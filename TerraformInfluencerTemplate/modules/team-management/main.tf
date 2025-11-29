# Team Management Module
# Manages team members with profile images and social links

# DynamoDB Table for Team Members
resource "aws_dynamodb_table" "team_members" {
  name           = "${var.project_name}-team-members"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "memberId"

  attribute {
    name = "memberId"
    type = "S"
  }

  attribute {
    name = "order"
    type = "N"
  }

  global_secondary_index {
    name            = "OrderIndex"
    hash_key        = "order"
    projection_type = "ALL"
  }

  tags = {
    Name        = "${var.project_name}-team-members"
    Environment = var.environment
  }
}

# Note: Team images werden im gleichen S3 Bucket wie andere Assets gespeichert
# Kein separater Bucket oder CloudFront Distribution nötig

# Lambda Execution Role
resource "aws_iam_role" "team_lambda" {
  name = "${var.project_name}-team-lambda-role"

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

resource "aws_iam_role_policy" "team_lambda" {
  name = "${var.project_name}-team-lambda-policy"
  role = aws_iam_role.team_lambda.id

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
          aws_dynamodb_table.team_members.arn,
          "${aws_dynamodb_table.team_members.arn}/index/*"
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
data "archive_file" "team_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/lambda.zip"
}

resource "aws_lambda_function" "team_api" {
  filename         = data.archive_file.team_lambda.output_path
  function_name    = "${var.project_name}-team-api"
  role            = aws_iam_role.team_lambda.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.team_lambda.output_base64sha256
  runtime         = "nodejs18.x"
  timeout         = 30

  environment {
    variables = {
      TEAM_TABLE_NAME    = aws_dynamodb_table.team_members.name
      IMAGES_BUCKET_NAME = var.assets_bucket_name
      CDN_DOMAIN         = var.cdn_domain
      USER_POOL_ID       = var.user_pool_id
      ADMIN_GROUP_NAME   = "admins"
    }
  }

  tags = {
    Name        = "${var.project_name}-team-api"
    Environment = var.environment
  }
}

# API Gateway Integration (using existing User API Gateway)
resource "aws_apigatewayv2_integration" "team_api" {
  api_id           = var.api_gateway_id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.team_api.invoke_arn
  integration_method = "POST"
}

# API Routes
resource "aws_apigatewayv2_route" "get_team" {
  api_id    = var.api_gateway_id
  route_key = "GET /team"
  target    = "integrations/${aws_apigatewayv2_integration.team_api.id}"
}

resource "aws_apigatewayv2_route" "create_team_member" {
  api_id             = var.api_gateway_id
  route_key          = "POST /team"
  target             = "integrations/${aws_apigatewayv2_integration.team_api.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

resource "aws_apigatewayv2_route" "update_team_member" {
  api_id             = var.api_gateway_id
  route_key          = "PUT /team/{memberId}"
  target             = "integrations/${aws_apigatewayv2_integration.team_api.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

resource "aws_apigatewayv2_route" "delete_team_member" {
  api_id             = var.api_gateway_id
  route_key          = "DELETE /team/{memberId}"
  target             = "integrations/${aws_apigatewayv2_integration.team_api.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

resource "aws_apigatewayv2_route" "upload_url" {
  api_id             = var.api_gateway_id
  route_key          = "POST /team/upload-url"
  target             = "integrations/${aws_apigatewayv2_integration.team_api.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

# Lambda Permission for API Gateway
resource "aws_lambda_permission" "team_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.team_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}
