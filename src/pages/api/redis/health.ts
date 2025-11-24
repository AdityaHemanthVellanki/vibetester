import type { NextApiRequest, NextApiResponse } from 'next'
import { healthCheck } from '@/lib/redis'

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const h = await healthCheck()
  return res.status(h.ok ? 200 : 503).json(h)
}