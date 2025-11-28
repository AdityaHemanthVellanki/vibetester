# Environment Configuration Notes

## Files
- `.env.example`: local development placeholders; no real secrets; documents all keys.
- `env.example.prod`: production-oriented placeholders; values sourced from cloud secret managers.

## Secret Managers
- Use AWS Secrets Manager for: `OPENAI_API_KEY`, `NEXTAUTH_SECRET`, `JWT_SECRET`, `API_KEY_SALT`, RDS credentials.
- Use Cloudflare R2 service tokens for `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`.

## Injection
- ECS Task Definitions: map secrets to container envs via task `secrets` field.
- GitHub Actions: reference secrets in workflow `env` or command flags; never echo values.

## Cloudflare R2
- Endpoint format: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` (no trailing slash).
- Always set `S3_FORCE_PATH_STYLE=true` for AWS SDK v3 compatibility.

## Redis URL
- ElastiCache: `rediss://:PASSWORD@primary.cluster-xyz.use1.cache.amazonaws.com:6379` (TLS required in production).
- Upstash: `rediss://:PASSWORD@UPSTASH_HOST:6379` or REST API for serverless workers.

## Rotation
- Rotate `API_KEY_SALT` and `JWT_SECRET` via Secrets Manager; update services to pick up new values.

## CI Safety
- Use placeholders for `.env.example`; never commit real secrets.
- In CI, set only required secrets; avoid printing their values in logs.

## Detection
- `src/lib/env.ts` detects prod/ECS/serverless from `NODE_ENV`, `ECS_CONTAINER_METADATA_URI`, `VERCEL`.
