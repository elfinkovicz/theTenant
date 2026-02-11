# =============================================================================
# WhatsApp Crosspost Module - Main Configuration
# Centralized WhatsApp broadcasts via AWS End User Messaging Social
# =============================================================================

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.0"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.0"
    }
  }
}

# DynamoDB Table for WhatsApp Subscribers (per tenant)
resource "aws_dynamodb_table" "whatsapp_subscribers" {
  name         = "${var.platform_name}-whatsapp-subscribers-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenant_id"
  range_key    = "phone_number"

  attribute {
    name = "tenant_id"
    type = "S"
  }

  attribute {
    name = "phone_number"
    type = "S"
  }

  # GSI to query all subscribers for a phone number (for unsubscribe all)
  global_secondary_index {
    name            = "phone-number-index"
    hash_key        = "phone_number"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = merge(var.tags, {
    Name      = "${var.platform_name}-whatsapp-subscribers"
    Component = "WhatsApp"
  })
}

# NOTE: WhatsApp Settings DynamoDB table is managed by tenant-newsfeed module
# and passed in via var.whatsapp_settings_table_name and var.whatsapp_settings_table_arn

# SQS Queue for WhatsApp message processing (rate limiting)
resource "aws_sqs_queue" "whatsapp_messages" {
  name                       = "${var.platform_name}-whatsapp-messages-${var.environment}"
  visibility_timeout_seconds = 60
  message_retention_seconds  = 86400  # 1 day
  receive_wait_time_seconds  = 10

  # Dead letter queue for failed messages
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.whatsapp_dlq.arn
    maxReceiveCount     = 3
  })

  tags = merge(var.tags, {
    Name      = "${var.platform_name}-whatsapp-messages"
    Component = "WhatsApp"
  })
}

resource "aws_sqs_queue" "whatsapp_dlq" {
  name                      = "${var.platform_name}-whatsapp-dlq-${var.environment}"
  message_retention_seconds = 1209600  # 14 days

  tags = merge(var.tags, {
    Name      = "${var.platform_name}-whatsapp-dlq"
    Component = "WhatsApp"
  })
}

# SNS Topic for incoming WhatsApp messages (webhook)
resource "aws_sns_topic" "whatsapp_inbound" {
  name = "${var.platform_name}-whatsapp-inbound-${var.environment}"

  tags = merge(var.tags, {
    Name      = "${var.platform_name}-whatsapp-inbound"
    Component = "WhatsApp"
  })
}

