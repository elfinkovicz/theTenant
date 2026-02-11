# Tenant Frontend Configuration Module
# Manages hero content, themes, and design settings per tenant

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# =============================================================================
# DynamoDB Table for Tenant Frontend Configuration
# =============================================================================

resource "aws_dynamodb_table" "tenant_frontend" {
  name         = "${var.platform_name}-tenant-frontend-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenant_id"

  attribute {
    name = "tenant_id"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = merge(var.tags, {
    Name = "${var.platform_name}-tenant-frontend"
    Type = "TenantFrontend"
  })
}

# =============================================================================
# IAM Role for Lambda
# =============================================================================

resource "aws_iam_role" "tenant_frontend_role" {
  name = "${var.platform_name}-tenant-frontend-role-${var.environment}"

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

resource "aws_iam_role_policy" "tenant_frontend_policy" {
  name = "${var.platform_name}-tenant-frontend-policy-${var.environment}"
  role = aws_iam_role.tenant_frontend_role.id

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
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem"
        ]
        Resource = [
          aws_dynamodb_table.tenant_frontend.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:Query"
        ]
        Resource = [
          var.user_tenants_table_arn,
          "${var.user_tenants_table_arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:Query"
        ]
        Resource = [
          var.tenants_table_arn,
          "${var.tenants_table_arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:GetObjectVersion"
        ]
        Resource = [
          "${var.creator_assets_bucket_arn}/tenants/*"
        ]
      }
    ]
  })
}

# =============================================================================
# Lambda Function
# =============================================================================

data "archive_file" "tenant_frontend_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/tenant-frontend"
  output_path = "${path.module}/../../tenant_frontend.zip"
  excludes    = ["node_modules", "package-lock.json"]
}

resource "aws_lambda_function" "tenant_frontend" {
  filename         = data.archive_file.tenant_frontend_zip.output_path
  source_code_hash = data.archive_file.tenant_frontend_zip.output_base64sha256
  function_name    = "${var.platform_name}-tenant-frontend-${var.environment}"
  role             = aws_iam_role.tenant_frontend_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 30
  memory_size      = 256
  layers           = [var.common_deps_layer_arn]

  environment {
    variables = {
      TENANT_FRONTEND_TABLE = aws_dynamodb_table.tenant_frontend.name
      USER_TENANTS_TABLE    = var.user_tenants_table_name
      TENANTS_TABLE         = var.tenants_table_name
      ASSETS_BUCKET         = var.creator_assets_bucket_name
      CLOUDFRONT_DOMAIN     = var.cloudfront_domain_name
      PLATFORM_DOMAIN       = var.platform_domain
      REGION                = var.aws_region
    }
  }

  tags = merge(var.tags, {
    Name = "${var.platform_name}-tenant-frontend"
    Type = "TenantFrontend"
  })

  depends_on = [aws_iam_role_policy.tenant_frontend_policy]
}

# =============================================================================
# API Gateway Resources
# =============================================================================

# /tenants/{tenantId}/hero
resource "aws_api_gateway_resource" "hero" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.tenant_by_id_resource_id
  path_part   = "hero"
}

# /tenants/{tenantId}/hero/upload-url
resource "aws_api_gateway_resource" "hero_upload_url" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.hero.id
  path_part   = "upload-url"
}

# /tenants/{tenantId}/hero/logo
resource "aws_api_gateway_resource" "hero_logo" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.hero.id
  path_part   = "logo"
}

# =============================================================================
# GET /tenants/{tenantId}/hero - Public endpoint for hero content
# =============================================================================

resource "aws_api_gateway_method" "get_hero" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.hero.id
  http_method   = "GET"
  authorization = "NONE" # Public for subdomain detection
}

resource "aws_api_gateway_integration" "get_hero" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.hero.id
  http_method             = aws_api_gateway_method.get_hero.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_frontend.invoke_arn
}

# =============================================================================
# PUT /tenants/{tenantId}/hero - Admin only
# =============================================================================

resource "aws_api_gateway_method" "put_hero" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.hero.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_hero" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.hero.id
  http_method             = aws_api_gateway_method.put_hero.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_frontend.invoke_arn
}

# =============================================================================
# POST /tenants/{tenantId}/hero/upload-url - Admin only
# =============================================================================

resource "aws_api_gateway_method" "post_upload_url" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.hero_upload_url.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_upload_url" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.hero_upload_url.id
  http_method             = aws_api_gateway_method.post_upload_url.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_frontend.invoke_arn
}

# =============================================================================
# DELETE /tenants/{tenantId}/hero/logo - Admin only
# =============================================================================

