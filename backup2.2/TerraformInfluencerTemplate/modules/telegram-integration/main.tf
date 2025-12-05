# Telegram Bot Integration Module
# Sends newsfeed posts to Telegram channel/group

# Lambda Function for Telegram Integration
resource "aws_lambda_function" "telegram_notifier" {
  filename         = data.archive_file.telegram_lambda.output_path
  function_name    = "${var.project_name}-telegram-notifier"
  role             = aws_iam_role.telegram_lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.telegram_lambda.output_base64sha256
  runtime          = "nodejs20.x"

  # Use Lambda Layers for dependencies
  layers = [
    var.aws_sdk_core_layer_arn,
  ]
  timeout          = 30

  environment {
    variables = {
      SETTINGS_TABLE_NAME = var.settings_table_name
      CDN_DOMAIN          = var.cdn_domain
    }
  }
}

data "archive_file" "telegram_lambda" {
  type        = "zip"
  source_file = "${path.module}/lambda/index.js"
  output_path = "${path.module}/lambda.zip"
}

# IAM Role for Lambda
resource "aws_iam_role" "telegram_lambda" {
  name = "${var.project_name}-telegram-lambda-role"

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

# Basic Lambda execution policy
resource "aws_iam_role_policy_attachment" "telegram_lambda_basic" {
  role       = aws_iam_role.telegram_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# DynamoDB Stream and Settings Table access
resource "aws_iam_role_policy" "dynamodb_access" {
  name = "dynamodb-access-policy"
  role = aws_iam_role.telegram_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:DescribeStream",
          "dynamodb:ListStreams"
        ]
        Resource = var.newsfeed_table_stream_arn
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem"
        ]
        Resource = var.settings_table_arn
      }
    ]
  })
}

# Event Source Mapping - DynamoDB Stream to Lambda
resource "aws_lambda_event_source_mapping" "newsfeed_stream" {
  event_source_arn  = var.newsfeed_table_stream_arn
  function_name     = aws_lambda_function.telegram_notifier.arn
  starting_position = "LATEST"

  filter_criteria {
    filter {
      pattern = jsonencode({
        eventName = ["INSERT"]
        dynamodb = {
          NewImage = {
            status = {
              S = ["published"]
            }
          }
        }
      })
    }
  }
}
