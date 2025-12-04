# Product Management Module
# Manages shop products with images and external links

# Lambda Execution Role
resource "aws_iam_role" "product_lambda" {
  name = "${var.project_name}-product-lambda-role"

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

resource "aws_iam_role_policy" "product_lambda" {
  name = "${var.project_name}-product-lambda-policy"
  role = aws_iam_role.product_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Scan"
        ]
        Resource = var.products_table_arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject"
        ]
        Resource = "arn:aws:s3:::${var.images_bucket_name}/*"
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
data "archive_file" "product_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/lambda.zip"
}

resource "aws_lambda_function" "product_api" {
  filename         = data.archive_file.product_lambda.output_path
  function_name    = "${var.project_name}-product-api"
  role             = aws_iam_role.product_lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.product_lambda.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = 30

  environment {
    variables = {
      PRODUCTS_TABLE_NAME = var.products_table_name
      IMAGES_BUCKET_NAME  = var.images_bucket_name
      CDN_DOMAIN          = var.cdn_domain
      USER_POOL_ID        = var.user_pool_id
      ADMIN_GROUP_NAME    = "admins"
    }
  }

  tags = {
    Name        = "${var.project_name}-product-api"
    Environment = var.environment
  }
}

# JWT Authorizer for Shop API Gateway
resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = var.api_gateway_id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${var.project_name}-product-authorizer"

  jwt_configuration {
    audience = [var.user_pool_client_id]
    issuer   = "https://cognito-idp.${data.aws_region.current.name}.amazonaws.com/${var.user_pool_id}"
  }
}

data "aws_region" "current" {}

# API Gateway Integration
resource "aws_apigatewayv2_integration" "product_api" {
  api_id             = var.api_gateway_id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.product_api.invoke_arn
  integration_method = "POST"
}

# API Routes
# Public routes (no authentication required)

# List all products
resource "aws_apigatewayv2_route" "list_products" {
  api_id    = var.api_gateway_id
  route_key = "GET /products"
  target    = "integrations/${aws_apigatewayv2_integration.product_api.id}"
}

resource "aws_apigatewayv2_route" "get_product" {
  api_id    = var.api_gateway_id
  route_key = "GET /products/{productId}"
  target    = "integrations/${aws_apigatewayv2_integration.product_api.id}"
}

resource "aws_apigatewayv2_route" "create_product" {
  api_id             = var.api_gateway_id
  route_key          = "POST /products"
  target             = "integrations/${aws_apigatewayv2_integration.product_api.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "update_product" {
  api_id             = var.api_gateway_id
  route_key          = "PUT /products/{productId}"
  target             = "integrations/${aws_apigatewayv2_integration.product_api.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "delete_product" {
  api_id             = var.api_gateway_id
  route_key          = "DELETE /products/{productId}"
  target             = "integrations/${aws_apigatewayv2_integration.product_api.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "product_upload_url" {
  api_id             = var.api_gateway_id
  route_key          = "POST /products/upload-url"
  target             = "integrations/${aws_apigatewayv2_integration.product_api.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# Lambda Permission for API Gateway
resource "aws_lambda_permission" "product_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.product_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}
