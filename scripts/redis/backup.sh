#!/usr/bin/env bash
set -e

CID=${CID:-ai-test-architect-redis}
TS=$(date +%s)
OUT_DIR=ops/backups
mkdir -p "$OUT_DIR"

docker exec "$CID" redis-cli --rdb "/data/dump-$TS.rdb"
docker cp "$CID":"/data/dump-$TS.rdb" "$OUT_DIR/dump-$TS.rdb"
echo "Snapshot saved to $OUT_DIR/dump-$TS.rdb"