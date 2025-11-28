import IORedis, { Redis } from 'ioredis'
import { config } from '@/lib/env'
const url = config.redisUrl || ''
const prefix = process.env.BULLMQ_PREFIX || 'ai-test-architect'

let redis: Redis | null = null
const inMemoryLogs: Map<string, Array<{ ts: number; step?: string; msg: string }>> = new Map()
function memAppend(jobId: string, entry: { ts: number; step?: string; msg: string }){
  const arr = inMemoryLogs.get(jobId) || []
  arr.push(entry)
  if (arr.length > 100) arr.shift()
  inMemoryLogs.set(jobId, arr)
}
export function getRedis(): Redis {
  if (!redis) {
    const client = new IORedis(url, {
      lazyConnect: true,
      enableAutoPipelining: true,
      maxRetriesPerRequest: null,
      retryStrategy: (times) => Math.min(times * 500, 5000),
      tls: url.startsWith('rediss://') ? {} : undefined,
    })
    client.on('ready', async () => {
      console.log('Redis ready')
      // Attempt to flush in-memory logs to Redis
      for (const [jobId, arr] of inMemoryLogs.entries()) {
        try {
          const key = `job:${jobId}:progress_log`
          const payloads = arr.map(e => JSON.stringify(e))
          if (payloads.length) {
            await client.rpush(key, ...payloads)
            await client.expire(key, 7 * 24 * 3600)
          }
          inMemoryLogs.delete(jobId)
        } catch {}
      }
    })
    client.on('error', (e) => { console.error('Redis error', e && (e as any).code ? (e as any).code : String(e)) })
    redis = client
  }
  return redis!
}

export function getBullConnection(): { connection: { url: string; maxRetriesPerRequest: null; tls?: Record<string, unknown> }; prefix?: string } {
  return { connection: { url, maxRetriesPerRequest: null, tls: url.startsWith('rediss://') ? {} : undefined }, prefix }
}

export interface JobFile { path: string; size?: number }
export interface JobResult { outDir?: string; s3Prefix?: string; files: JobFile[] }

export async function setProgress(jobId: string, message: string): Promise<void> {
  try { await getRedis().set(`job:${jobId}:progress`, message) } catch { memAppend(jobId, { ts: Date.now(), step: message, msg: message }) }
}

export async function appendProgressLog(jobId: string, message: string, step?: string): Promise<void> {
  const entry = { ts: Date.now(), step, msg: message }
  try {
    const key = `job:${jobId}:progress_log`
    await getRedis().rpush(key, JSON.stringify(entry))
    await getRedis().expire(key, 7 * 24 * 3600)
  } catch { memAppend(jobId, entry) }
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

export async function getProgressLog(jobId: string): Promise<Array<{ ts: number; step?: string; msg: string }>> {
  try {
    const raw = await getRedis().lrange(`job:${jobId}:progress_log`, 0, -1)
    const parsed = raw.map(s => { try { return JSON.parse(s) } catch { return { ts: Date.now(), msg: String(s) } } })
    return parsed
  } catch {
    return inMemoryLogs.get(jobId) || []
  }
}

export async function setResult(jobId: string, result: JobResult): Promise<void> { try { await getRedis().setex(`job:${jobId}:result`, 3600, JSON.stringify(result)) } catch {} }
export async function getJobResult(jobId: string): Promise<JobResult | null> { try { const d = await getRedis().get(`job:${jobId}:result`); return d ? JSON.parse(d) : null } catch { return null } }
export async function setError(jobId: string, error: string): Promise<void> { try { await getRedis().setex(`job:${jobId}:error`, 3600, error) } catch {} }
export async function getJobError(jobId: string): Promise<string | null> { try { return await getRedis().get(`job:${jobId}:error`) } catch { return null } }

export async function getJobStatus(jobId: string): Promise<{ status: 'queued' | 'running' | 'done' | 'failed'; progress: string[]; progress_log: Array<{ ts: number; step?: string; msg: string }>; result?: JobResult; error?: string; gitUrl?: string; startedAt?: number; completedAt?: number }>{
  const progress_log = await getProgressLog(jobId)
  const result = await getJobResult(jobId)
  const error = await getJobError(jobId)
  let meta: { gitUrl?: string } = {}
  try { const m = await getRedis().get(`job:${jobId}:meta`); meta = m ? JSON.parse(m) : {} } catch {}
  const timing = await getJobTiming(jobId)
  let status: 'queued' | 'running' | 'done' | 'failed' = 'queued'
  if (error) status = 'failed'
  else if (result) status = 'done'
  else if (progress_log.length > 0) status = 'running'
  const progress = progress_log.map(e => e.msg)
  return { status, progress, progress_log, result: result || undefined, error: error || undefined, gitUrl: meta.gitUrl, startedAt: timing.startedAt, completedAt: timing.completedAt }
}

export async function setJobMeta(jobId: string, meta: Record<string, unknown>): Promise<void> { try { await getRedis().setex(`job:${jobId}:meta`, 3600, JSON.stringify(meta)) } catch {} }

export async function setJobStatus(jobId: string, status: 'queued'|'running'|'done'|'failed'): Promise<void> { try { await getRedis().set(`job:${jobId}:status`, status) } catch {} }
export async function getJobStatusKey(jobId: string): Promise<string | null> { try { return await getRedis().get(`job:${jobId}:status`) } catch { return null } }

export async function healthCheck(): Promise<{ ok: boolean; pong?: string; latencyMs?: number }>{
  const start = Date.now()
  try { const pong = await getRedis().ping(); return { ok: pong === 'PONG', pong, latencyMs: Date.now() - start } } catch { return { ok: false } }
}

// Backward-compatible exports
export const setLatestStage = setProgress
export const setJobResult = setResult
export const setJobError = setError
