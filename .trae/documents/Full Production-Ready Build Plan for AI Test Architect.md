## Architecture Overview
- Backend: Next.js API routes for analyze, status, result, auth, apikeys, admin usage; Redis for job state; JWT for sessions; GitHub OAuth for login.
- Worker: Long-running process that dequeues jobs, runs sandbox container (`analyzer-image`) with no network, constrained CPU/mem, streams logs to Redis, writes outputs to `tmp/<jobId>/out`, uploads artifacts to Cloudflare R2.
- Storage: Cloudflare R2 via AWS SDK v3, using endpoint override and `forcePathStyle=true`. Presigned GET URLs expire after 1 hour.
- Frontend: Dark-themed dashboard (overview, jobs, usage, API keys), landing + upload, job inspector with live logs, file preview modal with syntax highlight and signed download URL.
- Observability: Sentry SDK for API and worker; optional Prometheus Pushgateway metrics.
- CI: GitHub Actions workflow runs install, build, lint, typecheck.
- Docs & Scripts: README, R2 guide, production notes, CLI scripts, tests.

## Environment & Configuration
- `.env.example` keys: `OPENAI_API_KEY`, `REDIS_URL`, `JWT_SECRET`, `API_KEY_SALT`, `S3_PROVIDER=cloudflare`, `S3_BUCKET`, `S3_REGION=auto`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, `S3_FORCE_PATH_STYLE=true`, `SANDBOX_TIMEOUT_MS`, `SENTRY_DSN`, `PROMETHEUS_PUSHGATEWAY`.
- Keep `.env` for local dev, with guidance to never commit; `.env.local` used by Next.
- Rate limiting: `RATE_LIMIT_PER_MINUTE` (Redis-backed fixed window).

## Backend API Routes
- `src/pages/api/analyze.ts`: Accepts `x-api-key` or session cookie; validates rate limit; accepts `gitUrl` or file upload; enqueues job to Redis-backed queue; returns `{ jobId }`.
- `src/pages/api/status.ts`: Returns `{ status, progress, startedAt, updatedAt }` from Redis keys (`job:<id>:status`, `job:<id>:progress_log`).
- `src/pages/api/result.ts`: If `job:<id>:result` has `s3Prefix`, generate signed URLs for each file using R2 client and return `{ jobId, s3Prefix: "bucketName/jobId/out/", files: [{ path, size, signedUrl }] }`; else fall back to local `outDir` in dev.
- `src/pages/api/apikeys.ts`: Create/revoke/list keys for authenticated user; keys hashed with `API_KEY_SALT`.
- `src/pages/api/admin/usage.ts`: Aggregate jobs/day, avg duration, user count; guards with admin check (e.g., `ADMIN_EMAIL`).
- `src/pages/api/auth/[...nextauth].ts` or custom handlers: GitHub OAuth; `/api/me` returns current user.

## Auth & API Keys
- `src/lib/auth.ts`: JWT session helpers, cookie parsing, API key validation (hash with `API_KEY_SALT`), rate limit enforcement entry points.
- `src/lib/db.ts`: Users, API keys, usage logs. Provide a fallback DB for local dev while keeping SQLite/Prisma boundaries abstracted.
- `/login` page with GitHub button; dashboard layout guards pages, redirects unauthenticated users.

## Worker & Sandbox
- `worker/index.ts`:
  - Dequeue jobs from `repo-analysis` queue.
  - Spawn container from `sandbox/Dockerfile.analyzer` image with `--network none --memory=512m --cpus=1.0`, mount temp dir, enforce `SANDBOX_TIMEOUT_MS`.
  - Append logs to `job:<id>:progress_log` and update status phases: cloning → scanning → generating → uploading → done.
  - Upload `tmp/<jobId>/out/**` to R2 under canonical `bucket/<jobId>/out/<relative-path>`; store `job:<id>:result = { s3Prefix: "bucketName/jobId/out/", files }`.
  - On failure, set `job:<id>:error` and increment failure metric.

- `src/lib/sandbox.ts`: Helpers to run Docker container, enforce limits, stream logs, collect output.
- `.sandbox/Dockerfile.analyzer`: Minimal Node image with necessary tooling (git, ripgrep) to clone and run analyzer entry.
- `sandbox/analyzer-entry.ts`: Entrypoint reading env (job ID, git URL), produces test files to `out` and logs milestones.

## Storage (Cloudflare R2)
- `src/lib/storage.ts`: AWS SDK v3 client configured with endpoint override; `uploadOutDir(jobId, localPath)` returns `{ s3Prefix: "bucketName/jobId/out/", files }`; `getSignedUrlForKey(key, 3600)` presigns GET; optional `listFiles(prefix)`.
- `scripts/test_r2_connection.js`: Upload small file and print presigned URL, advise on Access Keys and endpoint.
- README includes Cloudflare R2 setup (Object Read & Write permission), endpoint guidance.

