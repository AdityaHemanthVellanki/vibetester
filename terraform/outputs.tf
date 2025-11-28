output "alb_dns" { value = module.alb.alb_dns }
output "rds_endpoint" { value = module.rds.endpoint }
output "redis_endpoint" { value = module.redis.endpoint }
output "r2_bucket" { value = module.r2.bucket_name }
output "ecr_repo_web" { value = module.ecr.web_repository_url }
output "ecr_repo_worker" { value = module.ecr.worker_repository_url }
output "ecr_repo_sandbox" { value = module.ecr.sandbox_repository_url }
