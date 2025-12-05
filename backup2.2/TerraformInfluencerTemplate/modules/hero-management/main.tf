# Hero Management Module
# Manages hero section content (logo, title, subtitle) for the Home page

# DynamoDB Table for Hero Content
resource "aws_dynamodb_table" "hero" {
  name         = "${var.project_name}-hero"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "heroId"

  attribute {
    name = "heroId"
    type = "S"
  }

  tags = {
    Name        = "${var.project_name}-hero"
    Environment = var.environment
  }
}

# Lambda Execution Role
resource "aws_iam_role" "hero_lambda" {
  name = "${var.project_name}-hero-lambda-role"

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
}

resource "aws_iam_role_policy" "hero_lambda" {
  name = "${var.project_name}-hero-lambda-policy"
  role = aws_iam_role.hero_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem"
        ]
        Resource = aws_dynamodb_table.hero.arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject"
        ]
        Resource = "arn:aws:s3:::${var.assets_bucket_name}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# Lambda Function
data "archive_file" "hero_lambda" {
  type        = "zip"
  source_file = "${path.module}/lambda/index.js"
  output_path = "${path.module}/lambda.zip"
}

resource "aws_lambda_function" "hero_api" {
  filename         = data.archive_file.hero_lambda.output_path
  function_name    = "${var.project_name}-hero-api"
  role             = aws_iam_role.hero_lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.hero_lambda.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = 30
  
  # Use Lambda Layers for dependencies
  layers = [
    var.aws_sdk_core_layer_arn
  ]

  environment {
    variables = {
      HERO_TABLE_NAME    = aws_dynamodb_table.hero.name
      IMAGES_BUCKET_NAME = var.assets_bucket_name
      CDN_DOMAIN         = var.cdn_domain
      USER_POOL_ID       = var.user_pool_id
      ADMIN_GROUP_NAME   = "admins"
    }
  }

  tags = {
    Name        = "${var.project_name}-hero-api"
    Environment = var.environment
  }
}

# API Gateway Integration
resource "aws_apigatewayv2_integration" "hero_api" {
  api_id             = var.api_gateway_id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.hero_api.invoke_arn
  integration_method = "POST"
}

# API Routes
resource "aws_apigatewayv2_route" "get_hero" {
  api_id    = var.api_gateway_id
  route_key = "GET /hero"
  target    = "integrations/${aws_apigatewayv2_integration.hero_api.id}"
}

resource "aws_apigatewayv2_route" "update_hero" {
  api_id             = var.api_gateway_id
  route_key          = "PUT /hero"
  target             = "integrations/${aws_apigatewayv2_integration.hero_api.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

resource "aws_apigatewayv2_route" "hero_upload_url" {
  api_id             = var.api_gateway_id
  route_key          = "POST /hero/upload-url"
  target             = "integrations/${aws_apigatewayv2_integration.hero_api.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

resource "aws_apigatewayv2_route" "delete_hero_logo" {
  api_id             = var.api_gateway_id
  route_key          = "DELETE /hero/logo"
  target             = "integrations/${aws_apigatewayv2_integration.hero_api.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

# Lambda Permission for API Gateway
resource "aws_lambda_permission" "hero_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.hero_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}
