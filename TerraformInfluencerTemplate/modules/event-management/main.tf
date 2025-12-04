# Event Management Module
# Manages events with images, dates, and ticket links

# DynamoDB Table for Events
resource "aws_dynamodb_table" "events" {
  name           = "${var.project_name}-events"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "eventId"

  attribute {
    name = "eventId"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "eventDate"
    type = "S"
  }

  global_secondary_index {
    name            = "StatusDateIndex"
    hash_key        = "status"
    range_key       = "eventDate"
    projection_type = "ALL"
  }

  tags = {
    Name        = "${var.project_name}-events"
    Environment = var.environment
  }
}

# Lambda Execution Role
resource "aws_iam_role" "event_lambda" {
  name = "${var.project_name}-event-lambda-role"

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

resource "aws_iam_role_policy" "event_lambda" {
  name = "${var.project_name}-event-lambda-policy"
  role = aws_iam_role.event_lambda.id

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
          aws_dynamodb_table.events.arn,
          "${aws_dynamodb_table.events.arn}/index/*"
        ]
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
data "archive_file" "event_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/lambda.zip"
}

resource "aws_lambda_function" "event_api" {
  filename         = data.archive_file.event_lambda.output_path
  function_name    = "${var.project_name}-event-api"
  role            = aws_iam_role.event_lambda.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.event_lambda.output_base64sha256
  runtime         = "nodejs20.x"
  timeout         = 30

  environment {
    variables = {
      EVENTS_TABLE_NAME  = aws_dynamodb_table.events.name
      IMAGES_BUCKET_NAME = var.assets_bucket_name
      CDN_DOMAIN         = var.cdn_domain
      USER_POOL_ID       = var.user_pool_id
      ADMIN_GROUP_NAME   = "admins"
    }
  }

  tags = {
    Name        = "${var.project_name}-event-api"
    Environment = var.environment
  }
}

# API Gateway Integration (using existing User API Gateway)
resource "aws_apigatewayv2_integration" "event_api" {
  api_id             = var.api_gateway_id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.event_api.invoke_arn
  integration_method = "POST"
}

# API Routes
resource "aws_apigatewayv2_route" "get_events" {
  api_id    = var.api_gateway_id
  route_key = "GET /events"
  target    = "integrations/${aws_apigatewayv2_integration.event_api.id}"
}

resource "aws_apigatewayv2_route" "get_event" {
  api_id    = var.api_gateway_id
  route_key = "GET /events/{eventId}"
  target    = "integrations/${aws_apigatewayv2_integration.event_api.id}"
}

resource "aws_apigatewayv2_route" "create_event" {
  api_id             = var.api_gateway_id
  route_key          = "POST /events"
  target             = "integrations/${aws_apigatewayv2_integration.event_api.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

resource "aws_apigatewayv2_route" "update_event" {
  api_id             = var.api_gateway_id
  route_key          = "PUT /events/{eventId}"
  target             = "integrations/${aws_apigatewayv2_integration.event_api.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

resource "aws_apigatewayv2_route" "delete_event" {
  api_id             = var.api_gateway_id
  route_key          = "DELETE /events/{eventId}"
  target             = "integrations/${aws_apigatewayv2_integration.event_api.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

resource "aws_apigatewayv2_route" "event_upload_url" {
  api_id             = var.api_gateway_id
  route_key          = "POST /events/upload-url"
  target             = "integrations/${aws_apigatewayv2_integration.event_api.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

# Lambda Permission for API Gateway
resource "aws_lambda_permission" "event_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.event_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}
