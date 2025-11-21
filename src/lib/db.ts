let BetterSqlite: any
try { BetterSqlite = require('better-sqlite3') } catch {}
import * as path from 'path'

let db: any = null

export function getDb(): any {
  if (!db) {
    const dbPath = path.join(process.cwd(), 'data', 'app.db')
    if (BetterSqlite) db = new BetterSqlite(dbPath)
    else db = new BetterSqliteFallback(dbPath)
  }
  return db!
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
  return d.prepare('SELECT id, email, githubId FROM users WHERE id = ?').get(id) as any
}

export function insertUsage(userId: number | null, apiKeyId: number | null, route: string) {
  const d = getDb()
  d.prepare('INSERT INTO usage_logs (userId, apiKeyId, timestamp, route) VALUES (?, ?, ?, ?)')
    .run(userId, apiKeyId, Date.now(), route)
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
  return d.prepare('SELECT id, revoked, createdAt FROM apiKeys WHERE userId = ?').all(userId) as any
}

export function findApiKeyByHash(keyHash: string): { id: number; userId: number; revoked: number } | undefined {
  const d = getDb()
  return d.prepare('SELECT id, userId, revoked FROM apiKeys WHERE keyHash = ?').get(keyHash) as any
}

export function usageStats() {
  const d = getDb()
  const jobsPerDay = d.prepare(
    `SELECT date(timestamp/1000, 'unixepoch') AS day, COUNT(*) AS count FROM usage_logs GROUP BY day ORDER BY day DESC`
  ).all()
  const numUsers = d.prepare('SELECT COUNT(*) AS count FROM users').get() as any
  const activeKeys = d.prepare('SELECT COUNT(*) AS count FROM apiKeys WHERE revoked = 0').get() as any
  return { jobsPerDay, numUsers: numUsers.count as number, activeApiKeys: activeKeys.count as number }
}

class BetterSqliteFallback {
  file: string
  data: any
  constructor(file: string) { this.file = file; this.data = { users: [], apiKeys: [], usage_logs: [] } }
  exec(_: string) {}
  prepare(sql: string) { return new Statement(this, sql) }
}

class Statement {
  db: BetterSqliteFallback
  sql: string
  constructor(db: BetterSqliteFallback, sql: string) { this.db = db; this.sql = sql }
  run(...args: any[]) { return { lastInsertRowid: 0 } }
  get(...args: any[]) { return undefined }
  all(...args: any[]) { return [] }
}
