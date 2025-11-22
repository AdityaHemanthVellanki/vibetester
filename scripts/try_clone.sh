#!/usr/bin/env bash
set -e
if [ -z "$1" ]; then
  echo "Usage: ./scripts/try_clone.sh <gitUrl>" >&2
  exit 1
fi
exec npx tsx scripts/try_clone.ts "$1"