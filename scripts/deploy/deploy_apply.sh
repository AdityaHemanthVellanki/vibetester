#!/usr/bin/env bash
set -e
cd terraform
terraform init -input=false
terraform apply -auto-approve -input=false \
  -var "name=${NAME:-ai-test-architect}" \
  -var "aws_region=${AWS_REGION:-us-east-1}" \
  -var "vpc_cidr=${VPC_CIDR:-10.0.0.0/16}" \
  -var "domain=${DOMAIN}" \
  -var "db_username=app" \
  -var "db_password=${DB_PASSWORD}" \
  -var "cloudflare_api_token=${CLOUDFLARE_API_TOKEN}" \
  -var "cloudflare_account_id=${CLOUDFLARE_ACCOUNT_ID}" \
  -var "r2_bucket=${R2_BUCKET}"
