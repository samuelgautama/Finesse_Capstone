import https from 'https'

const data = JSON.stringify({
  monthly_budget: 3000000,
  total_spent: 1500000,
  transaction_count: 28
})

const options = {
  hostname: 'samuelgautama-finesse-ai-api.hf.space',
  path: '/get-league',
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
