# ============================================================
# BILLING CRON JOB - Monthly Invoice Generation
# ============================================================

# Lambda Function für Billing Cron
resource "aws_lambda_function" "billing_cron" {
  filename      = "billing_cron.zip"
  function_name = "${var.platform_name}-billing-cron-${var.environment}"
  role          = aws_iam_role.billing_cron_role.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  timeout       = 300 # 5 minutes - needs time for PDF generation and emails
  memory_size   = 1024
  layers        = [var.common_deps_layer_arn]

  environment {
    variables = {
      REGION             = var.aws_region
      TENANTS_TABLE      = var.tenants_table_name
      INVOICES_TABLE     = aws_dynamodb_table.invoices.name
      BILLING_TABLE      = aws_dynamodb_table.billing.name
      USER_TENANTS_TABLE = var.user_tenants_table_name
      INVOICES_BUCKET    = aws_s3_bucket.invoices.id
      USER_POOL_ID       = var.user_pool_id
      SENDER_EMAIL       = "billing@${var.domain}"
      AI_USAGE_TABLE     = var.ai_usage_table_name
    }
  }

  tags = merge(var.tags, {
    Name = "${var.platform_name}-billing-cron"
    Type = "BillingCron"
  })

  depends_on = [aws_iam_role_policy.billing_cron_policy]
}

# IAM Role für Billing Cron Lambda
resource "aws_iam_role" "billing_cron_role" {
  name = "${var.platform_name}-billing-cron-role-${var.environment}"

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

# IAM Policy für Billing Cron Lambda
resource "aws_iam_role_policy" "billing_cron_policy" {
  name = "${var.platform_name}-billing-cron-policy-${var.environment}"
  role = aws_iam_role.billing_cron_role.id

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
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.billing.arn,
          "${aws_dynamodb_table.billing.arn}/index/*",
          aws_dynamodb_table.invoices.arn,
          "${aws_dynamodb_table.invoices.arn}/index/*",
          "arn:aws:dynamodb:${var.aws_region}:*:table/${var.platform_name}-tenants-${var.environment}",
          "arn:aws:dynamodb:${var.aws_region}:*:table/${var.platform_name}-tenants-${var.environment}/index/*",
          "arn:aws:dynamodb:${var.aws_region}:*:table/${var.platform_name}-user-tenants-${var.environment}",
          "arn:aws:dynamodb:${var.aws_region}:*:table/${var.platform_name}-user-tenants-${var.environment}/index/*",
          "arn:aws:dynamodb:${var.aws_region}:*:table/${var.platform_name}-ai-usage-${var.environment}",
          "arn:aws:dynamodb:${var.aws_region}:*:table/${var.platform_name}-ai-usage-${var.environment}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ce:GetCostAndUsage",
          "ce:GetCostForecast"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = [
          "${aws_s3_bucket.invoices.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ses:SendRawEmail",
          "ses:SendEmail"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:AdminGetUser"
        ]
        Resource = "arn:aws:cognito-idp:${var.aws_region}:*:userpool/${var.user_pool_id}"
      }
    ]
  })
}

# EventBridge Scheduler - Runs on 1st of every month at 6:00 AM UTC
resource "aws_cloudwatch_event_rule" "billing_cron_schedule" {
  name                = "${var.platform_name}-billing-cron-schedule-${var.environment}"
  description         = "Triggers monthly billing invoice generation on the 1st of each month"
  schedule_expression = "cron(0 6 1 * ? *)" # 6:00 AM UTC on the 1st of every month

  tags = merge(var.tags, {
    Name = "${var.platform_name}-billing-cron-schedule"
    Type = "BillingScheduler"
  })
}

# EventBridge Target - Connect rule to Lambda
resource "aws_cloudwatch_event_target" "billing_cron_target" {
  rule      = aws_cloudwatch_event_rule.billing_cron_schedule.name
  target_id = "billing-cron-lambda"
  arn       = aws_lambda_function.billing_cron.arn

  input = jsonencode({
    source = "scheduled"
    time   = "monthly"
  })
}

# Lambda Permission for EventBridge
resource "aws_lambda_permission" "billing_cron_eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.billing_cron.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.billing_cron_schedule.arn
}

# CloudWatch Log Group for Billing Cron
resource "aws_cloudwatch_log_group" "billing_cron_logs" {
  name              = "/aws/lambda/${aws_lambda_function.billing_cron.function_name}"
  retention_in_days = 30

  tags = merge(var.tags, {
    Name = "${var.platform_name}-billing-cron-logs"
    Type = "BillingLogs"
  })
}

# ============================================================
# API Endpoint for Manual Trigger (Admin only)
# ============================================================

# Resource for manual billing trigger
resource "aws_api_gateway_resource" "billing_generate" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing.id
  path_part   = "generate-invoices"
}

# POST /billing/generate-invoices - Manual trigger for invoice generation
resource "aws_api_gateway_method" "post_billing_generate" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_generate.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_billing_generate" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_method.post_billing_generate.resource_id
  http_method             = aws_api_gateway_method.post_billing_generate.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_cron.invoke_arn
}

# Lambda Permission for API Gateway
resource "aws_lambda_permission" "billing_cron_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.billing_cron.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}

# CORS for /billing/generate-invoices
resource "aws_api_gateway_method" "billing_generate_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_generate.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "billing_generate_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_method.billing_generate_cors.resource_id
  http_method = aws_api_gateway_method.billing_generate_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_method_response" "billing_generate_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_generate.id
  http_method = aws_api_gateway_method.billing_generate_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "billing_generate_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_generate.id
  http_method = aws_api_gateway_method.billing_generate_cors.http_method
  status_code = aws_api_gateway_method_response.billing_generate_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# ============================================================
# Outputs
# ============================================================

output "billing_cron_function_name" {
  value       = aws_lambda_function.billing_cron.function_name
  description = "Name of the billing cron Lambda function"
}

output "billing_cron_function_arn" {
  value       = aws_lambda_function.billing_cron.arn
  description = "ARN of the billing cron Lambda function"
}

output "billing_cron_schedule_arn" {
  value       = aws_cloudwatch_event_rule.billing_cron_schedule.arn
  description = "ARN of the EventBridge schedule rule"
}
