import { Router } from 'express'
import db from '../database.js'
import http from 'http'
import https from 'https'

const router = Router()

// ── FastAPI config (sama dengan transactions.js) ──
const FASTAPI_URL = process.env.FASTAPI_URL || 'https://samuelgautama-finesse-ai-api.hf.space'
const FASTAPI_TIMEOUT_MS = 15000

const CLUSTER_TO_LIGA = {
  0: { id: 'gold',   label: 'Liga Gold',   icon: '🥇', color: '#F59E0B' },
  1: { id: 'silver', label: 'Liga Silver', icon: '🥈', color: '#94A3B8' },
  2: { id: 'bronze', label: 'Liga Bronze', icon: '🥉', color: '#B45309' },
  3: { id: 'iron',   label: 'Liga Iron',   icon: '⚙️', color: '#6B7280' },
}

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
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }
    req = protocol.request(options, res => {
      let responseText = ''
      res.on('data', chunk => responseText += chunk)
      res.on('end', () => {
        clearTimeout(timeoutId)
        if (res.statusCode < 200 || res.statusCode >= 300)
          return reject(new Error(`HTTP ${res.statusCode}: ${responseText}`))
        try { resolve(JSON.parse(responseText)) } catch (e) { reject(e) }
      })
    })
    req.on('error', err => { clearTimeout(timeoutId); reject(err) })
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
      if (!res.ok) throw new Error(`FastAPI ${path} returned ${res.status}`)
      return await res.json()
    } catch (err) {
      clearTimeout(timeoutId)
      console.warn(`[FastAPI users] fetch failed for ${path}, fallback ke node request`, err.message)
    }
  }
  return await requestFastAPIWithNode(url, body)
}

async function getLigaFromFastAPI(budget, totalSpent, txCount) {
  try {
    const data = await postFastAPI('/get-league', {
      monthly_budget: budget,
      total_spent: totalSpent,
      transaction_count: txCount
    })
    const payload = data?.data ?? data
    if (typeof payload?.cluster === 'number') return CLUSTER_TO_LIGA[payload.cluster] || CLUSTER_TO_LIGA[1]
    const leagueName = (payload?.league || payload?.user_league || payload?.role || '').toString().toLowerCase()
    return { gold: CLUSTER_TO_LIGA[0], silver: CLUSTER_TO_LIGA[1], bronze: CLUSTER_TO_LIGA[2], iron: CLUSTER_TO_LIGA[3] }[leagueName] || CLUSTER_TO_LIGA[1]
  } catch (err) {
    console.warn('[getLigaFromFastAPI] gagal:', err.message)
    return null
  }
}

// ── Konfigurasi Liga (4 liga sesuai K-Means cluster) ──
// Cluster 0 = Gold, 1 = Silver, 2 = Bronze, 3 = Iron
const LIGA_CONFIG = [
  { id: 'gold',   label: 'Liga Gold',   icon: '🥇', color: '#F59E0B' },
  { id: 'silver', label: 'Liga Silver', icon: '🥈', color: '#94A3B8' },
  { id: 'bronze', label: 'Liga Bronze', icon: '🥉', color: '#B45309' },
  { id: 'iron',   label: 'Liga Iron',   icon: '⚙️', color: '#6B7280' },
]

function getLigaById(ligaId) {
  return LIGA_CONFIG.find(l => l.id === ligaId) || LIGA_CONFIG[3]
}

// Fallback kalau K-Means belum dipanggil — pakai kolom liga dari DB user
function getLigaByUser(user) {
  return getLigaById(user?.liga || 'iron')
}

