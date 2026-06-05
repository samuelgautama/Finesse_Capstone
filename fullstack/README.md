# Finesse — Gamified Budgeting & Financial Health

**Finesse** adalah aplikasi web manajemen keuangan yang menggabungkan konsep gamifikasi dengan kecerdasan buatan (AI). Aplikasi ini dirancang khusus untuk membantu pengguna—terutama mahasiswa dan anak muda—membangun kebiasaan keuangan yang lebih sehat dengan cara yang jauh lebih menyenangkan dan interaktif.

---

## Masalah yang Diselesaikan

Banyak anak muda kesulitan mengelola keuangan bukan karena tidak mau, tetapi karena pendekatannya yang membosankan. Mencatat pengeluaran setiap hari sering kali terasa seperti beban atau tugas administratif, bukan sebuah kebiasaan hidup. 

Finesse mengubah paradigma tersebut dengan meminjam mekanisme dari dunia *game*. Kami mengubah tugas pencatatan keuangan yang membosankan menjadi sebuah petualangan mengumpulkan *Experience Points* (EXP), menyelesaikan misi, dan bersaing di papan peringkat (Leaderboard).

---

## Cara Kerja (The AI Engine)

Setiap kali pengguna mencatat transaksi, tiga mesin AI akan bekerja di balik layar secara *real-time*:

### 1. Deep Learning — Penentu EXP
Model *Neural Network* menganalisis pola transaksi pengguna secara komprehensif (mulai dari nominal, kategori, waktu transaksi, hingga rasio pemakaian *budget* bulanan) dan menghasilkan nilai EXP yang proporsional. Transaksi yang bijak akan menghasilkan EXP yang lebih tinggi, mendorong perilaku finansial yang lebih positif.

### 2. Machine Learning (K-Means) — Penentu Liga
Setiap pengguna diklasifikasikan ke dalam salah satu dari 4 liga kompetitif: **Gold, Silver, Bronze, atau Iron**. Penempatan ini dinilai berdasarkan pola pengeluaran bulanan. Liga ini bukan tentang seberapa banyak uang yang dimiliki pengguna, melainkan tentang seberapa bijak mereka mengelolanya.

### 3. Generative AI (Gemini) — Generator Misi
Setiap hari, pengguna dapat menekan tombol untuk meminta misi keuangan yang dipersonalisasi oleh AI. Misi ini bersifat dinamis dan kontekstual—disesuaikan langsung dengan kondisi keuangan aktual pengguna saat itu, sisa *budget*, dan kategori pengeluaran terakhir mereka (bukan sekadar *template* statis).

---

## Cara Menjalankan Aplikasi di Lokal

Ikuti langkah-langkah di bawah ini untuk menjalankan *Fullstack Node.js* & *Frontend* Finesse di komputermu:

### 1. Clone Repository
Unduh *repository* ini dan masuk ke dalam foldernya:
```bash
git clone [URL_REPOSITORY_ANDA]
cd Finesse
```

### 2. Install Dependencies
Pastikan Node.js sudah terinstal, lalu jalankan:
```bash
npm install
```

### 3. Konfigurasi Environment
Buat sebuah file bernama .env di direktori utama (root), lalu isi dengan konfigurasi berikut:
```env
PORT=3000
FASTAPI_URL=[https://samuelgautama-finesse-ai-api.hf.space](https://samuelgautama-finesse-ai-api.hf.space)
```

### 4. Jalankan Server Backend
Nyalakan server Node.js. Server ini juga akan secara otomatis menyajikan (serve) file statis UI kamu:
```bash
npm start
```

### 5. (Opsional) Jalankan Vite untuk Development UI
Jika kamu ingin mengubah kode CSS/JS di frontend secara real-time (hot-reload), buka tab terminal baru dan jalankan:
```bash
npm run dev
```

### 6. Buka Aplikasi
Buka browser pilihanmu dan akses URL berikut: `http://localhost:3000`
