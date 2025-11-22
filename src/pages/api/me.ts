import type { NextApiRequest, NextApiResponse } from 'next'
import { verifySession } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = verifySession(req)
  if (!session) return res.status(401).json({ error: 'unauthorized' })
  return res.status(200).json({ id: session.id, email: session.email })
}