resource "aws_api_gateway_method" "delete_logo" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.hero_logo.id
  http_method   = "DELETE"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "delete_logo" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.hero_logo.id
  http_method             = aws_api_gateway_method.delete_logo.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_frontend.invoke_arn
}


# =============================================================================
# CORS Configuration
# =============================================================================

# CORS for /tenants/{tenantId}/hero
resource "aws_api_gateway_method" "hero_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.hero.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "hero_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.hero.id
  http_method = aws_api_gateway_method.hero_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({ statusCode = 200 })
  }
}

resource "aws_api_gateway_method_response" "hero_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.hero.id
  http_method = aws_api_gateway_method.hero_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "hero_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.hero.id
  http_method = aws_api_gateway_method.hero_cors.http_method
  status_code = aws_api_gateway_method_response.hero_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,PUT,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# CORS for /tenants/{tenantId}/hero/upload-url
resource "aws_api_gateway_method" "upload_url_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.hero_upload_url.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "upload_url_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.hero_upload_url.id
  http_method = aws_api_gateway_method.upload_url_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({ statusCode = 200 })
  }
}

resource "aws_api_gateway_method_response" "upload_url_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.hero_upload_url.id
  http_method = aws_api_gateway_method.upload_url_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "upload_url_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.hero_upload_url.id
  http_method = aws_api_gateway_method.upload_url_cors.http_method
  status_code = aws_api_gateway_method_response.upload_url_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# CORS for /tenants/{tenantId}/hero/logo
resource "aws_api_gateway_method" "logo_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.hero_logo.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "logo_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.hero_logo.id
  http_method = aws_api_gateway_method.logo_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({ statusCode = 200 })
  }
}

resource "aws_api_gateway_method_response" "logo_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.hero_logo.id
  http_method = aws_api_gateway_method.logo_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "logo_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.hero_logo.id
  http_method = aws_api_gateway_method.logo_cors.http_method
  status_code = aws_api_gateway_method_response.logo_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# =============================================================================
# Lambda Permission
# =============================================================================

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.tenant_frontend.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}

# =============================================================================
# ADVERTISEMENT API ENDPOINTS
# =============================================================================

# /tenants/{tenantId}/advertisement
resource "aws_api_gateway_resource" "advertisement" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.tenant_by_id_resource_id
  path_part   = "advertisement"
}

# /tenants/{tenantId}/advertisement/upload-url
resource "aws_api_gateway_resource" "ad_upload_url" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.advertisement.id
  path_part   = "upload-url"
}

# /tenants/{tenantId}/advertisement/image
resource "aws_api_gateway_resource" "ad_image" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.advertisement.id
  path_part   = "image"
}

# GET /tenants/{tenantId}/advertisement - Public endpoint
resource "aws_api_gateway_method" "get_advertisement" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.advertisement.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_advertisement" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.advertisement.id
  http_method             = aws_api_gateway_method.get_advertisement.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_frontend.invoke_arn
}

# PUT /tenants/{tenantId}/advertisement - Admin only
resource "aws_api_gateway_method" "put_advertisement" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.advertisement.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_advertisement" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.advertisement.id
  http_method             = aws_api_gateway_method.put_advertisement.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_frontend.invoke_arn
}

# POST /tenants/{tenantId}/advertisement/upload-url - Admin only
resource "aws_api_gateway_method" "post_ad_upload_url" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.ad_upload_url.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_ad_upload_url" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.ad_upload_url.id
  http_method             = aws_api_gateway_method.post_ad_upload_url.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_frontend.invoke_arn
}

# DELETE /tenants/{tenantId}/advertisement/image - Admin only
resource "aws_api_gateway_method" "delete_ad_image" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.ad_image.id
  http_method   = "DELETE"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "delete_ad_image" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.ad_image.id
  http_method             = aws_api_gateway_method.delete_ad_image.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_frontend.invoke_arn
}

# CORS for /tenants/{tenantId}/advertisement
resource "aws_api_gateway_method" "advertisement_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.advertisement.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "advertisement_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.advertisement.id
  http_method = aws_api_gateway_method.advertisement_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({ statusCode = 200 })
  }
}

resource "aws_api_gateway_method_response" "advertisement_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.advertisement.id
  http_method = aws_api_gateway_method.advertisement_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "advertisement_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.advertisement.id
  http_method = aws_api_gateway_method.advertisement_cors.http_method
  status_code = aws_api_gateway_method_response.advertisement_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,PUT,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# CORS for /tenants/{tenantId}/advertisement/upload-url
resource "aws_api_gateway_method" "ad_upload_url_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.ad_upload_url.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "ad_upload_url_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.ad_upload_url.id
  http_method = aws_api_gateway_method.ad_upload_url_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({ statusCode = 200 })
  }
}

