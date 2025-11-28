const { Queue } = require('bullmq')
const IORedis = require('ioredis')
const fs = require('fs')

async function sleep(ms){ return new Promise(r=>setTimeout(r,ms)) }

async function main(){
  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
  const name = process.env.QUEUE_NAME || 'analyze'
  const connection = { url, maxRetriesPerRequest: null, tls: url.startsWith('rediss://') ? {} : undefined }
  const q = new Queue(name, { connection })
  const logFile = 'logs/self-heal.txt'
  fs.mkdirSync('logs', { recursive: true })
  function write(msg){ fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`) }
  write('self-heal started')
  while (true) {
    try {
      const c = await q.getJobCounts()
      if ((c.waiting||0) > 0 && (c.active||0) === 0) {
        write(`detected stuck: waiting=${c.waiting} active=${c.active}`)
        const waiting = await q.getJobs(['waiting'], 0, 50)
        for (const j of waiting) {
          try { await j.promote(); write(`promoted job ${j.id}`) } catch (e) { write(`promote failed ${j.id}: ${String(e.message||e)}`) }
        }
        if (process.env.DOCKER_CONTROL === 'true') {
          write('attempting dev worker restart')
          require('child_process').spawn('bash',['scripts/restart_worker_dev.sh'], { stdio: 'ignore' })
        }
      }
    } catch (e) { write(`error: ${String(e.message||e)}`) }
    await sleep(30000)
  }
}

main().catch(e => { console.error('self-heal: FAIL', e && e.message ? e.message : String(e)); process.exit(1) })
