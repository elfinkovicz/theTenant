# ============================================================
# STRIPE EVENTBRIDGE INTEGRATION
# ============================================================
# Uses Amazon EventBridge Partner Event Source from Stripe
# Benefits: Built-in retry, filtering, multiple targets, no signature verification needed

# Use the existing Stripe Partner Event Bus (created when connecting Stripe to EventBridge)
# Event Bus Name: aws.partner/stripe.com/ed_61U01usPHMtMsghiU16TkI45NRAFVFSrun04rt1ncViq
locals {
  stripe_event_bus_name = "aws.partner/stripe.com/ed_61U01usPHMtMsghiU16TkI45NRAFVFSrun04rt1ncViq"
}

# ============================================================
# STRIPE EVENTBRIDGE HANDLER LAMBDA
# ============================================================

resource "aws_iam_role" "stripe_eventbridge_handler_role" {
  name = "${var.platform_name}-stripe-eb-handler-role-${var.environment}"

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

  tags = var.tags
}

resource "aws_iam_role_policy" "stripe_eventbridge_handler_policy" {
  name = "${var.platform_name}-stripe-eb-handler-policy-${var.environment}"
  role = aws_iam_role.stripe_eventbridge_handler_role.id

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
          "dynamodb:Query"
        ]
        Resource = [
          aws_dynamodb_table.billing.arn,
          "${aws_dynamodb_table.billing.arn}/index/*",
          aws_dynamodb_table.invoices.arn,
          "${aws_dynamodb_table.invoices.arn}/index/*",
          "arn:aws:dynamodb:${var.aws_region}:*:table/${var.platform_name}-tenants-${var.environment}",
          "arn:aws:dynamodb:${var.aws_region}:*:table/${var.platform_name}-tenants-${var.environment}/index/*"
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = aws_secretsmanager_secret.stripe_secrets.arn
      }
    ]
  })
}

resource "aws_lambda_function" "stripe_eventbridge_handler" {
  filename         = "stripe_eventbridge_handler.zip"
  source_code_hash = fileexists("stripe_eventbridge_handler.zip") ? filebase64sha256("stripe_eventbridge_handler.zip") : null
  function_name    = "${var.platform_name}-stripe-eventbridge-handler-${var.environment}"
  role             = aws_iam_role.stripe_eventbridge_handler_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 30
  memory_size      = 256
  layers           = [var.common_deps_layer_arn]

  environment {
    variables = {
      BILLING_TABLE    = aws_dynamodb_table.billing.name
      INVOICES_TABLE   = aws_dynamodb_table.invoices.name
      TENANTS_TABLE    = "${var.platform_name}-tenants-${var.environment}"
      STRIPE_SECRET_ID = aws_secretsmanager_secret.stripe_secrets.id
      REGION           = var.aws_region
    }
  }

  tags = merge(var.tags, {
    Name = "${var.platform_name}-stripe-eventbridge-handler"
    Type = "Billing"
  })
}

resource "aws_lambda_permission" "stripe_eventbridge_handler" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.stripe_eventbridge_handler.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.stripe_billing_events.arn
}

# ============================================================
# EVENTBRIDGE RULES FOR STRIPE EVENTS
# ============================================================

# Rule for all billing-relevant Stripe events
resource "aws_cloudwatch_event_rule" "stripe_billing_events" {
  name           = "${var.platform_name}-stripe-billing-events-${var.environment}"
  description    = "Capture Stripe billing events for tenant management"
  event_bus_name = local.stripe_event_bus_name

  event_pattern = jsonencode({
    source = [{
      prefix = "stripe.com"
    }]
  })

  tags = var.tags
}

# Target: Lambda Handler
resource "aws_cloudwatch_event_target" "stripe_to_lambda" {
  rule           = aws_cloudwatch_event_rule.stripe_billing_events.name
  event_bus_name = local.stripe_event_bus_name
  target_id      = "stripe-billing-lambda"
  arn            = aws_lambda_function.stripe_eventbridge_handler.arn

  retry_policy {
    maximum_event_age_in_seconds = 3600  # 1 hour
    maximum_retry_attempts       = 3
  }

  dead_letter_config {
    arn = aws_sqs_queue.stripe_dlq.arn
  }
}

# Dead Letter Queue for failed events
resource "aws_sqs_queue" "stripe_dlq" {
  name                      = "${var.platform_name}-stripe-dlq-${var.environment}"
  message_retention_seconds = 1209600  # 14 days

  tags = merge(var.tags, {
    Name = "${var.platform_name}-stripe-dlq"
    Type = "Billing"
  })
}

resource "aws_sqs_queue_policy" "stripe_dlq_policy" {
  queue_url = aws_sqs_queue.stripe_dlq.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "events.amazonaws.com" }
        Action    = "sqs:SendMessage"
        Resource  = aws_sqs_queue.stripe_dlq.arn
      }
    ]
  })
}

# ============================================================
# CLOUDWATCH ALARMS FOR MONITORING
# ============================================================

# Alarm for DLQ messages (failed Stripe events)
resource "aws_cloudwatch_metric_alarm" "stripe_dlq_alarm" {
  alarm_name          = "${var.platform_name}-stripe-dlq-messages-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Stripe events failed to process"

  dimensions = {
    QueueName = aws_sqs_queue.stripe_dlq.name
  }

  tags = var.tags
}

# ============================================================
# OUTPUTS
# ============================================================

output "stripe_event_bus_name" {
  description = "Name of the Stripe EventBridge event bus"
  value       = local.stripe_event_bus_name
}

output "stripe_eventbridge_handler_arn" {
  description = "ARN of the Stripe EventBridge handler Lambda"
  value       = aws_lambda_function.stripe_eventbridge_handler.arn
}

output "stripe_dlq_url" {
  description = "URL of the Stripe Dead Letter Queue"
  value       = aws_sqs_queue.stripe_dlq.url
}

# Data source for AWS account ID
data "aws_caller_identity" "current" {}
