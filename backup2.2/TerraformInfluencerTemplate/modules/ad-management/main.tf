# Advertisement Management Module
# Manages a single advertisement banner for the Live page

# DynamoDB Table for Advertisement
resource "aws_dynamodb_table" "advertisements" {
  name         = "${var.project_name}-advertisements"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "adId"

  attribute {
    name = "adId"
    type = "S"
  }

  tags = {
    Name        = "${var.project_name}-advertisements"
    Environment = var.environment
  }
}

# Lambda Execution Role
resource "aws_iam_role" "ad_lambda" {
  name = "${var.project_name}-ad-lambda-role"

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

resource "aws_iam_role_policy" "ad_lambda" {
  name = "${var.project_name}-ad-lambda-policy"
  role = aws_iam_role.ad_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem"
        ]
        Resource = aws_dynamodb_table.advertisements.arn
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
data "archive_file" "ad_lambda" {
  type        = "zip"
  source_file = "${path.module}/lambda/index.js"
  output_path = "${path.module}/lambda.zip"
}

resource "aws_lambda_function" "ad_api" {
  filename         = data.archive_file.ad_lambda.output_path
  function_name    = "${var.project_name}-ad-api"
  role             = aws_iam_role.ad_lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.ad_lambda.output_base64sha256
  runtime          = "nodejs20.x"

  # Use Lambda Layers for dependencies
  layers = [
    var.aws_sdk_core_layer_arn,
  ]
  timeout          = 30

  environment {
    variables = {
      ADS_TABLE_NAME     = aws_dynamodb_table.advertisements.name
      IMAGES_BUCKET_NAME = var.assets_bucket_name
      CDN_DOMAIN         = var.cdn_domain
      USER_POOL_ID       = var.user_pool_id
      ADMIN_GROUP_NAME   = "admins"
    }
  }

  tags = {
    Name        = "${var.project_name}-ad-api"
    Environment = var.environment
  }
}

# API Gateway Integration
resource "aws_apigatewayv2_integration" "ad_api" {
  api_id             = var.api_gateway_id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.ad_api.invoke_arn
  integration_method = "POST"
}

# API Routes
resource "aws_apigatewayv2_route" "get_ad" {
  api_id    = var.api_gateway_id
  route_key = "GET /advertisement"
  target    = "integrations/${aws_apigatewayv2_integration.ad_api.id}"
}

resource "aws_apigatewayv2_route" "update_ad" {
  api_id             = var.api_gateway_id
  route_key          = "PUT /advertisement"
  target             = "integrations/${aws_apigatewayv2_integration.ad_api.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

resource "aws_apigatewayv2_route" "ad_upload_url" {
  api_id             = var.api_gateway_id
  route_key          = "POST /advertisement/upload-url"
  target             = "integrations/${aws_apigatewayv2_integration.ad_api.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

resource "aws_apigatewayv2_route" "delete_ad_image" {
  api_id             = var.api_gateway_id
  route_key          = "DELETE /advertisement/image"
  target             = "integrations/${aws_apigatewayv2_integration.ad_api.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

# Lambda Permission for API Gateway
resource "aws_lambda_permission" "ad_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ad_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}
