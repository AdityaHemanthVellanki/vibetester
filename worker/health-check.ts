import { redisConnection } from '@/lib/queue'
import * as Sentry from '@sentry/node'

export function startWorkerHealth(workerId: string) {
  const ttl = 45
  async function heartbeat(){
    try {
      await redisConnection.setex(`worker:${workerId}:heartbeat`, ttl, String(Date.now()))
    } catch {}
  }
  async function checkMissing(){
    try {
      const keys = await redisConnection.keys('worker:*:heartbeat')
      if (!keys || keys.length === 0) {
        console.warn('no worker heartbeats present')
        try { Sentry.addBreadcrumb({ category: 'worker', message: 'missing heartbeats' }) } catch {}
      }
    } catch {}
  }
  const timer = setInterval(heartbeat, 15000)
  const chk = setInterval(checkMissing, 30000)
  heartbeat().catch(()=>{})
  return () => { clearInterval(timer); clearInterval(chk) }
}
