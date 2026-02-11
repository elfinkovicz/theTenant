# Tenant Registration Module
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }
}

# DynamoDB Table for Email Verification Codes
resource "aws_dynamodb_table" "email_verification" {
  name         = "${var.platform_name}-email-verification-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "email"

  attribute {
    name = "email"
    type = "S"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = merge(var.tags, {
    Name = "${var.platform_name}-email-verification"
    Type = "TenantRegistration"
  })
}

# Create ZIP file from lambda directory
data "archive_file" "tenant_registration_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/tenant_registration_lambda.zip"
}

# IAM Role für Tenant Registration Lambda
resource "aws_iam_role" "tenant_registration_role" {
  name = "${var.platform_name}-tenant-registration-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })

  tags = var.tags
}

# IAM Policy für Tenant Registration Lambda
resource "aws_iam_role_policy" "tenant_registration_policy" {
  name = "${var.platform_name}-tenant-registration-policy-${var.environment}"
  role = aws_iam_role.tenant_registration_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:Query", "dynamodb:Scan"]
        Resource = [
          var.tenants_table_arn,
          "${var.tenants_table_arn}/index/*",
          var.user_tenants_table_arn,
          "${var.user_tenants_table_arn}/index/*",
          var.tenant_live_table_arn,
          "${var.tenant_live_table_arn}/index/*",
          aws_dynamodb_table.email_verification.arn
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["route53:ChangeResourceRecordSets", "route53:ListResourceRecordSets"]
        Resource = "arn:aws:route53:::hostedzone/${var.hosted_zone_id}"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:PutObjectAcl", "s3:GetObject"]
        Resource = ["${var.creator_assets_bucket_arn}/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["cognito-idp:AdminGetUser", "cognito-idp:AdminCreateUser", "cognito-idp:AdminAddUserToGroup", "cognito-idp:AdminSetUserPassword", "cognito-idp:ListUsers"]
        Resource = var.cognito_user_pool_arn
      },
      {
        Effect   = "Allow"
        Action   = ["ses:SendEmail", "ses:SendRawEmail"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["ivs:CreateChannel", "ivs:GetChannel", "ivs:ListChannels", "ivs:TagResource"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["ivschat:CreateRoom", "ivschat:GetRoom", "ivschat:ListRooms", "ivschat:TagResource"]
        Resource = "*"
      }
    ]
  })
}

# Lambda Function für Tenant Registration
resource "aws_lambda_function" "tenant_registration" {
  function_name = "${var.platform_name}-tenant-registration-${var.environment}"
  role          = aws_iam_role.tenant_registration_role.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  timeout       = 60

  layers           = [var.tenant_registration_deps_layer_arn]
  filename         = data.archive_file.tenant_registration_zip.output_path
  source_code_hash = data.archive_file.tenant_registration_zip.output_base64sha256

  environment {
    variables = {
      TENANTS_TABLE            = var.tenants_table_name
      USER_TENANTS_TABLE       = var.user_tenants_table_name
      TENANT_LIVE_TABLE        = var.tenant_live_table_name
      VERIFICATION_TABLE       = aws_dynamodb_table.email_verification.name
      VERIFICATION_CODES_TABLE = aws_dynamodb_table.email_verification.name
      HOSTED_ZONE_ID           = var.hosted_zone_id
      PLATFORM_DOMAIN          = var.platform_domain
      PLATFORM_NAME            = var.platform_name
      CLOUDFRONT_DOMAIN_NAME   = var.cloudfront_domain_name
      CREATOR_ASSETS_BUCKET    = var.creator_assets_bucket_name
      USER_POOL_ID             = var.cognito_user_pool_id
      SES_FROM_EMAIL           = "noreply@${var.platform_domain}"
      REGION                   = var.aws_region
    }
  }

  tags = merge(var.tags, {
    Name = "${var.platform_name}-tenant-registration"
    Type = "TenantRegistration"
  })

  depends_on = [aws_iam_role_policy.tenant_registration_policy]
}

# API Gateway Resources
resource "aws_api_gateway_resource" "admin" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.api_gateway_root_resource_id
  path_part   = "admin"
}

resource "aws_api_gateway_resource" "admin_tenants" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.admin.id
  path_part   = "tenants"
}

resource "aws_api_gateway_resource" "send_code" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.admin_tenants.id
  path_part   = "send-code"
}

resource "aws_api_gateway_resource" "verify" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.admin_tenants.id
  path_part   = "verify"
}

resource "aws_api_gateway_resource" "resend_code" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.admin_tenants.id
  path_part   = "resend-code"
}

# Methods and Integrations for send-code
resource "aws_api_gateway_method" "post_send_code" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.send_code.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "post_send_code" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.send_code.id
  http_method             = aws_api_gateway_method.post_send_code.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_registration.invoke_arn
}

resource "aws_api_gateway_method" "cors_send_code" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.send_code.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "cors_send_code" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.send_code.id
  http_method       = aws_api_gateway_method.cors_send_code.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "cors_send_code" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.send_code.id
  http_method = aws_api_gateway_method.cors_send_code.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "cors_send_code" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.send_code.id
  http_method = aws_api_gateway_method.cors_send_code.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_integration.cors_send_code]
}

# Methods and Integrations for verify
resource "aws_api_gateway_method" "post_verify" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.verify.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "post_verify" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.verify.id
  http_method             = aws_api_gateway_method.post_verify.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_registration.invoke_arn
}

resource "aws_api_gateway_method" "cors_verify" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.verify.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "cors_verify" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.verify.id
  http_method       = aws_api_gateway_method.cors_verify.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "cors_verify" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.verify.id
  http_method = aws_api_gateway_method.cors_verify.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "cors_verify" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.verify.id
  http_method = aws_api_gateway_method.cors_verify.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_integration.cors_verify]
}

# Methods and Integrations for resend-code
resource "aws_api_gateway_method" "post_resend_code" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.resend_code.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "post_resend_code" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.resend_code.id
  http_method             = aws_api_gateway_method.post_resend_code.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_registration.invoke_arn
}

resource "aws_api_gateway_method" "cors_resend_code" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.resend_code.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "cors_resend_code" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.resend_code.id
  http_method       = aws_api_gateway_method.cors_resend_code.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "cors_resend_code" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.resend_code.id
  http_method = aws_api_gateway_method.cors_resend_code.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "cors_resend_code" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.resend_code.id
  http_method = aws_api_gateway_method.cors_resend_code.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_integration.cors_resend_code]
}

# Lambda Permission für API Gateway
resource "aws_lambda_permission" "tenant_registration_api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.tenant_registration.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}