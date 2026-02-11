# Central Authentication Module
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Cognito User Pool
resource "aws_cognito_user_pool" "main" {
  name = "${var.platform_name}-users-${var.environment}"

  # Password Policy
  password_policy {
    minimum_length    = var.password_policy.minimum_length
    require_lowercase = var.password_policy.require_lowercase
    require_numbers   = var.password_policy.require_numbers
    require_symbols   = var.password_policy.require_symbols
    require_uppercase = var.password_policy.require_uppercase
  }

  # Username Configuration
  username_attributes = ["email"]

  # Custom Attributes
  schema {
    attribute_data_type = "String"
    name                = "username"
    mutable             = true
    required            = false

    string_attribute_constraints {
      min_length = 3
      max_length = 20
    }
  }

  # Auto-verified attributes
  auto_verified_attributes = ["email"]

  # Email Configuration
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  # Account Recovery
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # User Pool Add-ons
  user_pool_add_ons {
    advanced_security_mode = "ENFORCED"
  }

  tags = merge(var.tags, {
    Name = "${var.platform_name}-user-pool"
    Type = "Authentication"
  })
}

# Cognito User Pool Client
resource "aws_cognito_user_pool_client" "main" {
  name         = "${var.platform_name}-client-${var.environment}"
  user_pool_id = aws_cognito_user_pool.main.id

  # Client Settings
  generate_secret                               = false
  prevent_user_existence_errors                 = "ENABLED"
  enable_token_revocation                       = true
  enable_propagate_additional_user_context_data = false

  # Token Validity
  access_token_validity  = 60 # 1 hour
  id_token_validity      = 60 # 1 hour
  refresh_token_validity = 30 # 30 days

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  # Auth Flows
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]

  # OAuth Settings
  supported_identity_providers = ["COGNITO"]

  callback_urls = [
    "https://${var.platform_domain}/callback",
    "https://www.${var.platform_domain}/callback"
  ]

  logout_urls = [
    "https://${var.platform_domain}/logout",
    "https://www.${var.platform_domain}/"
  ]

  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  allowed_oauth_flows_user_pool_client = true

  # Read/Write Attributes
  read_attributes = [
    "email",
    "email_verified",
    "custom:username"
  ]

  write_attributes = [
    "email",
    "custom:username"
  ]
}

# Cognito User Groups
resource "aws_cognito_user_group" "user" {
  name         = "users"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Standard users with basic permissions"
  precedence   = 2
}

resource "aws_cognito_user_group" "admin" {
  name         = "admins"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Administrators with full permissions"
  precedence   = 1
}

resource "aws_cognito_user_group" "billing_admin" {
  name         = "billing-admins"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Billing administrators with access to billing dashboard"
  precedence   = 1
}

# Lambda Execution Role
resource "aws_iam_role" "lambda_role" {
  name = "${var.platform_name}-auth-lambda-role-${var.environment}"

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

# Lambda Policy
resource "aws_iam_role_policy" "lambda_policy" {
  name = "${var.platform_name}-auth-lambda-policy-${var.environment}"
  role = aws_iam_role.lambda_role.id

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
          "cognito-idp:AdminCreateUser",
          "cognito-idp:AdminDeleteUser",
          "cognito-idp:AdminGetUser",
          "cognito-idp:AdminListGroupsForUser",
          "cognito-idp:AdminAddUserToGroup",
          "cognito-idp:AdminRemoveUserFromGroup",
          "cognito-idp:AdminSetUserPassword",
          "cognito-idp:AdminConfirmSignUp",
          "cognito-idp:AdminInitiateAuth",
          "cognito-idp:AdminRespondToAuthChallenge",
          "cognito-idp:ConfirmSignUp",
          "cognito-idp:InitiateAuth",
          "cognito-idp:ResendConfirmationCode",
          "cognito-idp:ForgotPassword",
          "cognito-idp:ConfirmForgotPassword",
          "cognito-idp:GetUser",
          "cognito-idp:SignUp"
        ]
        Resource = aws_cognito_user_pool.main.arn
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:Query",
          "dynamodb:GetItem",
          "dynamodb:PutItem"
        ]
        Resource = [
          "arn:aws:dynamodb:${var.aws_region}:*:table/${var.platform_name}-tenants-${var.environment}",
          "arn:aws:dynamodb:${var.aws_region}:*:table/${var.platform_name}-tenants-${var.environment}/index/*",
          "arn:aws:dynamodb:${var.aws_region}:*:table/${var.platform_name}-user-tenants-${var.environment}"
        ]
      }
    ]
  })
}

