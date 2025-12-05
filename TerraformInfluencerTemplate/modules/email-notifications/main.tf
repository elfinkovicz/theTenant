# Email Notifications Module
# Sends newsfeed posts to registered users via email

# Lambda Function for Email Notifications
resource "aws_lambda_function" "email_notifier" {
  filename         = data.archive_file.email_lambda.output_path
  function_name    = "${var.project_name}-email-notifier"
  role             = aws_iam_role.email_lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.email_lambda.output_base64sha256
  runtime          = "nodejs20.x"

  # Use Lambda Layers for dependencies
  layers = [
    var.aws_sdk_core_layer_arn,
    var.aws_sdk_extended_layer_arn,
  ]
  
  timeout = 60  # Longer timeout for sending multiple emails

  environment {
    variables = {
      SETTINGS_TABLE_NAME = var.settings_table_name
      USERS_TABLE_NAME    = var.users_table_name
      CDN_DOMAIN          = var.cdn_domain
      WEBSITE_URL         = var.website_url
    }
  }
}

data "archive_file" "email_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/lambda.zip"
}

# IAM Role for Lambda
resource "aws_iam_role" "email_lambda" {
  name = "${var.project_name}-email-lambda-role"

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
resource "aws_iam_role_policy_attachment" "email_lambda_basic" {
  role       = aws_iam_role.email_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# DynamoDB Stream, Settings Table, and Users Table access
resource "aws_iam_role_policy" "dynamodb_access" {
  name = "dynamodb-access-policy"
  role = aws_iam_role.email_lambda.id

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
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:Scan"
        ]
        Resource = var.users_table_arn
      }
    ]
  })
}

# SES Send Email permission
resource "aws_iam_role_policy" "ses_access" {
  name = "ses-send-email-policy"
  role = aws_iam_role.email_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
      }
    ]
  })
}

# Event Source Mapping - DynamoDB Stream to Lambda
resource "aws_lambda_event_source_mapping" "newsfeed_stream" {
  event_source_arn  = var.newsfeed_table_stream_arn
  function_name     = aws_lambda_function.email_notifier.arn
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
