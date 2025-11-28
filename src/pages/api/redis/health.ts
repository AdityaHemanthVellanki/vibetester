import type { NextApiRequest, NextApiResponse } from 'next'
import { redisConnection } from '@/lib/queue'
import { config } from '@/lib/env'

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const start = Date.now()
    const pong = await redisConnection.ping()
    const latencyMs = Date.now() - start
    return res.status(200).json({ ok: pong === 'PONG', pong, latencyMs })
  } catch (e) {
    return res.status(503).json({ ok: false })
  }
}
