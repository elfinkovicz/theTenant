# Domain Routing Module für Multi-Tenant Platform (Vereinfacht ohne Lambda@Edge)

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
resource "aws_cloudfront_distribution" "multi_domain" {
  origin {
    domain_name = var.s3_bucket_domain_name
    origin_id   = "S3-${var.s3_bucket_name}"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.multi_domain.cloudfront_access_identity_path
    }
  }

  # API Gateway Origin für API Calls
  origin {
    domain_name = split("/", replace(var.api_gateway_domain, "https://", ""))[0]
    origin_id   = "API-Gateway"
    origin_path = "/${var.environment}"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  comment             = "Multi-Tenant Creator Platform CDN"

  # Aliases für Multi-Domain Support (disabled until SSL certificate is configured)
  # aliases = var.custom_domains

  # Default Cache Behavior (für Website Content)
  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${var.s3_bucket_name}"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      headers      = ["Host", "CloudFront-Viewer-Country"] # Vereinfacht ohne Creator-spezifische Headers
      cookies {
        forward = "none"
      }
    }

    # Kein Lambda@Edge - vereinfachte Konfiguration
    min_ttl     = 0
    default_ttl = 86400
    max_ttl     = 31536000
  }

  # API Cache Behavior
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    target_origin_id       = "API-Gateway"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Content-Type", "Host"] # Vereinfacht ohne Creator-spezifische Headers
      cookies {
        forward = "all"
      }
    }

    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0
  }

  # Tenant Assets Cache Behavior (vereinfacht)
  ordered_cache_behavior {
    path_pattern           = "/tenants/*"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${var.s3_bucket_name}"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      headers      = [] # Vereinfacht ohne Creator-spezifische Headers
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 604800   # 1 Woche
    max_ttl     = 31536000 # 1 Jahr
  }

  # Creator-spezifische API Cache Behavior (vereinfacht)
  ordered_cache_behavior {
    path_pattern           = "/api/creator/*"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    target_origin_id       = "API-Gateway"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Content-Type", "Host"]
      cookies {
        forward = "all"
      }
    }

    min_ttl     = 0
    default_ttl = 300  # 5 Minuten für Creator-spezifische API Calls
    max_ttl     = 3600 # 1 Stunde Maximum
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = merge(var.tags, {
    Name = "Multi-Domain CloudFront"
  })
}

# Origin Access Identity
resource "aws_cloudfront_origin_access_identity" "multi_domain" {
  comment = "Multi-Domain OAI for ${var.platform_name}"
}

# S3 Bucket Policy für CloudFront OAI
resource "aws_s3_bucket_policy" "cloudfront_oai" {
  bucket = var.s3_bucket_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontAccess"
        Effect = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.multi_domain.iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "arn:aws:s3:::${var.s3_bucket_name}/*"
      }
    ]
  })
}