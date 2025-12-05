# Newsfeed Management Module
# Manages news posts with media (images/videos), external links, and location

# Newsfeed nutzt den bestehenden Thumbnails-Bucket und CDN vom Video-Management
# Keine separate S3 Bucket oder CloudFront Distribution erforderlich

# DynamoDB Table for Newsfeed Posts
resource "aws_dynamodb_table" "newsfeed" {
  name           = "${var.project_name}-newsfeed"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "postId"

  # Enable DynamoDB Streams for WhatsApp integration
  stream_enabled   = true
  stream_view_type = "NEW_IMAGE"

  attribute {
    name = "postId"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  global_secondary_index {
    name            = "StatusCreatedIndex"
    hash_key        = "status"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  tags = {
    Name        = "${var.project_name}-newsfeed"
    Environment = var.environment
  }
}

# Lambda Execution Role
resource "aws_iam_role" "newsfeed_lambda" {
  name = "${var.project_name}-newsfeed-lambda-role"

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

resource "aws_iam_role_policy" "newsfeed_lambda" {
  name = "${var.project_name}-newsfeed-lambda-policy"
  role = aws_iam_role.newsfeed_lambda.id

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
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.newsfeed.arn,
          "${aws_dynamodb_table.newsfeed.arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem"
        ]
        Resource = var.settings_table_arn != "" ? var.settings_table_arn : "arn:aws:dynamodb:*:*:table/dummy"
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
data "archive_file" "newsfeed_lambda" {
  type        = "zip"
  source_file = "${path.module}/lambda/index.js"
  output_path = "${path.module}/lambda.zip"
}

resource "aws_lambda_function" "newsfeed_api" {
  filename         = data.archive_file.newsfeed_lambda.output_path
  function_name    = "${var.project_name}-newsfeed-api"
  role            = aws_iam_role.newsfeed_lambda.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.newsfeed_lambda.output_base64sha256
  runtime         = "nodejs20.x"

  # Use Lambda Layers for dependencies
  layers = [
    var.aws_sdk_core_layer_arn,
  ]
  timeout         = 30

  environment {
    variables = {
      NEWSFEED_TABLE_NAME = aws_dynamodb_table.newsfeed.name
      MEDIA_BUCKET_NAME   = var.assets_bucket_name
      CDN_DOMAIN          = var.cdn_domain
      USER_POOL_ID        = var.user_pool_id
      ADMIN_GROUP_NAME    = "admins"
      SETTINGS_TABLE_NAME = var.settings_table_name
    }
  }

  tags = {
    Name        = "${var.project_name}-newsfeed-api"
    Environment = var.environment
  }
}

# API Gateway Integration
resource "aws_apigatewayv2_integration" "newsfeed_api" {
  api_id             = var.api_gateway_id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.newsfeed_api.invoke_arn
  integration_method = "POST"
}

# API Routes
resource "aws_apigatewayv2_route" "get_posts" {
  api_id    = var.api_gateway_id
  route_key = "GET /newsfeed"
  target    = "integrations/${aws_apigatewayv2_integration.newsfeed_api.id}"
}

resource "aws_apigatewayv2_route" "get_post" {
  api_id    = var.api_gateway_id
  route_key = "GET /newsfeed/{postId}"
  target    = "integrations/${aws_apigatewayv2_integration.newsfeed_api.id}"
}

resource "aws_apigatewayv2_route" "create_post" {
  api_id             = var.api_gateway_id
  route_key          = "POST /newsfeed"
  target             = "integrations/${aws_apigatewayv2_integration.newsfeed_api.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

resource "aws_apigatewayv2_route" "update_post" {
  api_id             = var.api_gateway_id
  route_key          = "PUT /newsfeed/{postId}"
  target             = "integrations/${aws_apigatewayv2_integration.newsfeed_api.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

resource "aws_apigatewayv2_route" "delete_post" {
  api_id             = var.api_gateway_id
  route_key          = "DELETE /newsfeed/{postId}"
  target             = "integrations/${aws_apigatewayv2_integration.newsfeed_api.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

resource "aws_apigatewayv2_route" "newsfeed_upload_url" {
  api_id             = var.api_gateway_id
  route_key          = "POST /newsfeed/upload-url"
  target             = "integrations/${aws_apigatewayv2_integration.newsfeed_api.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

# Lambda Permission for API Gateway
resource "aws_lambda_permission" "newsfeed_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.newsfeed_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}
