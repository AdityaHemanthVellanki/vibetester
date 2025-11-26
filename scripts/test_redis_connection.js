const IORedis = require('ioredis')

async function main() {
  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
  const redis = new IORedis(url, { lazyConnect: true, retryStrategy: () => null })
  redis.on('error', (e) => {
    const code = e && e.code ? e.code : ''
    console.error('redis error', code || String(e))
  })
  try { await redis.connect() } catch (e) {
    console.error('connect error', e && e.code ? e.code : String(e))
  }
  try {
    const pong = await redis.ping()
    console.log(pong)
  } catch (e) {
    console.error('ping failed', e && e.code ? e.code : String(e))
  }
  try {
    await redis.set('testkey','value')
    const v = await redis.get('testkey')
    if (v === 'value') console.log('set/get ok')
    else console.log('set/get failed')
  } catch (e) {
    console.error('set/get error', e && e.code ? e.code : String(e))
  }
  try {
    const listKey = 'job:test:progress_log'
    await redis.lpush(listKey, 'ok')
    const arr = await redis.lrange(listKey, 0, -1)
    if (Array.isArray(arr) && arr.includes('ok')) console.log('list ok')
    else console.log('list failed')
  } catch (e) {
    console.error('list error', e && e.code ? e.code : String(e))
  }
  try { await redis.quit() } catch {}
}

main().catch(() => process.exit(1))
