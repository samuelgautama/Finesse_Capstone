import { Router } from 'express'
import db from '../database.js'
import http from 'http'
import https from 'https'

const router = Router()

// ── Kategori valid (harus sama persis dengan nama yang dipakai DL model) ──
const VALID_CATEGORIES = [
  'Makan & Minum',
  'Transportasi',
  'Hiburan & Nongkrong',
  'Kebutuhan Kuliah',
  'Tagihan & Kos'
]

const VALID_PAYMENT_METHODS = ['Cash', 'E-Wallet', 'Credit Card']

// ── Mapping Liga dari K-Means cluster ──
// Cluster 0 = Gold (hemat, terkontrol)
// Cluster 1 = Silver (normal, terkontrol)
// Cluster 2 = Bronze (agak boros)
// Cluster 3 = Iron (kritis, berantakan)
const CLUSTER_TO_LIGA = {
  0: { id: 'gold',   label: 'Liga Gold',   icon: '🥇', color: '#F59E0B' },
  1: { id: 'silver', label: 'Liga Silver', icon: '🥈', color: '#94A3B8' },
  2: { id: 'bronze', label: 'Liga Bronze', icon: '🥉', color: '#B45309' },
  3: { id: 'iron',   label: 'Liga Iron',   icon: '⚙️', color: '#6B7280' },
}

// ── HELPER: Hitung level dari XP ──
async function hitungLevel(xp) {
  const level = await db.get(
    'SELECT level, title, badge FROM levels WHERE min_xp <= ? AND max_xp >= ?',
    [xp, xp]
  )
  return level || { level: 1, title: 'Pemula', badge: '🥉' }
}

// ── HELPER: Susun fitur lengkap untuk DL model ──
// Node.js yang bertanggung jawab menghitung semua fitur ini
// sebelum dikirim ke FastAPI
async function buildDLFeatures(userId, amount, category, paymentMethod, date, budget) {
  const month = date.slice(0, 7)
  const txDate = new Date(date)
  const dayOfWeek = txDate.getDay()           // 0=Minggu, 6=Sabtu
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0
  const dayOfMonth = txDate.getDate()
  const isMonthEnd = dayOfMonth >= 25 ? 1 : 0

  // Ambil cumulative_spend bulan ini (sebelum transaksi ini)
  const cumRow = await db.get(
    `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
     WHERE user_id = ? AND date LIKE ?`,
    [userId, `${month}%`]
  )
  const cumulative_spend = (cumRow?.total || 0) + amount

  // Hitung rata-rata transaksi user (dari semua history)
  const avgRow = await db.get(
    `SELECT COALESCE(AVG(amount), 0) as avg_tx, COUNT(*) as tx_count
     FROM transactions WHERE user_id = ?`,
    [userId]
  )
  const user_avg_transaction = avgRow?.avg_tx || amount
  const transaction_count = (avgRow?.tx_count || 0) + 1

  // Rasio-rasio
  const transaction_to_budget_ratio = budget > 0 ? amount / budget : 0
  const budget_utilization_ratio = budget > 0 ? cumulative_spend / budget : 0
  const amount_vs_user_avg = user_avg_transaction > 0 ? amount / user_avg_transaction : 1

  // One-hot encoding kategori
  const catFeatures = {
    'category_Hiburan & Nongkrong': category === 'Hiburan & Nongkrong' ? 1 : 0,
    'category_Kebutuhan Kuliah':    category === 'Kebutuhan Kuliah'    ? 1 : 0,
    'category_Makan & Minum':       category === 'Makan & Minum'       ? 1 : 0,
    'category_Tagihan & Kos':       category === 'Tagihan & Kos'       ? 1 : 0,
    'category_Transportasi':        category === 'Transportasi'        ? 1 : 0,
  }

  // One-hot encoding payment method
  const pmFeatures = {
    'payment_method_Credit Card': paymentMethod === 'Credit Card' ? 1 : 0,
    'payment_method_E-Wallet':    paymentMethod === 'E-Wallet'    ? 1 : 0,
    // Cash adalah default (tidak perlu one-hot, tersirat kalau dua lainnya 0)
  }

  return {
    features: {
      amount,
      monthly_budget: budget,
      cumulative_spend,
      transaction_to_budget_ratio,
      budget_utilization_ratio,
      user_avg_transaction,
      amount_vs_user_avg,
      transaction_count,
      day_of_week: dayOfWeek,
      is_weekend: isWeekend,
      is_month_end: isMonthEnd,
      ...catFeatures,
      ...pmFeatures
    },
    // Data tambahan untuk keperluan internal (tidak dikirim ke DL)
    _meta: {
      cumulative_spend,
      user_avg_transaction,
      transaction_count,
      budget_utilization_ratio
    }
  }
}

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

async function predictEXP(dlFeatures) {
  try {
    const data = await postFastAPI('/calculate-exp', { features: dlFeatures.features })
    const payload = data?.data ?? data
    return {
      exp_awarded: payload?.exp_earned ?? payload?.exp_awarded ?? payload?.exp ?? 10,
      financial_health_score: payload?.financial_health_score ?? null
    }
  } catch (err) {
    const util = dlFeatures.features.budget_utilization_ratio || 0
    const fallbackExp = util <= 0.5 ? 20 : util <= 0.8 ? 15 : util <= 1.0 ? 10 : 5
    return { exp_awarded: fallbackExp, financial_health_score: null }
  }
}

