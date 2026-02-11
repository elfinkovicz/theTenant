# Lambda Authorizer Module für Multi-Tenant Authorization
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# IAM Role für Lambda Authorizer
resource "aws_iam_role" "lambda_authorizer_role" {
  name = "${var.platform_name}-lambda-authorizer-role-${var.environment}"

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

# IAM Policy für Lambda Authorizer
resource "aws_iam_role_policy" "lambda_authorizer_policy" {
  name = "${var.platform_name}-lambda-authorizer-policy-${var.environment}"
  role = aws_iam_role.lambda_authorizer_role.id

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
          "cognito-idp:GetUser",
          "cognito-idp:AdminGetUser"
        ]
        Resource = var.cognito_user_pool_arn
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:Query"
        ]
        Resource = [
          var.tenants_table_arn,
          "${var.tenants_table_arn}/index/*",
          var.user_tenants_table_arn,
          "${var.user_tenants_table_arn}/index/*"
        ]
      }
    ]
  })
}

# Lambda Function für Authorization
resource "aws_lambda_function" "tenant_authorizer" {
  filename      = "tenant_authorizer.zip"
  function_name = "${var.platform_name}-tenant-authorizer-${var.environment}"
  role          = aws_iam_role.lambda_authorizer_role.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  timeout       = 30
  layers        = [var.common_deps_layer_arn]

  environment {
    variables = {
      USER_POOL_ID       = var.cognito_user_pool_id
      CLIENT_ID          = var.cognito_client_id
      TENANTS_TABLE      = var.tenants_table_name
      USER_TENANTS_TABLE = var.user_tenants_table_name
      REGION             = var.aws_region
      PLATFORM_DOMAIN    = var.platform_domain
    }
  }

  tags = merge(var.tags, {
    Name = "${var.platform_name}-tenant-authorizer"
    Type = "Authorization"
  })

  depends_on = [aws_iam_role_policy.lambda_authorizer_policy]
}

# API Gateway Authorizer
resource "aws_api_gateway_authorizer" "tenant_authorizer" {
  name                   = "${var.platform_name}-tenant-authorizer-${var.environment}"
  rest_api_id            = var.api_gateway_id
  authorizer_uri         = aws_lambda_function.tenant_authorizer.invoke_arn
  authorizer_credentials = aws_iam_role.authorizer_invocation_role.arn
  type                   = "TOKEN"
  identity_source        = "method.request.header.Authorization"
}

# IAM Role für API Gateway Authorizer Invocation
resource "aws_iam_role" "authorizer_invocation_role" {
  name = "${var.platform_name}-authorizer-invocation-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "apigateway.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# IAM Policy für Authorizer Invocation
resource "aws_iam_role_policy" "authorizer_invocation_policy" {
  name = "${var.platform_name}-authorizer-invocation-policy-${var.environment}"
  role = aws_iam_role.authorizer_invocation_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "lambda:InvokeFunction"
        Resource = aws_lambda_function.tenant_authorizer.arn
      }
    ]
  })
}