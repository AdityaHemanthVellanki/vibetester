#!/usr/bin/env bash
set -e
mkdir -p logs
if command -v docker >/dev/null 2>&1; then
  docker logs $(docker ps --filter "name=worker" -q | head -1) --tail 500 > logs/worker-last.txt || true
else
  echo "docker not available; attempting to capture local worker stdout (not guaranteed)" > logs/worker-last.txt
fi
echo "wrote logs/worker-last.txt"
