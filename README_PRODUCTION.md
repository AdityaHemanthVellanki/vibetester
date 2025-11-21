Setup

Environment
- Copy .env.example to .env.local and fill values

MinIO
- Run docker-compose.prod.yml to start MinIO, Redis, web, worker
- Access console at http://localhost:9001 and create bucket

GitHub OAuth
- Create OAuth App, set Authorization callback URL to http://localhost:3000/api/auth?action=callback
- Set GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET

API Keys
- Call POST /api/apikeys after login to generate a key
- Or run tsx scripts/migrate_db.ts then tsx scripts/generate_api_key.ts <email>

Rate Limiting
-- Controlled by RATE_LIMIT_PER_MINUTE
-- Returns 429 with Retry-After when exceeded

Running
- npm run build; npm run start

Security
- No guaranteed strong isolation unless microVMs added
- Secrets should be managed externally in production
- Analyzer containers run with --network=none and CPU/memory limits