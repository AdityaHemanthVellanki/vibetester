// Database connectivity test (Postgres)
const { Client } = require('pg')

async function main() {
  const url = process.env.DATABASE_URL || ''
  if (!url) throw new Error('DATABASE_URL missing')
  const client = new Client({ connectionString: url, ssl: /neon|aws|rds/i.test(url) ? { rejectUnauthorized: false } : undefined })
  await client.connect()
  await client.query('CREATE TABLE IF NOT EXISTS prod_verify (id SERIAL PRIMARY KEY, note TEXT)')
  await client.query('INSERT INTO prod_verify (note) VALUES ($1)', ['hello db'])
  const { rows } = await client.query('SELECT note FROM prod_verify ORDER BY id DESC LIMIT 1')
  if (!rows[0] || rows[0].note !== 'hello db') throw new Error('DB content mismatch')
  await client.end()
  console.log('DB test: PASS')
}

main().catch(e => { console.error('DB test: FAIL', e && e.message ? e.message : String(e)); process.exit(1) })
