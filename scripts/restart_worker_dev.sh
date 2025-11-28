#!/usr/bin/env bash
set -e
if [ "$DOCKER_CONTROL" != "true" ]; then
  echo "DOCKER_CONTROL not enabled; refusing to restart worker"
  exit 1
fi
docker compose restart worker || echo "docker compose not available"
