#!/usr/bin/env bash
set -e
if command -v docker >/dev/null 2>&1; then
  docker logs -f $(docker ps --filter "name=worker" -q | head -1)
else
  echo "docker not available; tailing local worker log"
  tail -f logs/worker-last.txt || true
fi
