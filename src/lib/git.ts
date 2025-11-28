import { spawn } from 'child_process'

export function sanitizeAndNormalizeGitUrl(rawUrl: string, token?: string): string {
  let u = String(rawUrl || '').trim()
  if (!u) throw new Error('git url required')
  if (u.startsWith('git://')) throw new Error('git protocol not allowed; use https URL')

  if (u.startsWith('git@')) {
    // git@github.com:owner/repo.git → https://github.com/owner/repo.git
    const m = u.match(/^git@([^:]+):(.+)$/)
    if (!m) throw new Error('unsupported ssh url format')
    const host = m[1]
    const path = m[2]
    u = `https://${host}/${path}`
  }

  // Ensure https scheme
  if (!u.startsWith('https://')) {
    try {
      const parsed = new URL(u)
      u = `https://${parsed.host}${parsed.pathname}`
    } catch {
      // If it was missing scheme, assume https:// and continue
      if (!u.includes('://')) u = `https://${u}`
    }
  }

  // Ensure .git suffix
  if (!u.endsWith('.git')) {
    const parsed = new URL(u)
    if (!parsed.pathname.endsWith('.git')) {
      parsed.pathname = parsed.pathname.replace(/\/$/, '') + '.git'
      u = parsed.toString()
    }
  }

  // Optional PAT
  if (token) {
    const parsed = new URL(u)
    // embed token as username part: https://<token>@host/owner/repo.git
    parsed.username = encodeURIComponent(token)
    u = parsed.toString()
  }

  return u
}

export async function cloneWithRetries(url: string, dest: string, opts: { retries: number; timeoutMs: number; scrubToken?: string }): Promise<{ success: boolean; errorMessage?: string; errorType?: string }>{
  const attempts = Math.max(0, opts.retries) + 1
  let lastErr: { msg: string; type?: string } | null = null

  for (let i = 0; i < attempts; i++) {
    const res = await attemptClone(url, dest, opts.timeoutMs, opts.scrubToken)
    if (res.success) return { success: true }
    lastErr = { msg: res.errorMessage || 'unknown error', type: res.errorType }
    const backoffMs = 1000 * Math.pow(2, i)
    await sleep(backoffMs)
  }

  return { success: false, errorMessage: lastErr?.msg, errorType: lastErr?.type }
}

function attemptClone(url: string, dest: string, timeoutMs: number, scrub?: string): Promise<{ success: boolean; errorMessage?: string; errorType?: string }>{
  return new Promise((resolve) => {
    const args = ['clone', '--depth', '1', '--no-tags', '--single-branch', '--quiet', url, dest]
    const proc = spawn('git', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      // kill process
      try { proc.kill('SIGTERM') } catch {}
    }, timeoutMs)

    proc.stderr.on('data', d => { stderr += String(d) })
    proc.on('exit', (code) => {
      clearTimeout(timer)
      if (!code && !timedOut) return resolve({ success: true })
      // classify error type
      let msg = timedOut ? `timeout after ${timeoutMs}ms` : (stderr.trim() || `git exited ${code}`)
      if (scrub && scrub.length > 0) { try { msg = msg.split(scrub).join('***') } catch {} }
      const lower = msg.toLowerCase()
      const type = lower.includes('refused') ? 'ECONNREFUSED'
        : lower.includes('timed out') || timedOut ? 'ETIMEDOUT'
        : lower.includes('not found') ? 'NOT_FOUND'
        : lower.includes('permission denied') || lower.includes('authorization') ? 'AUTH'
        : 'OTHER'
      resolve({ success: false, errorMessage: msg, errorType: type })
    })
    proc.on('error', (err) => {
      clearTimeout(timer)
      let msg = err && typeof err === 'object' && 'message' in err ? String((err as any).message) : String(err)
      if (scrub && scrub.length > 0) { try { msg = msg.split(scrub).join('***') } catch {} }
      const lower = msg.toLowerCase()
      const type = lower.includes('refused') ? 'ECONNREFUSED'
        : lower.includes('timed out') ? 'ETIMEDOUT'
        : 'OTHER'
      resolve({ success: false, errorMessage: msg, errorType: type })
    })
  })
}

function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)) }