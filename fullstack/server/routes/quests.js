import { Router } from 'express'
import db from '../database.js'
import http from 'http'
import https from 'https'

const router = Router()

// ── Normalisasi quest_type dari AI (bisa free text) → key internal ──
function normalizeQuestType(raw) {
  if (!raw) return 'hemat_total'
  const s = raw.toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // hapus aksen
    .replace(/[^a-z0-9\s,]/g, '').trim()

  // Mapping kata kunci → quest_type internal
  if (/hemat.*(total|mingg|bulan)|total.*(hemat|belanja|pengeluaran)|disiplin/i.test(raw)) return 'hemat_total'
  if (/harian|hari.ini|sehari|daily/i.test(raw)) return 'batas_harian'
  if (/frekuensi|berapa.?kali|kali|batasi.*x|batas.*kali|x.kali|count/i.test(raw)) return 'batas_frekuensi'
  if (/kategori|category|jenis|khusus/i.test(raw)) return 'batas_kategori'
  // Fallback by keyword count
  if (s.includes('hemat') || s.includes('total') || s.includes('minggu')) return 'hemat_total'
  if (s.includes('hari') || s.includes('harian')) return 'batas_harian'
  if (s.includes('frekuensi') || s.includes('kali')) return 'batas_frekuensi'
  if (s.includes('kategori')) return 'batas_kategori'
  return 'hemat_total' // default paling aman
}

// ── Normalisasi difficulty dari AI → key internal ──
function normalizeDifficulty(raw) {
  if (!raw) return 'medium'
  const s = raw.toString().toLowerCase()
  if (/mudah|easy|gampang|ringan|simple/i.test(s)) return 'easy'
  if (/susah|hard|sulit|berat|difficult/i.test(s)) return 'hard'
  return 'medium'
}

// ── HELPER: Verifikasi misi berdasarkan tipe ──
async function verifikasiMisi(quest, userId) {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)

  const startDate = quest.start_date || (() => {
    const d = new Date(now); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10)
  })()
  const deadline = quest.deadline && quest.deadline >= startDate ? quest.deadline : today
  const effectiveStart = startDate <= deadline ? startDate : deadline

  // Normalisasi quest_type dari DB kalau-kalau tersimpan dalam format lama/free text
  const questType = normalizeQuestType(quest.quest_type)
  console.log(`[verifikasi] quest #${quest.id} type="${quest.quest_type}" → normalized="${questType}"`)

  switch (questType) {

    // Tipe: hemat total — total pengeluaran di bawah target dalam periode
    case 'hemat_total': {
      const row = await db.get(
        `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
         WHERE user_id = ? AND date >= ? AND date <= ?`,
        [userId, effectiveStart, deadline]
      )
      const totalSpend = row?.total || 0
      const target = quest.target_amount || 0
      const lolos = totalSpend <= target
      return {
        lolos,
        detail: `Total pengeluaran Rp ${totalSpend.toLocaleString('id-ID')} dari batas Rp ${target.toLocaleString('id-ID')} (${effectiveStart} s/d ${deadline})`,
        actual: totalSpend
      }
    }

    // Tipe: batas harian — pengeluaran HARI INI tidak melebihi target
    // (selalu cek hari ini, bukan hari deadline yang mungkin sudah lewat)
    case 'batas_harian': {
      const row = await db.get(
        `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
         WHERE user_id = ? AND date = ?`,
        [userId, today]
      )
      const totalHari = row?.total || 0
      const target = quest.target_amount || 0
      const lolos = totalHari <= target
      return {
        lolos,
        detail: `Pengeluaran hari ini (${today}): Rp ${totalHari.toLocaleString('id-ID')} dari batas Rp ${target.toLocaleString('id-ID')}`,
        actual: totalHari
      }
    }

    // Tipe: batas frekuensi — jumlah transaksi kategori tertentu tidak melebihi target
    case 'batas_frekuensi': {
      const row = await db.get(
        `SELECT COUNT(*) as jumlah FROM transactions
         WHERE user_id = ? AND category = ? AND date >= ? AND date <= ?`,
        [userId, quest.target_category, effectiveStart, today]
      )
      const jumlah = row?.jumlah || 0
      const target = quest.target_count || 3
      const hangus = jumlah > target
      const lolos = !hangus
      return {
        lolos,
        hangus,
        detail: `Transaksi ${quest.target_category}: ${jumlah}x dari batas ${target}x (sejak ${effectiveStart})`,
        actual: jumlah
      }
    }

    // Tipe: batas kategori — total pengeluaran kategori tertentu tidak melebihi target
    case 'batas_kategori': {
      const row = await db.get(
        `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
         WHERE user_id = ? AND category = ? AND date >= ? AND date <= ?`,
        [userId, quest.target_category, effectiveStart, deadline]
      )
      const totalKat = row?.total || 0
      const target = quest.target_amount || 0
      const lolos = totalKat <= target
      return {
        lolos,
        detail: `Total ${quest.target_category}: Rp ${totalKat.toLocaleString('id-ID')} dari batas Rp ${target.toLocaleString('id-ID')} (${effectiveStart} s/d ${deadline})`,
        actual: totalKat
      }
    }

    // Fallback — tipe tidak dikenal, anggap hemat_total dari start s/d hari ini
    default: {
      console.warn(`[verifikasi] quest_type tidak dikenal: "${quest.quest_type}", fallback ke hemat_total`)
      const row = await db.get(
        `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
         WHERE user_id = ? AND date >= ? AND date <= ?`,
        [userId, effectiveStart, today]
      )
      const totalSpend = row?.total || 0
      const target = quest.target_amount || 999999999 // kalau target null, selalu lolos
      const lolos = totalSpend <= target
      return {
        lolos,
        detail: `Total pengeluaran Rp ${totalSpend.toLocaleString('id-ID')}${target < 999999999 ? ` dari batas Rp ${target.toLocaleString('id-ID')}` : ''} (${effectiveStart} s/d ${today})`,
        actual: totalSpend
      }
    }
  }
}

