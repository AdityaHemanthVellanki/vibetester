# Backup & Restore

## Create RDB snapshot
- `docker exec ai-test-architect-redis redis-cli --rdb /data/dump-$(date +%s).rdb`

## Trigger BGSAVE
- `docker exec ai-test-architect-redis redis-cli BGSAVE`

## Restore from RDB
- Stop container.
- Place `dump.rdb` into `/data`.
- Start container; Redis loads snapshot on boot.

## Restore from AOF
- Stop container.
- Place `appendonly.aof` into `/data`.
- Start container; Redis replays AOF.

## Consistency Notes
- AOF provides better durability; RDB is compact and fast to load.
- Ensure files are from a trusted source and match server version.