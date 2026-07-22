# Replaces the in-process APScheduler cron job — EventBridge Scheduler invokes
# the cron Lambda directly at 3 AM UTC daily, matching the old `hour=3, minute=0`.

resource "aws_iam_role" "scheduler_invoke_cron" {
  name = "lumina-scheduler-invoke-cron-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "scheduler.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "scheduler_invoke_cron" {
  name = "lumina-invoke-cron-lambda"
  role = aws_iam_role.scheduler_invoke_cron.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "lambda:InvokeFunction"
      Resource = aws_lambda_function.lumina_cron.arn
    }]
  })
}

resource "aws_scheduler_schedule" "cleanup_anonymous_documents" {
  name       = "lumina-cleanup-anonymous-documents"
  group_name = "default"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression          = "cron(0 3 * * ? *)"
  schedule_expression_timezone = "UTC"

  target {
    arn      = aws_lambda_function.lumina_cron.arn
    role_arn = aws_iam_role.scheduler_invoke_cron.arn
  }
}
