# ============================================================
# BILLING DASHBOARD - Separate S3 + CloudFront for billing.viraltenant.com
# ============================================================

# S3 Bucket für Billing Dashboard
resource "aws_s3_bucket" "billing_dashboard" {
  bucket = "${var.platform_name}-billing-dashboard-${var.environment}"

  tags = merge(var.tags, {
    Name = "${var.platform_name}-billing-dashboard"
    Type = "BillingDashboard"
  })
}

resource "aws_s3_bucket_website_configuration" "billing_dashboard" {
  bucket = aws_s3_bucket.billing_dashboard.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

resource "aws_s3_bucket_public_access_block" "billing_dashboard" {
  bucket = aws_s3_bucket.billing_dashboard.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFront Origin Access Control
resource "aws_cloudfront_origin_access_control" "billing_dashboard" {
  name                              = "${var.platform_name}-billing-oac-${var.environment}"
  description                       = "OAC for Billing Dashboard"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# S3 Bucket Policy für CloudFront
resource "aws_s3_bucket_policy" "billing_dashboard" {
  bucket = aws_s3_bucket.billing_dashboard.id

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
        Resource = "${aws_s3_bucket.billing_dashboard.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.billing_dashboard.arn
          }
        }
      }
    ]
  })
}

# CloudFront Distribution für Billing Dashboard
resource "aws_cloudfront_distribution" "billing_dashboard" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100"

  aliases = var.enable_custom_domain ? ["billing.${var.domain}"] : []

  origin {
    domain_name              = aws_s3_bucket.billing_dashboard.bucket_regional_domain_name
    origin_id                = "S3-billing-dashboard"
    origin_access_control_id = aws_cloudfront_origin_access_control.billing_dashboard.id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-billing-dashboard"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    compress               = true
  }

  # SPA: Return index.html for 404 errors
  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = var.enable_custom_domain ? false : true
    acm_certificate_arn            = var.enable_custom_domain ? var.acm_certificate_arn : null
    ssl_support_method             = var.enable_custom_domain ? "sni-only" : null
    minimum_protocol_version       = var.enable_custom_domain ? "TLSv1.2_2021" : null
  }

  tags = merge(var.tags, {
    Name = "${var.platform_name}-billing-cloudfront"
    Type = "BillingDashboard"
  })
}

# Route53 Record für billing.viraltenant.com
resource "aws_route53_record" "billing_dashboard" {
  count   = var.enable_custom_domain && var.hosted_zone_id != "" ? 1 : 0
  zone_id = var.hosted_zone_id
  name    = "billing.${var.domain}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.billing_dashboard.domain_name
    zone_id                = aws_cloudfront_distribution.billing_dashboard.hosted_zone_id
    evaluate_target_health = false
  }
}

# Outputs
output "billing_dashboard_bucket_name" {
  value       = aws_s3_bucket.billing_dashboard.id
  description = "S3 bucket name for billing dashboard"
}

output "billing_dashboard_cloudfront_domain" {
  value       = aws_cloudfront_distribution.billing_dashboard.domain_name
  description = "CloudFront domain for billing dashboard"
}

output "billing_dashboard_cloudfront_id" {
  value       = aws_cloudfront_distribution.billing_dashboard.id
  description = "CloudFront distribution ID for billing dashboard"
}

output "billing_dashboard_url" {
  value       = var.enable_custom_domain ? "https://billing.${var.domain}" : "https://${aws_cloudfront_distribution.billing_dashboard.domain_name}"
  description = "URL for billing dashboard"
}