# Lambda Function
resource "aws_lambda_function" "auth_handler" {
  filename      = "auth_handler.zip"
  function_name = "${var.platform_name}-auth-handler-${var.environment}"
  role          = aws_iam_role.lambda_role.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  timeout       = 30
  layers        = var.common_deps_layer_arn != "" ? [var.common_deps_layer_arn] : []

  environment {
    variables = {
      USER_POOL_ID       = aws_cognito_user_pool.main.id
      CLIENT_ID          = aws_cognito_user_pool_client.main.id
      REGION             = var.aws_region
      TENANTS_TABLE      = "${var.platform_name}-tenants-${var.environment}"
      USER_TENANTS_TABLE = "${var.platform_name}-user-tenants-${var.environment}"
    }
  }

  tags = merge(var.tags, {
    Name = "${var.platform_name}-auth-handler"
    Type = "Authentication"
  })

  depends_on = [aws_iam_role_policy.lambda_policy]
}

# API Gateway
resource "aws_api_gateway_rest_api" "auth_api" {
  name        = "${var.platform_name}-auth-api-${var.environment}"
  description = "Authentication API for ${var.platform_name}"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = merge(var.tags, {
    Name = "${var.platform_name}-auth-api"
    Type = "API"
  })
}

# API Gateway Resources
resource "aws_api_gateway_resource" "api" {
  rest_api_id = aws_api_gateway_rest_api.auth_api.id
  parent_id   = aws_api_gateway_rest_api.auth_api.root_resource_id
  path_part   = "api"
}

# Auth endpoints
locals {
  auth_endpoints = [
    "signup",
    "signin",
    "confirm",
    "resend-code",
    "forgot-password",
    "confirm-forgot-password",
    "refresh"
  ]
}

resource "aws_api_gateway_resource" "auth_endpoints" {
  for_each = toset(local.auth_endpoints)

  rest_api_id = aws_api_gateway_rest_api.auth_api.id
  parent_id   = aws_api_gateway_resource.api.id
  path_part   = each.value
}

# Me endpoint (protected)
resource "aws_api_gateway_resource" "me" {
  rest_api_id = aws_api_gateway_rest_api.auth_api.id
  parent_id   = aws_api_gateway_rest_api.auth_api.root_resource_id
  path_part   = "me"
}

# CORS Method for all endpoints
resource "aws_api_gateway_method" "cors" {
  for_each = merge(
    { for endpoint in local.auth_endpoints : endpoint => aws_api_gateway_resource.auth_endpoints[endpoint].id },
    { "me" = aws_api_gateway_resource.me.id }
  )

  rest_api_id   = aws_api_gateway_rest_api.auth_api.id
  resource_id   = each.value
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "cors" {
  for_each = aws_api_gateway_method.cors

  rest_api_id = aws_api_gateway_rest_api.auth_api.id
  resource_id = each.value.resource_id
  http_method = each.value.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_method_response" "cors" {
  for_each = aws_api_gateway_method.cors

  rest_api_id = aws_api_gateway_rest_api.auth_api.id
  resource_id = each.value.resource_id
  http_method = each.value.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "cors" {
  for_each = aws_api_gateway_method_response.cors

  rest_api_id = aws_api_gateway_rest_api.auth_api.id
  resource_id = each.value.resource_id
  http_method = each.value.http_method
  status_code = each.value.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,PUT,DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# POST Methods for auth endpoints
resource "aws_api_gateway_method" "auth_post" {
  for_each = toset(local.auth_endpoints)

  rest_api_id   = aws_api_gateway_rest_api.auth_api.id
  resource_id   = aws_api_gateway_resource.auth_endpoints[each.value].id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "auth_post" {
  for_each = aws_api_gateway_method.auth_post

  rest_api_id             = aws_api_gateway_rest_api.auth_api.id
  resource_id             = each.value.resource_id
  http_method             = each.value.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.auth_handler.invoke_arn
}

# GET Method for me endpoint
resource "aws_api_gateway_method" "me_get" {
  rest_api_id   = aws_api_gateway_rest_api.auth_api.id
  resource_id   = aws_api_gateway_resource.me.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "me_get" {
  rest_api_id             = aws_api_gateway_rest_api.auth_api.id
  resource_id             = aws_api_gateway_method.me_get.resource_id
  http_method             = aws_api_gateway_method.me_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.auth_handler.invoke_arn
}

# Lambda Permission for API Gateway
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.auth_api.execution_arn}/*/*"
}

# NOTE: API Gateway Deployment is managed in main.tf to ensure all modules' 
# methods and integrations are created before deployment