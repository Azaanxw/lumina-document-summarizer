# ECS task execution role — allows ECS to pull images from ECR and write CloudWatch logs
resource "aws_iam_role" "ecs_task_execution" {
  name = "lumina-ecs-task-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ECS task role — grants the running container S3 access via IAM (no hardcoded keys needed)
resource "aws_iam_role" "ecs_task" {
  name = "lumina-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "ecs_task_s3" {
  name = "lumina-s3-access"
  role = aws_iam_role.ecs_task.id

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

resource "aws_cloudwatch_log_group" "lumina_backend" {
  name              = "/ecs/lumina-backend"
  retention_in_days = 7
}

resource "aws_ecs_cluster" "lumina" {
  name = "lumina-cluster"
}

resource "aws_ecs_task_definition" "lumina_backend" {
  family                   = "lumina-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name  = "lumina-backend"
    image = "${aws_ecr_repository.lumina_backend.repository_url}:${var.app_image_tag}"

    portMappings = [{
      containerPort = 8000
      protocol      = "tcp"
    }]

    environment = [
      { name = "AWS_S3_BUCKET",          value = aws_s3_bucket.lumina_storage.bucket },
      { name = "AWS_REGION",             value = "eu-west-2" },
      { name = "ENVIRONMENT",            value = "production" },
      { name = "LOG_LEVEL",              value = "INFO" },
      { name = "CLOUDFRONT_DOMAIN",      value = aws_cloudfront_distribution.lumina_pdfs.domain_name },
      { name = "CLOUDFRONT_KEY_PAIR_ID", value = aws_cloudfront_public_key.lumina.id },
    ]

    secrets = [
      { name = "SUPABASE_URL",               valueFrom = "${aws_secretsmanager_secret.lumina_app.arn}:SUPABASE_URL::" },
      { name = "SUPABASE_SERVICE_ROLE_KEY",  valueFrom = "${aws_secretsmanager_secret.lumina_app.arn}:SUPABASE_SERVICE_ROLE_KEY::" },
      { name = "OPENAI_API_KEY",             valueFrom = "${aws_secretsmanager_secret.lumina_app.arn}:OPENAI_API_KEY::" },
      { name = "GEMINI_API_KEY",             valueFrom = "${aws_secretsmanager_secret.lumina_app.arn}:GEMINI_API_KEY::" },
      { name = "SENTRY_DSN",                 valueFrom = "${aws_secretsmanager_secret.lumina_app.arn}:SENTRY_DSN::" },
      { name = "CLOUDFRONT_PRIVATE_KEY_B64", valueFrom = "${aws_secretsmanager_secret.lumina_app.arn}:CLOUDFRONT_PRIVATE_KEY_B64::" },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.lumina_backend.name
        "awslogs-region"        = "eu-west-2"
        "awslogs-stream-prefix" = "ecs"
      }
    }

    essential = true
  }])
}

resource "aws_ecs_service" "lumina_backend" {
  name            = "lumina-backend"
  cluster         = aws_ecs_cluster.lumina.id
  task_definition = aws_ecs_task_definition.lumina_backend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.public_a.id, aws_subnet.public_b.id]
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.lumina_backend.arn
    container_name   = "lumina-backend"
    container_port   = 8000
  }

  depends_on = [aws_lb_listener.https]
}
