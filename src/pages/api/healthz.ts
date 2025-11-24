import type { NextApiRequest, NextApiResponse } from 'next'
import { healthCheck, getRedis } from '@/lib/redis'
import { listFiles } from '@/lib/storage'

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const checks: Record<string, any> = {}

  const rh = await healthCheck(); checks.redis = rh

  const s3Enabled = process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY && process.env.S3_ENDPOINT
  if (s3Enabled) {
    try { await listFiles('healthz/'); checks.storage = { ok: true } } catch (e) { checks.storage = { ok: false, error: e instanceof Error ? e.message : String(e) } }
  } else { checks.storage = { ok: false, skipped: true } }

  try { const key = 'healthz:ping'; await getRedis().set(key,'ok'); const v = await getRedis().get(key); checks.workerPing = { ok: v === 'ok' } } catch (e) { checks.workerPing = { ok: false, error: e instanceof Error ? e.message : String(e) } }

  const ok = Object.values(checks).every((c: any) => c && c.ok || c.skipped)
  return res.status(ok ? 200 : 503).json({ ok, checks })
}