# IVS Channel (Stream Key wird automatisch erstellt)
resource "aws_ivs_channel" "main" {
  name         = "${var.project_name}-${var.channel_name}"
  latency_mode = "LOW"
  type         = var.channel_type
  authorized   = false

  tags = {
    Name = "${var.project_name}-${var.channel_name}"
  }
}

# IVS Recording Configuration (optional)
resource "aws_s3_bucket" "recordings" {
  bucket = "${var.project_name}-ivs-recordings-${data.aws_caller_identity.current.account_id}"
  
  lifecycle {
    prevent_destroy = true
    ignore_changes = [tags, tags_all, bucket]
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "recordings" {
  bucket = aws_s3_bucket.recordings.id

  rule {
    id     = "delete-old-recordings"
    status = "Enabled"

    filter {
      prefix = ""
    }

    expiration {
      days = 30
    }
  }
}

resource "aws_ivs_recording_configuration" "main" {
  name = "${var.project_name}-recording"

  destination_configuration {
    s3 {
      bucket_name = aws_s3_bucket.recordings.id
    }
  }

  thumbnail_configuration {
    recording_mode          = "INTERVAL"
    target_interval_seconds = 60
  }
}

data "aws_caller_identity" "current" {}

# Lambda Function for Stream Status
data "archive_file" "stream_status_lambda" {
  type        = "zip"
  source_file = "${path.module}/lambda/stream-status.py"
  output_path = "${path.module}/lambda/stream-status.zip"
}

resource "aws_lambda_function" "stream_status" {
  filename         = data.archive_file.stream_status_lambda.output_path
  function_name    = "${var.project_name}-stream-status"
  role            = aws_iam_role.stream_status_lambda.arn
  handler         = "stream-status.lambda_handler"
  source_code_hash = data.archive_file.stream_status_lambda.output_base64sha256
  runtime         = "python3.11"
  timeout         = 10

  environment {
    variables = {
      CHANNEL_ARN = aws_ivs_channel.main.arn
    }
  }
}

resource "aws_iam_role" "stream_status_lambda" {
  name = "${var.project_name}-stream-status-lambda"

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

resource "aws_iam_role_policy" "stream_status_lambda" {
  name = "${var.project_name}-stream-status-lambda"
  role = aws_iam_role.stream_status_lambda.id

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
          "ivs:GetStream",
          "ivs:GetChannel"
        ]
        Resource = aws_ivs_channel.main.arn
      }
    ]
  })
}

resource "aws_lambda_permission" "stream_status_api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.stream_status.function_name
  principal     = "apigateway.amazonaws.com"
}

# API Gateway Integration for Stream Status (if API Gateway is provided)
resource "aws_apigatewayv2_integration" "stream_status" {
  count = var.api_gateway_id != "" ? 1 : 0

  api_id           = var.api_gateway_id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.stream_status.invoke_arn
}

resource "aws_apigatewayv2_route" "stream_status" {
  count = var.api_gateway_id != "" ? 1 : 0

  api_id    = var.api_gateway_id
  route_key = "GET /stream/status"
  target    = "integrations/${aws_apigatewayv2_integration.stream_status[0].id}"
}

resource "aws_lambda_permission" "stream_status_api_gateway_invoke" {
  count = var.api_gateway_id != "" ? 1 : 0

  statement_id  = "AllowAPIGatewayInvokeStreamStatus"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.stream_status.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}
