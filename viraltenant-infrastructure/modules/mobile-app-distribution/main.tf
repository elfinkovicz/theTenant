# Mobile App Distribution Module
# S3 Bucket für APK Downloads mit Public Access

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# S3 Bucket für Mobile App Distribution
resource "aws_s3_bucket" "mobile_app" {
  bucket = "${var.platform_name}-mobile-app-${var.environment}"

  tags = merge(var.tags, {
    Name      = "${var.platform_name}-mobile-app"
    Component = "MobileAppDistribution"
  })
}

# Public Access erlauben
resource "aws_s3_bucket_public_access_block" "mobile_app" {
  bucket = aws_s3_bucket.mobile_app.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# Bucket Policy für Public Read
resource "aws_s3_bucket_policy" "mobile_app_public_read" {
  bucket = aws_s3_bucket.mobile_app.id

  depends_on = [aws_s3_bucket_public_access_block.mobile_app]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.mobile_app.arn}/*"
      }
    ]
  })
}

# CORS für Browser-Downloads
resource "aws_s3_bucket_cors_configuration" "mobile_app" {
  bucket = aws_s3_bucket.mobile_app.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["Content-Length", "Content-Type"]
    max_age_seconds = 3600
  }
}

# Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "mobile_app" {
  bucket = aws_s3_bucket.mobile_app.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
