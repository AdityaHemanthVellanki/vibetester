terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = ">= 4.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

module "networking" {
  source = "./modules/networking"
  name   = var.name
  cidr_block = var.vpc_cidr
  az_count   = 2
}

module "ecr" {
  source = "./modules/ecs/ecr"
  name   = var.name
}

module "ecs" {
  source = "./modules/ecs/cluster"
  name   = var.name
  vpc_id = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  public_subnet_ids  = module.networking.public_subnet_ids
}

module "alb" {
  source = "./modules/ecs/alb"
  name   = var.name
  vpc_id = module.networking.vpc_id
  public_subnet_ids = module.networking.public_subnet_ids
  certificate_domain = var.domain
}

module "rds" {
  source = "./modules/rds"
  name   = var.name
  vpc_id = module.networking.vpc_id
  subnet_ids = module.networking.private_subnet_ids
  db_username = var.db_username
  db_password = var.db_password
}

module "redis" {
  source = "./modules/redis/elasticache"
  name   = var.name
  vpc_id = module.networking.vpc_id
  subnet_ids = module.networking.private_subnet_ids
}

module "r2" {
  source = "./modules/cloudflare_r2"
  account_id = var.cloudflare_account_id
  bucket_name = var.r2_bucket
}

output "alb_dns" { value = module.alb.alb_dns }
output "rds_endpoint" { value = module.rds.endpoint }
output "redis_endpoint" { value = module.redis.endpoint }
output "r2_bucket" { value = module.r2.bucket_name }
output "ecr_repo_web" { value = module.ecr.web_repository_url }
output "ecr_repo_worker" { value = module.ecr.worker_repository_url }
output "ecr_repo_sandbox" { value = module.ecr.sandbox_repository_url }
