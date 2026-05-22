# Certificate for api.luminasummarizer.com (the backend API subdomain)
resource "aws_acm_certificate" "lumina_api" {
  domain_name       = "api.luminasummarizer.com"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = { Project = "Lumina" }
}

# Waits for DNS validation to complete before ALB listener is created.
# After Phase 1 apply, add the CNAME record output below to your DNS provider,
# then run terraform apply again for Phase 2.
resource "aws_acm_certificate_validation" "lumina_api" {
  certificate_arn = aws_acm_certificate.lumina_api.arn

  timeouts {
    create = "10m"
  }
}

output "acm_validation_cname" {
  value       = aws_acm_certificate.lumina_api.domain_validation_options
  description = "Add this CNAME to your DNS provider to validate the SSL certificate"
}
