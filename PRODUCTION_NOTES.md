# Production Notes

## Hardening Priorities
1. MicroVM isolation (Firecracker/gVisor) for stronger tenant separation.
2. Strict egress controls: block outbound network except explicit allowlists.
3. Secrets protection: per-job ephemeral credentials; scrub env and process space.

## Operational Recommendations
- Move `progress_log` to append-only streams with retention policies.
- Use object storage for persistent artifacts if needed; scope keys per job.
- Implement rate limiting and per-IP throttling on `/api/analyze`.
- Add audit logging for container lifecycle events.

## Observability
- Track container exit codes, durations, and resource usage.
- Surface worker health metrics (queue lag, Redis errors).

## Disaster Recovery
- Store minimal job metadata with TTLs; avoid long-lived secrets.
- Implement backpressure handling when Redis or Docker is degraded.