// ── GET /api/users/leaderboard/liga — Leaderboard per liga (3 besar tiap liga) ──
router.get('/leaderboard/liga', async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7)
  const currentUserId = parseInt(req.query.user_id || 1)

  try {
    // Ambil semua data leaderboard bulan ini
    const allRanks = await db.all(`
      SELECT l.user_id, l.name, l.exp, l.level, l.liga, l.month,
             u.name as display_name
      FROM leaderboard l
      LEFT JOIN users u ON l.user_id = u.id
      WHERE l.month = ?
      ORDER BY l.exp DESC
    `, [month])

    // Ambil data user saat ini
    const currentUser = await db.get('SELECT id, name, exp, level, liga FROM users WHERE id = ?', [currentUserId])

    // Tentukan liga user
    const userLiga = getLigaByUser(currentUser)

    // Kelompokkan per liga pakai kolom liga langsung
    const result = LIGA_CONFIG.map(liga => {
      const pemainLiga = allRanks.filter(r => r.liga === liga.id)

      const top10 = pemainLiga
        .sort((a, b) => b.exp - a.exp)
        .slice(0, 10)
        .map((r, idx) => ({
          rank: idx + 1,
          user_id: r.user_id,
          name: r.display_name || r.name,
          exp: r.exp,
          level: r.level,
          is_me: r.user_id === currentUserId
        }))

      const userDiLigaIni = liga.id === userLiga.id

      const userRankDiLiga = pemainLiga
        .sort((a, b) => b.exp - a.exp)
        .findIndex(r => r.user_id === currentUserId)

      return {
        liga_id: liga.id,
        liga_label: liga.label,
        liga_icon: liga.icon,
        liga_color: liga.color,
        is_user_liga: userDiLigaIni,
        user_rank_di_liga: userRankDiLiga >= 0 ? userRankDiLiga + 1 : null,
        total_members: pemainLiga.length,
        top10
      }
    })

    res.json({
      success: true,
      data: {
        liga_user: userLiga,
        leaderboard: result,
        user: currentUser ? {
          id: currentUser.id,
          name: currentUser.name,
          exp: currentUser.exp,
          level: currentUser.level,
          liga: userLiga
        } : null
      },
      month
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── GET /api/users/leaderboard/monthly — semua pemain bulan ini (legacy) ──
router.get('/leaderboard/monthly', async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7)
  try {
    const ranks = await db.all(`
      SELECT l.*, u.name as display_name
      FROM leaderboard l
      LEFT JOIN users u ON l.user_id = u.id
      WHERE l.month = ?
      ORDER BY l.exp DESC
      LIMIT 50
    `, [month])
    res.json({ success: true, data: ranks, month })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── POST /api/users/:id/sync-league — panggil model ML lalu update liga user ──
// Dipanggil dari frontend saat halaman Arena dibuka
router.post('/:id/sync-league', async (req, res) => {
  const userId = parseInt(req.params.id)
  const month = new Date().toISOString().slice(0, 7)
  try {
    const user = await db.get('SELECT id, name, exp, level, budget, liga FROM users WHERE id = ?', [userId])
    if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' })

    // Ambil total spent bulan ini dan jumlah transaksi
    const spendRow = await db.get(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as tx_count FROM transactions
       WHERE user_id = ? AND date LIKE ?`,
      [userId, `${month}%`]
    )
    const totalSpent = spendRow?.total || 0
    const txCount = spendRow?.tx_count || 0
    const budget = user.budget || 2000000

    // Panggil FastAPI /get-league
    const ligaBaru = await getLigaFromFastAPI(budget, totalSpent, txCount)

    if (!ligaBaru) {
      // FastAPI tidak bisa dihubungi — kembalikan liga yang tersimpan di DB
      const ligaConfig = CLUSTER_TO_LIGA
      const existing = Object.values(ligaConfig).find(l => l.id === user.liga) || CLUSTER_TO_LIGA[1]
      return res.json({
        success: true,
        message: 'FastAPI tidak aktif, menggunakan liga dari database',
        data: { liga: existing, updated: false }
      })
    }

    // Update users dan leaderboard
    await db.run('UPDATE users SET liga = ? WHERE id = ?', [ligaBaru.id, userId])
    await db.run(
      'UPDATE leaderboard SET liga = ? WHERE user_id = ? AND month = ?',
      [ligaBaru.id, userId, month]
    )
    // Kalau belum ada di leaderboard bulan ini, insert dulu
    const lb = await db.get('SELECT id FROM leaderboard WHERE user_id = ? AND month = ?', [userId, month])
    if (!lb) {
      await db.run(
        `INSERT INTO leaderboard (user_id, name, exp, level, liga, month) VALUES (?,?,?,?,?,?)`,
        [userId, user.name, user.exp, user.level, ligaBaru.id, month]
      )
    }

    console.log(`[sync-league] User ${userId} → ${ligaBaru.label} (spent: ${totalSpent}, txCount: ${txCount})`)
    res.json({
      success: true,
      message: `Liga diperbarui ke ${ligaBaru.label}`,
      data: { liga: ligaBaru, updated: true, total_spent: totalSpent, tx_count: txCount }
    })
  } catch (err) {
    console.error('[sync-league error]', err)
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── GET /api/users/:id ──
router.get('/:id', async (req, res) => {
  try {
    const user = await db.get(
      'SELECT id, name, email, level, exp, budget, liga, created_at FROM users WHERE id = ?',
      [req.params.id]
    )
    if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' })
    res.json({ success: true, data: user })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── PATCH /api/users/:id ──
router.patch('/:id', async (req, res) => {
  const { name, budget } = req.body
  try {
    await db.run(
      'UPDATE users SET name = COALESCE(?, name), budget = COALESCE(?, budget) WHERE id = ?',
      [name || null, budget || null, req.params.id]
    )
    res.json({ success: true, message: 'Profil diperbarui' })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

export default router
