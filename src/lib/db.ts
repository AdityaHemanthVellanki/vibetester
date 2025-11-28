import * as path from 'path'

type UserRec = { id: number; email: string; githubId: string }
type ApiKeyRec = { id: number; userId: number; keyHash: string; revoked: number; createdAt: number }
type UsageLogRec = { id: number; userId: number | null; apiKeyId: number | null; timestamp: number; route: string }

type DB = {
  exec(sql: string): void
  prepare(sql: string): Statement
}

let db: DB | null = null

export function getDb(): DB {
  if (!db) {
    const dbPath = path.join(process.cwd(), 'data', 'app.db')
    db = new BetterSqliteFallback(dbPath)
  }
  return db
}

export function migrate() {
  const d = getDb()
  d.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      githubId TEXT UNIQUE
    );
    CREATE TABLE IF NOT EXISTS apiKeys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      keyHash TEXT NOT NULL,
      revoked INTEGER DEFAULT 0,
      createdAt INTEGER DEFAULT (strftime('%s','now')),
      FOREIGN KEY(userId) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      apiKeyId INTEGER,
      timestamp INTEGER,
      route TEXT,
      FOREIGN KEY(userId) REFERENCES users(id),
      FOREIGN KEY(apiKeyId) REFERENCES apiKeys(id)
    );
    CREATE TABLE IF NOT EXISTS retries (
      id TEXT PRIMARY KEY,
      userId TEXT,
      origJobId TEXT,
      newJobId TEXT,
      timestamp INTEGER,
      attemptedWithToken INTEGER
    );
  `)
}

export function upsertUser(email: string, githubId: string): { id: number } {
  const d = getDb()
  const existing = d.prepare('SELECT id FROM users WHERE githubId = ?').get(githubId) as { id: number } | undefined
  if (existing) return { id: existing.id }
  const r = d.prepare('INSERT INTO users (email, githubId) VALUES (?, ?)').run(email, githubId)
  return { id: Number(r.lastInsertRowid) }
}

export function getUserById(id: number): { id: number; email: string; githubId: string } | undefined {
  const d = getDb()
  return d.prepare('SELECT id, email, githubId FROM users WHERE id = ?').get(id) as UserRec | undefined
}

export function insertUsage(userId: number | null, apiKeyId: number | null, route: string) {
  const d = getDb()
  d.prepare('INSERT INTO usage_logs (userId, apiKeyId, timestamp, route) VALUES (?, ?, ?, ?)')
    .run(userId, apiKeyId, Date.now(), route)
}

export function insertJobDuration(durationMs: number) {
  const d = getDb()
  d.prepare('INSERT INTO usage_logs (userId, apiKeyId, timestamp, route) VALUES (?, ?, ?, ?)')
    .run(null, null, durationMs, 'job_duration_ms')
}

export function createApiKey(userId: number, keyHash: string) {
  const d = getDb()
  const r = d.prepare('INSERT INTO apiKeys (userId, keyHash) VALUES (?, ?)').run(userId, keyHash)
  return { id: Number(r.lastInsertRowid) }
}

export function revokeApiKey(userId: number, keyId: number) {
  const d = getDb()
  d.prepare('UPDATE apiKeys SET revoked = 1 WHERE id = ? AND userId = ?').run(keyId, userId)
}

export function listApiKeys(userId: number): Array<{ id: number; revoked: number; createdAt: number }> {
  const d = getDb()
  return d.prepare('SELECT id, revoked, createdAt FROM apiKeys WHERE userId = ?').all(userId) as Array<{ id: number; revoked: number; createdAt: number }>
}

export function findApiKeyByHash(keyHash: string): { id: number; userId: number; revoked: number } | undefined {
  const d = getDb()
  return d.prepare('SELECT id, userId, revoked FROM apiKeys WHERE keyHash = ?').get(keyHash) as { id: number; userId: number; revoked: number } | undefined
}

export function usageStats() {
  const d = getDb()
  const jobsPerDay = d.prepare(
    `SELECT date(timestamp/1000, 'unixepoch') AS day, COUNT(*) AS count FROM usage_logs GROUP BY day ORDER BY day DESC`
  ).all()
  const numUsers = d.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }
  const activeKeys = d.prepare('SELECT COUNT(*) AS count FROM apiKeys WHERE revoked = 0').get() as { count: number }
  const avgDuration = d.prepare('SELECT AVG(timestamp) AS avg FROM usage_logs WHERE route = ?').get('job_duration_ms') as { avg: number | null }
  return { jobsPerDay, numUsers: numUsers.count, activeApiKeys: activeKeys.count, avgDurationMs: avgDuration.avg || 0 }
}

export function recordRetry(userId: string | null, origJobId: string, newJobId: string, attemptedWithToken: boolean) {
  const d = getDb()
  const id = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`
  d.prepare('INSERT INTO retries (id, userId, origJobId, newJobId, timestamp, attemptedWithToken) VALUES (?, ?, ?, ?, ?, ?)')
    .run(userId, origJobId, newJobId, Date.now(), attemptedWithToken ? 1 : 0)
}

