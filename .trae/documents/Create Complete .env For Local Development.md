## Overview
We will create a single `.env` file at the project root containing every environment variable needed across the web app, worker, sandbox, auth, storage, rate limiting, observability, and optional NextAuth. Values will be safe placeholders (no real secrets), grouped by clear headers. This will allow the project to run locally without additional configuration.

## Variable Coverage
- Core App: `NODE_ENV`, `ALLOW_ANON`, `PORT`
- Redis/Queue: `REDIS_URL`
- Database: `DB_PATH` (used by DB helpers; if not read yet, provides future compatibility)
- LLM/AI: `OPENAI_API_KEY`, `LLM_MODEL`
- Auth (GitHub OAuth + JWT): `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, `GITHUB_CALLBACK_URL`, `JWT_SECRET`
- API Keys: `API_KEY_SALT` (used for hashing if enabled; we currently use `JWT_SECRET` in code but we’ll include this as requested)
- Rate Limiting: `RATE_LIMIT_PER_MINUTE`, `RATE_LIMIT_PER_MINUTE_PRO`
- S3/Storage: `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`
- Sandbox/Docker: `SANDBOX_IMAGE_NAME`, `SANDBOX_MEMORY_LIMIT`, `SANDBOX_CPU_LIMIT`, `SANDBOX_TIMEOUT_MS`
- Observability: `SENTRY_DSN`, `PROMETHEUS_PUSHGATEWAY`
- Admin: `ADMIN_EMAIL`
- NextAuth: `NEXTAUTH_URL`, `NEXTAUTH_SECRET`

## Proposed .env Content
```
# Core App
NODE_ENV=development
ALLOW_ANON=true
PORT=3000

# Redis / Queue
REDIS_URL=redis://127.0.0.1:6379

# Database (SQLite or file-based)
DB_PATH=./data/app.db

# LLM / AI Models
OPENAI_API_KEY=changeme-openai
LLM_MODEL=gpt-4o-mini

# GitHub OAuth (Auth)
GITHUB_OAUTH_CLIENT_ID=changeme-github-id
GITHUB_OAUTH_CLIENT_SECRET=changeme-github-secret
GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/callback
JWT_SECRET=changeme-jwt-secret

# API Keys
API_KEY_SALT=changeme-apikey-salt

# Rate Limiting
RATE_LIMIT_PER_MINUTE=30
RATE_LIMIT_PER_MINUTE_PRO=600

# S3 / Storage
S3_BUCKET=ai-test-architect-dev
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=changeme-access-key
S3_SECRET_ACCESS_KEY=changeme-secret-key
S3_ENDPOINT=http://localhost:9000
S3_FORCE_PATH_STYLE=true

# Sandbox / Docker
SANDBOX_IMAGE_NAME=analyzer-image
SANDBOX_MEMORY_LIMIT=512m
SANDBOX_CPU_LIMIT=1.0
SANDBOX_TIMEOUT_MS=600000

# Observability / Monitoring
SENTRY_DSN=local-dev-sentry-dsn
PROMETHEUS_PUSHGATEWAY=http://localhost:9091

# Admin
ADMIN_EMAIL=admin@example.com

# NextAuth (optional)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=changeme-nextauth-secret
```

## Notes
- These values are placeholders suitable for local development. Replace with real secrets only in production.
- The current code reads many of these (`REDIS_URL`, `OPENAI_API_KEY`, `LLM_MODEL`, S3 variables, `JWT_SECRET`, `RATE_LIMIT_PER_MINUTE`, `SENTRY_DSN`, `PROMETHEUS_PUSHGATEWAY`). Others (e.g., `DB_PATH`, `API_KEY_SALT`, NextAuth) are included per your spec for completeness.

## Next Step
On your confirmation, I will create `.env` at the project root with the exact content above.