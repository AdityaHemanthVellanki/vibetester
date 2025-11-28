resource "aws_ecr_repository" "web" { name = "${var.name}-web" }
resource "aws_ecr_repository" "worker" { name = "${var.name}-worker" }
resource "aws_ecr_repository" "sandbox" { name = "${var.name}-sandbox" }

output "web_repository_url" { value = aws_ecr_repository.web.repository_url }
output "worker_repository_url" { value = aws_ecr_repository.worker.repository_url }
output "sandbox_repository_url" { value = aws_ecr_repository.sandbox.repository_url }
