type R2Config = {
  provider: 'cloudflare'
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  endpoint: string | undefined
  forcePathStyle: boolean
}

type AuthConfig = {
  githubClientId: string
  githubClientSecret: string
  nextAuthUrl: string
  nextAuthSecret: string
  jwtSecret: string
}

type OpenAIConfig = { apiKey: string; model: string }

type RateLimits = { perMinute: number; perMinutePro: number }

type Observability = { sentryDsn: string | undefined; pushgateway: string | undefined }

type AppConfig = {
  nodeEnv: 'development' | 'production' | 'test'
  allowAnon: boolean
  port: number
}

export type Config = {
  app: AppConfig
  redisUrl: string | undefined
  databaseUrl: string | undefined
  r2: R2Config
  openai: OpenAIConfig
  auth: AuthConfig
  rateLimits: RateLimits
  observability: Observability
  env: { isProd: boolean; isEcs: boolean; isServerless: boolean; cloudRegion?: string; cloudDeployEnv?: string }
}

function bool(v: string | undefined, def = false): boolean {
  const s = String(v ?? '')
  if (!s) return def
  return ['1','true','yes','on'].includes(s.toLowerCase())
}

function num(v: string | undefined, def: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}

function normalizeEndpoint(url: string | undefined): string | undefined {
  if (!url) return undefined
  let u = url.trim()
  if (!/^https?:\/\//.test(u)) u = `https://${u}`
  return u.replace(/\/$/, '')
}

function validateRedisUrl(u: string | undefined, isProd: boolean): void {
  if (!u) return
  const ok = /^rediss?:\/\//.test(u)
  if (!ok) throw new Error(`Invalid REDIS_URL format; expected redis:// or rediss://`)
  if (isProd && u.startsWith('redis://')) {
    throw new Error(`In production, use TLS: rediss://`)
  }
}

export const config: Config = (() => {
  const nodeEnv = (process.env.NODE_ENV as AppConfig['nodeEnv']) || 'development'
  const isProd = nodeEnv === 'production'
  const isEcs = !!process.env.ECS_CONTAINER_METADATA_URI || !!process.env.AWS_EXECUTION_ENV
  const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME
  const cloudRegion = process.env.CLOUD_REGION || undefined
  const cloudDeployEnv = process.env.CLOUD_DEPLOY_ENV || undefined

  const redisUrl = process.env.REDIS_URL || undefined
  validateRedisUrl(redisUrl, isProd)

  const databaseUrl = process.env.DATABASE_URL || undefined

  const r2: R2Config = {
    provider: 'cloudflare',
    bucket: process.env.S3_BUCKET || 'your-r2-bucket',
    region: process.env.S3_REGION || 'auto',
    accessKeyId: process.env.S3_ACCESS_KEY_ID || 'your-r2-access-key',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'your-r2-secret',
    endpoint: normalizeEndpoint(process.env.S3_ENDPOINT),
    forcePathStyle: bool(process.env.S3_FORCE_PATH_STYLE, true),
  }

  const auth: AuthConfig = {
    githubClientId: process.env.GITHUB_OAUTH_CLIENT_ID || '',
    githubClientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET || '',
    nextAuthUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000',
    nextAuthSecret: process.env.NEXTAUTH_SECRET || 'dev-nextauth-secret',
    jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret',
  }

  const openai: OpenAIConfig = {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.LLM_MODEL || (isProd ? 'gpt-4o' : 'gpt-4o-mini'),
  }

  const rateLimits: RateLimits = {
    perMinute: num(process.env.RATE_LIMIT_PER_MINUTE, 30),
    perMinutePro: num(process.env.RATE_LIMIT_PER_MINUTE_PRO, 600),
  }

  const observability: Observability = {
    sentryDsn: process.env.SENTRY_DSN || undefined,
    pushgateway: process.env.PROMETHEUS_PUSHGATEWAY || undefined,
  }

  const app: AppConfig = {
    nodeEnv,
    allowAnon: bool(process.env.ALLOW_ANON, true),
    port: num(process.env.PORT, 3000),
  }

  if (isProd) {
    const missing: string[] = []
    if (!redisUrl) missing.push('REDIS_URL')
    if (!databaseUrl) missing.push('DATABASE_URL')
    if (!auth.nextAuthSecret) missing.push('NEXTAUTH_SECRET')
    if (!auth.jwtSecret) missing.push('JWT_SECRET')
    if (!openai.apiKey) missing.push('OPENAI_API_KEY')
    if (!r2.bucket || !r2.accessKeyId || !r2.secretAccessKey) missing.push('R2 credentials')
    if (missing.length) throw new Error(`Missing required envs in production: ${missing.join(', ')}`)
  }

  return { app, redisUrl, databaseUrl, r2, openai, auth, rateLimits, observability, env: { isProd, isEcs, isServerless, cloudRegion, cloudDeployEnv } }
})()