// ── FastAPI mission generator ──
const FASTAPI_URL = process.env.FASTAPI_URL || 'https://samuelgautama-finesse-ai-api.hf.space'
const FASTAPI_TIMEOUT_MS = 15000

function requestFastAPIWithNode(url, body) {
  return new Promise((resolve, reject) => {
    let req
    const protocol = url.protocol === 'https:' ? https : http
    const timeoutId = setTimeout(() => {
      if (req) req.destroy(new Error('HTTP request timeout'))
    }, FASTAPI_TIMEOUT_MS)

    const options = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }

    req = protocol.request(options, res => {
      let responseText = ''
      res.on('data', chunk => responseText += chunk)
      res.on('end', () => {
        clearTimeout(timeoutId)
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode}: ${responseText}`))
        }
        try {
          resolve(JSON.parse(responseText))
        } catch (parseErr) {
          reject(parseErr)
        }
      })
    })

    req.on('error', err => {
      clearTimeout(timeoutId)
      reject(err)
    })

    req.write(body)
    req.end()
  })
}

async function postFastAPI(path, payload) {
  const body = JSON.stringify(payload)
  const url = new URL(`${FASTAPI_URL}${path}`)

  if (typeof fetch === 'function') {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FASTAPI_TIMEOUT_MS)
    try {
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      if (!res.ok) {
        const bodyText = await res.text().catch(() => '')
        throw new Error(`FastAPI ${path} returned ${res.status} ${bodyText}`)
      }
      return await res.json()
    } catch (err) {
      clearTimeout(timeoutId)
      console.warn(`[FastAPI] fetch failed for ${path}, falling back to node request (${url.protocol})`, err.message)
    }
  }

  return await requestFastAPIWithNode(url, body)
}

// ── Tentukan target_* dan deadline dari Node.js berdasarkan quest_type ──
// AI hanya kasih: title, description, reason, quest_type, difficulty, exp_reward
// Node.js yang tentukan angka targetnya berdasarkan data real user
function buildTargetFromType(questType, transactions, user, now) {
  const budget = user?.budget || 2000000
  const today = now.toISOString().slice(0, 10)

  // Deadline 7 hari ke depan untuk misi mingguan
  const deadline7 = (() => {
    const d = new Date(now); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10)
  })()

  // Hitung rata-rata harian dari budget
  const targetHarian = Math.round(budget / 30 / 1000) * 1000

  // Kategori paling sering/boros dari transaksi
  const topCategory = transactions.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount; return acc
  }, {})
  const borosKategori = Object.entries(topCategory).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Makan & Minum'

  // Total spent bulan ini
  const thisMonth = now.toISOString().slice(0, 7)
  const totalBulanIni = transactions
    .filter(t => t.date && t.date.startsWith(thisMonth))
    .reduce((sum, t) => sum + t.amount, 0)
  const sisaBudget = Math.max(budget - totalBulanIni, 0)

  switch (questType) {
    case 'hemat_total':
      return { target_amount: Math.min(sisaBudget, targetHarian * 5), target_category: null, target_count: null, deadline: deadline7 }
    case 'batas_harian':
      return { target_amount: targetHarian, target_category: null, target_count: null, deadline: today }
    case 'batas_frekuensi':
      return { target_amount: null, target_category: borosKategori, target_count: 3, deadline: deadline7 }
    case 'batas_kategori':
      return { target_amount: Math.round(targetHarian * 3 / 1000) * 1000, target_category: borosKategori, target_count: null, deadline: deadline7 }
    default:
      return { target_amount: targetHarian * 5, target_category: null, target_count: null, deadline: deadline7 }
  }
}

async function generateMisiDariFastAPI(userId, transactions, user) {
  const now = new Date()
  const defaultDate = now.toISOString().slice(0, 10)
  const lastTx = transactions[0] || { category: 'Lainnya', amount: 0, date: defaultDate, exp_earned: 0 }
  const totalSpent = transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0)
  const isWeekend = [0, 6].includes(new Date(lastTx.date || defaultDate).getDay()) ? 1 : 0
  const isMonthEnd = (new Date(lastTx.date || defaultDate).getDate() >= 25) ? 1 : 0
  const remainingBudget = Math.max((user?.budget || 2000000) - totalSpent, 0)
  const payload = {
    kategori_aktif: lastTx.category || 'Lainnya',
    amount: lastTx.amount || 0,
    sisa_anggaran: remainingBudget,
    is_weekend: isWeekend,
    is_month_end: isMonthEnd,
    exp_earned: lastTx.exp_earned || 0,
    user_league: user?.liga || user?.league || 'Silver'
  }

  try {
    const data = await postFastAPI('/generate-missions', payload)
    const payloadData = data?.data ?? data

    // Ambil list misi dari berbagai kemungkinan struktur response
    let rawMissions = []
    if (Array.isArray(payloadData?.dynamic_missions)) rawMissions = payloadData.dynamic_missions
    else if (Array.isArray(payloadData?.quests)) rawMissions = payloadData.quests
    else if (Array.isArray(data)) rawMissions = data

    if (rawMissions.length === 0) return []

    // ── Hanya ambil 6 field dari AI, target_* ditentukan Node.js ──
    return rawMissions.map(m => {
      const questType = normalizeQuestType(m.quest_type || m.type || '')
      const difficulty = normalizeDifficulty(m.kesulitan || m.difficulty || '')
      const targets = buildTargetFromType(questType, transactions, user, now)
      console.log(`[generateMisi] AI quest_type="${m.quest_type}" → "${questType}", difficulty="${m.difficulty||m.kesulitan}" → "${difficulty}"`)
      return {
        title:       m.title || m.judul || m.name || 'Misi Baru',
        description: m.description || m.deskripsi || m.desc || '',
        reason:      m.reason || m.alasan || 'Misi ini dibuat berdasarkan pola transaksimu.',
        quest_type:  questType,
        difficulty,
        exp_reward:  parseInt(m.exp_reward || m.exp_earned || 100),
        ...targets
      }
    })
  } catch (err) {
    console.warn('[generateMisi] FastAPI tidak aktif, pakai mock:', err.message)

    const weekEnd = new Date(now)
    weekEnd.setDate(now.getDate() + 7)
    const deadline7 = weekEnd.toISOString().slice(0, 10)

    const topCategory = transactions.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount
      return acc
    }, {})
    const borosKategori = Object.entries(topCategory).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Hiburan & Nongkrong'
    const budget = user?.budget || 2000000
    const targetHarian = Math.round(budget / 30 / 1000) * 1000

    return [
      {
        title: `Hemat minggu ini di bawah Rp ${(targetHarian * 5).toLocaleString('id-ID')}`,
        description: `Jaga total pengeluaranmu dalam 7 hari ke depan agar tidak melebihi Rp ${(targetHarian * 5).toLocaleString('id-ID')}. Ini akan membentuk kebiasaan hemat yang konsisten.`,
        reason: `AI mendeteksi rata-rata pengeluaran harianmu cukup tinggi. Misi ini dirancang untuk melatih disiplin mingguan.`,
        quest_type: 'hemat_total',
        target_amount: targetHarian * 5,
        target_category: null,
        target_count: null,
        deadline: deadline7,
        difficulty: 'medium',
        exp_reward: 300
      },
      {
        title: `Jangan habiskan lebih dari Rp ${targetHarian.toLocaleString('id-ID')} hari ini`,
        description: `Total pengeluaran hari ini harus di bawah Rp ${targetHarian.toLocaleString('id-ID')}. Kamu perlu bijak memilih prioritas pengeluaran.`,
        reason: `Berdasarkan pola transaksi harianmu, AI menyarankan batas harian yang realistis untuk budgetmu.`,
        quest_type: 'batas_harian',
        target_amount: targetHarian,
        target_category: null,
        target_count: null,
        deadline: defaultDate,
        difficulty: 'easy',
        exp_reward: 150
      },
      {
        title: `Batasi ${borosKategori} maksimal 3x minggu ini`,
        description: `Transaksi kategori ${borosKategori} tidak boleh lebih dari 3 kali dalam 7 hari ke depan. Jika melebihi, misi otomatis hangus!`,
        reason: `AI mendeteksi ${borosKategori} adalah kategori dengan pengeluaran terbesar bulanmu. Kurangi frekuensinya!`,
        quest_type: 'batas_frekuensi',
        target_amount: null,
        target_category: borosKategori,
        target_count: 3,
        deadline: deadline7,
        difficulty: 'hard',
        exp_reward: 500
      }
    ]
  }
}

// ── GET /api/quests ──
router.get('/', async (req, res) => {
  const userId = req.query.user_id || 1
  try {
    const quests = await db.all(
      `SELECT * FROM quests WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    )
    res.json({ success: true, data: quests })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── GET /api/quests/token-status — cek sisa token hari ini ──
router.get('/token-status', async (req, res) => {
  const userId = req.query.user_id || 1
  try {
    const user = await db.get('SELECT quest_token_used, quest_token_date FROM users WHERE id = ?', [userId])
    const today = new Date().toISOString().slice(0, 10)
    const sudahPakai = user?.quest_token_date === today && user?.quest_token_used === 1
    res.json({
      success: true,
      data: {
        token_tersedia: !sudahPakai,
        reset_jam: '00:00 tengah malam',
        pesan: sudahPakai
          ? 'Token harian sudah digunakan. Kembali lagi besok!'
          : 'Kamu punya 1 token untuk generate misi hari ini!'
      }
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── POST /api/quests/generate — generate misi baru (1x per hari) ──
router.post('/generate', async (req, res) => {
  const { user_id = 1 } = req.body
  const today = new Date().toISOString().slice(0, 10)
  try {
    // Cek token harian
    const user = await db.get('SELECT * FROM users WHERE id = ?', [user_id])
    if (user?.quest_token_date === today && user?.quest_token_used === 1) {
      return res.status(429).json({
        success: false,
        message: 'Token harian sudah digunakan! Kembali lagi besok pukul 00:00.',
        data: { token_tersedia: false }
      })
    }

    // Ambil data transaksi untuk dikirim ke FastAPI
    const transactions = await db.all(
      `SELECT category, amount, date, exp_earned FROM transactions
       WHERE user_id = ? ORDER BY created_at DESC LIMIT 30`,
      [user_id]
    )

    // Minta misi dari FastAPI (atau mock kalau belum aktif)
    const misiList = await generateMisiDariFastAPI(user_id, transactions, user)

    // Hapus misi aktif lama (bersihkan slate)
    await db.run(
      `DELETE FROM quests WHERE user_id = ? AND status = 'active'`,
      [user_id]
    )

    // Simpan misi baru ke DB
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    const startDate = weekStart.toISOString().slice(0, 10)

    const savedQuests = []
    for (const misi of misiList) {
      const result = await db.run(
        `INSERT INTO quests
          (user_id, title, description, reason, progress, total, exp_reward, status,
           quest_type, target_amount, target_category, target_count, deadline, difficulty, start_date)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          user_id,
          misi.title,
          misi.description || '',
          misi.reason || '',
          0,
          1,
          misi.exp_reward || 100,
          'active',
          normalizeQuestType(misi.quest_type || 'hemat_total'),
          misi.target_amount || null,
          misi.target_category || null,
          misi.target_count || null,
          misi.deadline || today,
          normalizeDifficulty(misi.difficulty || 'medium'),
          startDate
        ]
      )
      savedQuests.push({ id: result.lastInsertRowid, ...misi })
    }

    // Tandai token sudah dipakai
    await db.run(
      'UPDATE users SET quest_token_used = 1, quest_token_date = ? WHERE id = ?',
      [today, user_id]
    )

    res.status(201).json({
      success: true,
      message: `${savedQuests.length} misi baru berhasil digenerate!`,
      data: { quests: savedQuests, token_tersedia: false }
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── POST /api/quests/:id/selesaikan — verifikasi + klaim misi ──
router.post('/:id/selesaikan', async (req, res) => {
  const user_id = parseInt(req.body?.user_id || req.query?.user_id || 1)
  const questId = parseInt(req.params.id)

  try {
    const quest = await db.get('SELECT * FROM quests WHERE id = ?', [questId])
    if (!quest) return res.status(404).json({ success: false, message: 'Misi tidak ditemukan' })
    if (quest.status === 'claimed') return res.status(400).json({ success: false, message: 'Misi sudah diklaim sebelumnya!' })
    if (quest.status === 'hangus') return res.status(400).json({ success: false, message: 'Misi ini sudah hangus.' })

    // Normalisasi quest_type kalau masih free text (dari AI lama)
    const normalizedType = normalizeQuestType(quest.quest_type)
    const normalizedDiff = normalizeDifficulty(quest.difficulty)
    if (normalizedType !== quest.quest_type || normalizedDiff !== quest.difficulty) {
      await db.run(
        'UPDATE quests SET quest_type = ?, difficulty = ? WHERE id = ?',
        [normalizedType, normalizedDiff, questId]
      )
      quest.quest_type = normalizedType
      quest.difficulty = normalizedDiff
      console.log(`[selesaikan] Normalized quest #${questId}: type="${normalizedType}", diff="${normalizedDiff}"`)
    }

    // Verifikasi kondisi misi
    const hasil = await verifikasiMisi(quest, user_id)

    // Kalau hangus (khusus batas_frekuensi yang kelewatan)
    if (hasil.hangus) {
      await db.run(`UPDATE quests SET status = 'hangus' WHERE id = ?`, [questId])
      return res.status(400).json({
        success: false,
        hangus: true,
        message: '💀 Misi hangus! Kamu melewati batas yang ditentukan.',
        detail: hasil.detail
      })
    }

    // Kalau belum lolos
    if (!hasil.lolos) {
      return res.status(400).json({
        success: false,
        message: '⚠️ Misi belum selesai! Kondisi belum terpenuhi.',
        detail: hasil.detail
      })
    }

    // ── Lolos → klaim EXP ──

    // 1. Tandai quest sebagai claimed
    await db.run(`UPDATE quests SET status = 'claimed', progress = 1 WHERE id = ?`, [questId])

    // 2. Ambil data user TERBARU dari DB
    const user = await db.get('SELECT id, exp, level FROM users WHERE id = ?', [user_id])
    if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' })

    const oldExp = user.exp || 0
    const oldLevel = user.level || 1
    const newExp = oldExp + quest.exp_reward

    // 3. Cari level baru berdasarkan total EXP
    const newLevel = await db.get(
      'SELECT level, title, badge FROM levels WHERE min_xp <= ? AND max_xp >= ?',
      [newExp, newExp]
    )
    const finalLevel = newLevel?.level || oldLevel

    // 4. Update EXP dan level user ke DB
    await db.run(
      'UPDATE users SET exp = ?, level = ? WHERE id = ?',
      [newExp, finalLevel, user_id]
    )

    // 5. Update leaderboard bulan ini
    const month = new Date().toISOString().slice(0, 7)
    const lb = await db.get('SELECT id FROM leaderboard WHERE user_id = ? AND month = ?', [user_id, month])
    if (lb) {
      await db.run(
        'UPDATE leaderboard SET exp = exp + ?, level = ? WHERE user_id = ? AND month = ?',
        [quest.exp_reward, finalLevel, user_id, month]
      )
    }

    // 6. Verifikasi hasil update (untuk debugging)
    const updatedUser = await db.get('SELECT exp, level FROM users WHERE id = ?', [user_id])
    console.log(`[Quest Claim] User ${user_id}: ${oldExp} → ${updatedUser.exp} EXP (+${quest.exp_reward})`)

    res.json({
      success: true,
      message: `🎉 Misi selesai! +${quest.exp_reward} EXP`,
      detail: hasil.detail,
      data: {
        exp_earned: quest.exp_reward,
        exp_sebelum: oldExp,
        total_exp: updatedUser.exp,
        level_before: oldLevel,
        level_after: finalLevel,
        level_up: finalLevel > oldLevel,
        level_title: newLevel?.title,
        level_badge: newLevel?.badge
      }
    })
  } catch (err) {
    console.error('[Quest Claim Error]', err)
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── GET /api/quests/:id ──
router.get('/:id', async (req, res) => {
  try {
    const quest = await db.get('SELECT * FROM quests WHERE id = ?', [req.params.id])
    if (!quest) return res.status(404).json({ success: false, message: 'Quest tidak ditemukan' })
    res.json({ success: true, data: quest })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── DELETE /api/quests/:id ──
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.run('DELETE FROM quests WHERE id = ?', [req.params.id])
    if (result.changes === 0) return res.status(404).json({ success: false, message: 'Quest tidak ditemukan' })
    res.json({ success: true, message: 'Quest dihapus' })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

export default router
