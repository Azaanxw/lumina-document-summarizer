variable "supabase_url" {
  description = "Supabase project URL"
  type        = string
}

variable "supabase_service_role_key" {
  description = "Supabase service role key"
  type        = string
  sensitive   = true
}

variable "openai_api_key" {
  description = "OpenAI API key"
  type        = string
  sensitive   = true
}

variable "gemini_api_key" {
  description = "Google Gemini API key"
  type        = string
  sensitive   = true
}

variable "sentry_dsn" {
  description = "Sentry DSN for error tracking"
  type        = string
  default     = ""
}

variable "app_image_tag" {
  description = "ECR tag for the API Lambda image. Terraform only reads this at creation time (image_uri is in lifecycle.ignore_changes) — CI updates the running code afterwards via `aws lambda update-function-code`. An image with this tag must already exist in ECR before the first `terraform apply`."
  type        = string
  default     = "api-latest"
}

variable "cron_image_tag" {
  description = "ECR tag for the cron Lambda image. Same bootstrapping caveat as app_image_tag."
  type        = string
  default     = "cron-latest"
}

variable "cloudfront_public_key" {
  description = "RSA-2048 public key in PEM format for signing CloudFront URLs"
  type        = string
}

variable "cloudfront_private_key_b64" {
  description = "Base64-encoded RSA-2048 private key for signing CloudFront URLs"
  type        = string
  sensitive   = true
}
