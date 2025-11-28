# Production Verification Report

## Summary
- Prepared production validation scripts:
  - `scripts/test_r2_prod.js` (R2 upload/presign/download/delete)
  - `scripts/test_db_prod.js` (Postgres connect, schema check, query)
  - `scripts/run_full_job_prod.js` (enqueue, status poll, result download)
- Hardened Redis client for TLS and reconnection; unified BullMQ connection.
- Standardized environment variables via `src/lib/env.ts`.

## How to Run
1. Ensure secrets set in environment (or ECS task secrets):
   - R2: `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, `S3_REGION`, `S3_FORCE_PATH_STYLE=true`
   - DB: `DATABASE_URL`
   - Redis: `REDIS_URL` (use `rediss://` in prod)
   - Web: `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `JWT_SECRET`
2. Start services or run in deployed environment.
3. Execute tests:
```
node scripts/test_r2_prod.js
node scripts/test_db_prod.js
node scripts/run_full_job_prod.js
```

## Expected Results
- R2: outputs `R2 storage test: PASS`
- DB: outputs `DB test: PASS`
- Full job: outputs `Full job pipeline: PASS`

## Notes
- Redis client uses TLS when `REDIS_URL` starts with `rediss://`.
- Endpoint normalization and required env validation are enforced by `src/lib/env.ts`.
- OAuth production readiness relies on `NEXTAUTH_URL`, `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`.

## Status
- Scripts ready; run them in your cloud deployment with real credentials to verify.
