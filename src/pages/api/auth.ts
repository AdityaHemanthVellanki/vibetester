import type { NextApiRequest, NextApiResponse } from 'next'
import { upsertUser, getUserById } from '@/lib/db'
import { signSession as signJwt, verifySession } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const action = (req.query.action as string) || 'me'
  if (action === 'login') {
    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID || ''
    const redirectUri = encodeURIComponent(`${req.headers.origin}/api/auth?action=callback`)
    const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=user:email`
    res.status(302).setHeader('Location', url)
    return res.end('redirect')
  }
  if (action === 'callback') {
    const code = req.query.code as string
    if (!code) return res.status(400).json({ error: 'code required' })
    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID || ''
    const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET || ''
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code })
    })
    if (!tokenRes.ok) return res.status(500).json({ error: 'oauth failed' })
    const tokenJson = await tokenRes.json() as any
    const accessToken = tokenJson.access_token
    const userRes = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${accessToken}` } })
    const userJson = await userRes.json() as any
    const emailRes = await fetch('https://api.github.com/user/emails', { headers: { Authorization: `Bearer ${accessToken}` } })
    const emails = await emailRes.json() as any[]
    const primaryEmail = emails.find(e => e.primary)?.email || emails[0]?.email || ''
    const { id } = upsertUser(primaryEmail, String(userJson.id))
    const token = signJwt({ id, email: primaryEmail })
    res.setHeader('Set-Cookie', `session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7*24*3600}`)
    return res.status(200).json({ id, email: primaryEmail, githubId: String(userJson.id) })
  }
  if (action === 'me') {
    const s = verifySession(req)
    if (!s) return res.status(401).json({ error: 'unauthorized' })
    const u = getUserById(s.id)
    if (!u) return res.status(404).json({ error: 'not found' })
    return res.status(200).json({ id: u.id, email: u.email, githubId: u.githubId })
  }
  return res.status(400).json({ error: 'invalid action' })
}
