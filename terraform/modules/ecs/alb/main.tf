resource "aws_lb" "app" {
  name               = "${var.name}-alb"
  internal           = false
  load_balancer_type = "application"
  subnets            = var.public_subnet_ids
}

resource "aws_lb_target_group" "web" {
  name     = "${var.name}-tg"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = var.vpc_id
  target_type = "ip"
  health_check { path = "/" }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.app.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-2016-08"
  certificate_arn   = aws_acm_certificate.cert.arn
  default_action { type = "forward" target_group_arn = aws_lb_target_group.web.arn }
}

resource "aws_acm_certificate" "cert" {
  domain_name       = var.certificate_domain
  validation_method = "DNS"
}

output "alb_dns" { value = aws_lb.app.dns_name }