class BetterSqliteFallback implements DB {
  file: string
  data: { users: UserRec[]; apiKeys: ApiKeyRec[]; usage_logs: UsageLogRec[]; retries: Array<{ id: string; userId: string | null; origJobId: string; newJobId: string; timestamp: number; attemptedWithToken: number }> }
  constructor(file: string) { this.file = file; this.data = { users: [], apiKeys: [], usage_logs: [], retries: [] } }
  exec(_: string) {}
  prepare(sql: string) { return new Statement(this, sql) }
}

class Statement {
  db: BetterSqliteFallback
  sql: string
  constructor(db: BetterSqliteFallback, sql: string) { this.db = db; this.sql = sql }
  run(...args: unknown[]) {
    const s = this.sql
    if (s.startsWith('INSERT INTO users')) {
      const id = this.db.data.users.length + 1
      const [email, githubId] = args as [string, string]
      this.db.data.users.push({ id, email, githubId })
      return { lastInsertRowid: id }
    }
    if (s.startsWith('INSERT INTO apiKeys')) {
      const id = this.db.data.apiKeys.length + 1
      const [userId, keyHash] = args as [number, string]
      const createdAt = Math.floor(Date.now() / 1000)
      this.db.data.apiKeys.push({ id, userId, keyHash, revoked: 0, createdAt })
      return { lastInsertRowid: id }
    }
    if (s.startsWith('UPDATE apiKeys SET revoked = 1')) {
      const [keyId, userId] = args as [number, number]
      const rec = this.db.data.apiKeys.find(a => a.id === keyId && a.userId === userId)
      if (rec) rec.revoked = 1
      return { lastInsertRowid: 0 }
    }
    if (s.startsWith('INSERT INTO usage_logs')) {
      const id = this.db.data.usage_logs.length + 1
      const [userId, apiKeyId, timestamp, route] = args as [number|null, number|null, number, string]
      this.db.data.usage_logs.push({ id, userId, apiKeyId, timestamp, route })
      return { lastInsertRowid: id }
    }
    if (s.startsWith('INSERT INTO retries')) {
      const [id, userId, origJobId, newJobId, timestamp, attemptedWithToken] = args as [string, string|null, string, string, number, number]
      this.db.data.retries.push({ id, userId, origJobId, newJobId, timestamp, attemptedWithToken })
      return { lastInsertRowid: 0 }
    }
    return { lastInsertRowid: 0 }
  }
  get(...args: unknown[]) {
    const s = this.sql
    if (s.startsWith('SELECT id FROM users WHERE githubId = ?')) {
      const [githubId] = args as [string]
      const u = this.db.data.users.find(u => u.githubId === githubId)
      return u ? { id: u.id } : undefined
    }
    if (s.startsWith('SELECT id FROM users WHERE email = ?')) {
      const [email] = args as [string]
      const u = this.db.data.users.find(u => u.email === email)
      return u ? { id: u.id } : undefined
    }
    if (s.startsWith('SELECT id, email, githubId FROM users WHERE id = ?')) {
      const [id] = args as [number]
      return this.db.data.users.find(u => u.id === id)
    }
    if (s.startsWith('SELECT id, userId, revoked FROM apiKeys WHERE keyHash = ?')) {
      const [keyHash] = args as [string]
      const a = this.db.data.apiKeys.find(a => a.keyHash === keyHash)
      return a ? { id: a.id, userId: a.userId, revoked: a.revoked } : undefined
    }
    if (s.startsWith('SELECT COUNT(*) AS count FROM users')) {
      return { count: this.db.data.users.length }
    }
    if (s.startsWith('SELECT COUNT(*) AS count FROM apiKeys WHERE revoked = 0')) {
      return { count: this.db.data.apiKeys.filter(a => a.revoked === 0).length }
    }
    if (s.startsWith('SELECT AVG(timestamp) AS avg FROM usage_logs WHERE route = ?')) {
      const [route] = args as [string]
      const vals = this.db.data.usage_logs.filter(u => u.route === route).map(u => u.timestamp)
      if (vals.length === 0) return { avg: null }
      const sum = vals.reduce((acc, n) => acc + n, 0)
      return { avg: sum / vals.length }
    }
    return undefined
  }
  all(...args: unknown[]) {
    const s = this.sql
    if (s.startsWith('SELECT id, revoked, createdAt FROM apiKeys WHERE userId = ?')) {
      const [userId] = args as [number]
      return this.db.data.apiKeys.filter(a => a.userId === userId).map(a => ({ id: a.id, revoked: a.revoked, createdAt: a.createdAt }))
    }
    if (s.startsWith("SELECT date(timestamp/1000, 'unixepoch') AS day, COUNT(*) AS count FROM usage_logs GROUP BY day")) {
      const groups: Record<string, number> = {}
      for (const u of this.db.data.usage_logs) {
        const day = new Date(u.timestamp).toISOString().slice(0, 10)
        groups[day] = (groups[day] || 0) + 1
      }
      return Object.entries(groups).map(([day, count]) => ({ day, count }))
    }
    return []
  }
}
