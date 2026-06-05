# %% Import Libraries
import os
import pandas as pd
import numpy as np
import joblib
import json
from pathlib import Path

# Suppress TensorFlow logging for a cleaner terminal output
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

import tensorflow as tf
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any
import uvicorn
from dotenv import load_dotenv
from google import genai

# %% 1. Generative AI Configuration
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError("API Key belum diset! Pastikan file .env sudah benar.")

# Initialize GenAI Client
client = genai.Client(api_key=GEMINI_API_KEY)

# %% 2. Redefine Custom Layer for Model Loading
class FinesseDenseLayer(tf.keras.layers.Layer):
    def __init__(self, units=32, activation='relu', **kwargs):
        super(FinesseDenseLayer, self).__init__(**kwargs)
        self.units = units
        self.activation = tf.keras.activations.get(activation)

    def build(self, input_shape):
        self.w = self.add_weight(shape=(input_shape[-1], self.units),
                                 initializer='glorot_uniform',
                                 trainable=True,
                                 name='finesse_weight')
        self.b = self.add_weight(shape=(self.units,),
                                 initializer='zeros',
                                 trainable=True,
                                 name='finesse_bias')

    def call(self, inputs):
        return self.activation(tf.matmul(inputs, self.w) + self.b)

# %% 3. App Initialization & Model Loading
app = FastAPI(
    title="Finesse Modular API",
    description="Microservices API untuk Deep Learning (EXP), Machine Learning (League), dan GenAI (Missions).",
    version="3.0.0" 
)

# Global Variables
model_dnn = None
preprocessor_dnn = None
target_scaler = None
scaler_km = None
kmeans_model = None
league_mapping = {}

try:
    PROJECT_ROOT = Path(__file__).resolve().parent
except NameError:
    PROJECT_ROOT = Path.cwd()

try:
    print("\nMemuat seluruh arsitektur AI...")
    
    # DL Paths
    dnn_dir = PROJECT_ROOT / 'saved_models' / 'Deep_Learning'
    model_dnn = tf.keras.models.load_model(
        dnn_dir / 'finesse_dnn_v1.keras', 
        custom_objects={'FinesseDenseLayer': FinesseDenseLayer}
    )
    preprocessor_dnn = joblib.load(dnn_dir / 'preprocessor_dnn.pkl')
    target_scaler = joblib.load(dnn_dir / 'target_scaler.pkl')
    
    # ML Paths
    km_dir = PROJECT_ROOT / 'saved_models' / 'Machine_Learning'
    scaler_km = joblib.load(km_dir / 'scaler_finesse.pkl')
    kmeans_model = joblib.load(km_dir / 'kmeans_finesse.pkl')
    mappings = joblib.load(km_dir / 'league_mapping.pkl')
    
    league_mapping = mappings['leagues']
    
    print("Seluruh model siap melayani request!\n")
except Exception as e:
    print(f"\nGAGAL MEMUAT MODEL: {e}")

# %% 4. Input Schemas (Validasi Data & Template Swagger)
class ExpRequest(BaseModel):
    features: Dict[str, Any]

    class Config:
        json_schema_extra = {
            "example": {
                "features": {
                    "amount": 50000,
                    "monthly_budget": 3000000,
                    "cumulative_spend": 1500000,
                    "transaction_count": 28,
                    "transaction_to_budget_ratio": 0.016,
                    "budget_utilization_ratio": 0.5,
                    "user_avg_transaction": 45000,
                    "amount_vs_user_avg": 1.1,
                    "day_of_week": 3,
                    "is_weekend": 0,
                    "is_month_end": 0,
                    "category_Hiburan & Nongkrong": 0,
                    "category_Makan & Minum": 1,
                    "category_Transportasi": 0,
                    "category_Kebutuhan Kuliah": 0,
                    "category_Tagihan & Kos": 0,
                    "payment_method_E-Wallet": 1,
                    "payment_method_Credit Card": 0
                }
            }
        }

