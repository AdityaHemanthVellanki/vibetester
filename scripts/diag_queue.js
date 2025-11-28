const { Queue } = require('bullmq')
const IORedis = require('ioredis')

async function sleep(ms){ return new Promise(r=>setTimeout(r,ms)) }

async function main(){
  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
  const name = process.env.QUEUE_NAME || 'analyze'
  const connection = { url, maxRetriesPerRequest: null, tls: url.startsWith('rediss://') ? {} : undefined }
  const q = new Queue(name, { connection })
  const redis = new IORedis(url, { maxRetriesPerRequest: null, tls: url.startsWith('rediss://') ? {} : undefined })
  const counts = await q.getJobCounts()
  console.log('counts:', counts)
  const waiting = await q.getJobs(['waiting'], 0, 50)
  console.log('waiting (top 50):', waiting.map(j => ({ id: j.id, ts: j.timestamp, attemptsMade: j.attemptsMade, data: j.data })))
  try {
    const info = await redis.info()
    console.log('redis info snapshot: ok')
  } catch (e) { console.log('redis info failed:', String(e.message||e)) }
  const thresholdMs = Number(process.env.DIAG_THRESHOLD_MS || '30000')
  const start = Date.now()
  let lastActive = 0
  while (Date.now() - start < thresholdMs) {
    const c = await q.getJobCounts()
    lastActive = c.active || 0
    if ((c.waiting||0) === 0) break
    if (lastActive > 0) break
    await sleep(1000)
  }
  const final = await q.getJobCounts()
  const mismatch = name !== 'analyze' ? 'Queue name differs from expected "analyze"' : ''
  console.log('final counts:', final)
  if (mismatch) console.log('name check:', mismatch)
  try {
    const hbKeys = await redis.keys('worker:*:heartbeat')
    console.log('worker heartbeats:', hbKeys.length)
  } catch {}
  if ((final.waiting||0) > 0 && (final.active||0) === 0) {
    console.error('diag: waiting jobs present and no active workers')
    process.exit(2)
  }
  console.log('diag: PASS')
}

main().catch(e => { console.error('diag: FAIL', e && e.message ? e.message : String(e)); process.exit(1) })
