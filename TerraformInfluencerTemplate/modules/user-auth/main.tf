# Cognito User Pool
resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-users"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false # Sonderzeichen optional
    require_uppercase = false # Großbuchstaben optional
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = false
  }

  admin_create_user_config {
    allow_admin_create_user_only = !var.allow_user_registration
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }
}

# Cognito User Pool Client
resource "aws_cognito_user_pool_client" "main" {
  name         = "${var.project_name}-client"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret                      = false
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code", "implicit"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  callback_urls                        = var.callback_urls
  logout_urls                          = var.logout_urls
  supported_identity_providers         = ["COGNITO"]

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]
}

# Cognito Domain
resource "aws_cognito_user_pool_domain" "main" {
  domain       = "${var.project_name}-${data.aws_caller_identity.current.account_id}"
  user_pool_id = aws_cognito_user_pool.main.id
}

# DynamoDB für User Profile
resource "aws_dynamodb_table" "users" {
  name         = "${var.project_name}-users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "email"
    type = "S"
  }

  global_secondary_index {
    name            = "EmailIndex"
    hash_key        = "email"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = false
  }
}

# Lambda für User Management
resource "aws_iam_role" "user_api_lambda" {
  name = "${var.project_name}-user-api-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "user_api_lambda_basic" {
  role       = aws_iam_role.user_api_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "user_api_lambda_dynamodb" {
  name = "dynamodb-access"
  role = aws_iam_role.user_api_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ]
      Resource = [
        aws_dynamodb_table.users.arn,
        "${aws_dynamodb_table.users.arn}/index/*"
      ]
    }]
  })
}

resource "aws_iam_role_policy" "user_api_lambda_cognito" {
  name = "cognito-access"
  role = aws_iam_role.user_api_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "cognito-idp:AdminGetUser",
        "cognito-idp:AdminUpdateUserAttributes",
        "cognito-idp:AdminDeleteUser",
        "cognito-idp:ListUsers"
      ]
      Resource = aws_cognito_user_pool.main.arn
    }]
  })
}

resource "aws_lambda_function" "user_api" {
  filename         = data.archive_file.user_api_lambda.output_path
  function_name    = "${var.project_name}-user-api"
  role             = aws_iam_role.user_api_lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.user_api_lambda.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = 10

  environment {
    variables = {
      USER_TABLE_NAME = aws_dynamodb_table.users.name
      USER_POOL_ID    = aws_cognito_user_pool.main.id
    }
  }
}

data "archive_file" "user_api_lambda" {
  type        = "zip"
  output_path = "${path.module}/lambda.zip"

  source {
    content  = file("${path.module}/lambda/index.js")
    filename = "index.js"
  }
}

# Auth Lambda (SignUp, SignIn, Confirm, etc.)
resource "aws_iam_role" "auth_lambda" {
  name = "${var.project_name}-auth-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "auth_lambda_basic" {
  role       = aws_iam_role.auth_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "auth_lambda_cognito" {
  name = "cognito-auth-access"
  role = aws_iam_role.auth_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "cognito-idp:SignUp",
        "cognito-idp:ConfirmSignUp",
        "cognito-idp:InitiateAuth",
        "cognito-idp:ResendConfirmationCode",
        "cognito-idp:GetUser",
        "cognito-idp:ForgotPassword",
        "cognito-idp:ConfirmForgotPassword"
      ]
      Resource = aws_cognito_user_pool.main.arn
    }]
  })
}

resource "aws_lambda_function" "auth" {
  filename         = data.archive_file.auth_lambda.output_path
  function_name    = "${var.project_name}-auth"
  role             = aws_iam_role.auth_lambda.arn
  handler          = "auth.handler"
  source_code_hash = data.archive_file.auth_lambda.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = 10

  environment {
    variables = {
      USER_POOL_ID = aws_cognito_user_pool.main.id
      CLIENT_ID    = aws_cognito_user_pool_client.main.id
    }
  }
}

data "archive_file" "auth_lambda" {
  type        = "zip"
  output_path = "${path.module}/auth-lambda.zip"

  source {
    content  = file("${path.module}/lambda/auth.js")
    filename = "auth.js"
  }
}

# Auth API Gateway Integration
resource "aws_apigatewayv2_integration" "auth" {
  api_id           = aws_apigatewayv2_api.user_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.auth.invoke_arn
}

# Auth Routes
resource "aws_apigatewayv2_route" "signup" {
  api_id    = aws_apigatewayv2_api.user_api.id
  route_key = "POST /signup"
  target    = "integrations/${aws_apigatewayv2_integration.auth.id}"
}

resource "aws_apigatewayv2_route" "signin" {
  api_id    = aws_apigatewayv2_api.user_api.id
  route_key = "POST /signin"
  target    = "integrations/${aws_apigatewayv2_integration.auth.id}"
}

resource "aws_apigatewayv2_route" "confirm" {
  api_id    = aws_apigatewayv2_api.user_api.id
  route_key = "POST /confirm"
  target    = "integrations/${aws_apigatewayv2_integration.auth.id}"
}

resource "aws_apigatewayv2_route" "resend_code" {
  api_id    = aws_apigatewayv2_api.user_api.id
  route_key = "POST /resend-code"
  target    = "integrations/${aws_apigatewayv2_integration.auth.id}"
}

resource "aws_apigatewayv2_route" "get_me" {
  api_id    = aws_apigatewayv2_api.user_api.id
  route_key = "GET /me"
  target    = "integrations/${aws_apigatewayv2_integration.auth.id}"
}

resource "aws_lambda_permission" "api_gateway_auth" {
  statement_id  = "AllowAPIGatewayInvokeAuth"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.user_api.execution_arn}/*/*"
}

# API Gateway für User Management
resource "aws_apigatewayv2_api" "user_api" {
  name          = "${var.project_name}-user-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins  = ["*"]
    allow_methods  = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers  = ["Content-Type", "Authorization", "X-Amz-Date", "X-Api-Key", "X-Amz-Security-Token"]
    expose_headers = ["*"]
    max_age        = 300
  }
}

# JWT Authorizer für geschützte Routen
resource "aws_apigatewayv2_authorizer" "jwt" {
  api_id           = aws_apigatewayv2_api.user_api.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${var.project_name}-jwt-authorizer"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.main.id]
    issuer   = "https://cognito-idp.${data.aws_region.current.name}.amazonaws.com/${aws_cognito_user_pool.main.id}"
  }
}

resource "aws_apigatewayv2_stage" "user_api" {
  api_id      = aws_apigatewayv2_api.user_api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_apigatewayv2_integration" "user_api" {
  api_id           = aws_apigatewayv2_api.user_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.user_api.invoke_arn
}

resource "aws_apigatewayv2_route" "get_user" {
  api_id    = aws_apigatewayv2_api.user_api.id
  route_key = "GET /users/{userId}"
  target    = "integrations/${aws_apigatewayv2_integration.user_api.id}"
}

resource "aws_apigatewayv2_route" "update_user" {
  api_id    = aws_apigatewayv2_api.user_api.id
  route_key = "PUT /users/{userId}"
  target    = "integrations/${aws_apigatewayv2_integration.user_api.id}"
}

resource "aws_apigatewayv2_route" "delete_user" {
  api_id    = aws_apigatewayv2_api.user_api.id
  route_key = "DELETE /users/{userId}"
  target    = "integrations/${aws_apigatewayv2_integration.user_api.id}"
}

resource "aws_lambda_permission" "api_gateway_user" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.user_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.user_api.execution_arn}/*/*"
}

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}