async function predictLiga(meta, budget) {
  try {
    const data = await postFastAPI('/get-league', {
      monthly_budget: budget,
      total_spent: meta.cumulative_spend,
      transaction_count: meta.transaction_count
    })
    const payload = data?.data ?? data
    if (typeof payload?.cluster === 'number') {
      return CLUSTER_TO_LIGA[payload.cluster] || CLUSTER_TO_LIGA[1]
    }
    const leagueName = (payload?.league || payload?.user_league || payload?.role || payload?.cluster || '').toString().toLowerCase()
    const mapping = {
      gold: CLUSTER_TO_LIGA[0],
      silver: CLUSTER_TO_LIGA[1],
      bronze: CLUSTER_TO_LIGA[2],
      iron: CLUSTER_TO_LIGA[3]
    }
    return mapping[leagueName] || CLUSTER_TO_LIGA[1]
  } catch (err) {
    return null
  }
}

// ── GET /api/transactions ──
router.get('/', async (req, res) => {
  const userId = req.query.user_id || 1
  try {
    const transactions = await db.all(
      `SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    )
    res.json({ success: true, data: transactions })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── GET /api/transactions/:id ──
router.get('/:id', async (req, res) => {
  try {
    const tx = await db.get('SELECT * FROM transactions WHERE id = ?', [req.params.id])
    if (!tx) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' })
    res.json({ success: true, data: tx })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── POST /api/transactions ── FLOW UTAMA
router.post('/', async (req, res) => {
  const {
    user_id = 1,
    amount,
    category,
    payment_method = 'Cash',
    note,
    date
  } = req.body

  // Validasi input
  if (!amount || amount <= 0)
    return res.status(400).json({ success: false, message: 'Nominal harus lebih dari 0' })
  if (!category || !VALID_CATEGORIES.includes(category))
    return res.status(400).json({ success: false, message: `Kategori tidak valid. Pilih: ${VALID_CATEGORIES.join(', ')}` })
  if (!date)
    return res.status(400).json({ success: false, message: 'Tanggal wajib diisi' })
  if (!VALID_PAYMENT_METHODS.includes(payment_method))
    return res.status(400).json({ success: false, message: `Metode pembayaran tidak valid` })

  try {
    // 1. Ambil data user
    const user = await db.get('SELECT * FROM users WHERE id = ?', [user_id])
    const budget = user?.budget || 2000000
    const level_before = user?.level || 1
    const current_xp = user?.exp || 0

    // 2. Hitung semua fitur untuk DL
    const { features, _meta } = await buildDLFeatures(
      user_id, amount, category, payment_method, date, budget
    )

    // 3. Kirim ke FastAPI DL → dapat EXP
    const { exp_awarded, financial_health_score } = await predictEXP({ features })

    // 4. Simpan transaksi ke DB
    const txResult = await db.run(
      `INSERT INTO transactions
        (user_id, amount, category, payment_method, note, date, exp_earned, cumulative_spend)
       VALUES (?,?,?,?,?,?,?,?)`,
      [user_id, amount, category, payment_method, note || category, date, exp_awarded, _meta.cumulative_spend]
    )

    // 5. Update EXP user
    const new_xp = current_xp + exp_awarded
    const newLevel = await hitungLevel(new_xp)
    await db.run(
      'UPDATE users SET exp = ?, level = ? WHERE id = ?',
      [new_xp, newLevel.level, user_id]
    )

    // 6. Simpan ke xp_history
    await db.run(
      `INSERT INTO xp_history
        (user_id, transaction_id, amount, category, cumulative_spend,
         jumlah_kategori, xp_earned, level_before, level_after, reason)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [user_id, txResult.lastInsertRowid, amount, category,
       _meta.cumulative_spend, _meta.transaction_count,
       exp_awarded, level_before, newLevel.level,
       `+${exp_awarded} EXP dari transaksi ${category}`]
    )

    // 7. Update leaderboard
    const month = date.slice(0, 7)
    const existing = await db.get(
      'SELECT id FROM leaderboard WHERE user_id = ? AND month = ?',
      [user_id, month]
    )
    if (existing) {
      await db.run(
        'UPDATE leaderboard SET exp = exp + ?, level = ? WHERE user_id = ? AND month = ?',
        [exp_awarded, newLevel.level, user_id, month]
      )
    }

    // 8. Cek apakah perlu update liga (tiap 5 transaksi atau naik level)
    const ligaBaru = (_meta.transaction_count % 5 === 0 || newLevel.level > level_before)
      ? await predictLiga(_meta, budget)
      : null

    if (ligaBaru) {
      // Update liga di tabel users
      await db.run('UPDATE users SET liga = ? WHERE id = ?', [ligaBaru.id, user_id])
      // Sync liga ke leaderboard bulan ini juga — supaya halaman Arena langsung reflect
      await db.run(
        'UPDATE leaderboard SET liga = ? WHERE user_id = ? AND month = ?',
        [ligaBaru.id, user_id, month]
      )
      console.log(`[Liga Update] User ${user_id} → ${ligaBaru.label}`)
    }

    // 9. Response lengkap ke frontend
    res.status(201).json({
      success: true,
      message: 'Transaksi berhasil disimpan',
      data: {
        transaction_id: txResult.lastInsertRowid,
        amount,
        category,
        payment_method,
        cumulative_spend: _meta.cumulative_spend,
        financial_health_score,
        exp_awarded,
        level_before,
        level_after: newLevel.level,
        level_title: newLevel.title,
        level_badge: newLevel.badge,
        total_xp: new_xp,
        level_up: newLevel.level > level_before,
        liga_baru: ligaBaru
      }
    })
  } catch (err) {
    console.error('[POST /transactions]', err)
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── DELETE /api/transactions/:id ──
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.run('DELETE FROM transactions WHERE id = ?', [req.params.id])
    if (result.changes === 0)
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' })
    res.json({ success: true, message: 'Transaksi dihapus' })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

export default router
