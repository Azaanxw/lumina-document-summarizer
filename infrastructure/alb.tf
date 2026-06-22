resource "aws_lb" "lumina" {
  name               = "lumina-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [aws_subnet.public_a.id, aws_subnet.public_b.id]
  idle_timeout       = 300
  tags               = { Project = "Lumina" }
}

resource "aws_lb_target_group" "lumina_backend" {
  name        = "lumina-backend-tg"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.lumina.id
  target_type = "ip"

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
    timeout             = 10
  }
}

# HTTP → HTTPS redirect
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.lumina.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.lumina.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.lumina_api.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.lumina_backend.arn
  }
}

output "alb_dns_name" {
  value       = aws_lb.lumina.dns_name
  description = "Point api.luminasummarizer.com CNAME to this value"
}
