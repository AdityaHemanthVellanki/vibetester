import type { NextApiRequest, NextApiResponse } from 'next'
import { verifySession } from '@/lib/auth'
import { usageStats } from '@/lib/db'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = verifySession(req)
  if (!session) return res.status(401).json({ error: 'unauthorized' })
  const stats = usageStats()
  return res.status(200).json(stats)
}