## Observability
- `src/lib/sentry.ts`: Initialize Sentry using `SENTRY_DSN`, environment, release; wrap API handlers with error capture.
- `src/lib/observability.ts`: Prometheus Pushgateway client to push `jobs_started_total`, `jobs_failed_total`, `job_duration_seconds` from worker.
- Integrate error capture and metrics in worker lifecycle and API routes.

## Frontend
- `src/pages/index.tsx`: Landing page, upload form (git URL or zip), sample generated test preview, privacy microcopy.
- `src/pages/job/[jobId].tsx`: Live status and log stream, progress timeline, file list with preview modal and signed download URL.
- `src/pages/dashboard/*.tsx`: Overview, API keys (create/revoke), jobs list, usage metrics page.
- Components: `UploadRepo`, `StatusPoller` (SWR polling), `LogViewer` (stream progress_log), `FileList`, `CodePreviewModal` (syntax highlight), `DashboardLayout`, `LoginButton`, `LogoutButton`, `ApiKeyCard`.

## CI & Tests
- `.github/workflows/ci.yml`: Node matrix (LTS), steps: checkout, setup-node, install, lint, typecheck, build; cache dependencies.
- `tests/llm.test.ts`: Unit test for `src/lib/llm.ts` mocking `fetch` to validate prompt and response handling.

## Documentation
- `README.md`: Local dev commands:
  - `docker-compose up -d`
  - `docker build -f sandbox/Dockerfile.analyzer -t analyzer-image .`
  - `cp .env.example .env` and fill keys
  - `npm install && npm run dev && npm run worker`
  - `bash scripts/demo.sh <gitUrl>`
- `README_S3_R2.md`: Cloudflare R2 steps, permission selection (Object Read & Write), CORS note, example `.env`.
- `PRODUCTION_NOTES.md`: Security/hardening checklist: secret management, microVM sandbox (gVisor/Firecracker), network isolation, quotas.

## Acceptance Walkthrough (Local)
- Start services: `docker-compose up -d`; build analyzer: `docker build -f sandbox/Dockerfile.analyzer -t analyzer-image .`.
- Configure `.env` with required keys; run Next dev and worker.
- From UI: upload git URL, redirect to `/job/<jobId>`, watch progress/logs; `/api/result` returns files with signed URLs; download works.
- Auth: GitHub login, create API key, enqueue via `x-api-key`, observe rate limiting when exceeding `RATE_LIMIT_PER_MINUTE`.
- `scripts/test_r2_connection.js` prints a working presigned URL.

## Deliverables Mapping (Files to Produce/Update)
- `.sandbox/Dockerfile.analyzer`, `sandbox/analyzer-entry.ts`
- `worker/index.ts`, `src/lib/sandbox.ts`, `src/lib/analyzer.ts`
- API: `src/pages/api/analyze.ts`, `src/pages/api/status.ts`, `src/pages/api/result.ts`, `src/pages/api/auth/[...nextauth].ts` (or custom), `src/pages/api/apikeys.ts`, `src/pages/api/admin/usage.ts`
- Lib: `src/lib/storage.ts`, `src/lib/auth.ts`, `src/lib/queue.ts`, `src/lib/db.ts`, `src/lib/llm.ts`, `src/lib/sentry.ts`, `src/lib/observability.ts`
- Frontend: `src/pages/index.tsx`, `src/pages/job/[jobId].tsx`, `src/pages/dashboard/*.tsx`, `src/components/*`
- Scripts: `scripts/demo.sh`, `scripts/enqueue.js`, `scripts/test_r2_connection.js`, `scripts/generate_api_key.ts`
- Infra: `docker-compose.yml`, `docker-compose.prod.yml`, `.Dockerfile`
- Config: `.env.example` (and `.env` if requested)
- Docs: `README.md`, `README_S3_R2.md`, `PRODUCTION_NOTES.md`
- CI: `.github/workflows/ci.yml`
- Tests: `tests/llm.test.ts`

## Commands to Run (Post-Implementation)
- `docker-compose up -d`
- `docker build -f sandbox/Dockerfile.analyzer -t analyzer-image .`
- `cp .env.example .env && vim .env` (fill keys)
- `npm install`
- `npm run dev` (Next) and `npm run worker` (worker)
- Enqueue example:
```
curl -X POST http://localhost:3000/api/analyze \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: <YOUR_API_KEY>' \
  -d '{"gitUrl":"https://github.com/owner/repo"}'
```
- Poll status: `curl "http://localhost:3000/api/status?jobId=<ID>"`
- Fetch result: `curl "http://localhost:3000/api/result?jobId=<ID>"`

## Notes & Assumptions
- LLM calls run on host by default; container receives no network. If passing `OPENAI_API_KEY` to container is needed for a job type, document risk in production notes.
- Redis must be running; queue uses lazy connect with graceful error handling.
- R2 presigned URLs default to 3600s expiry.
- Backwards compatibility: if `S3_PROVIDER` is not `cloudflare`, existing S3 behavior remains.

Please confirm this plan. Once approved, I will implement all files, wire integrations, add docs/CI/tests, and verify end-to-end locally.