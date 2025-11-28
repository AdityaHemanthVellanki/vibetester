const { Queue } = require('bullmq')
const IORedis = require('ioredis')

async function main(){
  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
  const connection = { url, maxRetriesPerRequest: null, tls: url.startsWith('rediss://') ? {} : undefined }
  const q = new Queue(process.env.QUEUE_NAME || 'analyze', { connection })
  const counts = await q.getJobCounts()
  console.log('Queue counts:', counts)
  const waiting = await q.getJobs(['waiting'], 0, 20)
  for (const j of waiting) {
    console.log('waiting:', j.id, j.timestamp, JSON.stringify(j.data))
  }
}

main().catch(e => { console.error(e); process.exit(1) })