resource "aws_api_gateway_method_response" "ad_upload_url_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.ad_upload_url.id
  http_method = aws_api_gateway_method.ad_upload_url_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "ad_upload_url_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.ad_upload_url.id
  http_method = aws_api_gateway_method.ad_upload_url_cors.http_method
  status_code = aws_api_gateway_method_response.ad_upload_url_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# CORS for /tenants/{tenantId}/advertisement/image
resource "aws_api_gateway_method" "ad_image_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.ad_image.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "ad_image_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.ad_image.id
  http_method = aws_api_gateway_method.ad_image_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({ statusCode = 200 })
  }
}

resource "aws_api_gateway_method_response" "ad_image_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.ad_image.id
  http_method = aws_api_gateway_method.ad_image_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "ad_image_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.ad_image.id
  http_method = aws_api_gateway_method.ad_image_cors.http_method
  status_code = aws_api_gateway_method_response.ad_image_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# =============================================================================
# PAGE BANNER API ENDPOINTS
# =============================================================================

# /tenants/{tenantId}/banners
resource "aws_api_gateway_resource" "banners" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.tenant_by_id_resource_id
  path_part   = "banners"
}

# /tenants/{tenantId}/banners/{pageId}
resource "aws_api_gateway_resource" "banner_by_page" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.banners.id
  path_part   = "{pageId}"
}

# /tenants/{tenantId}/banners/{pageId}/upload-url
resource "aws_api_gateway_resource" "banner_upload_url" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.banner_by_page.id
  path_part   = "upload-url"
}

# GET /tenants/{tenantId}/banners - Public endpoint for all banners
resource "aws_api_gateway_method" "get_banners" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.banners.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_banners" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.banners.id
  http_method             = aws_api_gateway_method.get_banners.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_frontend.invoke_arn
}

# PUT /tenants/{tenantId}/banners/{pageId} - Admin only
resource "aws_api_gateway_method" "put_banner" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.banner_by_page.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_banner" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.banner_by_page.id
  http_method             = aws_api_gateway_method.put_banner.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_frontend.invoke_arn
}

# DELETE /tenants/{tenantId}/banners/{pageId} - Admin only
resource "aws_api_gateway_method" "delete_banner" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.banner_by_page.id
  http_method   = "DELETE"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "delete_banner" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.banner_by_page.id
  http_method             = aws_api_gateway_method.delete_banner.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_frontend.invoke_arn
}

# POST /tenants/{tenantId}/banners/{pageId}/upload-url - Admin only
resource "aws_api_gateway_method" "post_banner_upload_url" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.banner_upload_url.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_banner_upload_url" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.banner_upload_url.id
  http_method             = aws_api_gateway_method.post_banner_upload_url.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_frontend.invoke_arn
}

# CORS for /tenants/{tenantId}/banners
resource "aws_api_gateway_method" "banners_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.banners.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "banners_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.banners.id
  http_method = aws_api_gateway_method.banners_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({ statusCode = 200 })
  }
}

resource "aws_api_gateway_method_response" "banners_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.banners.id
  http_method = aws_api_gateway_method.banners_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "banners_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.banners.id
  http_method = aws_api_gateway_method.banners_cors.http_method
  status_code = aws_api_gateway_method_response.banners_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.banners_cors]
}

# CORS for /tenants/{tenantId}/banners/{pageId}
resource "aws_api_gateway_method" "banner_by_page_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.banner_by_page.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "banner_by_page_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.banner_by_page.id
  http_method = aws_api_gateway_method.banner_by_page_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({ statusCode = 200 })
  }
}

resource "aws_api_gateway_method_response" "banner_by_page_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.banner_by_page.id
  http_method = aws_api_gateway_method.banner_by_page_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "banner_by_page_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.banner_by_page.id
  http_method = aws_api_gateway_method.banner_by_page_cors.http_method
  status_code = aws_api_gateway_method_response.banner_by_page_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'PUT,DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.banner_by_page_cors]
}

# CORS for /tenants/{tenantId}/banners/{pageId}/upload-url
resource "aws_api_gateway_method" "banner_upload_url_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.banner_upload_url.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "banner_upload_url_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.banner_upload_url.id
  http_method = aws_api_gateway_method.banner_upload_url_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({ statusCode = 200 })
  }
}

resource "aws_api_gateway_method_response" "banner_upload_url_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.banner_upload_url.id
  http_method = aws_api_gateway_method.banner_upload_url_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "banner_upload_url_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.banner_upload_url.id
  http_method = aws_api_gateway_method.banner_upload_url_cors.http_method
  status_code = aws_api_gateway_method_response.banner_upload_url_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.banner_upload_url_cors]
}
