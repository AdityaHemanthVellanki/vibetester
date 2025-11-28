import type { NextApiRequest, NextApiResponse } from 'next'
import { initSentry, addRetryBreadcrumb } from '@/lib/sentry'
import { verifySession, validateApiKeyHeader } from '@/lib/auth'
import { getJobStatus } from '@/lib/redis'
import { addAnalysisJob } from '@/lib/queue'
import * as DB from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { checkRate } from '@/lib/rateLimiter'
import { getRedis } from '@/lib/redis'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  initSentry()
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const allowAnon = (process.env.ALLOW_ANON || 'true') === 'true'
    const session = verifySession(req)
    const apiKeyAuth = validateApiKeyHeader(req)
    if (!allowAnon && !session && !apiKeyAuth) {
      return res.status(401).json({ error: 'unauthorized' })
    }

    const { jobId, gitToken } = req.body || {}
    if (!jobId || typeof jobId !== 'string') return res.status(400).json({ error: 'jobId required' })

    const statusAny = await getJobStatus(jobId) as any
    if (statusAny.status !== 'failed' || !statusAny.error) {
      return res.status(400).json({ error: 'job is not a failed clone job' })
    }
    const errLower = String(statusAny.error || '').toLowerCase()
    const isCloneError = errLower.includes('git clone failed') || errLower.includes('auth') || errLower.includes('401') || errLower.includes('403')
    if (!isCloneError) {
      return res.status(400).json({ error: 'not a clone-related failure' })
    }

    const origGitUrl = String(statusAny.gitUrl || '')
    if (!origGitUrl) return res.status(400).json({ error: 'original git url missing' })

    const userKey = apiKeyAuth ? `key:${apiKeyAuth.apiKeyId}` : session ? `user:${session.id}` : `anon:${req.socket.remoteAddress}`
    const rlKey = `retry:${jobId}:${userKey}`
    let cnt = 0
    try { cnt = Number(await getRedis().get(rlKey) || '0') } catch {}
    if (cnt >= 3) return res.status(429).json({ error: 'retry quota exceeded for this job' })
    try { await getRedis().set(rlKey, String(cnt + 1), 'EX', 24 * 3600) } catch {}

    const limitPerMinute = Number(process.env.RATE_LIMIT_PER_MINUTE || '30')
    const rlGlobalKey = userKey
    const rl = await checkRate(rlGlobalKey, limitPerMinute)
    if (!rl.allowed) {
      res.setHeader('Retry-After', String(rl.reset - Math.floor(Date.now()/1000)))
      return res.status(429).json({ error: 'rate limit exceeded' })
    }

    const newJobId = uuidv4()
    const attemptedWithToken = !!(gitToken && String(gitToken).length > 8)
    await addAnalysisJob({ jobId: newJobId, type: 'git', gitUrl: origGitUrl, gitToken: attemptedWithToken ? String(gitToken) : undefined } as any)
    const userIdStr = apiKeyAuth ? String(apiKeyAuth.userId) : session ? String(session.id) : null
    ;(DB as any).recordRetry(userIdStr, jobId, newJobId, attemptedWithToken)
    addRetryBreadcrumb(jobId, newJobId, attemptedWithToken)
    return res.status(200).json({ jobId: newJobId })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to retry'
    return res.status(500).json({ error: msg })
  }
}
