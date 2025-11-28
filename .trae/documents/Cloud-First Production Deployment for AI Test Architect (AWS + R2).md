## Objectives

* Run an end-to-end verification across backend API, worker, sandbox, storage (R2), auth, frontend, admin, and metrics.

* Auto-diagnose and auto-fix failures in code/config; repeat until acceptance criteria pass.

* Maintain safety constraints: no billing, keep sandbox `--network none`, never persist private tokens.

## Verification Runner Implementation

* Create a single verification runner (`scripts/verify.ts`) that orchestrates checks and records results:

  * Step A: Environment checks and placeholders

  * Step B: Infra startup (docker-compose, sandbox image build, app + worker processes)

  * Step C: API smoke tests

  * Step D: Frontend flows

  * Step E: Storage tests (R2 signed URL)

  * Step F: Metrics & Sentry checks

  * Step G: Reporting to `VERIFY_REPORT.md`

* Runner logs each check with timestamp, pass/fail, and captures relevant logs (Next.js, worker, docker) to include in the report.

* Auto-fix loop: On failure, execute targeted fixers, re-run failing check; repeat up to configurable retries.

## Environment & Prerequisites

* Validate presence (in `.env` or process env) of: `REDIS_URL`, `OPENAI_API_KEY`, `S3_PROVIDER`, `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `JWT_SECRET`, `API_KEY_SALT`, `RATE_LIMIT_PER_MINUTE`.

* If missing, generate `.env.local` with safe placeholders only (no real secrets). Do not commit real credentials.

* Use screenshot hint to confirm R2 permissions visually if manual review is needed (include link in report: `/mnt/data/Screenshot 2025-11-22 at 14.56.23.png`).

## Infrastructure Startup

* Run `docker-compose up -d` with existing compose files; wait for Redis and MinIO (if present).

* Build sandbox analyzer image: `docker build -f sandbox/Dockerfile.analyzer -t analyzer-image .`.

* Start Next.js (`npm run dev`) and worker (`npm run worker`) in separate child processes; stream logs to the runner.

* Auto-fixes if startup fails:

  * Missing deps → run `npm install`.

  * Type errors → `npm run build`; apply minimal code fixes (incorrect imports/exports, missing types).

  * Port conflicts → probe and adjust dev server port or gracefully stop conflicting processes.

## API Smoke Tests

* POST `/api/analyze` with a small public TS repo (e.g., `https://github.com/vercel/next.js/tree/canary/examples/with-typescript`). Expect `{ jobId }`.

  * If clone fails, ensure host-side clone logic executes, URL normalization, retries, error propagation to Redis.

* GET `/api/status?jobId=`: poll until done/failed; assert fields: `status`, `progress[]`, `error?`, `result?`.

* GET `/api/result?jobId=`: when success, if R2 enabled, expect `{ s3Prefix, files[{ path, signedUrl }] }`; fetch each `signedUrl` (200 OK, correct content-type). If local, expect `{ outDir, files[{ path, preview }] }`.

* POST `/api/analyze/retry`: simulate failed clone; test with and without `gitToken`. Expect new `{ jobId }`, audit row recorded (`retries`), token never persisted.

* Auth endpoints:

  * GET `/api/me` with session or API key → user info.

  * API key lifecycle: POST/GET/DELETE `/api/apikeys` → create, list, revoke; ensure hashing with `API_KEY_SALT`.

* Admin: GET `/api/admin/usage` → metrics summary.

* Storage: run `scripts/test_r2_connection.js` to assert presigned URL works.

* Metrics & Sentry:

  * Verify emission of `jobs_started_total`, `jobs_failed_total`, `job_clone_auth_attempts_total`, `job_clone_auth_failures_total` to Pushgateway or console.

  * Initialize Sentry in dev; simulate a controlled error and assert breadcrumb/event capture (sanitized).

## Frontend Flows

* Upload/paste Git URL on `/` → `{ jobId }` and redirect `/job/<jobId>`.

* Job page: live logs update; progress timeline shows states (`validating git url`, `cloning`, `cloned`, `scanning`, `done` or `failed`).

