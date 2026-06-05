const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const PORT = 3000;

// Buka jalur agar frontend (app.js temanmu) bisa masuk
app.use(cors());
app.use(express.json());

// 1. KONEKSI DATABASE SQLITE
const db = new sqlite3.Database('./finesse.db', (err) => {
  if (err) console.error("❌ Error database:", err.message);
  else console.log("✅ Database SQLite siap menerima data!");
});

// 2. BUAT TABEL
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    budget REAL,
    exp INTEGER DEFAULT 0,
    league TEXT DEFAULT 'Bronze'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    amount REAL,
    category TEXT,
    note TEXT,
    date TEXT,
    exp_earned INTEGER,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  db.get("SELECT COUNT(*) AS count FROM users", (err, row) => {
    if (row.count === 0) {
      db.run(`INSERT INTO users (name, budget, exp, league) VALUES ('Pengguna Finesse', 1500000, 0, 'Bronze')`);
    }
  });
});

// ==========================================
// 3. JALUR RESTful API (Sudah ada GET, POST, PATCH)
// ==========================================

// GET: Ambil data user
// GET: Ambil data user
app.get('/api/users/:id', (req, res) => {
  db.get(`SELECT * FROM users WHERE id = ?`, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, data: row });
  });
});

// PATCH: Edit Profil
app.patch('/api/users/:id', (req, res) => {
  const { name, budget } = req.body;
  const userId = req.params.id;

  if (!name || name.trim() === "") {
      return res.status(400).json({ success: false, message: "Nama tidak boleh kosong!" });
  }

  db.run(`UPDATE users SET name = ?, budget = ? WHERE id = ?`, [name, budget, userId], function(err) {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: "Profil berhasil diupdate!" });
  });
});

// GET: Ambil riwayat transaksi
app.get('/api/transactions', (req, res) => {
  const userId = req.query.user_id || 1;
  db.all(`SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC`, [userId], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, data: rows });
  });
});

// POST: Simpan Transaksi Baru
app.post('/api/transactions', (req, res) => {
  const { user_id, amount, category, note, date } = req.body;

  if (!amount || !category) {
      return res.status(400).json({ success: false, message: "Data transaksi tidak lengkap!" });
  }

  const dummyExp = 50; 

  db.run(`INSERT INTO transactions (user_id, amount, category, note, date, exp_earned) 
          VALUES (?, ?, ?, ?, ?, ?)`, 
    [user_id, amount, category, note, date, dummyExp], 
    function(err) {
      if (err) return res.status(500).json({ success: false, error: err.message });
      
      db.run(`UPDATE users SET exp = exp + ? WHERE id = ?`, [dummyExp, user_id]);

      res.json({ success: true, message: "Tersimpan!", data: { exp_earned: dummyExp } });
  });
});