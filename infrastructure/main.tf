
# 1. AWS Provider Configuration
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "eu-west-2" # London
}

# 2. S3 Bucket Resource
# Bucket names MUST be globally unique across all of AWS.
resource "aws_s3_bucket" "lumina_storage" {
  bucket = "lumina-document-storage-${random_id.suffix.hex}"

  tags = {
    Project = "Lumina"
    Owner   = "Student-Project"
  }
}

# 3. Security: Block all public access (Crucial for privacy)
resource "aws_s3_bucket_public_access_block" "privacy" {
  bucket = aws_s3_bucket.lumina_storage.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# 4. Random ID generator to ensure bucket name uniqueness
resource "random_id" "suffix" {
  byte_length = 4
}

# 5. CORS — allows browsers on the production domains to fetch presigned S3 URLs
#    (safety net; CloudFront signed URLs are the primary path)
resource "aws_s3_bucket_cors_configuration" "lumina_storage" {
  bucket = aws_s3_bucket.lumina_storage.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = [
      "https://luminasummarizer.com",
      "https://www.luminasummarizer.com",
      "http://localhost:3000",
    ]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

# 6. Output the name so we can put it in our .env file later
output "bucket_name" {
  value = aws_s3_bucket.lumina_storage.bucket
}