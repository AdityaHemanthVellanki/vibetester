resource "aws_ecs_cluster" "main" { name = var.name }

output "cluster_arn" { value = aws_ecs_cluster.main.arn }
