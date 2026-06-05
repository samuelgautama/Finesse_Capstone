# Finesse: Gamified Budgeting & Financial Health Scorer
> **Backend Repository: Machine Learning & Generative AI**

Repositori ini memuat arsitektur backend Machine Learning untuk aplikasi Finesse. Sistem ini bertugas memproses data transaksi pengguna menggunakan model Deep Learning untuk menghitung Experience Points (EXP) sebagai indikator kesehatan finansial, melakukan segmentasi pengguna ke dalam liga gamifikasi menggunakan model K-Means, serta memberikan saran finansial personal menggunakan Generative AI.

Proyek ini dikembangkan sebagai Capstone Project dalam program Coding Camp by DBS Foundation.

---

## | Features

### 1. EXP Calculation (Deep Learning)
* Memanfaatkan model Deep Learning yang dibangun menggunakan *TensorFlow Functional API*.
* Model memprediksi jumlah EXP (`Experience Points`) yang layak didapatkan pengguna berdasarkan perilaku pengeluaran mereka (nominal, rasio budget, frekuensi transaksi, dll).
* Mengimplementasikan *custom layer* (`FinesseDenseLayer`) untuk pemrosesan operasi *dense* jaringan saraf secara manual.

### 2. Gamification & League Profiling (K-Means)
* Melakukan segmentasi pengguna ke dalam 4 liga (Gold, Silver, Bronze, Iron) berdasarkan pola pengeluaran dan utilitas anggaran menggunakan model *K-Means Clustering*.

### 3. Dynamic Quest Generator (Generative AI)
* Mengintegrasikan API **Google Gemini** (`gemini-2.5-flash`) untuk menghasilkan misi atau tantangan finansial harian secara dinamis (Quest Generator).
*AI secara cerdas menganalisis sisa anggaran, kategori transaksi terakhir, dan status liga pengguna untuk meracik 3 tingkat misi (Mudah, Sedang, Sulit) lengkap dengan judul, deskripsi, alasan edukatif, dan reward EXP yang sepadan guna mencegah pengeluaran impulsif.

### 4. RESTful API
* Berjalan di atas framework **FastAPI** untuk menyediakan antarmuka (endpoint) yang asinkron dan efisien.
* Terdokumentasi secara otomatis melalui **Swagger UI** guna memastikan kelancaran integrasi antara model AI dan *frontend* aplikasi.

---

## | Tech Stack

| Kategori | Teknologi |
|---|---|
| **Bahasa Pemrograman** | Python 3.x |
| **Deep Learning Framework** | TensorFlow, Keras |
| **Data Processing & ML** | Scikit-Learn, Pandas, NumPy |
| **Generative AI** | Google GenAI SDK (`google-genai`) |
| **API Framework** | FastAPI, Uvicorn |
| **Utilities** | Joblib, python-dotenv, TensorBoard |

---

## | Project Directory

```text
.
├── dataset/                
├── logs/                   
├── notebooks/              
├── saved_models/
│   ├── Deep_Learning/      
│   └── Machine_Learning/
├── src/           
├── tests/           
├── .env                    
├── .gitignore
├── Dockerfile  
├── main.py                 
├── requirements.txt        
└── README.md
```

## | Panduan Instalasi & Penggunaan Lokal
### 1. Clone Repository
```bash
git clone [URL_REPOSITORY_ANDA]
cd [NAMA_FOLDER_REPOSITORY]
```

### 2. Persiapan Virtual Environment
```bash
python -m venv venv

# Linux/macOS:
source venv/bin/activate

# Windows:
venv\Scripts\activate
```

### 3. Instalasi Dependensi
```bash
pip install -r requirements.txt
```

### 4. Konfigurasi Environment Variables
Buat file bernama .env di direktori utama proyek (root directory). Tambahkan API Key Google Gemini Anda ke dalam file tersebut:
```env
GEMINI_API_KEY=masukkan_api_key_gemini_anda_di_sini
```

### 5. Menjalankan Server
Jalankan server Uvicorn untuk memulai FastAPI:
```bash
uvicorn main:app --reload
```

### 6. Pengujian Endpoint
Akses dokumentasi interaktif melalui browser pada alamat http://127.0.0.1:8000/docs untuk melakukan uji coba request JSON langsung ke endpoint yang tersedia, seperti /calculate-exp, /get-league, dan /generate-missions.

## | Tentang Kami
Proyek ini dikembangkan secara kolaboratif oleh tim dari Universitas Sumatera Utara:
- Patrick Nicxon Hutabarat (CFCC319D6Y0190) - Full-Stack Web Developer 
- Dame Theresia Rejeki Sidauruk (CDCC319D6X0998) - Data Science 
- Cikita Natasya Br Sembiring (CDCC319D6X1254) - Data Scientist 
- Rayza Indafri Yahya (CACC319D6Y0343) - AI Engineer 
- Samuel Gautama Manik (CACC319D6Y1720) - AI Engineer