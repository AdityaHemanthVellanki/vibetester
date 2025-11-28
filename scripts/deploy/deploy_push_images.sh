#!/usr/bin/env bash
set -e
REGION="${AWS_REGION:-us-east-1}"
NAME="ai-test-architect"

WEB_REPO="$NAME-web"
WORKER_REPO="$NAME-worker"
SANDBOX_REPO="$NAME-sandbox"

aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$(aws sts get-caller-identity --query 'Account' --output text).dkr.ecr.$REGION.amazonaws.com"

docker build -t "$WEB_REPO" -f Dockerfile .
docker build -t "$WORKER_REPO" -f Dockerfile.worker .
docker build -t "$SANDBOX_REPO" -f Dockerfile.sandbox .

ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
WEB_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$WEB_REPO:latest"
WORKER_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$WORKER_REPO:latest"
SANDBOX_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$SANDBOX_REPO:latest"

docker tag "$WEB_REPO:latest" "$WEB_URI"
docker tag "$WORKER_REPO:latest" "$WORKER_URI"
docker tag "$SANDBOX_REPO:latest" "$SANDBOX_URI"

docker push "$WEB_URI"
docker push "$WORKER_URI"
docker push "$SANDBOX_URI"