# SNS Topic Policy to allow AWS End User Messaging Social to publish
resource "aws_sns_topic_policy" "whatsapp_inbound_policy" {
  arn = aws_sns_topic.whatsapp_inbound.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowSocialMessagingPublish"
        Effect    = "Allow"
        Principal = {
          Service = "social-messaging.amazonaws.com"
        }
        Action    = "sns:Publish"
        Resource  = aws_sns_topic.whatsapp_inbound.arn
        Condition = {
          StringEquals = {
            "AWS:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}

# Data source for current AWS account
data "aws_caller_identity" "current" {}

# =============================================================================
# AWS End User Messaging Social - Event Destination
# Using null_resource with local-exec because Terraform AWS Provider
# does not yet support aws_socialmessaging resources natively.
# =============================================================================

# Create a JSON file for the event destination configuration
resource "local_file" "event_destination_config" {
  content = jsonencode([{
    eventDestinationArn = aws_sns_topic.whatsapp_inbound.arn
  }])
  filename = "${path.module}/event-destination-${var.environment}.json"
}

# Configure Event Destination for WhatsApp Business Account
resource "null_resource" "whatsapp_event_destination" {
  triggers = {
    sns_topic_arn = aws_sns_topic.whatsapp_inbound.arn
    waba_id       = var.whatsapp_waba_id
  }

  provisioner "local-exec" {
    command = "aws socialmessaging put-whatsapp-business-account-event-destinations --id ${var.whatsapp_waba_id} --event-destinations file://${replace(local_file.event_destination_config.filename, "\\", "/")} --region ${var.aws_region}"
  }

  depends_on = [
    aws_sns_topic.whatsapp_inbound,
    aws_sns_topic_policy.whatsapp_inbound_policy,
    local_file.event_destination_config
  ]
}

# IAM Role for WhatsApp Lambda functions
resource "aws_iam_role" "whatsapp_lambda_role" {
  name = "${var.platform_name}-whatsapp-lambda-role-${var.environment}"

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

  tags = var.tags
}

# IAM Policy for WhatsApp Lambda
resource "aws_iam_role_policy" "whatsapp_lambda_policy" {
  name = "${var.platform_name}-whatsapp-lambda-policy"
  role = aws_iam_role.whatsapp_lambda_role.id

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
          aws_dynamodb_table.whatsapp_subscribers.arn,
          "${aws_dynamodb_table.whatsapp_subscribers.arn}/index/*",
          var.whatsapp_settings_table_arn,
          var.tenants_table_arn,
          "${var.tenants_table_arn}/index/*",
          var.user_tenants_table_arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = [
          aws_sqs_queue.whatsapp_messages.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish",
          "sns:Subscribe"
        ]
        Resource = [
          aws_sns_topic.whatsapp_inbound.arn
        ]
      },
      {
        # AWS End User Messaging Social permissions
        Effect = "Allow"
        Action = [
          "social-messaging:SendWhatsAppMessage",
          "social-messaging:GetLinkedWhatsAppBusinessAccount",
          "social-messaging:GetLinkedWhatsAppBusinessAccountPhoneNumber"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject"
        ]
        Resource = "${var.creator_assets_bucket_arn}/*"
      }
    ]
  })
}

# =============================================================================
# Lambda: WhatsApp Subscription Handler (processes START/STOP messages)
# =============================================================================

resource "aws_lambda_function" "whatsapp_subscription" {
  function_name = "${var.platform_name}-whatsapp-subscription-${var.environment}"
  role          = aws_iam_role.whatsapp_lambda_role.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  filename         = "${path.module}/../../tenant_whatsapp_subscription.zip"
  source_code_hash = fileexists("${path.module}/../../tenant_whatsapp_subscription.zip") ? filebase64sha256("${path.module}/../../tenant_whatsapp_subscription.zip") : null

  layers = [var.common_deps_layer_arn]

  environment {
    variables = {
      REGION                    = var.aws_region
      SUBSCRIBERS_TABLE         = aws_dynamodb_table.whatsapp_subscribers.name
      SETTINGS_TABLE            = var.whatsapp_settings_table_name
      TENANTS_TABLE             = var.tenants_table_name
      WHATSAPP_PHONE_NUMBER_ID  = var.whatsapp_phone_number_id
      WHATSAPP_PHONE_NUMBER     = var.whatsapp_phone_number
      WHATSAPP_DISPLAY_NAME     = var.whatsapp_display_name
    }
  }

  tags = merge(var.tags, {
    Name      = "${var.platform_name}-whatsapp-subscription"
    Component = "WhatsApp"
  })
}

# SNS Subscription for inbound messages
resource "aws_sns_topic_subscription" "whatsapp_inbound_lambda" {
  topic_arn = aws_sns_topic.whatsapp_inbound.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.whatsapp_subscription.arn
}

resource "aws_lambda_permission" "whatsapp_subscription_sns" {
  statement_id  = "AllowSNSInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.whatsapp_subscription.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.whatsapp_inbound.arn
}

# =============================================================================
# Lambda: WhatsApp Crosspost (sends broadcasts to subscribers)
# =============================================================================