* Result browsing: signed URL downloads; modal preview and download button function.

* Dashboard: login flow to `/dashboard`; API Key modal creates key; Jobs list shows jobs; Usage page shows metrics.

## Auto-Diagnose & Fix Logic

* When a check fails:

  1. Capture full logs: Next.js console, worker logs, docker/analyzer logs (stdout/stderr).
  2. Targeted fixes in order:

     * Missing package → add dependency to `package.json` (if clear) and `npm install`.

     * Type errors → minimal code tweaks to align imports/exports or type unions.

     * Env misconfig → generate `.env.local` placeholders; retry.

     * R2 failures → validate `S3_ENDPOINT`, `forcePathStyle`, credentials; fallback to local storage if endpoint invalid; surface actionable error.

     * Git clone failures → ensure host-side clone; sanitize URL; timeout/retries; clear, actionable error with suggestions.

     * LLM failures → if `OPENAI_API_KEY` missing, stub `generateTestsWithLLM` with deterministic mock responses during verification.

     * Redis errors → restart docker-compose; wait; retry.
  3. Re-run the failing check; repeat until pass or deterministic blocker.
  4. If non-automatable blocker (e.g., missing paid external), provide explicit remediation steps.

## Security & Validation Rules

* Never persist private tokens; use ephemeral in-memory only for host-side clone.

* Keep sandbox container `--network none`.

* Scrub secrets from logs (e.g., PAT values replaced).

* Use HTTPS-only clone; reject `git://` and untrusted hosts.

## Reporting

* Generate `VERIFY_REPORT.md` with:

  * Summary pass/fail and auto-fixes applied.

  * Checklist of all tests (A–C, plus frontend, metrics & Sentry) with timestamps and PASS/FAIL.

  * Failures & Fixes: root causes, code edits (file paths + diffs), and re-run results.

  * Remaining manual actions (e.g., supply real R2 keys, supply `OPENAI_API_KEY`), with exact env placeholders.

  * Reproduction: commands to start stack and re-run verification.

  * Security notes.

  * Include screenshot URL reference for R2 permissions.

## Acceptance Criteria Mapping

* All endpoints reachable with expected schemas.

* End-to-end worker execution; R2 upload or local fallback; `/api/result` returns working signed URLs and functional downloads.

* Host-side clone works for public; retry with PAT (mock/private) functions; token never persisted.

* Frontend flows: upload → job → logs → results; dashboard features operate.

* Metrics and Sentry show expected events or mocked equivalents.

* `VERIFY_REPORT.md` generated with complete run log.

## Planned Code/Files to Touch

* `scripts/verify.ts` (new): orchestrated verification runner.

* API: `/api/analyze`, `/api/analyze/retry`, `/api/status`, `/api/result`, `/api/apikeys`, `/api/auth/*` (tactical fixes if failures).

* Worker: `worker/index.ts` (only if verification finds regressions in host clone or sandbox mount/logging).

* Libs: `src/lib/git.ts`, `src/lib/storage.ts`, `src/lib/llm.ts` (mocking), `src/lib/sandbox.ts` (mount/read-only), `src/lib/metrics.ts`.

* Frontend: `src/pages/job/[jobId].tsx`, `src/components/*` (RetryModal, UploadRepo, StatusPoller, LogViewer, FileList) — only if UI verification fails.

* Scripts: `scripts/test_r2_connection.js`, `scripts/demo.sh` (enhanced outputs), `scripts/retry_demo.sh`.

* Report: `VERIFY_REPORT.md`.

## Execution Plan

1. Implement `scripts/verify.ts` with modular checks and auto-fix loop.
2. Run environment check; write `.env.local` placeholders if needed.
3. Start infra services; build analyzer image; start app and worker.
4. Run API smoke tests and storage/metrics tests; apply fixes as needed.
5. Run frontend flow checks via HTTP interactions; apply UI fixes as needed.
6. Generate `VERIFY_REPORT.md` with results.
7. Provide executive summary and any manual next steps (e.g., supply real R2 credentials, real LLM key).

