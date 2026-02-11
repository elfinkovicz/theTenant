# CloudFront Distribution Module
terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "~> 5.0"
      configuration_aliases = [aws.us_east_1]
    }
  }
}

# S3 Bucket für Website Content
resource "aws_s3_bucket" "website" {
  bucket = "${var.platform_name}-website-${var.environment}"

  tags = merge(var.tags, {
    Name = "${var.platform_name}-website"
    Type = "Website"
  })
}

resource "aws_s3_bucket_versioning" "website" {
  bucket = aws_s3_bucket.website.id
  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Disabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "website" {
  bucket = aws_s3_bucket.website.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "website" {
  bucket = aws_s3_bucket.website.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 CORS Configuration
resource "aws_s3_bucket_cors_configuration" "website" {
  bucket = aws_s3_bucket.website.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD", "PUT", "POST", "DELETE"]
    allowed_origins = [
      "https://${var.platform_domain}",
      "https://www.${var.platform_domain}",
      "https://*.${var.platform_domain}"
    ]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]
    max_age_seconds = 3000
  }
}

# Upload static pages to S3
resource "aws_s3_object" "tenant_creation_html" {
  bucket       = aws_s3_bucket.website.id
  key          = "admin/tenant-creation.html"
  source       = "${path.root}/static-pages/tenant-creation.html"
  content_type = "text/html"
  etag         = filemd5("${path.root}/static-pages/tenant-creation.html")

  tags = merge(var.tags, {
    Name = "Tenant Creation Page"
    Type = "AdminTool"
  })
}

# CloudFront Origin Access Control
resource "aws_cloudfront_origin_access_control" "website" {
  name                              = "${var.platform_name}-website-oac"
  description                       = "OAC for ${var.platform_name} website"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront Response Headers Policy for CORS
resource "aws_cloudfront_response_headers_policy" "cors_policy" {
  name    = "${var.platform_name}-cors-policy-${var.environment}"
  comment = "CORS policy for video frame extraction"

  cors_config {
    access_control_allow_credentials = false

    access_control_allow_headers {
      items = ["*"]
    }

    access_control_allow_methods {
      items = ["GET", "HEAD", "OPTIONS"]
    }

    access_control_allow_origins {
      items = ["*"]
    }

    access_control_expose_headers {
      items = ["ETag", "Content-Length", "Content-Type", "Content-Range", "Accept-Ranges"]
    }

    access_control_max_age_sec = 3600
    origin_override            = true
  }

  custom_headers_config {
    items {
      header   = "Cross-Origin-Resource-Policy"
      value    = "cross-origin"
      override = true
    }
  }
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "website" {
  # Origin 1: Website S3 Bucket
  origin {
    domain_name              = aws_s3_bucket.website.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.website.id
    origin_id                = "S3-Website"
  }

  # Origin 2: Creator Assets S3 Bucket
  origin {
    domain_name              = var.creator_assets_bucket_domain_name
    origin_access_control_id = var.creator_assets_oac_id
    origin_id                = "S3-CreatorAssets"
  }

  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.platform_name} Multi-Tenant Distribution"
  default_root_object = "index.html"

  # Custom domains - Wildcard für Subdomains
  aliases = var.enable_custom_domains ? concat(var.cloudfront_domains, ["*.${var.platform_domain}"]) : []

  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-Website"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = var.default_ttl
    max_ttl                = var.max_ttl
    compress               = var.compression
  }

  # Cache behavior für Tenant Assets (/tenants/*)
  ordered_cache_behavior {
    path_pattern     = "/tenants/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-CreatorAssets"

    forwarded_values {
      query_string = false
      headers      = ["Origin", "Access-Control-Request-Headers", "Access-Control-Request-Method"]
      cookies {
        forward = "none"
      }
    }

    min_ttl                = 0
    default_ttl            = var.creator_assets_ttl
    max_ttl                = var.creator_assets_max_ttl
    compress               = var.compression
    viewer_protocol_policy = "redirect-to-https"
    
    # Add CORS response headers policy
    response_headers_policy_id = aws_cloudfront_response_headers_policy.cors_policy.id
  }

  # Cache behavior for HTML files (shorter TTL)
  ordered_cache_behavior {
    path_pattern     = "*.html"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-Website"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl                = 0
    default_ttl            = var.website_ttl
    max_ttl                = var.website_ttl
    compress               = var.compression
    viewer_protocol_policy = "redirect-to-https"
  }

  price_class = "PriceClass_100"

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # SSL Certificate configuration
  viewer_certificate {
    cloudfront_default_certificate = var.ssl_certificate_mode == "none"
    acm_certificate_arn            = var.ssl_certificate_mode != "none" ? var.ssl_certificate_arn : null
    ssl_support_method             = var.ssl_certificate_mode != "none" ? "sni-only" : null
    minimum_protocol_version       = var.ssl_certificate_mode != "none" ? "TLSv1.2_2021" : null
  }

  # Custom error pages
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

  tags = merge(var.tags, {
    Name = "${var.platform_name}-cloudfront"
  })
}

# S3 Bucket Policy for CloudFront
resource "aws_s3_bucket_policy" "website" {
  bucket = aws_s3_bucket.website.id

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
        Resource = "${aws_s3_bucket.website.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = concat(
              [aws_cloudfront_distribution.website.arn],
              var.additional_cloudfront_arns
            )
          }
        }
      }
    ]
  })
}
