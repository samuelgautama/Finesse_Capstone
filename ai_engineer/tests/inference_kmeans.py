# %%
import pandas as pd
import joblib
from pathlib import Path

# %% Setup Paths & Load Models
PROJECT_ROOT = Path(__file__).resolve().parent if '__file__' in locals() else Path.cwd()
save_dir = PROJECT_ROOT / 'saved_models' / 'Machine_Learning'

loaded_scaler = joblib.load(save_dir / 'scaler_finesse.pkl')
loaded_kmeans = joblib.load(save_dir / 'kmeans_finesse.pkl')
mappings = joblib.load(save_dir / 'league_mapping.pkl')

league_mapping = mappings['leagues']
missions_mapping = mappings['missions']

# %% Simulate New User (Budi)
data_baru = {
    'total_spent': [3500000],
    'transaction_count': [28],
    'monthly_budget': [2000000]
}
df_new_user = pd.DataFrame(data_baru)

# Feature Engineering
df_new_user['budget_utilization'] = df_new_user['total_spent'] / df_new_user['monthly_budget']
features_to_predict = df_new_user[['total_spent', 'transaction_count', 'budget_utilization']]

# Data Scaling (Using transform, NOT fit_transform)
new_user_scaled = loaded_scaler.transform(features_to_predict)

# Predict Cluster
prediksi_cluster = loaded_kmeans.predict(new_user_scaled)[0]

# Dynamic Mapping Retrieval
nama_liga = league_mapping.get(prediksi_cluster, "Unranked")
teks_misi = missions_mapping.get(prediksi_cluster, "Catat transaksimu dengan baik!")

# %% Output Results
print("\n=== HASIL ANALISIS GAMIFIKASI FINESSE ===")
print(f"Pemakaian Budget : {df_new_user['budget_utilization'][0]*100:.1f}%")
print(f"Prediksi AI      : Masuk Cluster {prediksi_cluster}")
print(f"Penempatan Liga  : {nama_liga}")
print(f"Misi Otomatis    : {teks_misi}\n")