resource "aws_lambda_function" "whatsapp_crosspost" {
  function_name = "${var.platform_name}-crosspost-whatsapp-${var.environment}"
  role          = aws_iam_role.whatsapp_lambda_role.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 300  # 5 minutes for batch processing
  memory_size   = 512

  filename         = "${path.module}/../../tenant_crosspost_whatsapp.zip"
  source_code_hash = fileexists("${path.module}/../../tenant_crosspost_whatsapp.zip") ? filebase64sha256("${path.module}/../../tenant_crosspost_whatsapp.zip") : null

  layers = [var.common_deps_layer_arn]

  environment {
    variables = {
      REGION                    = var.aws_region
      SUBSCRIBERS_TABLE         = aws_dynamodb_table.whatsapp_subscribers.name
      SETTINGS_TABLE            = var.whatsapp_settings_table_name
      TENANTS_TABLE             = var.tenants_table_name
      SQS_QUEUE_URL             = aws_sqs_queue.whatsapp_messages.url
      WHATSAPP_PHONE_NUMBER_ID  = var.whatsapp_phone_number_id
      CLOUDFRONT_DOMAIN         = var.cloudfront_domain_name
    }
  }

  tags = merge(var.tags, {
    Name      = "${var.platform_name}-crosspost-whatsapp"
    Component = "WhatsApp"
  })
}

# =============================================================================
# Lambda: WhatsApp Message Worker (processes SQS queue)
# =============================================================================

resource "aws_lambda_function" "whatsapp_worker" {
  function_name = "${var.platform_name}-whatsapp-worker-${var.environment}"
  role          = aws_iam_role.whatsapp_lambda_role.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 60
  memory_size   = 256

  filename         = "${path.module}/../../tenant_whatsapp_worker.zip"
  source_code_hash = fileexists("${path.module}/../../tenant_whatsapp_worker.zip") ? filebase64sha256("${path.module}/../../tenant_whatsapp_worker.zip") : null

  layers = [var.common_deps_layer_arn]

  environment {
    variables = {
      REGION                   = var.aws_region
      WHATSAPP_PHONE_NUMBER_ID = var.whatsapp_phone_number_id
    }
  }

  tags = merge(var.tags, {
    Name      = "${var.platform_name}-whatsapp-worker"
    Component = "WhatsApp"
  })
}

# SQS Event Source Mapping for Worker
resource "aws_lambda_event_source_mapping" "whatsapp_worker_sqs" {
  event_source_arn                   = aws_sqs_queue.whatsapp_messages.arn
  function_name                      = aws_lambda_function.whatsapp_worker.arn
  batch_size                         = 10
  maximum_batching_window_in_seconds = 5
}

# =============================================================================
# Lambda: WhatsApp Settings API (for frontend)
# =============================================================================

resource "aws_lambda_function" "whatsapp_settings" {
  function_name = "${var.platform_name}-whatsapp-settings-${var.environment}"
  role          = aws_iam_role.whatsapp_lambda_role.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  filename         = "${path.module}/../../tenant_whatsapp_settings.zip"
  source_code_hash = fileexists("${path.module}/../../tenant_whatsapp_settings.zip") ? filebase64sha256("${path.module}/../../tenant_whatsapp_settings.zip") : null

  layers = [var.common_deps_layer_arn]

  environment {
    variables = {
      REGION                   = var.aws_region
      SUBSCRIBERS_TABLE        = aws_dynamodb_table.whatsapp_subscribers.name
      SETTINGS_TABLE           = var.whatsapp_settings_table_name
      TENANTS_TABLE            = var.tenants_table_name
      USER_TENANTS_TABLE       = var.user_tenants_table_name
      WHATSAPP_PHONE_NUMBER    = var.whatsapp_phone_number
      WHATSAPP_DISPLAY_NAME    = var.whatsapp_display_name
    }
  }

  tags = merge(var.tags, {
    Name      = "${var.platform_name}-whatsapp-settings"
    Component = "WhatsApp"
  })
}

# =============================================================================
# API Gateway Integration
# =============================================================================

# /tenants/{tenantId}/whatsapp
resource "aws_api_gateway_resource" "whatsapp" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.tenant_by_id_resource_id
  path_part   = "whatsapp"
}

