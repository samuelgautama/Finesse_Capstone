# Finesse — Gamified Budgeting & Financial Health Scorer

## Deskripsi Proyek
Finesse adalah platform asisten manajemen keuangan personal pintar yang mengintegrasikan analisis sains data kuantitatif dengan arsitektur psikologi perilaku berbasis gamifikasi. Proyek ini dikembangkan untuk mengidentifikasi dan memitigasi anomali perilaku konsumtif di kalangan mahasiswa, seperti *cashless effect* dan *phantom spending*. Sistem ini mengevaluasi interaksi antara laju belanja dan pemanfaatan anggaran guna menjaga stabilitas *Financial Health Score* (FHS) pengguna.

## Tim Pengembang
Proyek kolaboratif ini dikembangkan oleh:
*   **Patrick Nicxon Hutabarat** - Full-Stack Web Developer
*   **Dame Theresia Rejeki Sidauruk** - Data Science
*   **Cikita Natasya Br Sembiring** - Data Scientist
*   **Rayza Indafri Yahya** - AI Engineer
*   **Samuel Gautama Manik** - AI Engineer

## Dataset
Platform ini dianalisis dan divalidasi menggunakan kumpulan data historis yang tersimpan dalam **finesse_dataset.csv**. Dataset ini memuat 15.239 entri log transaksi dari 613 pengguna simulasi, yang telah melalui proses pembersihan data runtun waktu (*time-series*) dan rekayasa fitur kondisional.

## Analisis Data Eksploratif (EDA) & Eksplanatori
Berdasarkan pemrosesan data analitik yang telah dieksekusi, ditemukan beberapa wawasan strategis:
*   **Beban Struktural**: Kategori "Tagihan & Kos" menyumbang persentase terbesar, yaitu 44,66% dari total perputaran dana mahasiswa.
*   **Siklus Kritis Temporal**: Frekuensi penurunan *Financial Health Score* secara drastis paling banyak terjadi pada minggu ke-4 (mencapai 3.361 kasus), mengonfirmasi fenomena krisis finansial di akhir bulan.
*   **Korelasi Kanal Pembayaran**: Tidak ditemukan korelasi yang signifikan antara metode pembayaran digital (*Bank Transfer*, *E-Wallet*, *Credit Card*) dengan tingginya nominal pengeluaran per transaksi.
*   **Segmentasi Risiko (Over-spending)**: Mayoritas mutlak pengguna dalam dataset (98,86% atau 606 pengguna) diidentifikasi sebagai kelompok rentan yang secara konsisten mengalokasikan lebih dari 30% anggaran mereka untuk pos hiburan.

## Panduan Penggunaan Dashboard Streamlit

Untuk mempermudah visualisasi dan interaksi dengan hasil analisis data, proyek ini dilengkapi dengan dashboard analitik interaktif berbasis Streamlit yang dapat diakses secara publik melalui tautan berikut:
🔗 **[Finesse Financial Dashboard](https://finesse-dashboard.streamlit.app/)**

Berikut adalah tata cara dan panduan operasional untuk mengeksplorasi metrik kesehatan keuangan pada dashboard Finesse:

### 1. Akses dan Inisialisasi Halaman
* Akses dashboard melalui tautan resmi di atas menggunakan peramban (*web browser*) pilihan Anda.
* Tunggu beberapa saat hingga sistem memuat keseluruhan dataset (`finesse_dataset.csv`) dan menginisialisasi pustaka visualisasi data secara otomatis di latar belakang.

### 2. Pemanfaatan Panel Kendali Kontrol (Sidebar)
* **Pusat Pengaturan Dinamis:** Di sisi kiri antarmuka, terdapat panel kendali (*Sidebar*) dengan skema warna *Slate Blue* terintegrasi.
* **Filter Interaktif:** Gunakan fitur drop-down, tombol pilihan, atau input pencarian yang tersedia untuk menyaring visualisasi data berdasarkan parameter spesifik, seperti identitas pengguna (*User ID*), kategori pengeluaran tertentu, atau rentang waktu analisis yang diinginkan.
* **Simulasi Parameter:** Anda dapat memanipulasi variabel batas anggaran bulanan secara langsung untuk mengamati pergeseran nilai skor kesehatan keuangan (*Financial Health Score*) secara dinamis.

### 3. Eksplorasi Metrik dan Visualisasi Utama (Main Panel)
* **Ikhtisar Metrik Utama (KPI Cards):** Bagian atas halaman utama menampilkan kartu ringkasan eksekutif yang memuat total akumulasi pengeluaran, sisa anggaran riil, dan rata-rata *Financial Health Score* pengguna terpilih.
* **Diagram Tren dan Distribusi:** Analisis grafik visualisasi yang disajikan pada panel tengah untuk mengidentifikasi pola pengeluaran runtun waktu, khususnya grafik histogram yang menunjukkan penumpukan frekuensi belanja pada siklus kritis akhir bulan.

### 4. Analisis Aktivitas Mikro & Deteksi Anomali
* **Tabel Transaksi Ekstrem:** Gulir halaman ke bagian bawah untuk mengeksplorasi tabel interaktif **Top 10 Transaksi Tunggal Terboros** dan **Top 10 Transaksi Tunggal Terhemat**. Tabel ini telah diformat secara otomatis ke dalam mata uang Rupiah (Rp) demi kenyamanan pembacaan data.
* **Kotak Wawasan Kontekstual (*Insight Box*):** Cermati notifikasi edukatif otomatis berwarna biru (*Info*) dan hijau (*Success*) di bawah tabel. Sistem memanfaatkan logika pemrograman untuk memberikan konklusi instan mengenai kategori transaksi apa yang paling memicu anomali lonjakan pengeluaran serta pos pengeluaran mikro yang berhasil dihemat.

## Uji Eksperimental (A/B Testing)
Untuk menguji efektivitas pengaruh fitur intervensi gamifikasi terhadap perbaikan skor kesehatan keuangan, eksperimen A/B Testing dilakukan dengan membagi pengguna secara acak menjadi dua kelompok uji. 

Hasil uji *Independent T-Test* menghasilkan:
*   **T-Statistic**: -1.1018
*   **P-Value**: 0.2706

Nilai P-Value yang melampaui ambang batas signifikansi ($\alpha = 0.05$) menunjukkan bahwa implementasi gamifikasi global tidak memberikan dampak yang seragam. Fakta empiris ini menjadi landasan bahwa sistem memerlukan intervensi gamifikasi yang dipersonalisasi (*Personalized Gamification*).

## Rekomendasi Taktis & Implementasi
Berdasarkan seluruh temuan data, arsitektur Finesse merekomendasikan:
1.  **Otomatisasi Safe Mode**: Intervensi sistematis di akhir bulan (minggu ke-3 dan ke-4) untuk menekan laju pengeluaran konsumtif mikro.
2.  **Personalized Gamification**: Pemberian penghargaan (*Experience Points*) ganda yang ditargetkan secara khusus untuk memotivasi kelompok berisiko menahan pengeluaran di sektor hiburan.
3.  **Sistem Peringatan Dini**: Integrasi fitur deteksi deviasi yang memperingatkan pengguna secara *real-time* apabila transaksi melebihi batas rata-rata historis wajar.
