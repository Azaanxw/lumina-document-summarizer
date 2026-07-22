# ---------------------------------------------------------------------------
# API function — replaces ALB + ECS Fargate service + VPC.
# Runs the existing FastAPI/uvicorn app unchanged via the Lambda Web Adapter
# (see backend/Dockerfile). No VPC config — Supabase/OpenAI/Gemini/S3/Secrets
# Manager are all reached over the public internet/AWS public APIs, so there's
# nothing here that needs a VPC, and therefore no NAT/public-IP costs either.
# ---------------------------------------------------------------------------

resource "aws_iam_role" "lambda_api" {
  name = "lumina-lambda-api-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_api_basic" {
  role       = aws_iam_role.lambda_api.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_api_s3" {
  name = "lumina-s3-access"
  role = aws_iam_role.lambda_api.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ]
      Resource = [
        aws_s3_bucket.lumina_storage.arn,
        "${aws_s3_bucket.lumina_storage.arn}/*"
      ]
    }]
  })
}

resource "aws_iam_role_policy" "lambda_api_secrets" {
  name = "lumina-secrets-access"
  role = aws_iam_role.lambda_api.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "secretsmanager:GetSecretValue"
      Resource = aws_secretsmanager_secret.lumina_app.arn
    }]
  })
}

resource "aws_cloudwatch_log_group" "lumina_api" {
  name              = "/aws/lambda/lumina-backend-api"
  retention_in_days = 7
}

resource "aws_lambda_function" "lumina_api" {
  function_name = "lumina-backend-api"
  role          = aws_iam_role.lambda_api.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.lumina_backend.repository_url}:${var.app_image_tag}"

  timeout     = 300 # matches the old ALB idle_timeout — /ask, /process-document, /generate-cards call slow LLMs
  memory_size = 1024

  environment {
    variables = {
      AWS_S3_BUCKET          = aws_s3_bucket.lumina_storage.bucket
      ENVIRONMENT            = "production"
      LOG_LEVEL              = "INFO"
      CLOUDFRONT_DOMAIN      = aws_cloudfront_distribution.lumina_pdfs.domain_name
      CLOUDFRONT_KEY_PAIR_ID = aws_cloudfront_public_key.lumina.id
      SECRETS_ARN            = aws_secretsmanager_secret.lumina_app.arn
    }
  }

  # CI updates the running code via `aws lambda update-function-code` — Terraform
  # only needs a valid image at creation time and shouldn't fight subsequent deploys.
  lifecycle {
    ignore_changes = [image_uri]
  }

  depends_on = [aws_cloudwatch_log_group.lumina_api]
}

resource "aws_lambda_function_url" "lumina_api" {
  function_name      = aws_lambda_function.lumina_api.function_name
  authorization_type = "NONE" # app enforces its own auth via Supabase bearer tokens
}

# authorization_type = NONE alone doesn't allow public invocation — Lambda
# still needs explicit resource-based permissions for BOTH actions below
# (confirmed via the console's own warning banner: granting only
# InvokeFunctionUrl still 403s every request).
resource "aws_lambda_permission" "function_url_public" {
  statement_id           = "AllowPublicFunctionUrlInvoke"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.lumina_api.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "aws_lambda_permission" "function_public_invoke" {
  statement_id  = "AllowPublicInvokeFunction"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lumina_api.function_name
  principal     = "*"
}

output "lambda_function_url" {
  value       = aws_lambda_function_url.lumina_api.function_url
  description = "Set this as NEXT_PUBLIC_API_URL in the frontend"
}

# ---------------------------------------------------------------------------
# Cron function — replaces the in-process APScheduler job. Built from a
# separate image (backend/Dockerfile.cron, standard Lambda Python base) since
# mixing the Web Adapter's HTTP-proxy model with a non-HTTP EventBridge
# invocation isn't a documented/supported pattern.
# ---------------------------------------------------------------------------

resource "aws_iam_role" "lambda_cron" {
  name = "lumina-lambda-cron-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_cron_basic" {
  role       = aws_iam_role.lambda_cron.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_cron_s3" {
  name = "lumina-s3-cleanup-access"
  role = aws_iam_role.lambda_cron.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:DeleteObject",
        "s3:ListBucket"
      ]
      Resource = [
        aws_s3_bucket.lumina_storage.arn,
        "${aws_s3_bucket.lumina_storage.arn}/*"
      ]
    }]
  })
}

resource "aws_iam_role_policy" "lambda_cron_secrets" {
  name = "lumina-secrets-access"
  role = aws_iam_role.lambda_cron.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "secretsmanager:GetSecretValue"
      Resource = aws_secretsmanager_secret.lumina_app.arn
    }]
  })
}

resource "aws_cloudwatch_log_group" "lumina_cron" {
  name              = "/aws/lambda/lumina-backend-cron"
  retention_in_days = 7
}

resource "aws_lambda_function" "lumina_cron" {
  function_name = "lumina-backend-cron"
  role          = aws_iam_role.lambda_cron.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.lumina_backend.repository_url}:${var.cron_image_tag}"

  timeout     = 120
  memory_size = 512

  environment {
    variables = {
      LOG_LEVEL   = "INFO"
      SECRETS_ARN = aws_secretsmanager_secret.lumina_app.arn
    }
  }

  lifecycle {
    ignore_changes = [image_uri]
  }

  depends_on = [aws_cloudwatch_log_group.lumina_cron]
}
