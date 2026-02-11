# S3 Bucket Policies Module - Separates bucket policies to avoid circular dependencies
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# S3 Bucket Policy für CloudFront Access (Creator Assets)
resource "aws_s3_bucket_policy" "creator_assets" {
  bucket = var.creator_assets_bucket_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${var.creator_assets_bucket_arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = concat(
              [var.cloudfront_distribution_arn],
              var.additional_cloudfront_arns
            )
          }
        }
      }
    ]
  })
}