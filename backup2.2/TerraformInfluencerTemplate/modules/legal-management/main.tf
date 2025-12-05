# Legal Management Module
# Manages legal documents (Impressum, Datenschutz, AGB)

# DynamoDB Table for Legal Documents
resource "aws_dynamodb_table" "legal_docs" {
  name           = "${var.project_name}-legal-docs"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "docId"

  attribute {
    name = "docId"
    type = "S"
  }

  tags = {
    Name        = "${var.project_name}-legal-docs"
    Environment = var.environment
  }
}

# Lambda Execution Role
resource "aws_iam_role" "legal_lambda" {
  name = "${var.project_name}-legal-lambda-role"

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

resource "aws_iam_role_policy" "legal_lambda" {
  name = "${var.project_name}-legal-lambda-policy"
  role = aws_iam_role.legal_lambda.id

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
        Resource = aws_dynamodb_table.legal_docs.arn
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
data "archive_file" "legal_lambda" {
  type        = "zip"
  source_file = "${path.module}/lambda/index.js"
  output_path = "${path.module}/lambda.zip"
}

resource "aws_lambda_function" "legal_api" {
  filename         = data.archive_file.legal_lambda.output_path
  function_name    = "${var.project_name}-legal-api"
  role            = aws_iam_role.legal_lambda.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.legal_lambda.output_base64sha256
  runtime         = "nodejs20.x"

  # Use Lambda Layers for dependencies
  layers = [
    var.aws_sdk_core_layer_arn,
  ]
  timeout         = 30

  environment {
    variables = {
      LEGAL_DOCS_TABLE_NAME = aws_dynamodb_table.legal_docs.name
      USER_POOL_ID          = var.user_pool_id
      ADMIN_GROUP_NAME      = "admins"
    }
  }

  tags = {
    Name        = "${var.project_name}-legal-api"
    Environment = var.environment
  }
}

# API Gateway Integration
resource "aws_apigatewayv2_integration" "legal_api" {
  api_id           = var.api_gateway_id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.legal_api.invoke_arn
  integration_method = "POST"
}

# API Routes
resource "aws_apigatewayv2_route" "get_legal_docs" {
  api_id    = var.api_gateway_id
  route_key = "GET /legal"
  target    = "integrations/${aws_apigatewayv2_integration.legal_api.id}"
}

resource "aws_apigatewayv2_route" "update_legal_docs" {
  api_id             = var.api_gateway_id
  route_key          = "PUT /legal"
  target             = "integrations/${aws_apigatewayv2_integration.legal_api.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

# Lambda Permission for API Gateway
resource "aws_lambda_permission" "legal_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.legal_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}
