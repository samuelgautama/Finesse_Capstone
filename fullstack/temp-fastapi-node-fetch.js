const payload = {
  features: {
    amount: 50000,
    amount_vs_user_avg: 1.1,
    budget_utilization_ratio: 0.5,
    'category_Hiburan & Nongkrong': 0,
    'category_Kebutuhan Kuliah': 0,
    'category_Makan & Minum': 1,
    'category_Tagihan & Kos': 0,
    'category_Transportasi': 0,
    cumulative_spend: 1500000,
    day_of_week: 3,
    is_month_end: 0,
    is_weekend: 0,
    monthly_budget: 3000000,
    'payment_method_Credit Card': 0,
    'payment_method_E-Wallet': 1,
    transaction_count: 28,
    transaction_to_budget_ratio: 0.016,
    user_avg_transaction: 45000
  }
}

console.log('node', process.version)
console.log('fetch available', typeof fetch !== 'undefined')

const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 5000)

fetch('https://samuelgautama-finesse-ai-api.hf.space/calculate-exp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
  signal: controller.signal
})
  .then(async res => {
    clearTimeout(timeout)
    console.log('status', res.status)
    const text = await res.text()
    console.log('body', text)
  })
  .catch(err => {
    console.error('fetch error', err.name, err.message)
    if (err instanceof Error && err.stack) console.error(err.stack)
  })
