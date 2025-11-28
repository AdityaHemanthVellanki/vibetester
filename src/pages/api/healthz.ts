import type { NextApiRequest, NextApiResponse } from 'next'
import { listFiles } from '@/lib/storage'
import { redisConnection } from '@/lib/queue'

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const checks: Record<string, any> = {}

  try {
    const start = Date.now(); const pong = await redisConnection.ping(); const latencyMs = Date.now()-start
    checks.redis = { ok: pong === 'PONG', pong, latencyMs }
  } catch (e) { checks.redis = { ok: false } }

  const s3Enabled = process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY && process.env.S3_ENDPOINT
  if (s3Enabled) {
    try { await listFiles('healthz/'); checks.storage = { ok: true } } catch (e) { checks.storage = { ok: false, error: e instanceof Error ? e.message : String(e) } }
  } else { checks.storage = { ok: false, skipped: true } }

  try { const key = 'healthz:ping'; await redisConnection.set(key,'ok'); const v = await redisConnection.get(key); checks.workerPing = { ok: v === 'ok' } } catch (e) { checks.workerPing = { ok: false, error: e instanceof Error ? e.message : String(e) } }

  const ok = (checks.redis?.ok === true) && (checks.workerPing?.ok === true) && ((checks.storage?.ok === true) || (checks.storage?.skipped === true))
  return res.status(ok ? 200 : 503).json({ ok, checks })
}
