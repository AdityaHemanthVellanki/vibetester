import type { NextApiRequest, NextApiResponse } from 'next'
import { verifySession, hashApiKey } from '@/lib/auth'
import { createApiKey, listApiKeys, revokeApiKey } from '@/lib/db'
import crypto from 'crypto'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = verifySession(req)
  if (!session) return res.status(401).json({ error: 'unauthorized' })

  if (req.method === 'GET') {
    const keys = listApiKeys(session.id)
    return res.status(200).json({ keys })
  }
  if (req.method === 'POST') {
    const raw = crypto.randomBytes(24).toString('hex')
    const keyHash = hashApiKey(raw)
    const rec = createApiKey(session.id, keyHash)
    return res.status(200).json({ id: rec.id, key: raw })
  }
  if (req.method === 'DELETE') {
    const id = Number(req.query.id || '0')
    if (!id) return res.status(400).json({ error: 'id required' })
    revokeApiKey(session.id, id)
    return res.status(200).json({ ok: true })
  }
  res.setHeader('Allow', 'GET, POST, DELETE')
  return res.status(405).json({ error: 'Method Not Allowed' })
}