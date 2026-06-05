// src/api.js
import axios from 'https://cdn.jsdelivr.net/npm/axios@1.7.2/dist/esm/axios.min.js'

const BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3000/api'
  : '/api'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.response.use(
  res => res.data,
  err => {
    console.error('API Error:', err.response?.data || err.message)
    return Promise.reject(err.response?.data || err)
  }
)

export const TransactionAPI = {
  getAll: (userId = 1) => api.get(`/transactions?user_id=${userId}`),
  getById: (id) => api.get(`/transactions/${id}`),
  create: (data) => api.post('/transactions', data),
  delete: (id) => api.delete(`/transactions/${id}`),
  getMonthlySummary: (userId = 1) => api.get(`/transactions/summary/monthly?user_id=${userId}`)
}

export const QuestAPI = {
  getAll: (userId = 1) => api.get(`/quests?user_id=${userId}`),
  getById: (id) => api.get(`/quests/${id}`),
  create: (data) => api.post('/quests', data),
  updateProgress: (id, increment = 1) => api.patch(`/quests/${id}/progress`, { increment }),
  claim: (id) => api.post(`/quests/${id}/claim`),
  delete: (id) => api.delete(`/quests/${id}`)
}

export const UserAPI = {
  getProfile: (id = 1) => api.get(`/users/${id}`),
  updateProfile: (id, data) => api.patch(`/users/${id}`, data),
  getLeaderboard: (month) => api.get(`/users/leaderboard/monthly${month ? `?month=${month}` : ''}`)
}

export const AIAPI = {
  analyze: (userId = 1) => api.post('/ai/analyze', { user_id: userId }),
  suggestQuests: (userId = 1) => api.post('/ai/quest-suggest', { user_id: userId })
}

window.simpanTransaksiAPI = async function(nominal, kategori, catatan, tanggal) {
  try {
    const result = await TransactionAPI.create({ user_id: 1, amount: nominal, category: kategori, note: catatan, date: tanggal })
    console.log('✅ Transaksi disimpan ke database:', result)
    return result
  } catch (err) {
    console.warn('⚠️ Backend tidak tersedia:', err.message)
    return null
  }
}

window.getAIAnalysis = async function() {
  try {
    const result = await AIAPI.analyze(1)
    return result.data
  } catch (err) {
    console.warn('⚠️ AI tidak tersedia:', err.message)
    return null
  }
}

window.loadTransactionsFromDB = async function() {
  try {
    const result = await TransactionAPI.getAll(1)
    return result.data
  } catch (err) {
    console.warn('⚠️ Gagal load transaksi dari DB:', err.message)
    return []
  }
}

console.log('✅ Finesse API client loaded — Axios connected to', BASE_URL)
