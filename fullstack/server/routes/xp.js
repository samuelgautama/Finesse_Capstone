import { Router } from 'express'
import db from '../database.js'

const router = Router()

// GET /api/xp/history — riwayat XP user
router.get('/history', async (req, res) => {
  const userId = req.query.user_id || 1
  try {
    const history = await db.all(
      `SELECT 
        x.*,
        t.note as transaction_note
       FROM xp_history x
       LEFT JOIN transactions t ON x.transaction_id = t.id
       WHERE x.user_id = ?
       ORDER BY x.created_at DESC
       LIMIT 50`,
      [userId]
    )
    res.json({ success: true, data: history })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// GET /api/xp/summary — ringkasan XP user
router.get('/summary', async (req, res) => {
  const userId = req.query.user_id || 1
  try {
    const user = await db.get(
      'SELECT exp, level FROM users WHERE id = ?',
      [userId]
    )
    const currentLevel = await db.get(
      'SELECT * FROM levels WHERE level = ?',
      [user?.level || 1]
    )
    const nextLevel = await db.get(
      'SELECT * FROM levels WHERE level = ?',
      [(user?.level || 1) + 1]
    )
    const totalXP = await db.get(
      'SELECT COALESCE(SUM(xp_earned), 0) as total FROM xp_history WHERE user_id = ?',
      [userId]
    )
    const monthXP = await db.get(
      `SELECT COALESCE(SUM(xp_earned), 0) as total FROM xp_history 
       WHERE user_id = ? AND created_at >= date('now', 'start of month')`,
      [userId]
    )
    const topCategory = await db.get(
      `SELECT category, SUM(xp_earned) as total FROM xp_history 
       WHERE user_id = ? GROUP BY category ORDER BY total DESC LIMIT 1`,
      [userId]
    )

    res.json({
      success: true,
      data: {
        current_xp: user?.exp || 0,
        current_level: user?.level || 1,
        level_title: currentLevel?.title || 'Pemula',
        level_badge: currentLevel?.badge || '🥉',
        next_level_xp: nextLevel?.min_xp || 999999,
        xp_to_next: Math.max(0, (nextLevel?.min_xp || 999999) - (user?.exp || 0)),
        progress_pct: nextLevel
          ? Math.round(((user?.exp - currentLevel?.min_xp) / (nextLevel?.min_xp - currentLevel?.min_xp)) * 100)
          : 100,
        total_xp_earned: totalXP?.total || 0,
        xp_this_month: monthXP?.total || 0,
        top_category: topCategory?.category || '-'
      }
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// GET /api/xp/levels — semua level config
router.get('/levels', async (req, res) => {
  try {
    const levels = await db.all('SELECT * FROM levels ORDER BY level ASC')
    res.json({ success: true, data: levels })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

export default router
