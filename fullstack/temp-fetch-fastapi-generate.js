import https from 'https'

const data = JSON.stringify({
  kategori_aktif: 'Makan & Minum',
  amount: 50000,
  sisa_anggaran: 1500000,
  is_weekend: 0,
  is_month_end: 0,
  exp_earned: 40,
  user_league: 'Silver'
})

const options = {
  hostname: 'samuelgautama-finesse-ai-api.hf.space',
  path: '/generate-missions',
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
