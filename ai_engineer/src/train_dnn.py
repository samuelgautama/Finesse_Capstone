# %% Import Libraries
import pandas as pd
import numpy as np
import joblib
import os
from pathlib import Path
from tqdm import tqdm

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'  # Suppress TensorFlow logging
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'  # Disable oneDNN optimizations for better reproducibility

import tensorflow as tf
from tensorflow.keras import layers, Model
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from sklearn.compose import ColumnTransformer
from sklearn.metrics import r2_score
import datetime

# %% Load Dataset
# %% Load Dataset
current_dir = Path.cwd()

if current_dir.name == 'notebooks':
    PROJECT_ROOT = current_dir.parent
else:
    PROJECT_ROOT = current_dir
    
print(f"Current Directory: {current_dir}")
print(f"Project Root detected at: {PROJECT_ROOT}")
    
data_path = PROJECT_ROOT / 'dataset' / 'finesse_dataset_engineered.csv'

if not data_path.exists():
    raise FileNotFoundError(f"Dataset not found at: {data_path}")

df = pd.read_csv(data_path)
print(f"Dataset successfully loaded from: {data_path}")

# %% Preprocessing and Feature Engineering
X = df.drop(columns=['user_id', 'financial_health_score'])
y = df['financial_health_score']

# Convert boolean columns to integers
for col in X.columns:
    if X[col].dtype == 'bool':
        X[col] = X[col].astype(int)

# Target Scaling 
target_scaler = MinMaxScaler() 
y_scaled = target_scaler.fit_transform(y.values.reshape(-1, 1))

num_features = [
    'amount', 'monthly_budget', 'cumulative_spend', 
    'transaction_to_budget_ratio', 'budget_utilization_ratio', 
    'user_avg_transaction', 'amount_vs_user_avg'
]
pass_features = [col for col in X.columns if col not in num_features]

preprocessor_dnn = ColumnTransformer(
    transformers=[
        ('num', StandardScaler(), num_features),
        ('pass', 'passthrough', pass_features)
    ])

X_processed = preprocessor_dnn.fit_transform(X)

if hasattr(X_processed, "toarray"):
    X_processed = X_processed.toarray()

# %% Dataset Splitting 
X_train, X_test, y_train, y_test = train_test_split(
    X_processed, y_scaled, test_size=0.2, random_state=42
)

# %% 1. Custom Layer Implementation
class FinesseDenseLayer(layers.Layer):
    """Implementing standard dense layer (W * x + b) manually."""
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

# %% 2. Functional API Model Definition
input_layer = layers.Input(shape=(X_train.shape[1],), name="input_features")
x = layers.Dense(64, activation='relu', name="hidden_layer_1")(input_layer)

# Custom Layer
x = FinesseDenseLayer(units=32, activation='relu', name="custom_hidden_layer")(x)

x = layers.Dense(16, activation='relu', name="hidden_layer_3")(x)
output_layer = layers.Dense(1, activation='linear', name="output_layer")(x)

model = Model(inputs=input_layer, outputs=output_layer, name="Finesse_AI_Engine")
model.summary()

# %% 3. Training Loop with GradientTape and TensorBoard Logging
batch_size = 32

# tf.data.Dataset untuk batching dan shuffling
train_dataset = tf.data.Dataset.from_tensor_slices((X_train, y_train)).shuffle(buffer_size=1024).batch(batch_size)
val_dataset = tf.data.Dataset.from_tensor_slices((X_test, y_test)).batch(batch_size)

optimizer = tf.keras.optimizers.Adam(learning_rate=0.001)
loss_fn = tf.keras.losses.MeanSquaredError()

# Metric setup for tracking loss and MAE
train_loss_metric = tf.keras.metrics.Mean(name='train_loss')
train_mae_metric = tf.keras.metrics.MeanAbsoluteError(name='train_mae')
val_loss_metric = tf.keras.metrics.Mean(name='val_loss')
val_mae_metric = tf.keras.metrics.MeanAbsoluteError(name='val_mae')

# Tensorboard log setup
run_id = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
log_dir = PROJECT_ROOT / "logs" / "gradient_tape" / run_id

train_summary_writer = tf.summary.create_file_writer(str(log_dir / "train"))
val_summary_writer = tf.summary.create_file_writer(str(log_dir / "val"))

