# S3 Tenant Storage Module
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# S3 Bucket für Creator Assets (Private)
resource "aws_s3_bucket" "creator_assets" {
  bucket = "${var.platform_name}-creator-assets-${var.environment}"

  tags = merge(var.tags, {
    Name         = "${var.platform_name}-creator-assets"
    Type         = "CreatorStorage"
    BillingGroup = "videohost"
  })
}

resource "aws_s3_bucket_versioning" "creator_assets" {
  bucket = aws_s3_bucket.creator_assets.id
  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Disabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "creator_assets" {
  bucket = aws_s3_bucket.creator_assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "creator_assets" {
  bucket = aws_s3_bucket.creator_assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 Bucket für Upload-Temp (Private)
resource "aws_s3_bucket" "upload_temp" {
  bucket = "${var.platform_name}-upload-temp-${var.environment}"

  tags = merge(var.tags, {
    Name = "${var.platform_name}-upload-temp"
    Type = "UploadStorage"
  })
}

resource "aws_s3_bucket_versioning" "upload_temp" {
  bucket = aws_s3_bucket.upload_temp.id
  versioning_configuration {
    status = "Disabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "upload_temp" {
  bucket = aws_s3_bucket.upload_temp.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "upload_temp" {
  bucket = aws_s3_bucket.upload_temp.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle Policy für Upload-Temp (Auto-Delete nach 7 Tagen)
resource "aws_s3_bucket_lifecycle_configuration" "upload_temp" {
  bucket = aws_s3_bucket.upload_temp.id

  rule {
    id     = "delete_temp_uploads"
    status = "Enabled"

    filter {
      prefix = ""
    }

    expiration {
      days = 7
    }

    noncurrent_version_expiration {
      noncurrent_days = 1
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

# CORS Configuration für Upload-Bucket
resource "aws_s3_bucket_cors_configuration" "upload_temp" {
  bucket = aws_s3_bucket.upload_temp.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "POST", "DELETE"]
    allowed_origins = [
      "https://*.${var.platform_domain}",
      "https://${var.platform_domain}"
    ]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# CORS Configuration für Creator Assets Bucket (für presigned URL uploads)
resource "aws_s3_bucket_cors_configuration" "creator_assets" {
  bucket = aws_s3_bucket.creator_assets.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = [
      "https://viraltenant.com",
      "https://www.viraltenant.com",
      "https://*.${var.platform_domain}",
      "https://standupnow.ch",
      "https://www.standupnow.ch",
      "http://localhost:5173",
      "http://localhost:3000"
    ]
    expose_headers  = ["ETag", "x-amz-checksum-crc32"]
    max_age_seconds = 3600
  }
}

# CloudFront Origin Access Control für Creator Assets
resource "aws_cloudfront_origin_access_control" "creator_assets" {
  name                              = "${var.platform_name}-creator-assets-oac"
  description                       = "OAC for ${var.platform_name} creator assets"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# S3 Bucket Policy für CloudFront Access (Creator Assets)
# Wird später über separates Modul erstellt, um zirkuläre Abhängigkeiten zu vermeiden

# IAM Role für Lambda Asset Management
resource "aws_iam_role" "asset_management_role" {
  name = "${var.platform_name}-asset-management-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# IAM Policy für Asset Management
resource "aws_iam_role_policy" "asset_management_policy" {
  name = "${var.platform_name}-asset-management-policy-${var.environment}"
  role = aws_iam_role.asset_management_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.creator_assets.arn,
          "${aws_s3_bucket.creator_assets.arn}/*",
          aws_s3_bucket.upload_temp.arn,
          "${aws_s3_bucket.upload_temp.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = "arn:aws:dynamodb:*:*:table/${var.platform_name}-assets-${var.environment}*"
      }
    ]
  })
}