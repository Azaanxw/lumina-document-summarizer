resource "aws_ecr_repository" "lumina_backend" {
  name                 = "lumina-backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = { Project = "Lumina" }
}

output "ecr_repository_url" {
  value       = aws_ecr_repository.lumina_backend.repository_url
  description = "ECR URL — used in the docker push step"
}

# Keeps image storage bounded — every deploy pushes a new tag (api-<sha> or
# cron-<sha>) and nothing expired them before, so storage grew unbounded.
resource "aws_ecr_lifecycle_policy" "lumina_backend" {
  repository = aws_ecr_repository.lumina_backend.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 api-* images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["api-"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Keep last 10 cron-* images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["cron-"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = { type = "expire" }
      }
    ]
  })
}
