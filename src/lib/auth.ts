import jwt from 'jsonwebtoken'
import { upsertUser, getUserById, findApiKeyByHash } from '@/lib/db'
import crypto from 'crypto'

type Session = { id: number; email: string }

export function signSession(user: { id: number; email: string }): string {
  const secret = process.env.JWT_SECRET || 'dev-secret'
  return jwt.sign({ id: user.id, email: user.email }, secret, { expiresIn: '7d' })
}

export function verifySessionToken(token: string | undefined): Session | null {
  if (!token) return null
  try {
    const secret = process.env.JWT_SECRET || 'dev-secret'
    const decoded = jwt.verify(token, secret) as any
    return { id: decoded.id, email: decoded.email }
  } catch {
    return null
  }
}

export function parseSessionCookie(req: any): string | undefined {
  const cookie = req.headers?.cookie || ''
  const m = cookie.split(';').map(s => s.trim()).find(s => s.startsWith('session='))
  if (!m) return undefined
  return decodeURIComponent(m.split('=')[1])
}

export function verifySession(req: any): Session | null {
  const token = parseSessionCookie(req)
  return verifySessionToken(token)
}

export function hashApiKey(key: string): string {
  const secret = process.env.JWT_SECRET || 'dev-secret'
  return crypto.createHmac('sha256', secret).update(key).digest('hex')
}

export function validateApiKeyHeader(req: any): { apiKeyId: number; userId: number } | null {
  const key = req.headers['x-api-key']
  if (!key || typeof key !== 'string') return null
  const keyHash = hashApiKey(key)
  const rec = findApiKeyByHash(keyHash)
  if (!rec || rec.revoked) return null
  return { apiKeyId: rec.id, userId: rec.userId }
}