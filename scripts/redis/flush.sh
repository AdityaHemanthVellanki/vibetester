#!/usr/bin/env bash
set -e

echo "This will delete keys with prefix 'ai-test-architect'"
read -p "Are you sure? (yes/no): " ans
if [ "$ans" != "yes" ]; then
  echo "Aborted"
  exit 0
fi

REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
node - <<'EOF'
const IORedis = require('ioredis')
const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
const r = new IORedis(url)
;(async () => {
  const it = r.scanStream({ match: 'ai-test-architect*', count: 100 })
  const dels = []
  it.on('data', async (keys) => {
    if (keys.length) dels.push(r.del(...keys))
  })
  it.on('end', async () => {
    await Promise.all(dels)
    console.log('Deleted keys')
    r.quit()
  })
})()
EOF