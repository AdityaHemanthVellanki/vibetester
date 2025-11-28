# Queue Debugging Guide

## Quick Checks
- Verify `REDIS_URL` is reachable and uses `rediss://` in production.
- Ensure both API and worker use the same queue name: `analyze`.
- Use `scripts/inspect_queue.js` to print counts and waiting job IDs.

## Diagnostics
- `node scripts/diag_queue.js` → counts, top 20 waiting jobs, Redis INFO; exits nonzero if stuck.
- `bash scripts/diag_worker_logs.sh` → writes `logs/worker-last.txt`.
- `bash scripts/worker_tail.sh` → tails worker logs.

## Self-Heal (dev only)
- `DOCKER_CONTROL=true bash scripts/restart_worker_dev.sh` to restart worker container.

## Common Causes
- Redis credentials/TLS mismatch
- Queue name/prefix mismatch
- Worker not started or wrong connection
- Delayed jobs not promoted

## Prevention
- Shared BullMQ connection from `src/lib/redis.ts`
- Worker heartbeat (`worker/health-check.ts`)
- Structured progress logs in Redis with in-memory fallback
