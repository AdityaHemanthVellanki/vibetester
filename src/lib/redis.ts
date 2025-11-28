import IORedis, { Redis } from 'ioredis'
import { config } from '@/lib/env'
const url = config.redisUrl || ''
const prefix = 'ai-test-architect'

let redis: Redis | null = null
export function getRedis(): Redis {
  if (!redis) {
    const client = url ? new IORedis(url, {
      lazyConnect: true,
      enableAutoPipelining: true,
      maxRetriesPerRequest: null,
      retryStrategy: (times) => Math.min(times * 500, 5000),
    }) : new IORedis(url)
    client.on('ready', () => { console.log('Redis ready') })
    client.on('error', (e) => { console.error('Redis error', e && (e as any).code ? (e as any).code : String(e)) })
    redis = client
  }
  return redis!
}

export function getBullConnection(): { connection: { url: string; maxRetriesPerRequest: null }; prefix?: string } {
  return { connection: { url, maxRetriesPerRequest: null }, prefix }
}

export interface JobFile { path: string; size?: number }
export interface JobResult { outDir?: string; s3Prefix?: string; files: JobFile[] }

export async function setProgress(jobId: string, message: string): Promise<void> {
  try { await getRedis().set(`job:${jobId}:progress`, message) } catch {}
}

export async function appendProgressLog(jobId: string, message: string): Promise<void> {
  try {
    const key = `job:${jobId}:progress_log`
    await getRedis().rpush(key, message)
    await getRedis().expire(key, 7 * 24 * 3600)
  } catch {}
}

export async function setJobStarted(jobId: string): Promise<void> { try { await getRedis().set(`job:${jobId}:startedAt`, String(Date.now())) } catch {} }
export async function setJobCompleted(jobId: string): Promise<void> { try { await getRedis().set(`job:${jobId}:completedAt`, String(Date.now())) } catch {} }

export async function getJobTiming(jobId: string): Promise<{ startedAt?: number; completedAt?: number; durationMs?: number }>{
  try {
    const s = await getRedis().get(`job:${jobId}:startedAt`)
    const c = await getRedis().get(`job:${jobId}:completedAt`)
    const startedAt = s ? Number(s) : undefined
    const completedAt = c ? Number(c) : undefined
    const durationMs = startedAt && completedAt ? (completedAt - startedAt) : undefined
    return { startedAt, completedAt, durationMs }
  } catch { return { } }
}

export async function getProgressLog(jobId: string): Promise<string[]> {
  try { return await getRedis().lrange(`job:${jobId}:progress_log`, 0, -1) } catch { return [] }
}

export async function setResult(jobId: string, result: JobResult): Promise<void> { try { await getRedis().setex(`job:${jobId}:result`, 3600, JSON.stringify(result)) } catch {} }
export async function getJobResult(jobId: string): Promise<JobResult | null> { try { const d = await getRedis().get(`job:${jobId}:result`); return d ? JSON.parse(d) : null } catch { return null } }
export async function setError(jobId: string, error: string): Promise<void> { try { await getRedis().setex(`job:${jobId}:error`, 3600, error) } catch {} }
export async function getJobError(jobId: string): Promise<string | null> { try { return await getRedis().get(`job:${jobId}:error`) } catch { return null } }

export async function getJobStatus(jobId: string): Promise<{ status: 'queued' | 'processing' | 'done' | 'failed'; progress: string[]; result?: JobResult; error?: string; gitUrl?: string; startedAt?: number; completedAt?: number }>{
  const log = await getProgressLog(jobId)
  const result = await getJobResult(jobId)
  const error = await getJobError(jobId)
  let meta: { gitUrl?: string } = {}
  try { const m = await getRedis().get(`job:${jobId}:meta`); meta = m ? JSON.parse(m) : {} } catch {}
  const timing = await getJobTiming(jobId)
  let status: 'queued' | 'processing' | 'done' | 'failed' = 'queued'
  if (error) status = 'failed'
  else if (result) status = 'done'
  else if (log.length > 0) status = 'processing'
  return { status, progress: log, result: result || undefined, error: error || undefined, gitUrl: meta.gitUrl, startedAt: timing.startedAt, completedAt: timing.completedAt }
}

export async function setJobMeta(jobId: string, meta: Record<string, unknown>): Promise<void> { try { await getRedis().setex(`job:${jobId}:meta`, 3600, JSON.stringify(meta)) } catch {} }

export async function healthCheck(): Promise<{ ok: boolean; pong?: string; latencyMs?: number }>{
  const start = Date.now()
  try { const pong = await getRedis().ping(); return { ok: pong === 'PONG', pong, latencyMs: Date.now() - start } } catch { return { ok: false } }
}

// Backward-compatible exports
export const setLatestStage = setProgress
export const setJobResult = setResult
export const setJobError = setError
