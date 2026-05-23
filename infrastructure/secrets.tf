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

# Allow the ECS task execution role to fetch this secret at container startup
resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "lumina-secrets-access"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "secretsmanager:GetSecretValue"
      Resource = aws_secretsmanager_secret.lumina_app.arn
    }]
  })
}

output "secrets_manager_arn" {
  value = aws_secretsmanager_secret.lumina_app.arn
}
