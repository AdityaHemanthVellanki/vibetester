resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.name}-redis-subnets"
  subnet_ids = var.subnet_ids
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "${var.name}-redis"
  engine               = "redis"
  node_type            = "cache.t4g.micro"
  num_cache_nodes      = 1
  subnet_group_name    = aws_elasticache_subnet_group.main.name
}

output "endpoint" { value = aws_elasticache_cluster.redis.cache_nodes[0].address }
