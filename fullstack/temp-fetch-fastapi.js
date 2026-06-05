import https from 'https'

const data = JSON.stringify({
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
})

const options = {
  hostname: 'samuelgautama-finesse-ai-api.hf.space',
  path: '/calculate-exp',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}

const req = https.request(options, res => {
  let body = ''
  res.on('data', chunk => body += chunk)
  res.on('end', () => {
    console.log('STATUS', res.statusCode)
    console.log('BODY', body)
  })
})

req.on('error', err => console.error('ERR', err.message))
req.write(data)
req.end()
