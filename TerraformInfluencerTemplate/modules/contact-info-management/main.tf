# Contact Info Management Module
# Manages contact information (email, phone, address)

# DynamoDB Table for Contact Info
resource "aws_dynamodb_table" "contact_info" {
  name           = "${var.project_name}-contact-info"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "infoId"

  attribute {
    name = "infoId"
    type = "S"
  }

  tags = {
    Name        = "${var.project_name}-contact-info"
    Environment = var.environment
  }
}

# Lambda Execution Role
resource "aws_iam_role" "contact_info_lambda" {
  name = "${var.project_name}-contact-info-lambda-role"

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

resource "aws_iam_role_policy" "contact_info_lambda" {
  name = "${var.project_name}-contact-info-lambda-policy"
  role = aws_iam_role.contact_info_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Scan"
        ]
        Resource = aws_dynamodb_table.contact_info.arn
      },
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:GetUser",
          "cognito-idp:ListUsers",
          "cognito-idp:AdminGetUser"
        ]
        Resource = "arn:aws:cognito-idp:*:*:userpool/${var.user_pool_id}"
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
data "archive_file" "contact_info_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/lambda.zip"
}

resource "aws_lambda_function" "contact_info_api" {
  filename         = data.archive_file.contact_info_lambda.output_path
  function_name    = "${var.project_name}-contact-info-api"
  role            = aws_iam_role.contact_info_lambda.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.contact_info_lambda.output_base64sha256
  runtime         = "nodejs20.x"
  timeout         = 30

  environment {
    variables = {
      CONTACT_INFO_TABLE_NAME = aws_dynamodb_table.contact_info.name
      USER_POOL_ID            = var.user_pool_id
      ADMIN_GROUP_NAME        = "admins"
    }
  }

  tags = {
    Name        = "${var.project_name}-contact-info-api"
    Environment = var.environment
  }
}

# API Gateway Integration
resource "aws_apigatewayv2_integration" "contact_info_api" {
  api_id           = var.api_gateway_id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.contact_info_api.invoke_arn
  integration_method = "POST"
}

# API Routes
resource "aws_apigatewayv2_route" "get_contact_info" {
  api_id    = var.api_gateway_id
  route_key = "GET /contact-info"
  target    = "integrations/${aws_apigatewayv2_integration.contact_info_api.id}"
}

resource "aws_apigatewayv2_route" "update_contact_info" {
  api_id             = var.api_gateway_id
  route_key          = "PUT /contact-info"
  target             = "integrations/${aws_apigatewayv2_integration.contact_info_api.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

# Lambda Permission for API Gateway
resource "aws_lambda_permission" "contact_info_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.contact_info_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}