# /tenants/{tenantId}/whatsapp/settings
resource "aws_api_gateway_resource" "whatsapp_settings" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.whatsapp.id
  path_part   = "settings"
}

# GET /tenants/{tenantId}/whatsapp/settings
resource "aws_api_gateway_method" "whatsapp_settings_get" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.whatsapp_settings.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "whatsapp_settings_get" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.whatsapp_settings.id
  http_method             = aws_api_gateway_method.whatsapp_settings_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.whatsapp_settings.invoke_arn
}

# PUT /tenants/{tenantId}/whatsapp/settings
resource "aws_api_gateway_method" "whatsapp_settings_put" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.whatsapp_settings.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "whatsapp_settings_put" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.whatsapp_settings.id
  http_method             = aws_api_gateway_method.whatsapp_settings_put.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.whatsapp_settings.invoke_arn
}

# OPTIONS for CORS
resource "aws_api_gateway_method" "whatsapp_settings_options" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.whatsapp_settings.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "whatsapp_settings_options" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.whatsapp_settings.id
  http_method = aws_api_gateway_method.whatsapp_settings_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "whatsapp_settings_options" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.whatsapp_settings.id
  http_method = aws_api_gateway_method.whatsapp_settings_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "whatsapp_settings_options" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.whatsapp_settings.id
  http_method = aws_api_gateway_method.whatsapp_settings_options.http_method
  status_code = aws_api_gateway_method_response.whatsapp_settings_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,PUT,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# /tenants/{tenantId}/whatsapp/subscribers
resource "aws_api_gateway_resource" "whatsapp_subscribers" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.whatsapp.id
  path_part   = "subscribers"
}

# GET /tenants/{tenantId}/whatsapp/subscribers
resource "aws_api_gateway_method" "whatsapp_subscribers_get" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.whatsapp_subscribers.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "whatsapp_subscribers_get" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.whatsapp_subscribers.id
  http_method             = aws_api_gateway_method.whatsapp_subscribers_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.whatsapp_settings.invoke_arn
}

# OPTIONS for CORS
resource "aws_api_gateway_method" "whatsapp_subscribers_options" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.whatsapp_subscribers.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "whatsapp_subscribers_options" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.whatsapp_subscribers.id
  http_method = aws_api_gateway_method.whatsapp_subscribers_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "whatsapp_subscribers_options" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.whatsapp_subscribers.id
  http_method = aws_api_gateway_method.whatsapp_subscribers_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "whatsapp_subscribers_options" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.whatsapp_subscribers.id
  http_method = aws_api_gateway_method.whatsapp_subscribers_options.http_method
  status_code = aws_api_gateway_method_response.whatsapp_subscribers_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# Lambda Permissions for API Gateway
resource "aws_lambda_permission" "whatsapp_settings_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.whatsapp_settings.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}

# /tenants/{tenantId}/whatsapp/test
resource "aws_api_gateway_resource" "whatsapp_test" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.whatsapp.id
  path_part   = "test"
}

# POST /tenants/{tenantId}/whatsapp/test
resource "aws_api_gateway_method" "whatsapp_test_post" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.whatsapp_test.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "whatsapp_test_post" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.whatsapp_test.id
  http_method             = aws_api_gateway_method.whatsapp_test_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.whatsapp_settings.invoke_arn
}

# OPTIONS for CORS
resource "aws_api_gateway_method" "whatsapp_test_options" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.whatsapp_test.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "whatsapp_test_options" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.whatsapp_test.id
  http_method = aws_api_gateway_method.whatsapp_test_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "whatsapp_test_options" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.whatsapp_test.id
  http_method = aws_api_gateway_method.whatsapp_test_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "whatsapp_test_options" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.whatsapp_test.id
  http_method = aws_api_gateway_method.whatsapp_test_options.http_method
  status_code = aws_api_gateway_method_response.whatsapp_test_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}
