# Cloud Deployment (AWS + Cloudflare R2)

## Prerequisites
- AWS account with IAM user credentials
- Cloudflare account and API Token with R2 permissions
- GitHub repository with Secrets set

## Terraform
```
cd terraform
terraform init
terraform plan -var 'name=ai-test-architect' -var 'aws_region=us-east-1' -var 'vpc_cidr=10.0.0.0/16' -var 'domain=app.example.com' -var 'db_username=app' -var 'db_password=CHANGEME' -var 'cloudflare_api_token=CF_TOKEN' -var 'cloudflare_account_id=CF_ACCOUNT' -var 'r2_bucket=ai-test-architect-prod'
# terraform apply (after approval)
```

## GitHub Actions Secrets
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `OPENAI_API_KEY`
- `JWT_SECRET`
- `API_KEY_SALT`
- `DB_PASSWORD`
- `SENTRY_DSN` (optional)

## Build & Push Images
```
bash scripts/deploy/deploy_push_images.sh
```

## Deploy from CI
- Push to `main`
- Approve `deploy` workflow Run → applies Terraform and updates ECS services

## Manual Steps
- ACM certificate DNS validation
- Route53 or Cloudflare DNS A/AAAA record to ALB DNS
- Create Cloudflare R2 API token and account id, set in GitHub Secrets
