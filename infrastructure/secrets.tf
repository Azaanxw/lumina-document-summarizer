resource "aws_secretsmanager_secret" "lumina_app" {
  name                    = "lumina/app-secrets"
  recovery_window_in_days = 0 # immediate deletion allowed (no 30-day window)
}

resource "aws_secretsmanager_secret_version" "lumina_app" {
  secret_id = aws_secretsmanager_secret.lumina_app.id

  secret_string = jsonencode({
    SUPABASE_URL               = var.supabase_url
    SUPABASE_SERVICE_ROLE_KEY  = var.supabase_service_role_key
    OPENAI_API_KEY             = var.openai_api_key
    GEMINI_API_KEY             = var.gemini_api_key
    SENTRY_DSN                 = var.sentry_dsn
    CLOUDFRONT_PRIVATE_KEY_B64 = var.cloudfront_private_key_b64
  })
}

# Secrets access policies for the Lambda execution roles live in lambda.tf
# (aws_iam_role_policy.lambda_api_secrets / lambda_cron_secrets)

output "secrets_manager_arn" {
  value = aws_secretsmanager_secret.lumina_app.arn
}
