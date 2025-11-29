# Sponsor System Module
# Ermöglicht Sponsoren-Buchungen und Tracking

# DynamoDB Table für Sponsor-Buchungen
resource "aws_dynamodb_table" "sponsors" {
  name         = "${var.project_name}-sponsors"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "sponsorId"

  attribute {
    name = "sponsorId"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "startDate"
    type = "S"
  }

  global_secondary_index {
    name            = "StatusIndex"
    hash_key        = "status"
    range_key       = "startDate"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Name = "${var.project_name}-sponsors"
  }
}

# DynamoDB Table für Sponsor-Statistiken
resource "aws_dynamodb_table" "sponsor_stats" {
  name         = "${var.project_name}-sponsor-stats"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "sponsorId"
  range_key    = "timestamp"

  attribute {
    name = "sponsorId"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "N"
  }

  tags = {
    Name = "${var.project_name}-sponsor-stats"
  }
}

# S3 Bucket für Sponsor-Assets (Bilder, Banner)
resource "aws_s3_bucket" "sponsor_assets" {
  bucket = "${var.project_name}-sponsor-assets-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name = "${var.project_name}-sponsor-assets"
  }
}

resource "aws_s3_bucket_public_access_block" "sponsor_assets" {
  bucket = aws_s3_bucket.sponsor_assets.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "sponsor_assets" {
  bucket = aws_s3_bucket.sponsor_assets.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "PublicReadGetObject"
      Effect    = "Allow"
      Principal = "*"
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.sponsor_assets.arn}/*"
    }]
  })
}

resource "aws_s3_bucket_cors_configuration" "sponsor_assets" {
  bucket = aws_s3_bucket.sponsor_assets.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = var.allowed_origins
    max_age_seconds = 3000
  }
}

# IAM Role für Lambda Functions
resource "aws_iam_role" "sponsor_lambda" {
  name = "${var.project_name}-sponsor-lambda"

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

resource "aws_iam_role_policy_attachment" "sponsor_lambda_basic" {
  role       = aws_iam_role.sponsor_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "sponsor_lambda_dynamodb" {
  name = "dynamodb-access"
  role = aws_iam_role.sponsor_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
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
        aws_dynamodb_table.sponsors.arn,
        "${aws_dynamodb_table.sponsors.arn}/index/*",
        aws_dynamodb_table.sponsor_stats.arn
      ]
    }]
  })
}

resource "aws_iam_role_policy" "sponsor_lambda_s3" {
  name = "s3-access"
  role = aws_iam_role.sponsor_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ]
      Resource = "${aws_s3_bucket.sponsor_assets.arn}/*"
    }]
  })
}

# Lambda Function: Create Booking
resource "aws_lambda_function" "create_booking" {
  filename         = data.archive_file.create_booking.output_path
  function_name    = "${var.project_name}-sponsor-create-booking"
  role             = aws_iam_role.sponsor_lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.create_booking.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = 30

  environment {
    variables = {
      SPONSORS_TABLE = aws_dynamodb_table.sponsors.name
      ASSETS_BUCKET  = aws_s3_bucket.sponsor_assets.id
    }
  }
}

data "archive_file" "create_booking" {
  type        = "zip"
  output_path = "${path.module}/lambda/create-booking.zip"

  source {
    content  = file("${path.module}/lambda/create-booking.js")
    filename = "index.js"
  }
}

# Lambda Function: Approve Booking
resource "aws_lambda_function" "approve_booking" {
  filename         = data.archive_file.approve_booking.output_path
  function_name    = "${var.project_name}-sponsor-approve-booking"
  role             = aws_iam_role.sponsor_lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.approve_booking.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = 10

  environment {
    variables = {
      SPONSORS_TABLE = aws_dynamodb_table.sponsors.name
    }
  }
}

data "archive_file" "approve_booking" {
  type        = "zip"
  output_path = "${path.module}/lambda/approve-booking.zip"

  source {
    content  = file("${path.module}/lambda/approve-booking.js")
    filename = "index.js"
  }
}

# Lambda Function: Get Active Sponsors
resource "aws_lambda_function" "get_active_sponsors" {
  filename         = data.archive_file.get_active_sponsors.output_path
  function_name    = "${var.project_name}-sponsor-get-active"
  role             = aws_iam_role.sponsor_lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.get_active_sponsors.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = 10

  environment {
    variables = {
      SPONSORS_TABLE = aws_dynamodb_table.sponsors.name
    }
  }
}

data "archive_file" "get_active_sponsors" {
  type        = "zip"
  output_path = "${path.module}/lambda/get-active-sponsors.zip"

  source {
    content  = file("${path.module}/lambda/get-active-sponsors.js")
    filename = "index.js"
  }
}

# Lambda Function: Track Stats
resource "aws_lambda_function" "track_stats" {
  filename         = data.archive_file.track_stats.output_path
  function_name    = "${var.project_name}-sponsor-track-stats"
  role             = aws_iam_role.sponsor_lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.track_stats.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = 10

  environment {
    variables = {
      SPONSORS_TABLE = aws_dynamodb_table.sponsors.name
      STATS_TABLE    = aws_dynamodb_table.sponsor_stats.name
    }
  }
}

data "archive_file" "track_stats" {
  type        = "zip"
  output_path = "${path.module}/lambda/track-stats.zip"

  source {
    content  = file("${path.module}/lambda/track-stats.js")
    filename = "index.js"
  }
}

# API Gateway
resource "aws_apigatewayv2_api" "sponsor_api" {
  name          = "${var.project_name}-sponsor-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = var.allowed_origins
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["content-type", "authorization"]
    max_age       = 300
  }
}

resource "aws_apigatewayv2_stage" "sponsor_api" {
  api_id      = aws_apigatewayv2_api.sponsor_api.id
  name        = "$default"
  auto_deploy = true
}

# API Gateway Integrations
resource "aws_apigatewayv2_integration" "create_booking" {
  api_id           = aws_apigatewayv2_api.sponsor_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.create_booking.invoke_arn
}

resource "aws_apigatewayv2_integration" "approve_booking" {
  api_id           = aws_apigatewayv2_api.sponsor_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.approve_booking.invoke_arn
}

resource "aws_apigatewayv2_integration" "get_active_sponsors" {
  api_id           = aws_apigatewayv2_api.sponsor_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.get_active_sponsors.invoke_arn
}

resource "aws_apigatewayv2_integration" "track_stats" {
  api_id           = aws_apigatewayv2_api.sponsor_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.track_stats.invoke_arn
}

# API Gateway Routes
resource "aws_apigatewayv2_route" "create_booking" {
  api_id    = aws_apigatewayv2_api.sponsor_api.id
  route_key = "POST /bookings"
  target    = "integrations/${aws_apigatewayv2_integration.create_booking.id}"
}

resource "aws_apigatewayv2_route" "approve_booking" {
  api_id    = aws_apigatewayv2_api.sponsor_api.id
  route_key = "PUT /bookings/{bookingId}/approve"
  target    = "integrations/${aws_apigatewayv2_integration.approve_booking.id}"
}

resource "aws_apigatewayv2_route" "get_active_sponsors" {
  api_id    = aws_apigatewayv2_api.sponsor_api.id
  route_key = "GET /sponsors/active"
  target    = "integrations/${aws_apigatewayv2_integration.get_active_sponsors.id}"
}

resource "aws_apigatewayv2_route" "track_view" {
  api_id    = aws_apigatewayv2_api.sponsor_api.id
  route_key = "POST /sponsors/{sponsorId}/track/view"
  target    = "integrations/${aws_apigatewayv2_integration.track_stats.id}"
}

resource "aws_apigatewayv2_route" "track_click" {
  api_id    = aws_apigatewayv2_api.sponsor_api.id
  route_key = "POST /sponsors/{sponsorId}/track/click"
  target    = "integrations/${aws_apigatewayv2_integration.track_stats.id}"
}

# Lambda Permissions
resource "aws_lambda_permission" "create_booking" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.create_booking.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.sponsor_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "approve_booking" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.approve_booking.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.sponsor_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "get_active_sponsors" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_active_sponsors.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.sponsor_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "track_stats" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.track_stats.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.sponsor_api.execution_arn}/*/*"
}

data "aws_caller_identity" "current" {}
