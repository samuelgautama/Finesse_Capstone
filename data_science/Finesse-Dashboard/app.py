import streamlit as st
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

# ==============================================================================
# 1. KONFIGURASI HALAMAN & KUSTOM CSS
# ==============================================================================
st.set_page_config(
    page_title="Finesse Financial Dashboard", 
    page_icon="📊", 
    layout="wide"
)

# Kustom CSS komprehensif untuk mengunci warna latar belakang dan teks agar adaptif
st.markdown("""
    <style>
    /* 1. Latar belakang sidebar menggunakan warna Slate Blue yang teduh dan adem */
    [data-testid="stSidebar"] {
        background-color: #334155 !important;
    }
    
    /* 2. Memaksa semua jenis teks & label di dalam sidebar tetap berwarna PUTIH BERSIH */
    [data-testid="stSidebar"] .stMarkdown,
    [data-testid="stSidebar"] .stMarkdown p,
    [data-testid="stSidebar"] h1, [data-testid="stSidebar"] h2, [data-testid="stSidebar"] h3, 
    [data-testid="stSidebar"] h4, [data-testid="stSidebar"] h5, [data-testid="stSidebar"] h6, 
    [data-testid="stSidebar"] label, [data-testid="stSidebar"] p, [data-testid="stSidebar"] span {
        color: #FFFFFF !important;
    }
    
    /* 3. Menyesuaikan warna pil/tag di dalam multiselect sidebar agar teks putihnya tetap kontras */
    span[data-baseweb="tag"] {
        background-color: #475569 !important;
        color: #FFFFFF !important;
    }

    /* 4. Memaksa teks judul & deskripsi dashboard TETAP PUTIH di Light & Dark Mode */
    .judul-finesse {
        color: #FFFFFF !important;
        font-size: 28px !important;
        font-weight: 700 !important;
        margin: 0 !important;
        letter-spacing: -0.5px !important;
        line-height: 1.3 !important;
    }
    
    .deskripsi-finesse {
        color: #F1F5F9 !important;
        font-size: 14px !important;
        margin-top: 12px !important;
        opacity: 0.95 !important;
        line-height: 1.6 !important;
        font-weight: 400 !important;
    }
    </style>
""", unsafe_allow_html=True)

# Mengatur tema visualisasi dasar agar bersih dan profesional
sns.set_theme(style="whitegrid")
plt.rcParams['font.family'] = 'sans-serif'
plt.rcParams['text.color'] = '#1E293B'
plt.rcParams['axes.labelcolor'] = '#475569'

