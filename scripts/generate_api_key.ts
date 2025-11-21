import { getDb, createApiKey } from '@/lib/db'
import { hashApiKey } from '@/lib/auth'

async function main() {
  const email = process.argv[2]
  if (!email) {
    process.stderr.write('usage: tsx scripts/generate_api_key.ts <email>\n')
    process.exit(1)
  }
  const d = getDb()
  const user = d.prepare('SELECT id FROM users WHERE email = ?').get(email) as any
  if (!user) {
    process.stderr.write('user not found\n')
    process.exit(1)
  }
  const raw = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  const keyHash = hashApiKey(raw)
  const rec = createApiKey(user.id, keyHash)
  process.stdout.write(JSON.stringify({ id: rec.id, key: raw }) + '\n')
}

main()