class LeagueRequest(BaseModel):
    total_spent: float
    transaction_count: int
    monthly_budget: float

    class Config:
        json_schema_extra = {
            "example": {
                "total_spent": 1500000.0,
                "transaction_count": 28,
                "monthly_budget": 3000000.0
            }
        }

class MissionRequest(BaseModel):
    kategori_aktif: str
    amount: float
    sisa_anggaran: float
    is_weekend: int
    is_month_end: int
    exp_earned: int
    user_league: str

# %% 5. ENDPOINT 1: Calculate EXP (Deep Learning Khusus CRUD)
@app.post("/calculate-exp")
async def calculate_exp(request: ExpRequest):
    """
    Dipanggil saat user menyimpan transaksi baru. Hanya menjalankan Deep Learning.
    """
    if any(m is None for m in [model_dnn, preprocessor_dnn, target_scaler]):
        raise HTTPException(status_code=500, detail="Model DL belum siap.")

    try:
        features_dict = request.features
        df_input_dnn = pd.DataFrame([features_dict])
        
        for col in df_input_dnn.columns:
            if df_input_dnn[col].dtype == 'bool':
                df_input_dnn[col] = df_input_dnn[col].astype(int)
                
        X_processed = preprocessor_dnn.transform(df_input_dnn)
        if hasattr(X_processed, "toarray"):
            X_processed = X_processed.toarray()
            
        scaled_prediction = model_dnn.predict(X_processed, verbose=0)
        true_prediction = target_scaler.inverse_transform(scaled_prediction)
        
        exp_earned = int(round(float(true_prediction[0][0]), 0))

        return {
            "status": "success",
            "data": {
                "exp_earned": exp_earned
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# %% 6. ENDPOINT 2: Get League (K-Means Khusus Leaderboard)
@app.post("/get-league")
async def get_league(request: LeagueRequest):
    """
    Dipanggil untuk mengupdate status ranking/liga user.
    """
    if any(m is None for m in [scaler_km, kmeans_model]):
        raise HTTPException(status_code=500, detail="Model ML belum siap.")

    try:
        monthly_budget = request.monthly_budget if request.monthly_budget > 0 else 1
        budget_utilization = request.total_spent / monthly_budget
        
        km_features = pd.DataFrame({
            'total_spent': [request.total_spent],
            'transaction_count': [request.transaction_count],
            'budget_utilization': [budget_utilization]
        })
        
        km_scaled = scaler_km.transform(km_features)
        cluster_id = kmeans_model.predict(km_scaled)[0]
        
        return {
            "status": "success",
            "data": {
                "league": league_mapping.get(cluster_id, "Unranked"),
                "budget_utilization_percentage": round(budget_utilization * 100, 1)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# %% 7. ENDPOINT 3: Generate Missions (GenAI Khusus Tombol Misi)
@app.post("/generate-missions")
async def generate_missions(request: MissionRequest):
    """
    Dipanggil HANYA KETIKA user menekan tombol 'Generate Misi' di web.
    """
    try:
        status_weekend = "Ya" if request.is_weekend == 1 else "Tidak"
        status_akhir_bulan = "Ya" if request.is_month_end == 1 else "Tidak"

        prompt = f"""
        Kamu adalah sistem pembuat misi gamifikasi (Quest Generator) untuk aplikasi Finesse.
        
        Data pengguna saat ini:
        - Kategori Transaksi Terakhir: {request.kategori_aktif}
        - Nominal Transaksi Terakhir: Rp {request.amount}
        - Sisa Anggaran Bulanan: Rp {request.sisa_anggaran}
        - Konteks: Akhir Pekan? {status_weekend} | Akhir Bulan? {status_akhir_bulan}
        - EXP Terakhir Didapat: +{request.exp_earned}
        - Liga Gamifikasi: {request.user_league}
        
        TUGAS UTAMA:
        Hasilkan tepat 3 misi (tantangan keuangan) spesifik yang DAPAT DISELESAIKAN DALAM WAKTU 1 HARI (24 Jam) agar pengguna bisa bertahan atau naik dari Liga {request.user_league}. 
        Misi harus realistis. Sangat disarankan agar salah satu misi mendorong pengguna untuk menarik uang cash (tunai) hari ini juga untuk menyimpan sisa uang agar tidak terjadi pengeluaran impulsif secara elektronik.
        
        Aturan Reward EXP (WAJIB PILIH ANGKA ACAK DALAM RENTANG INI):
        - Mudah: 100 - 150 EXP
        - Sedang: 151 - 250 EXP
        - Sulit: 251 - 400 EXP
        
        Balas HANYA dengan format JSON murni persis seperti di bawah ini, tanpa teks pengantar, tanpa tag markdown. Buatlah title yang catchy bergaya anak muda, dan untuk exp_reward, gantilah dengan angka acak yang sesuai rentang:
        {{
          "misi": [
            {{
              "title": "Tulis Judul Misi Singkat Di Sini",
              "description": "Tuliskan tantangan 1 hari di sini...",
              "reason": "Jelaskan mengapa misi ini penting untuk kesehatan finansial mereka saat ini...",
              "quest_type": "Kategori quest (misal: Hemat, Pencatatan, Tarik Tunai, Disiplin, dll)",
              "difficulty": "Mudah",
              "exp_reward": 125
            }},
            {{
              "title": "Tulis Judul Misi Singkat Di Sini",
              "description": "Tuliskan tantangan 1 hari di sini...",
              "reason": "Jelaskan mengapa misi ini penting untuk kesehatan finansial mereka saat ini...",
              "quest_type": "Kategori quest",
              "difficulty": "Sedang",
              "exp_reward": 200
            }},
            {{
              "title": "Tulis Judul Misi Singkat Di Sini",
              "description": "Tuliskan tantangan 1 hari di sini...",
              "reason": "Jelaskan mengapa misi ini penting untuk kesehatan finansial mereka saat ini...",
              "quest_type": "Kategori quest",
              "difficulty": "Sulit",
              "exp_reward": 350
            }}
          ]
        }}
        """
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )
        
        clean_response = response.text.replace("```json", "").replace("```", "").strip()
        ai_data = json.loads(clean_response)
        daftar_misi = ai_data.get("misi", [])
        
        return {
            "status": "success",
            "data": {
                "dynamic_missions": daftar_misi
            }
        }
    except Exception as e_genai:
        print(f"Error GenAI Mission Generator: {e_genai}")
        # Fallback yang sudah disesuaikan dengan struktur JSON baru
        return {
            "status": "partial_success",
            "data": {
                "dynamic_missions": [
                    {
                        "title": "Disiplin Hari Ini",
                        "description": "Pastikan kamu mencatat setiap sen pengeluaranmu hari ini tanpa ada yang terlewat.",
                        "reason": "Mencatat transaksi harian adalah langkah awal mencegah kebocoran dana tak kasat mata.",
                        "quest_type": "Pencatatan",
                        "difficulty": "Mudah", 
                        "exp_reward": 120
                    },
                    {
                        "title": "Puasa Kategori",
                        "description": f"Tahan diri 100% dari pengeluaran untuk {request.kategori_aktif} hari ini.",
                        "reason": f"Mengerem pengeluaran di kategori yang baru saja kamu gunakan melatih kontrol diri dari sifat impulsif.",
                        "quest_type": "Hemat",
                        "difficulty": "Sedang", 
                        "exp_reward": 200
                    },
                    {
                        "title": "Amankan Cash Fisik",
                        "description": f"Pergi ke ATM hari ini, tarik tunai sisa Rp {request.sisa_anggaran} milikmu.",
                        "reason": "Memegang uang tunai secara fisik memberikan beban psikologis yang ampuh untuk menahan hasrat jajan online/scan QR.",
                        "quest_type": "Tarik Tunai",
                        "difficulty": "Sulit", 
                        "exp_reward": 350
                    }
                ]
            }
        }

# %% 8. Health Check
@app.get("/test")
async def test_endpoint():
    return {"message": "Modular API Server Berjalan Normal!"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)