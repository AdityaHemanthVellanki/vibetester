# Redis Operations

## Authentication (requirepass)
- Set a password in `ops/redis/redis.conf` by uncommenting `requirepass` and providing a strong value.
- Use `REDIS_URL=redis://:PASSWORD@host:port` in environments.
- Rotate by updating config and restarting the service; update all clients.

## Backups (AOF/RDB)
- AOF is enabled (`appendonly yes`) with `appendfsync everysec`.
- Trigger RDB snapshot: `docker exec ai-test-architect-redis redis-cli --rdb /data/dump.rdb` or `BGSAVE`.
- See `ops/redis/backup_restore.md` for restore steps.

## Restore
- RDB: place `dump.rdb` in `/data` and restart; server loads snapshot.
- AOF: place `appendonly.aof` in `/data` and restart; server replays log.

## Cluster/Replication
- For production, prefer managed Redis or private VPC deployments.
- Replication: configure `replicaof <master-host> <port>` on replicas.
- Cluster: provision 3+ masters and replicas; use `redis-cli --cluster create`.

## IAM/Firewall Notes
- Do not expose Redis publicly.
- Restrict access to application hosts only.
- Use TLS (`rediss://`) for production.

## Metrics
- Optionally run redis-exporter; see docker-compose metrics example.