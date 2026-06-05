import sqlite3pkg from 'sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const { Database } = sqlite3pkg.verbose()
const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, 'finesse.db')
const db = new Database(DB_PATH)

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) reject(err)
    else resolve({ lastInsertRowid: this.lastID, changes: this.changes })
  })
})
const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => { if (err) reject(err); else resolve(row) })
})
const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows) })
})

// ── TABEL USERS ──
await run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  level INTEGER DEFAULT 1,
  exp INTEGER DEFAULT 0,
  budget INTEGER DEFAULT 2000000,
  liga TEXT DEFAULT 'iron',
  quest_token_used INTEGER DEFAULT 0,
  quest_token_date TEXT DEFAULT NULL,
  created_at TEXT DEFAULT (datetime('now'))
)`)

// Migrasi kolom baru
try { await run(`ALTER TABLE users ADD COLUMN quest_token_used INTEGER DEFAULT 0`) } catch {}
try { await run(`ALTER TABLE users ADD COLUMN quest_token_date TEXT DEFAULT NULL`) } catch {}
try { await run(`ALTER TABLE users ADD COLUMN liga TEXT DEFAULT 'iron'`) } catch {}

// ── TABEL TRANSACTIONS ──
await run(`CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  category TEXT NOT NULL,
  payment_method TEXT DEFAULT 'Cash',
  note TEXT,
  date TEXT NOT NULL,
  exp_earned INTEGER DEFAULT 0,
  cumulative_spend INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
)`)

// Migrasi kolom payment_method
try { await run(`ALTER TABLE transactions ADD COLUMN payment_method TEXT DEFAULT 'Cash'`) } catch {}

// ── TABEL QUESTS (dengan kolom sistem misi baru) ──
await run(`CREATE TABLE IF NOT EXISTS quests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  reason TEXT,
  progress INTEGER DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 1,
  exp_reward INTEGER DEFAULT 100,
  status TEXT DEFAULT 'active',
  quest_type TEXT DEFAULT 'hemat_total',
  target_amount INTEGER DEFAULT NULL,
  target_category TEXT DEFAULT NULL,
  target_count INTEGER DEFAULT NULL,
  deadline TEXT DEFAULT NULL,
  difficulty TEXT DEFAULT 'medium',
  start_date TEXT DEFAULT NULL,
  created_at TEXT DEFAULT (datetime('now'))
)`)

// Migrasi kolom baru ke tabel quests yang sudah ada
try { await run(`ALTER TABLE quests ADD COLUMN quest_type TEXT DEFAULT 'hemat_total'`) } catch {}
try { await run(`ALTER TABLE quests ADD COLUMN target_amount INTEGER DEFAULT NULL`) } catch {}
try { await run(`ALTER TABLE quests ADD COLUMN target_category TEXT DEFAULT NULL`) } catch {}
try { await run(`ALTER TABLE quests ADD COLUMN target_count INTEGER DEFAULT NULL`) } catch {}
try { await run(`ALTER TABLE quests ADD COLUMN deadline TEXT DEFAULT NULL`) } catch {}
try { await run(`ALTER TABLE quests ADD COLUMN difficulty TEXT DEFAULT 'medium'`) } catch {}
try { await run(`ALTER TABLE quests ADD COLUMN start_date TEXT DEFAULT NULL`) } catch {}

// ── TABEL LEADERBOARD ──
await run(`CREATE TABLE IF NOT EXISTS leaderboard (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  exp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  liga TEXT DEFAULT 'iron',
  month TEXT NOT NULL
)`)

// Migrasi kolom liga ke leaderboard yang sudah ada
try { await run(`ALTER TABLE leaderboard ADD COLUMN liga TEXT DEFAULT 'iron'`) } catch {}

// ── TABEL XP HISTORY ──
await run(`CREATE TABLE IF NOT EXISTS xp_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  transaction_id INTEGER,
  amount INTEGER NOT NULL,
  category TEXT NOT NULL,
  cumulative_spend INTEGER DEFAULT 0,
  jumlah_kategori INTEGER DEFAULT 1,
  xp_earned INTEGER NOT NULL,
  level_before INTEGER NOT NULL,
  level_after INTEGER NOT NULL,
  reason TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)`)

// ── TABEL LEVELS ──
await run(`CREATE TABLE IF NOT EXISTS levels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level INTEGER UNIQUE NOT NULL,
  min_xp INTEGER NOT NULL,
  max_xp INTEGER NOT NULL,
  title TEXT NOT NULL,
  badge TEXT NOT NULL
)`)

// ── SEED LEVELS ──
const levelCount = await get('SELECT COUNT(*) as count FROM levels')
if (levelCount.count === 0) {
  const levelData = [
    [1, 0, 199, 'Pemula', '🥉'],
    [2, 200, 499, 'Hemat Muda', '🥉'],
    [3, 500, 899, 'Penabung', '🥈'],
    [4, 900, 1399, 'Bijak Belanja', '🥈'],
    [5, 1400, 1999, 'Finansial Pro', '🥇'],
    [6, 2000, 2799, 'Money Master', '🥇'],
    [7, 2800, 3799, 'Liga Silver', '⭐'],
    [8, 3800, 4999, 'Liga Gold', '🌟'],
    [9, 5000, 6499, 'Liga Platinum', '💎'],
    [10, 6500, 999999, 'Financial Legend', '👑'],
  ]
  for (const [level, min_xp, max_xp, title, badge] of levelData) {
    await run(`INSERT INTO levels (level, min_xp, max_xp, title, badge) VALUES (?,?,?,?,?)`,
      [level, min_xp, max_xp, title, badge])
  }
  console.log('✅ Levels seeded')
}

// ── SEED USERS & DATA ──
// ── SEED USERS & TRANSAKSI (hanya kalau DB baru) ──
const userCount = await get('SELECT COUNT(*) as count FROM users')
if (userCount.count === 0) {
  await run(`INSERT INTO users (name, email, password, level, exp, budget, liga) VALUES (?,?,?,?,?,?,?)`,
    ['Budi Santoso', 'budi@email.com', 'password123', 4, 3200, 2000000, 'gold'])

  const txList = [
    [1, 25000, 'Makan & Minum',       'Makan siang warteg', '2026-06-01', 15, 25000],
    [1, 15000, 'Transportasi',         'Angkot kampus',      '2026-06-01', 18, 40000],
    [1, 50000, 'Hiburan & Nongkrong', 'Nonton bioskop',     '2026-06-02', 10, 90000],
    [1, 80000, 'Kebutuhan Kuliah',    'Beli buku kuliah',   '2026-06-02',  8, 170000],
    [1, 32000, 'Makan & Minum',       'Kopi kekinian',      '2026-06-03', 12, 202000],
    [1, 18000, 'Transportasi',         'Grab ke kampus',     '2026-06-03', 16, 220000],
  ]
  for (const [uid, amt, cat, note, date, xp, cum] of txList) {
    const res = await run(
      `INSERT INTO transactions (user_id, amount, category, note, date, exp_earned, cumulative_spend) VALUES (?,?,?,?,?,?,?)`,
      [uid, amt, cat, note, date, xp, cum]
    )
    await run(
      `INSERT INTO xp_history (user_id, transaction_id, amount, category, cumulative_spend, jumlah_kategori, xp_earned, level_before, level_after, reason) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [uid, res.lastInsertRowid, amt, cat, cum, 1, xp, 4, 4, `Transaksi ${cat}`]
    )
  }
  console.log('✅ User & transaksi demo seeded')
}

