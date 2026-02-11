# Lambda@Edge Function für Custom Domain Routing
# Skalierbar für beliebig viele Custom Domains

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Lambda@Edge muss in us-east-1 sein
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

# IAM Role für Lambda@Edge
resource "aws_iam_role" "lambda_edge_role" {
  name = "viraltenant-domain-routing-edge-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = [
            "lambda.amazonaws.com",
            "edgelambda.amazonaws.com"
          ]
        }
      }
    ]
  })
}

# IAM Policy für Lambda@Edge - DynamoDB Query
resource "aws_iam_role_policy" "lambda_edge_dynamodb_policy" {
  name = "viraltenant-domain-routing-dynamodb"
  role = aws_iam_role.lambda_edge_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:Query"
        ]
        Resource = [
          "arn:aws:dynamodb:eu-central-1:${data.aws_caller_identity.current.account_id}:table/${var.tenants_table_name}/index/custom_domain-index"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:us-east-1:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/us-east-1.*"
      }
    ]
  })
}

# Lambda@Edge Function
resource "aws_lambda_function" "domain_routing_edge" {
  provider         = aws.us_east_1
  filename         = data.archive_file.lambda_edge_zip.output_path
  function_name    = "viraltenant-domain-routing-edge"
  role             = aws_iam_role.lambda_edge_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 5
  memory_size      = 128
  source_code_hash = data.archive_file.lambda_edge_zip.output_base64sha256

  environment {
    variables = {
      TENANTS_TABLE = var.tenants_table_name
    }
  }

  # Lambda@Edge braucht publish = true
  publish = true

  tags = {
    Name        = "viraltenant-domain-routing-edge"
    Environment = var.environment
    Purpose     = "Custom Domain Routing"
  }
}

# Archive für Lambda Function
data "archive_file" "lambda_edge_zip" {
  type        = "zip"
  source_file = "${path.module}/../../lambda-functions/domain-routing-edge/index.js"
  output_path = "${path.module}/../../lambda-functions/domain-routing-edge/lambda.zip"
}

# CloudFront Distribution aktualisieren
resource "aws_cloudfront_distribution" "website_with_custom_domains" {
  provider = aws.us_east_1

  origin {
    domain_name = var.website_bucket_domain
    origin_id   = "website-origin"

    s3_origin_config {
      origin_access_identity = var.origin_access_identity
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  http_version        = "http2"

  # Aliases für alle Domains (Subdomains + Custom Domains)
  aliases = concat(
    var.subdomain_aliases,
    var.custom_domain_aliases
  )

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "website-origin"

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }

      headers = ["Host"]
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    compress               = true

    # Lambda@Edge für Domain Routing
    lambda_function_association {
      event_type   = "viewer-request"
      lambda_arn   = aws_lambda_function.domain_routing_edge.qualified_arn
      include_body = false
    }
  }

  # Cache Behavior für API Requests
  cache_behavior {
    path_pattern     = "/api/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "website-origin"

    forwarded_values {
      query_string = true

      cookies {
        forward = "all"
      }

      headers = [
        "Authorization",
        "Content-Type",
        "X-Creator-ID",
        "X-Amz-Date",
        "X-Api-Key",
        "X-Amz-Security-Token",
        "Accept",
        "Accept-Language",
        "Host",
        "User-Agent"
      ]
    }

    viewer_protocol_policy = "https-only"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
    compress               = true

    # Lambda@Edge für Domain Routing
    lambda_function_association {
      event_type   = "viewer-request"
      lambda_arn   = aws_lambda_function.domain_routing_edge.qualified_arn
      include_body = false
    }
  }

  # Custom Error Response für 404 -> index.html (SPA)
  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 300
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = {
    Name        = "viraltenant-website-distribution"
    Environment = var.environment
  }

  depends_on = [aws_lambda_function.domain_routing_edge]
}

# DynamoDB Global Secondary Index für Custom Domains
resource "aws_dynamodb_global_secondary_index" "custom_domain_index" {
  name            = "custom_domain-index"
  hash_key        = "custom_domain"
  table_name      = var.tenants_table_name
  projection_type = "ALL"

  read_capacity  = var.dynamodb_read_capacity
  write_capacity = var.dynamodb_write_capacity
}

# Data source für AWS Account ID
data "aws_caller_identity" "current" {}

# Outputs
output "lambda_edge_arn" {
  description = "ARN der Lambda@Edge Function"
  value       = aws_lambda_function.domain_routing_edge.arn
}

output "lambda_edge_qualified_arn" {
  description = "Qualified ARN der Lambda@Edge Function (mit Version)"
  value       = aws_lambda_function.domain_routing_edge.qualified_arn
}

output "cloudfront_distribution_id" {
  description = "CloudFront Distribution ID"
  value       = aws_cloudfront_distribution.website_with_custom_domains.id
}

output "cloudfront_domain_name" {
  description = "CloudFront Domain Name"
  value       = aws_cloudfront_distribution.website_with_custom_domains.domain_name
}
