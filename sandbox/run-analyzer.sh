#!/bin/sh
set -e

trap 'echo "[analyzer] received SIGTERM"; exit 143' TERM
trap 'echo "[analyzer] received SIGINT"; exit 130' INT

node /app/analyzer-entry.ts "$@"