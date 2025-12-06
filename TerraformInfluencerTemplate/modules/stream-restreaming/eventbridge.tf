# DynamoDB Table für Stream State Tracking
resource "aws_dynamodb_table" "stream_state" {
  name           = "${var.project_name}-stream-state"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }

  tags = {
    Name = "${var.project_name}-stream-state"
  }
}

# Lambda für Stream Monitoring
resource "aws_lambda_function" "stream_monitor" {
  filename         = "${path.module}/monitor.zip"
  function_name    = "${var.project_name}-stream-monitor"
  role            = aws_iam_role.lambda.arn
  handler         = "stream_monitor.handler"
  source_code_hash = filebase64sha256("${path.module}/monitor.zip")
  runtime         = "python3.11"
  timeout         = 60

  environment {
    variables = {
      DESTINATIONS_TABLE = aws_dynamodb_table.streaming_destinations.name
      STATE_TABLE        = aws_dynamodb_table.stream_state.name
      IVS_CHANNEL_ARN    = var.ivs_channel_arn
      IVS_PLAYBACK_URL   = var.ivs_playback_url
      MEDIALIVE_ROLE_ARN = aws_iam_role.medialive.arn
      MEDIALIVE_SG_ID    = aws_medialive_input_security_group.main.id
      PROJECT_NAME       = var.project_name
    }
  }
}

# IAM Policy für Stream Monitor Lambda
resource "aws_iam_role_policy" "lambda_stream_monitor" {
  name = "${var.project_name}-lambda-stream-monitor-policy"
  role = aws_iam_role.lambda.id

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
        Resource = [
          aws_dynamodb_table.streaming_destinations.arn,
          aws_dynamodb_table.stream_state.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ivs:GetStream",
          "ivs:GetChannel"
        ]
        Resource = var.ivs_channel_arn
      }
    ]
  })
}

# CloudWatch Event Rule - Polling alle 30 Sekunden
resource "aws_cloudwatch_event_rule" "stream_monitor" {
  name                = "${var.project_name}-stream-monitor"
  description         = "Polls IVS stream status every 30 seconds"
  schedule_expression = "rate(30 seconds)"
}

# EventBridge Target -> Stream Monitor Lambda
resource "aws_cloudwatch_event_target" "stream_monitor" {
  rule      = aws_cloudwatch_event_rule.stream_monitor.name
  target_id = "StreamMonitorLambda"
  arn       = aws_lambda_function.stream_monitor.arn
}

# Lambda Permission für EventBridge (Stream Monitor)
resource "aws_lambda_permission" "stream_monitor_eventbridge" {
  statement_id  = "AllowEventBridgeInvokeMonitor"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.stream_monitor.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.stream_monitor.arn
}
