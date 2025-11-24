#!/usr/bin/env bash
set -e
API_BASE="http://localhost:3000"
JOB_ID="$1"
TOKEN="$2"
if [ -z "$JOB_ID" ]; then
  echo "Usage: scripts/retry_demo.sh <origJobId> [gitToken]" >&2
  exit 1
fi
echo "Retrying job: $JOB_ID"
BODY=$(jq -n --arg jobId "$JOB_ID" --arg token "$TOKEN" '{jobId: $jobId, gitToken: ($token|length>8? $token: null)}')
RES=$(curl -s -X POST "$API_BASE/api/analyze/retry" -H 'Content-Type: application/json' -d "$BODY")
echo "$RES" | jq '.' || echo "$RES"