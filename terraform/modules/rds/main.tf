resource "aws_db_subnet_group" "main" {
  name       = "${var.name}-db-subnets"
  subnet_ids = var.subnet_ids
}

resource "aws_db_instance" "pg" {
  identifier = "${var.name}-pg"
  engine     = "postgres"
  instance_class = "db.t4g.micro"
  allocated_storage = 20
  username = var.db_username
  password = var.db_password
  db_subnet_group_name = aws_db_subnet_group.main.name
  skip_final_snapshot = true
  publicly_accessible = false
}

output "endpoint" { value = aws_db_instance.pg.address }
