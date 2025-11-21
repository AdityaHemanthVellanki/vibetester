#!/bin/bash

# Demo script for AI Test Architect Backend
# This script demonstrates the complete flow of submitting a job and polling for results

set -e

echo "🚀 AI Test Architect Backend Demo"
echo "=================================="

# Configuration
API_BASE="http://localhost:3000"
TEST_REPO=${1:-"https://github.com/rauchg/nextjs-blog-starter"}

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Testing with repository: $TEST_REPO${NC}"

# Step 1: Submit analysis job
echo -e "\n${YELLOW}Step 1: Submitting analysis job...${NC}"
RESPONSE=$(curl -s -X POST "$API_BASE/api/analyze" \
  -F "gitUrl=$TEST_REPO" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" != "200" ]; then
    echo -e "${RED}❌ Failed to submit job (HTTP $HTTP_CODE)${NC}"
    echo "Response: $BODY"
    exit 1
fi

JOB_ID=$(echo "$BODY" | grep -o '"jobId":"[^"]*' | cut -d'"' -f4)
echo -e "${GREEN}✅ Job submitted successfully!${NC}"
echo "Job ID: $JOB_ID"

# Step 2: Poll for status
echo -e "\n${YELLOW}Step 2: Polling job status...${NC}"

MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    ATTEMPT=$((ATTEMPT + 1))
    
    STATUS_RESPONSE=$(curl -s "$API_BASE/api/status?jobId=$JOB_ID")
    STATUS=$(echo "$STATUS_RESPONSE" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
    
    echo -e "${BLUE}Attempt $ATTEMPT: Status = $STATUS${NC}"
    
    # Show latest progress message
    LATEST_PROGRESS=$(echo "$STATUS_RESPONSE" | grep -o '"message":"[^"]*' | tail -1 | cut -d'"' -f4)
    if [ ! -z "$LATEST_PROGRESS" ]; then
        echo "  Latest: $LATEST_PROGRESS"
    fi
    
    if [ "$STATUS" = "done" ]; then
        echo -e "${GREEN}✅ Job completed!${NC}"
        break
    elif [ "$STATUS" = "failed" ]; then
        ERROR=$(echo "$STATUS_RESPONSE" | grep -o '"error":"[^"]*' | cut -d'"' -f4)
        echo -e "${RED}❌ Job failed: $ERROR${NC}"
        exit 1
    fi
    
    sleep 3
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo -e "${RED}❌ Timeout waiting for job completion${NC}"
    exit 1
fi

# Step 3: Download results
echo -e "\n${YELLOW}Step 3: Fetching results JSON...${NC}"

RESULT_JSON=$(curl -s "$API_BASE/api/result?jobId=$JOB_ID")
echo "$RESULT_JSON" | jq '.' || echo "$RESULT_JSON"

OUT_DIR=$(echo "$RESULT_JSON" | grep -o '"outDir":"[^"]*' | cut -d'"' -f4)
FIRST_PATH=$(echo "$RESULT_JSON" | grep -o '"path":"[^"]*' | head -1 | cut -d'"' -f4)
FIRST_PREVIEW=$(echo "$RESULT_JSON" | grep -o '"preview":"[^"]*' | head -1 | cut -d'"' -f4)

mkdir -p tmp
PREVIEW_FILE="tmp/demo-${JOB_ID}-first-preview.txt"
printf "%s" "$FIRST_PREVIEW" > "$PREVIEW_FILE"

echo -e "${GREEN}✅ Results fetched!${NC}"
echo "OutDir: $OUT_DIR"
echo "First file: $FIRST_PATH"
echo "First preview saved to: $PREVIEW_FILE"