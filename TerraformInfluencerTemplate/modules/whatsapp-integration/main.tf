# WhatsApp Integration Module
# Sends newsfeed posts to WhatsApp group using AWS End User Messaging

# EventBridge Rule to trigger on DynamoDB Stream events
resource "aws_cloudwatch_event_rule" "newsfeed_created" {
  name        = "${var.project_name}-newsfeed-whatsapp"
  description = "Trigger WhatsApp notification when newsfeed post is created"

  event_pattern = jsonencode({
    source      = ["aws.dynamodb"]
    detail-type = ["DynamoDB Stream Record"]
    detail = {
      eventName = ["INSERT"]
      dynamodb = {
        NewImage = {
          status = {
            S = ["published"]
          }
        }
      }
    }
  })
}

# Lambda Function for WhatsApp Integration
resource "aws_lambda_function" "whatsapp_notifier" {
  filename         = data.archive_file.whatsapp_lambda.output_path
  function_name    = "${var.project_name}-whatsapp-notifier"
  role             = aws_iam_role.whatsapp_lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.whatsapp_lambda.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = 30

  environment {
    variables = {
      WHATSAPP_PHONE_NUMBER_ID = var.whatsapp_phone_number_id
      WHATSAPP_GROUP_ID        = var.whatsapp_group_id
      CDN_DOMAIN               = var.cdn_domain
    }
  }
}

data "archive_file" "whatsapp_lambda" {
  type        = "zip"
  output_path = "${path.module}/lambda.zip"

  source {
    content  = file("${path.module}/lambda/index.js")
    filename = "index.js"
  }
}

# IAM Role for Lambda
resource "aws_iam_role" "whatsapp_lambda" {
  name = "${var.project_name}-whatsapp-lambda-role"

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
resource "aws_iam_role_policy_attachment" "whatsapp_lambda_basic" {
  role       = aws_iam_role.whatsapp_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Policy for AWS End User Messaging (Social Messaging)
resource "aws_iam_role_policy" "whatsapp_messaging" {
  name = "whatsapp-messaging-policy"
  role = aws_iam_role.whatsapp_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "social-messaging:SendWhatsAppMessage",
          "social-messaging:GetWhatsAppMessageMedia"
        ]
        Resource = "*"
      }
    ]
  })
}

# DynamoDB Stream access
resource "aws_iam_role_policy" "dynamodb_stream" {
  name = "dynamodb-stream-policy"
  role = aws_iam_role.whatsapp_lambda.id

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
      }
    ]
  })
}

# Event Source Mapping - DynamoDB Stream to Lambda
resource "aws_lambda_event_source_mapping" "newsfeed_stream" {
  event_source_arn  = var.newsfeed_table_stream_arn
  function_name     = aws_lambda_function.whatsapp_notifier.arn
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