// ── SEED NPC LEADERBOARD (selalu sync — hapus NPC lama lalu insert ulang) ──
// Pakai user_id = 0 sebagai penanda NPC
const npcCount = await get('SELECT COUNT(*) as count FROM leaderboard WHERE user_id = 0')
if (npcCount.count === 0) {
  const month = new Date().toISOString().slice(0, 7)

  // Seed user Budi ke leaderboard juga kalau belum ada
  const budiLb = await get('SELECT id FROM leaderboard WHERE user_id = 1 AND month = ?', [month])
  if (!budiLb) {
    await run(`INSERT INTO leaderboard (user_id, name, exp, level, liga, month) VALUES (?,?,?,?,?,?)`,
      [1, 'Budi Santoso', 3200, 4, 'gold', month])
  }

  // ── Liga Gold (Cluster 0: hemat, terkontrol) ──
  const npcGold = [
    ['Arief Wibowo',    4800, 4, 'gold'],
    ['Nadia Putri',     4500, 4, 'gold'],
    ['Hendra Gunawan',  4200, 4, 'gold'],
    ['Lestari Dewi',    4000, 4, 'gold'],
    ['Bagas Prasetyo',  3900, 4, 'gold'],
    ['Cindy Maharani',  3700, 4, 'gold'],
    ['Fajar Nugroho',   3600, 4, 'gold'],
    ['Indah Sari',      3400, 4, 'gold'],
    ['Kevin Santoso',   3300, 4, 'gold'],
    ['Maya Kusuma',     3100, 4, 'gold'],
  ]

  // ── Liga Silver (Cluster 1: normal, terkontrol) ──
  const npcSilver = [
    ['Andi Kurnia',     2700, 3, 'silver'],
    ['Siti Rahayu',     2500, 3, 'silver'],
    ['Dian Pratama',    2300, 3, 'silver'],
    ['Rizky Maulana',   2100, 3, 'silver'],
    ['Putri Handayani', 2000, 3, 'silver'],
    ['Galih Saputra',   1900, 3, 'silver'],
    ['Wulan Sari',      1800, 3, 'silver'],
    ['Taufik Rahman',   1700, 3, 'silver'],
    ['Ayu Fitriani',    1600, 3, 'silver'],
    ['Doni Setiawan',   1500, 3, 'silver'],
  ]

  // ── Liga Bronze (Cluster 2: agak boros) ──
  const npcBronze = [
    ['Yudi Hermawan',   1300, 2, 'bronze'],
    ['Rina Oktavia',    1200, 2, 'bronze'],
    ['Bimo Cahyono',    1100, 2, 'bronze'],
    ['Siska Amelia',    1000, 2, 'bronze'],
    ['Wahyu Hidayat',    900, 2, 'bronze'],
    ['Fitri Rahayu',     800, 2, 'bronze'],
    ['Agung Prabowo',    750, 2, 'bronze'],
    ['Laila Nurul',      700, 2, 'bronze'],
    ['Rendi Kurniawan',  650, 2, 'bronze'],
    ['Tina Agustin',     550, 2, 'bronze'],
  ]

  // ── Liga Iron (Cluster 3: kritis, berantakan) ──
  const npcIron = [
    ['Hadi Susanto',     450, 1, 'iron'],
    ['Novi Anggraini',   400, 1, 'iron'],
    ['Eko Prasetya',     350, 1, 'iron'],
    ['Dewi Lestari',     300, 1, 'iron'],
    ['Irwan Syahputra',  250, 1, 'iron'],
    ['Melinda Sari',     200, 1, 'iron'],
    ['Yusuf Hakim',      150, 1, 'iron'],
    ['Sari Wahyuni',     120, 1, 'iron'],
    ['Anton Budiman',    100, 1, 'iron'],
    ['Citra Mulia',       80, 1, 'iron'],
  ]

  const allNPC = [...npcGold, ...npcSilver, ...npcBronze, ...npcIron]
  for (const [name, exp, level, liga] of allNPC) {
    await run(
      `INSERT INTO leaderboard (user_id, name, exp, level, liga, month) VALUES (?,?,?,?,?,?)`,
      [0, name, exp, level, liga, month]
    )
  }
  console.log(`✅ ${allNPC.length} NPC seeded ke leaderboard (10 per liga)`)
}

export default { run, get, all }
