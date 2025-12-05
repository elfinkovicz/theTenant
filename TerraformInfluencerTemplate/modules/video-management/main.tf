# Video Management Module
# Provides admin video upload/management with S3 storage and DynamoDB metadata

# DynamoDB Table for Video Metadata
resource "aws_dynamodb_table" "videos" {
  name         = "${var.project_name}-videos"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "videoId"

  attribute {
    name = "videoId"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "uploadedAt"
    type = "S"
  }

  global_secondary_index {
    name            = "StatusIndex"
    hash_key        = "status"
    range_key       = "uploadedAt"
    projection_type = "ALL"
  }

  tags = {
    Name        = "${var.project_name}-videos"
    Environment = var.environment
  }
}

# S3 Bucket for Videos (Private)
resource "aws_s3_bucket" "videos" {
  bucket = "${var.project_name}-videos-${var.environment}"

  tags = {
    Name        = "${var.project_name}-videos"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_public_access_block" "videos" {
  bucket = aws_s3_bucket.videos.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "videos" {
  bucket = aws_s3_bucket.videos.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = var.allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# S3 Bucket for Thumbnails (Public with CORS)
resource "aws_s3_bucket" "thumbnails" {
  bucket = "${var.project_name}-thumbnails-${var.environment}"

  tags = {
    Name        = "${var.project_name}-thumbnails"
    Environment = var.environment
  }
}

# Allow public read access for thumbnails
resource "aws_s3_bucket_public_access_block" "thumbnails" {
  bucket = aws_s3_bucket.thumbnails.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_cors_configuration" "thumbnails" {
  bucket = aws_s3_bucket.thumbnails.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD", "PUT", "POST"]
    allowed_origins = ["*"]  # Public thumbnails
    expose_headers  = ["ETag", "Content-Type", "Content-Length"]
    max_age_seconds = 3600
  }
}

# Public read policy for thumbnails
resource "aws_s3_bucket_policy" "thumbnails" {
  bucket = aws_s3_bucket.thumbnails.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "PublicReadGetObject"
        Effect = "Allow"
        Principal = "*"
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.thumbnails.arn}/*"
      }
    ]
  })

  depends_on = [
    aws_s3_bucket_public_access_block.thumbnails
  ]
}

# Lambda Execution Role
resource "aws_iam_role" "video_api_lambda" {
  name = "${var.project_name}-video-api-lambda"

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

resource "aws_iam_role_policy" "video_api_lambda" {
  name = "${var.project_name}-video-api-lambda-policy"
  role = aws_iam_role.video_api_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
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
          aws_dynamodb_table.videos.arn,
          "${aws_dynamodb_table.videos.arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject"
        ]
        Resource = [
          "${aws_s3_bucket.videos.arn}/*",
          "${aws_s3_bucket.thumbnails.arn}/*"
        ]
      }
    ]
  })
}

# Lambda Function
data "archive_file" "video_api_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/lambda.zip"
  excludes    = ["package-lock.json"]
}

resource "aws_lambda_function" "video_api" {
  filename         = data.archive_file.video_api_lambda.output_path
  function_name    = "${var.project_name}-video-api"
  role             = aws_iam_role.video_api_lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.video_api_lambda.output_base64sha256
  runtime          = "nodejs20.x"

  # Use Lambda Layers for dependencies
  layers = [
    var.aws_sdk_core_layer_arn,
    var.utilities_layer_arn,
  ]
  timeout          = 30

  environment {
    variables = {
      VIDEOS_TABLE_NAME      = aws_dynamodb_table.videos.name
      VIDEOS_BUCKET_NAME     = aws_s3_bucket.videos.id
      THUMBNAILS_BUCKET_NAME = aws_s3_bucket.thumbnails.id
      THUMBNAILS_CDN_DOMAIN  = aws_s3_bucket.thumbnails.bucket_regional_domain_name
      USER_POOL_ID           = var.user_pool_id
      ADMIN_GROUP_NAME       = "admins"
    }
  }

  tags = {
    Name        = "${var.project_name}-video-api"
    Environment = var.environment
  }
}

# API Gateway Integration
resource "aws_apigatewayv2_integration" "video_api" {
  api_id           = var.api_gateway_id
  integration_type = "AWS_PROXY"

  integration_uri    = aws_lambda_function.video_api.invoke_arn
  integration_method = "POST"
}

# API Routes
resource "aws_apigatewayv2_route" "get_videos" {
  api_id    = var.api_gateway_id
  route_key = "GET /videos"
  target    = "integrations/${aws_apigatewayv2_integration.video_api.id}"
}

resource "aws_apigatewayv2_route" "get_video" {
  api_id    = var.api_gateway_id
  route_key = "GET /videos/{videoId}"
  target    = "integrations/${aws_apigatewayv2_integration.video_api.id}"
}

resource "aws_apigatewayv2_route" "create_video" {
  api_id             = var.api_gateway_id
  route_key          = "POST /videos"
  target             = "integrations/${aws_apigatewayv2_integration.video_api.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

resource "aws_apigatewayv2_route" "update_video" {
  api_id             = var.api_gateway_id
  route_key          = "PUT /videos/{videoId}"
  target             = "integrations/${aws_apigatewayv2_integration.video_api.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

resource "aws_apigatewayv2_route" "delete_video" {
  api_id             = var.api_gateway_id
  route_key          = "DELETE /videos/{videoId}"
  target             = "integrations/${aws_apigatewayv2_integration.video_api.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

resource "aws_apigatewayv2_route" "upload_url" {
  api_id             = var.api_gateway_id
  route_key          = "POST /videos/upload-url"
  target             = "integrations/${aws_apigatewayv2_integration.video_api.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

# Lambda Permission for API Gateway
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.video_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}

# Cognito Admin Group
resource "aws_cognito_user_group" "admins" {
  name         = "admins"
  user_pool_id = var.user_pool_id
  description  = "Admin users with video management permissions"
  precedence   = 1
}
