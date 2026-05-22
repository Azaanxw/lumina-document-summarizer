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