# ==============================================================================
# 2. MEMUAT DATASET
# ==============================================================================
@st.cache_data
def load_data():
    data = pd.read_csv("finesse_dataset.csv")
    data['date'] = pd.to_datetime(data['date'])
    data['minggu_ke'] = data['date'].dt.day.apply(lambda x: min((x - 1) // 7 + 1, 4))
    return data

df = load_data()

# ==============================================================================
# 3. SIDEBAR FILTER INTERAKTIF (WARNA SLATE ADEM & TEKS FULL PUTIH BERSIH)
# ==============================================================================
st.sidebar.header("🎛️ Panel Filter Dashboard")
st.sidebar.markdown("Filter data di bawah ini untuk melihat perubahan pola finansial secara real-time.")

# Filter Kategori Pengeluaran
categories = df['category'].unique().tolist()
selected_categories = st.sidebar.multiselect("Kategori Transaksi:", categories, default=categories)

# Filter Metode Pembayaran
payment_methods = df['payment_method'].unique().tolist()
selected_payments = st.sidebar.multiselect("Metode Pembayaran:", payment_methods, default=payment_methods)

# Menerapkan filter ke dataset utama yang berjalan di dashboard
filtered_df = df[(df['category'].isin(selected_categories)) & (df['payment_method'].isin(selected_payments))]

if len(filtered_df) == 0:
    st.error("⚠️ Data tidak ditemukan untuk kombinasi filter ini. Silakan sesuaikan kembali filter Anda di sidebar.")
    st.stop()

# ==============================================================================
# 4. HEADER DASHBOARD - MUTED CHARCOAL & TEAL GRADATION (TEKS KUNCI PUTIH MUTLAK)
# ==============================================================================
st.markdown("""
    <div style="background: linear-gradient(135deg, #1E293B 0%, #475569 100%); padding: 32px; border-radius: 12px; margin-bottom: 28px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);">
        <p class="judul-finesse">
            Finesse: Gamified Budgeting & Financial Health Scorer
        </p>
        <p class="deskripsi-finesse">
            Platform analitik interaktif untuk memetakan perilaku alokasi dana mahasiswa, mendeteksi anomali finansial, serta mengukur metrik skor kesehatan keuangan guna mendukung ekosistem cerdas fitur Finesse. Gunakan panel filter di sebelah kiri untuk mengeksplorasi data secara dinamis.
        </p>
    </div>
""", unsafe_allow_html=True)

# ==============================================================================
# 5. KEY PERFORMANCE INDICATORS (KPI) - AKSEN SOFT TEAL & GREEN
# ==============================================================================
col1, col2, col3, col4 = st.columns(4)

val_total_transaksi = f"{len(filtered_df):,}"
val_rata_pengeluaran = f"Rp {int(filtered_df['amount'].mean()):,}"
val_rata_budget = f"Rp {int(filtered_df['monthly_budget'].mean()):,}"
val_rata_skor = f"{filtered_df['financial_health_score'].mean():.2f} / 100"

with col1:
    with st.container(border=True):
        st.markdown("<p style='color: #0D9488; font-weight: 600; font-size: 11px; margin: 0;'>🔹 TOTAL CATATAN TRANSAKSI</p>", unsafe_allow_html=True)
        st.markdown(f"## {val_total_transaksi}")

with col2:
    with st.container(border=True):
        st.markdown("<p style='color: #0D9488; font-weight: 600; font-size: 11px; margin: 0;'>🔹 RATA-RATA PENGELUARAN</p>", unsafe_allow_html=True)
        st.markdown(f"## {val_rata_pengeluaran}")

with col3:
    with st.container(border=True):
        st.markdown("<p style='color: #0D9488; font-weight: 600; font-size: 11px; margin: 0;'>🔹 RATA-RATA BUDGET BULANAN</p>", unsafe_allow_html=True)
        st.markdown(f"## {val_rata_budget}")

with col4:
    with st.container(border=True):
        st.markdown("<p style='color: #16A34A; font-weight: 600; font-size: 11px; margin: 0;'>🟢 RATA-RATA SKOR KESEHATAN</p>", unsafe_allow_html=True)
        st.markdown(f"## {val_rata_skor}")

st.markdown("<br>", unsafe_allow_html=True)

# ==============================================================================
# 6. STRUKTUR TAB MENU UTAMA (3 TAB)
# ==============================================================================
tab1, tab2, tab3 = st.tabs([
    "📌 Ringkasan Tren Utama", 
    "🔍 Detail Distribusi & Karakteristik Data",
    "💰 Daftar Ekstrim: Top Transaksi Terboros & Terhemat"
])

# --- TAB 1: RINGKASAN TREN UTAMA ---
with tab1:
    st.markdown("### Analisis Perilaku Finansial Mahasiswa")
    left_col, right_col = st.columns(2)

    with left_col:
        with st.container(border=True):
            st.markdown("#### Dominasi Alokasi Dana Berdasarkan Kategori")
            spend_kategori = filtered_df.groupby('category')['amount'].sum().reset_index()
            spend_kategori['persentase'] = (spend_kategori['amount'] / spend_kategori['amount'].sum()) * 100
            spend_kategori = spend_kategori.sort_values(by='amount', ascending=False).reset_index(drop=True)
            
            fig, ax = plt.subplots(figsize=(10, 5))
            sns.barplot(x='amount', y='category', data=spend_kategori, palette='GnBu_r', ax=ax)
            ax.set_xlabel("Total Pengeluaran Kumulatif (Rp)")
            ax.set_ylabel("Kategori")
            ax.ticklabel_format(style='plain', axis='x')  # Memaksa angka sumbu X tertulis jutaan normal tanpa notasi 1e8
            ax.spines['top'].set_visible(False)
            ax.spines['right'].set_visible(False)
            st.pyplot(fig)
            
            top_kategori = spend_kategori.iloc[0]['category']
            top_kategori_pct = spend_kategori.iloc[0]['persentase']
            top_kategori_val = spend_kategori.iloc[0]['amount']
            
            tabel_kategori_rapi = spend_kategori.rename(columns={
                'category': 'Kategori Pengeluaran', 'amount': 'Total Pengeluaran', 'persentase': 'Kontribusi Alokasi'
            })
            st.dataframe(tabel_kategori_rapi.style.format({'Total Pengeluaran': 'Rp {:,}', 'Kontribusi Alokasi': '{:.2f}%'}), use_container_width=True)
            st.info(f"💡 **Insight Utama Kategori:** Pos pengeluaran terbesar adalah **{top_kategori}** dengan total akumulasi mencapai **Rp {int(top_kategori_val):,}** ({top_kategori_pct:.2f}%).")

    with right_col:
        with st.container(border=True):
            st.markdown("#### Karakteristik Transaksi per Metode Pembayaran")
            fig, ax = plt.subplots(figsize=(10, 5))
            sns.boxplot(x='payment_method', y='amount', data=filtered_df, hue='payment_method', palette='Pastel1', legend=False, ax=ax)
            ax.set_xlabel("Metode Pembayaran")
            ax.set_ylabel("Nominal Transaksi (Rp)")
            ax.spines['top'].set_visible(False)
            ax.spines['right'].set_visible(False)
            st.pyplot(fig)
            
            stats_metode = filtered_df.groupby('payment_method')['amount'].agg(['count', 'mean', 'median']).reset_index()
            tabel_metode_rapi = stats_metode.rename(columns={
                'payment_method': 'Metode Pembayaran', 'count': 'Jumlah Transaksi', 'mean': 'Rata-rata (Mean)', 'median': 'Nilai Tengah (Median)'
            })
            st.dataframe(tabel_metode_rapi.style.format({'Rata-rata (Mean)': 'Rp {:,}', 'Nilai Tengah (Median)': 'Rp {:,}', 'Jumlah Transaksi': '{:,}'}), use_container_width=True)
            
            stats_metode_sorted = stats_metode.sort_values(by='count', ascending=False)
            top_method = stats_metode_sorted.iloc[0]['payment_method']
            top_method_count = stats_metode_sorted.iloc[0]['count']
            st.info(f"💡 **Insight Utama Metode Pembayaran:** Kanal pembayaran yang paling sering digunakan adalah **{top_method}** dengan intensitas sebanyak **{top_method_count:,} transaksi**.")

# --- TAB 2: DETAIL DISTRIBUSI & KARAKTERISTIK DATA ---
with tab2:
    st.markdown("### Analisis Karakteristik & Distribusi Data")
    uv_col1, uv_col2 = st.columns(2)

    with uv_col1:
        with st.container(border=True):
            st.markdown("#### Sebaran Variabilitas Nominal Transaksi")
            fig, ax = plt.subplots(figsize=(10, 5))
            sns.histplot(filtered_df['amount'], bins=30, kde=True, color='#475569', ax=ax)
            ax.set_xlabel("Nominal Uang per Transaksi (Rp)")
            ax.set_ylabel("Frekuensi")
            ax.spines['top'].set_visible(False)
            ax.spines['right'].set_visible(False)
            st.pyplot(fig)
            
            uv_median_amount = filtered_df['amount'].median()
            st.markdown(f"**Kesimpulan:** Mayoritas transaksi bernilai retail kecil dengan nilai tengah **Rp {int(uv_median_amount):,}**.")

    with uv_col2:
        with st.container(border=True):
            st.markdown("#### Sebaran Metrik Skor Kesehatan Keuangan")
            fig, ax = plt.subplots(figsize=(10, 5))
            sns.histplot(filtered_df['financial_health_score'], bins=30, kde=True, color='#0D9488', ax=ax)
            ax.set_xlabel("Skor Kesehatan Keuangan (0 - 100)")
            ax.set_ylabel("Frekuensi")
            ax.spines['top'].set_visible(False)
            ax.spines['right'].set_visible(False)
            st.pyplot(fig)
            
            uv_median_score = filtered_df['financial_health_score'].median()
            st.markdown(f"**Kesimpulan:** Tingkat kesehatan finansial mahasiswa memiliki median di angka **{uv_median_score:.2f}**.")

    st.markdown("---")
    st.markdown("### Analisis Tren Siklus Finansial & Makro Pengeluaran")
    
    down_col1, down_col2 = st.columns(2)
    
    with down_col1:
        with st.container(border=True):
            st.markdown("#### Tren Frekuensi Penurunan Skor Finansial Bulanan")
            df_sorted = filtered_df.sort_values(by=['user_id', 'date']).reset_index(drop=True)
            df_sorted['perubahan_skor'] = df_sorted.groupby('user_id')['financial_health_score'].diff()
            skor_negatif = df_sorted[df_sorted['perubahan_skor'] < 0]
            
            if not skor_negatif.empty:
                tren_mingguan = skor_negatif.groupby('minggu_ke')['perubahan_skor'].count().reset_index()
                tren_mingguan.columns = ['Minggu Ke', 'Jumlah Kasus']
                
                fig, ax = plt.subplots(figsize=(10, 5))
                sns.lineplot(x='Minggu Ke', y='Jumlah Kasus', data=tren_mingguan, marker='o', color='red', linewidth=2, ax=ax)
                ax.set_xticks([1, 2, 3, 4])
                ax.set_xlabel("Siklus Minggu")
                ax.set_ylabel("Frekuensi Kasus")
                ax.spines['top'].set_visible(False)
                ax.spines['right'].set_visible(False)
                st.pyplot(fig)
                
                tren_sorted = tren_mingguan.sort_values(by='Jumlah Kasus', ascending=False)
                peak_week = tren_sorted.iloc[0]['Minggu Ke']
                st.warning(f"📉 Penurunan stabilitas keuangan terbanyak berulang pada **Minggu ke-{int(peak_week)}** (Siklus Tanggal Tua).")
            else:
                st.warning("Tidak ada data penurunan skor untuk filter saat ini.")
                
    with down_col2:
        with st.container(border=True):
            st.markdown("#### Segmentasi Pengguna Berdasarkan Rasio Dana Hiburan")
            def klasifikasi_grup(kat):
                return 'Pokok' if kat in ['Kebutuhan Kuliah', 'Transportasi', 'Makan & Minum'] else 'Hiburan'
                    
            filtered_df_macro = filtered_df.copy()
            filtered_df_macro['grup_kebutuhan'] = filtered_df_macro['category'].apply(klasifikasi_grup)
            profil_user = filtered_df_macro.groupby(['user_id', 'grup_kebutuhan'])['amount'].sum().unstack(fill_value=0).reset_index()
            
            if 'Hiburan' in profil_user.columns and 'Pokok' in profil_user.columns:
                profil_user['Total'] = profil_user['Pokok'] + profil_user['Hiburan']
                profil_user['Rasio_Hiburan'] = profil_user['Hiburan'] / profil_user['Total']
                
                fig, ax = plt.subplots(figsize=(10, 5))
                sns.histplot(profil_user['Rasio_Hiburan'], bins=15, kde=True, color='purple', ax=ax)
                ax.set_xlabel("Proporsi Alokasi Dana Hiburan (0.0 - 1.0)")
                ax.set_ylabel("Jumlah Mahasiswa")
                ax.spines['top'].set_visible(False)
                ax.spines['right'].set_visible(False)
                st.pyplot(fig)
                
                # --- SINKRONISASI HASIL PERHITUNGAN JUJUR BERDASARKAN LAPORAN RISET TIM (VERSI RINGKAS & SCANNABLE) ---
                mean_ratio_pct = profil_user['Rasio_Hiburan'].mean() * 100
                high_risk_count = len(profil_user[profil_user['Rasio_Hiburan'] > 0.3])
                high_risk_pct = (high_risk_count / len(profil_user)) * 100
                
                # --- POTONGAN KODE BARIS ~190-197 DI APP.PY (VERSI SUPER RINGKAS) ---
                st.error(f"""
                🎯 **Kesimpulan Makro:** Sebanyak **{high_risk_count} pengguna ({high_risk_pct:.2f}%)** terdeteksi sebagai *high-risk spender* dengan rata-rata alokasi dana hiburan sangat tinggi, yaitu **{mean_ratio_pct:.1f}%**. Ketimpangan konsumsi ini menjadi pemicu utama runtuhnya stabilitas keuangan mahasiswa di setiap siklus akhir bulan (tanggal tua).
                """)
            else:
                st.warning("Kombinasi filter saat ini tidak memenuhi klasifikasi makro.")

    # --- SIKLUS MINGGU PALING BOROS ---
    st.markdown("<br>", unsafe_allow_html=True)
    with st.container(border=True):
        st.markdown("#### 📊 Analisis : Siklus Minggu Paling Boros Mahasiswa")
        rata_mingguan = filtered_df.groupby('minggu_ke')['amount'].mean().reset_index()
        
        fig, ax = plt.subplots(figsize=(15, 4))
        sns.barplot(x='minggu_ke', y='amount', data=rata_mingguan, palette='Blues', ax=ax)
        ax.set_xlabel("Siklus Minggu dalam Bulan")
        ax.set_ylabel("Rata-rata Besaran Transaksi (Rp)")
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        st.pyplot(fig)
        
        boros_sorted = rata_mingguan.sort_values(by='amount', ascending=False)
        minggu_boros = boros_sorted.iloc[0]['minggu_ke']
        nilai_boros = boros_sorted.iloc[0]['amount']
        
        st.markdown(f"📌 **Kesimpulan:** Pengeluaran melonjak paling tinggi terjadi di **Minggu ke-{int(minggu_boros)}** dengan rata-rata **Rp {int(nilai_boros):,}** per transaksi.")

# ==============================================================================
# 7. TAB 3: DAFTAR EKSTRIM - TOP TRANSAKSI TERBOROS & TERHEMAT
# ==============================================================================
with tab3:
    st.markdown("### 🔍 Deteksi Nilai Ekstrim Transaksi Mahasiswa")
    boros_col, hemat_col = st.columns(2)
    
    top_boros = filtered_df.sort_values(by='amount', ascending=False).head(10).reset_index(drop=True)
    top_boros_display = top_boros[['transaction_id', 'user_id', 'date', 'category', 'amount', 'payment_method']].rename(columns={
        'transaction_id': 'ID Transaksi', 'user_id': 'ID Pengguna', 'date': 'Tanggal', 'category': 'Kategori', 'amount': 'Nominal Belanja', 'payment_method': 'Metode Pembayaran'
    })
    
    top_hemat = filtered_df.sort_values(by='amount', ascending=True).head(10).reset_index(drop=True)
    top_hemat_display = top_hemat[['transaction_id', 'user_id', 'date', 'category', 'amount', 'payment_method']].rename(columns={
        'transaction_id': 'ID Transaksi', 'user_id': 'ID Pengguna', 'date': 'Tanggal', 'category': 'Kategori', 'amount': 'Nominal Belanja', 'payment_method': 'Metode Pembayaran'
    })

    with boros_col:
        with st.container(border=True):
            st.markdown("#### 🚨 Top 10 Transaksi Tunggal Terboros")
            st.dataframe(top_boros_display.style.format({'Nominal Belanja': 'Rp {:,}', 'Tanggal': lambda t: t.strftime('%Y-%m-%d')}), use_container_width=True, hide_index=True)
            if not top_boros.empty:
                kategori_puncak = top_boros.iloc[0]['category']
                nilai_puncak = top_boros.iloc[0]['amount']
                st.info(f"💡 **Analisis Anomali:** Transaksi paling boros tercatat sebesar **Rp {int(nilai_puncak):,}** pada kategori **{kategori_puncak}**.")

    with hemat_col:
        with st.container(border=True):
            st.markdown("#### 🍃 Top 10 Transaksi Tunggal Terhemat")
            st.dataframe(top_hemat_display.style.format({'Nominal Belanja': 'Rp {:,}', 'Tanggal': lambda t: t.strftime('%Y-%m-%d')}), use_container_width=True, hide_index=True)
            if not top_hemat.empty:
                kategori_dasar = top_hemat.iloc[0]['category']
                nilai_dasar = top_hemat.iloc[0]['amount']
                st.success(f"💡 **Analisis Aktivitas Mikro:** Transaksi bernilai paling hemat diawali dari angka **Rp {int(nilai_dasar):,}** pada kategori **{kategori_dasar}**.")

# ==============================================================================
# 8. FOOTER BRANDING
# ==============================================================================
st.markdown("---")
st.markdown("<p style='text-align: center; color: #94A3B8; font-size: 12px;'>© 2026 Finesse Development Team - All Rights Reserved.</p>", unsafe_allow_html=True)