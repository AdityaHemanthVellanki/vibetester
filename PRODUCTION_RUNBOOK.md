# Production Runbook

## First Deploy
- Set GitHub Actions secrets
- Run `ci.yml` to build/push images
- Approve `deploy.yml` to apply Terraform and update services

## Rollback
- In ECR, select previous image tag
- Update ECS service to previous tag

## Logs & Metrics
- CloudWatch Logs: web, worker, sandbox tasks
- Alarms: high error rate, queue length

## Scale Worker
- Update desired count or autoscaling thresholds

## Secrets Rotation
- Update values in AWS Secrets Manager
- Redeploy services to pick up new secrets

## DR
- RDS automated backups and snapshots
- ElastiCache snapshots (if enabled)
- R2 lifecycle policies
