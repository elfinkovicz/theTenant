# Messaging Settings Module
# Manages WhatsApp and Telegram integration settings

# DynamoDB Table for Settings
resource "aws_dynamodb_table" "messaging_settings" {
  name         = "${var.project_name}-messaging-settings"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "settingId"

  attribute {
    name = "settingId"
    type = "S"
  }

  tags = {
    Name        = "${var.project_name}-messaging-settings"
    Environment = var.environment
  }
}

# Lambda Function
resource "aws_lambda_function" "messaging_settings_api" {
  filename         = data.archive_file.lambda.output_path
  function_name    = "${var.project_name}-messaging-settings-api"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.lambda.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = 10
  layers           = var.lambda_layer_arns

  environment {
    variables = {
      SETTINGS_TABLE_NAME = aws_dynamodb_table.messaging_settings.name
      ADMIN_GROUP_NAME    = var.admin_group_name
      DOMAIN_NAME         = var.domain_name
    }
  }
}

data "archive_file" "lambda" {
  type        = "zip"
  output_path = "${path.module}/lambda.zip"

  source {
    content  = file("${path.module}/lambda/index.js")
    filename = "index.js"
  }
}

# IAM Role
resource "aws_iam_role" "lambda" {
  name = "${var.project_name}-messaging-settings-lambda-role"

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

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "dynamodb" {
  name = "dynamodb-access"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem"
      ]
      Resource = aws_dynamodb_table.messaging_settings.arn
    }]
  })
}

resource "aws_iam_role_policy" "ses" {
  name = "ses-send-email"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ]
      Resource = "*"
    }]
  })
}

# API Gateway Integration
resource "aws_apigatewayv2_integration" "api" {
  api_id           = var.api_gateway_id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.messaging_settings_api.invoke_arn
}

# Routes
resource "aws_apigatewayv2_route" "get_whatsapp" {
  api_id             = var.api_gateway_id
  route_key          = "GET /whatsapp/settings"
  target             = "integrations/${aws_apigatewayv2_integration.api.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

resource "aws_apigatewayv2_route" "put_whatsapp" {
  api_id             = var.api_gateway_id
  route_key          = "PUT /whatsapp/settings"
  target             = "integrations/${aws_apigatewayv2_integration.api.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

resource "aws_apigatewayv2_route" "post_whatsapp_test" {
  api_id             = var.api_gateway_id
  route_key          = "POST /whatsapp/test"
  target             = "integrations/${aws_apigatewayv2_integration.api.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

resource "aws_apigatewayv2_route" "get_telegram" {
  api_id             = var.api_gateway_id
  route_key          = "GET /telegram/settings"
  target             = "integrations/${aws_apigatewayv2_integration.api.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

resource "aws_apigatewayv2_route" "put_telegram" {
  api_id             = var.api_gateway_id
  route_key          = "PUT /telegram/settings"
  target             = "integrations/${aws_apigatewayv2_integration.api.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

resource "aws_apigatewayv2_route" "post_telegram_test" {
  api_id             = var.api_gateway_id
  route_key          = "POST /telegram/test"
  target             = "integrations/${aws_apigatewayv2_integration.api.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

resource "aws_apigatewayv2_route" "get_email" {
  api_id             = var.api_gateway_id
  route_key          = "GET /email/settings"
  target             = "integrations/${aws_apigatewayv2_integration.api.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

resource "aws_apigatewayv2_route" "put_email" {
  api_id             = var.api_gateway_id
  route_key          = "PUT /email/settings"
  target             = "integrations/${aws_apigatewayv2_integration.api.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

resource "aws_apigatewayv2_route" "post_email_test" {
  api_id             = var.api_gateway_id
  route_key          = "POST /email/test"
  target             = "integrations/${aws_apigatewayv2_integration.api.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.messaging_settings_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}
