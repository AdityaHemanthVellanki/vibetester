import IORedis from 'ioredis'

let redis: IORedis | null = null
function getRedis(): IORedis {
  if (!redis) redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379')
  return redis
}

export async function checkRate(key: string, limitPerMinute: number): Promise<{ allowed: boolean; remaining: number; reset: number }>{
  const r = getRedis()
  const now = Math.floor(Date.now() / 1000)
  const window = Math.floor(now / 60)
  const redisKey = `rl:${key}:${window}`
  const used = await r.incr(redisKey)
  if (used === 1) await r.expire(redisKey, 60)
  const remaining = Math.max(0, limitPerMinute - used)
  const allowed = used <= limitPerMinute
  const reset = (window + 1) * 60
  return { allowed, remaining, reset }
}