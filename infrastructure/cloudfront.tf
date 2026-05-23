# Origin Access Control — lets CloudFront read from the private S3 bucket
resource "aws_cloudfront_origin_access_control" "lumina" {
  name                              = "lumina-s3-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# RSA public key registered with CloudFront — used to verify signed URLs produced by the backend
resource "aws_cloudfront_public_key" "lumina" {
  name        = "lumina-signing-key"
  encoded_key = var.cloudfront_public_key
}

resource "aws_cloudfront_key_group" "lumina" {
  name  = "lumina-key-group"
  items = [aws_cloudfront_public_key.lumina.id]
}

resource "aws_cloudfront_distribution" "lumina_pdfs" {
  origin {
    domain_name              = aws_s3_bucket.lumina_storage.bucket_regional_domain_name
    origin_id                = "s3-lumina"
    origin_access_control_id = aws_cloudfront_origin_access_control.lumina.id
  }

  enabled         = true
  is_ipv6_enabled = true

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-lumina"
    viewer_protocol_policy = "https-only"
    trusted_key_groups     = [aws_cloudfront_key_group.lumina.id]

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    min_ttl     = 0
    default_ttl = 86400   # 1 day
    max_ttl     = 604800  # 1 week
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  price_class = "PriceClass_100" # US, Canada, Europe
}

# Allow CloudFront OAC to read S3 objects — bucket stays fully private to everything else
resource "aws_s3_bucket_policy" "lumina_storage" {
  bucket = aws_s3_bucket.lumina_storage.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowCloudFrontOAC"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.lumina_storage.arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.lumina_pdfs.arn
        }
      }
    }]
  })
}

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.lumina_pdfs.domain_name
}

output "cloudfront_key_pair_id" {
  value = aws_cloudfront_public_key.lumina.id
}
