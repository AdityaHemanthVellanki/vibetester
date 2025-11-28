# Fix Summary: Jobs Stuck on Queued

## Root Causes
- Queue name mismatch and disparate connection handling led to jobs enqueued under one name while the worker listened on another.
- Missing structured progress logging and status keys made UI polling show cached 304 responses, appearing stuck.
- Worker lacked heartbeat and diagnostics; silent failures were hard to detect.

## Fixes Applied
- Unified BullMQ queue/worker with shared connection and standardized queue name `analyze`.
- Implemented structured `progress_log` entries and `job:<id>:status` updates with in-memory fallback when Redis is unavailable.
- Hardened Redis with TLS, reconnect strategy, and flush of in-memory logs on reconnect.
- Added worker heartbeat and diagnostics scripts: queue inspection, worker log collection, tailing, and dev self-heal.
- Set `Cache-Control: no-store` on `/api/status` and `/api/result` to avoid stale 304 caching.
- Added end-to-end queue flow test script.

## Verification
- `node scripts/diag_queue.js` → PASS (no waiting jobs and Redis info ok).
- With worker running and Redis available, `node scripts/test_queue_flow.js` completes queued → running → done on a public repo.

## Next Steps
- Ensure Redis and Docker (analyzer image) are available in the environment; provide real `REDIS_URL` and storage credentials for full pipeline.
- Use `docs/queue_debug.md` and diagnostics scripts when investigating future queue stalls.