print(f"Log saved in: {log_dir}")

# %% 4. Training Loop and Evaluation Step Definitions
@tf.function
def train_step(x, y):
    with tf.GradientTape() as tape:
        predictions = model(x, training=True) # Forward pass
        loss = loss_fn(y, predictions)
    
    # Backward pass & update weights
    gradients = tape.gradient(loss, model.trainable_variables)
    optimizer.apply_gradients(zip(gradients, model.trainable_variables))
    
    train_loss_metric(loss)
    train_mae_metric(y, predictions)

@tf.function
def test_step(x, y):
    predictions = model(x, training=False)
    loss = loss_fn(y, predictions)
    val_loss_metric(loss)
    val_mae_metric(y, predictions)

# %% 5. Custom Training Loop with Early Stopping Logic
epochs = 50
print("\n" + "="*50)
print("\nStarting Custom Training Loop with tf.GradientTape...\n")
print("="*50 + "\n")

for epoch in range(epochs):
    # Metric reset on each epoch
    train_loss_metric.reset_state()
    train_mae_metric.reset_state()
    val_loss_metric.reset_state()
    val_mae_metric.reset_state()
    
    # Training Loop
    with tqdm(total=len(train_dataset), desc=f"Epoch {epoch+1:02d}/{epochs} [Train]", unit="batch", leave=False) as pbar:
        for x_batch_train, y_batch_train in train_dataset:
            train_step(x_batch_train, y_batch_train)
            pbar.update(1)
        
    # Evaluation Loop
    for x_batch_val, y_batch_val in val_dataset:
        test_step(x_batch_val, y_batch_val)
        
    # Metric results extraction
    t_loss = train_loss_metric.result()
    t_mae = train_mae_metric.result()
    v_loss = val_loss_metric.result()
    v_mae = val_mae_metric.result()
    
    # Writing to TensorBoard
    with train_summary_writer.as_default():
        tf.summary.scalar('loss', t_loss, step=epoch)
        tf.summary.scalar('mae', t_mae, step=epoch)
    with val_summary_writer.as_default():
        tf.summary.scalar('loss', v_loss, step=epoch)
        tf.summary.scalar('mae', v_mae, step=epoch)
        
    print(f"Epoch {epoch+1:02d}/{epochs} | Loss: {t_loss:.4f} - MAE: {t_mae:.4f} | Val Loss: {v_loss:.4f} - Val MAE: {v_mae:.4f}")
    
    # Custom Early Stopping logic (Ensuring MAE performance <= 0.02)
    if v_mae <= 0.02: 
        print(f"\n[Success] Target Validation MAE (<= 0.02) reached at Epoch {epoch+1}! (MAE: {v_mae:.4f})")
        print("Stopping training early to prevent overfitting.")
        break

# %% 6. Model Export and Preprocessor
# Define the directory
save_dir = PROJECT_ROOT / "saved_models" / 'Deep_Learning'

# Create the directory if it doesn't exist
save_dir.mkdir(parents=True, exist_ok=True)

# Save model and preprocessor to the folder
joblib.dump(preprocessor_dnn, save_dir / 'preprocessor_dnn.pkl')
joblib.dump(target_scaler, save_dir / 'target_scaler.pkl')
model.save(save_dir / 'finesse_dnn_v1.keras')

print(f"\nModel and Preprocessor successfully exported to: {save_dir}")

# %% 7. Inference & Final Evaluation
print("\n" + "="*50)
print("=== FINAL INFERENCE & EVALUATION ===")

# Predict entire test set to check R2 Score
y_pred_scaled = model.predict(X_test, verbose=0)
final_r2 = r2_score(y_test, y_pred_scaled)
print(f"Test R2 Score  : {final_r2:.4f} (Accuracy R-squared: {final_r2*100:.2f}%)")
print("="*50)

# Inference example one row of data
sample_data = X_test[0:1]
prediksi_scaled = model(sample_data, training=False).numpy()

# Return scale prediction and answer
ai_prediction = target_scaler.inverse_transform(prediksi_scaled)
true_answer = target_scaler.inverse_transform(y_test[0:1].reshape(-1, 1))

print(f"AI Prediction : {ai_prediction[0][0]:.2f}")
print(f"True Answer   : {true_answer[0][0]:.2f}")