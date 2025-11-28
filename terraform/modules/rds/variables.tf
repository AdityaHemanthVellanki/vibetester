variable "name" { type = string }
variable "vpc_id" { type = string }
variable "subnet_ids" { type = list(string) }
variable "db_username" { type = string }
variable "db_password" { type = string }
