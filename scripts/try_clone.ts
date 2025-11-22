import { cloneWithRetries, sanitizeAndNormalizeGitUrl } from '../src/lib/git'
import * as fs from 'fs/promises'
import * as path from 'path'

async function main() {
  const gitUrl = process.argv[2]
  if (!gitUrl) { console.error('Usage: tsx scripts/try_clone.ts <gitUrl>'); process.exit(1) }
  const tmp = path.join(process.cwd(), 'tmp', `try-${Date.now()}`)
  const dest = path.join(tmp, 'repo')
  await fs.mkdir(tmp, { recursive: true })
  try {
    const normalized = sanitizeAndNormalizeGitUrl(gitUrl)
    console.log('Cloning', normalized)
    const res = await cloneWithRetries(normalized, dest, { retries: 2, timeoutMs: 30_000 })
    if (!res.success) {
      console.error(`git clone failed: ${res.errorMessage} (type=${res.errorType})`)
      console.error('Suggestions: check network, ensure HTTPS, repo visibility, try again')
      process.exit(2)
    }
    console.log('✅ clone succeeded:', dest)
  } catch (e) {
    console.error('Error:', e instanceof Error ? e.message : String(e))
    process.exit(1)
  }
}

main()