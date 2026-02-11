# Tenant Newsfeed Module - News/Posts Management per Tenant

terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

resource "aws_dynamodb_table" "tenant_newsfeed" {
  name         = "${var.platform_name}-tenant-newsfeed-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenant_id"
  attribute {
    name = "tenant_id"
    type = "S"
  }
  point_in_time_recovery {
    enabled = true
  }
  tags = merge(var.tags, {
    Name         = "${var.platform_name}-tenant-newsfeed"
    BillingGroup = "crosspost"
  })
}

# DynamoDB Table for Scheduled Posts
resource "aws_dynamodb_table" "scheduled_posts" {
  name         = "${var.platform_name}-scheduled-posts-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "schedule_id"
  
  attribute {
    name = "schedule_id"
    type = "S"
  }
  
  attribute {
    name = "tenant_id"
    type = "S"
  }
  
  attribute {
    name = "scheduled_at"
    type = "S"
  }
  
  # GSI for querying by tenant
  global_secondary_index {
    name            = "tenant-scheduled-index"
    hash_key        = "tenant_id"
    range_key       = "scheduled_at"
    projection_type = "ALL"
  }
  
  # TTL for automatic cleanup after execution
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }
  
  tags = merge(var.tags, {
    Name         = "${var.platform_name}-scheduled-posts"
    BillingGroup = "crosspost"
  })
}

# DynamoDB Table for Posting Slots
resource "aws_dynamodb_table" "posting_slots" {
  name         = "${var.platform_name}-posting-slots-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenant_id"
  
  attribute {
    name = "tenant_id"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }
  
  tags = merge(var.tags, {
    Name         = "${var.platform_name}-posting-slots"
    BillingGroup = "crosspost"
  })
}

resource "aws_iam_role" "tenant_newsfeed_role" {
  name = "${var.platform_name}-tenant-newsfeed-role-${var.environment}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
  tags = var.tags
}

resource "aws_iam_role_policy" "tenant_newsfeed_policy" {
  name = "${var.platform_name}-tenant-newsfeed-policy-${var.environment}"
  role = aws_iam_role.tenant_newsfeed_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"], Resource = "arn:aws:logs:*:*:*" },
      { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem"], Resource = [aws_dynamodb_table.tenant_newsfeed.arn] },
      { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:Query"], Resource = [aws_dynamodb_table.scheduled_posts.arn, "${aws_dynamodb_table.scheduled_posts.arn}/index/*"] },
      { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem"], Resource = [aws_dynamodb_table.posting_slots.arn] },
      { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:Query"], Resource = [var.user_tenants_table_arn, "${var.user_tenants_table_arn}/index/*"] },
      { Effect = "Allow", Action = ["dynamodb:Query"], Resource = [var.tenants_table_arn, "${var.tenants_table_arn}/index/*"] },
      { Effect = "Allow", Action = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"], Resource = ["${var.creator_assets_bucket_arn}/tenants/*/newsfeed/*"] },
      # EventBridge Scheduler permissions
      { Effect = "Allow", Action = ["scheduler:CreateSchedule", "scheduler:DeleteSchedule", "scheduler:GetSchedule", "scheduler:UpdateSchedule"], Resource = "arn:aws:scheduler:${var.aws_region}:*:schedule/default/${var.platform_name}-post-*" },
      { Effect = "Allow", Action = ["iam:PassRole"], Resource = aws_iam_role.eventbridge_scheduler_role.arn },
      # STS permissions to get account ID
      { Effect = "Allow", Action = ["sts:GetCallerIdentity"], Resource = "*" },
      # Crossposting permissions - all settings tables
      { Effect = "Allow", Action = ["dynamodb:GetItem"], Resource = [
        aws_dynamodb_table.whatsapp_settings.arn,
        aws_dynamodb_table.telegram_settings.arn,
        aws_dynamodb_table.email_settings.arn,
        aws_dynamodb_table.email_optout.arn,
        aws_dynamodb_table.discord_settings.arn,
        aws_dynamodb_table.slack_settings.arn,
        aws_dynamodb_table.facebook_settings.arn,
        aws_dynamodb_table.instagram_settings.arn,
        aws_dynamodb_table.signal_settings.arn,
        aws_dynamodb_table.xtwitter_settings.arn,
        aws_dynamodb_table.linkedin_settings.arn
      ] },
      # SES permissions for sending emails
      { Effect = "Allow", Action = ["ses:SendEmail", "ses:SendRawEmail"], Resource = "*" },
      # Cognito permissions for getting user emails
      { Effect = "Allow", Action = ["cognito-idp:AdminGetUser", "cognito-idp:ListUsers"], Resource = [var.user_pool_arn] },
      # Lambda invoke permission for crosspost dispatcher
      { Effect = "Allow", Action = ["lambda:InvokeFunction"], Resource = "arn:aws:lambda:${var.aws_region}:*:function:${var.platform_name}-crosspost-dispatcher-*" }
    ]
  })
}

# IAM Role for EventBridge Scheduler to invoke Lambda
resource "aws_iam_role" "eventbridge_scheduler_role" {
  name = "${var.platform_name}-eventbridge-scheduler-role-${var.environment}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "scheduler.amazonaws.com" }
    }]
  })
  tags = var.tags
}

resource "aws_iam_role_policy" "eventbridge_scheduler_policy" {
  name = "${var.platform_name}-eventbridge-scheduler-policy-${var.environment}"
  role = aws_iam_role.eventbridge_scheduler_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["lambda:InvokeFunction"], Resource = aws_lambda_function.tenant_newsfeed.arn }
    ]
  })
}

data "archive_file" "tenant_newsfeed_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/tenant-newsfeed"
  output_path = "${path.module}/../../tenant_newsfeed.zip"
  excludes    = ["node_modules", "package-lock.json"]
}

resource "aws_lambda_function" "tenant_newsfeed" {
  filename         = data.archive_file.tenant_newsfeed_zip.output_path
  source_code_hash = data.archive_file.tenant_newsfeed_zip.output_base64sha256
  function_name    = "${var.platform_name}-tenant-newsfeed-${var.environment}"
  role             = aws_iam_role.tenant_newsfeed_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 30
  memory_size      = 256
  layers           = [var.common_deps_layer_arn]
  environment {
    variables = {
      TENANT_NEWSFEED_TABLE = aws_dynamodb_table.tenant_newsfeed.name
      SCHEDULED_POSTS_TABLE = aws_dynamodb_table.scheduled_posts.name
      POSTING_SLOTS_TABLE   = aws_dynamodb_table.posting_slots.name
      USER_TENANTS_TABLE    = var.user_tenants_table_name
      TENANTS_TABLE         = var.tenants_table_name
      ASSETS_BUCKET         = var.creator_assets_bucket_name
      CLOUDFRONT_DOMAIN     = var.cloudfront_domain_name
      REGION                = var.aws_region
      ENVIRONMENT           = var.environment
      WEBSITE_URL           = "https://${var.platform_domain}"
      PLATFORM_DOMAIN       = var.platform_domain
      PLATFORM_NAME         = var.platform_name
      USER_POOL_ID          = var.user_pool_id
      API_URL               = "https://${var.api_gateway_id}.execute-api.${var.aws_region}.amazonaws.com/production"
      # EventBridge Scheduler
      EVENTBRIDGE_SCHEDULER_ROLE_ARN = aws_iam_role.eventbridge_scheduler_role.arn
      # Crosspost Dispatcher Lambda (modular system)
      CROSSPOST_DISPATCHER_LAMBDA = var.crosspost_dispatcher_lambda_name
      # Crossposting tables (legacy fallback)
      WHATSAPP_SETTINGS_TABLE  = aws_dynamodb_table.whatsapp_settings.name
      TELEGRAM_SETTINGS_TABLE  = aws_dynamodb_table.telegram_settings.name
      EMAIL_SETTINGS_TABLE     = aws_dynamodb_table.email_settings.name
      EMAIL_OPTOUT_TABLE       = aws_dynamodb_table.email_optout.name
      DISCORD_SETTINGS_TABLE   = aws_dynamodb_table.discord_settings.name
      SLACK_SETTINGS_TABLE     = aws_dynamodb_table.slack_settings.name
      FACEBOOK_SETTINGS_TABLE  = aws_dynamodb_table.facebook_settings.name
      INSTAGRAM_SETTINGS_TABLE = aws_dynamodb_table.instagram_settings.name
      SIGNAL_SETTINGS_TABLE    = aws_dynamodb_table.signal_settings.name
      XTWITTER_SETTINGS_TABLE  = aws_dynamodb_table.xtwitter_settings.name
      LINKEDIN_SETTINGS_TABLE  = aws_dynamodb_table.linkedin_settings.name
      YOUTUBE_SETTINGS_TABLE   = aws_dynamodb_table.youtube_settings.name
    }
  }
  tags = merge(var.tags, {
    BillingGroup = "crosspost"
  })
  depends_on = [aws_iam_role_policy.tenant_newsfeed_policy]
}

resource "aws_api_gateway_resource" "newsfeed" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.tenant_by_id_resource_id
  path_part   = "newsfeed"
}

resource "aws_api_gateway_method" "get_newsfeed" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.newsfeed.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_newsfeed" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.newsfeed.id
  http_method             = aws_api_gateway_method.get_newsfeed.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_newsfeed.invoke_arn
}

resource "aws_api_gateway_method" "put_newsfeed" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.newsfeed.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_newsfeed" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.newsfeed.id
  http_method             = aws_api_gateway_method.put_newsfeed.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_newsfeed.invoke_arn
}

resource "aws_api_gateway_method" "newsfeed_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.newsfeed.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "newsfeed_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.newsfeed.id
  http_method       = aws_api_gateway_method.newsfeed_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "newsfeed_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.newsfeed.id
  http_method = aws_api_gateway_method.newsfeed_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "newsfeed_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.newsfeed.id
  http_method = aws_api_gateway_method.newsfeed_cors.http_method
  status_code = aws_api_gateway_method_response.newsfeed_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,PUT,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.tenant_newsfeed.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}

# /tenants/{tenantId}/newsfeed/schedule - Schedule a post
resource "aws_api_gateway_resource" "newsfeed_schedule" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.newsfeed.id
  path_part   = "schedule"
}

resource "aws_api_gateway_method" "post_newsfeed_schedule" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.newsfeed_schedule.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_newsfeed_schedule" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.newsfeed_schedule.id
  http_method             = aws_api_gateway_method.post_newsfeed_schedule.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_newsfeed.invoke_arn
}

resource "aws_api_gateway_method" "newsfeed_schedule_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.newsfeed_schedule.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "newsfeed_schedule_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.newsfeed_schedule.id
  http_method       = aws_api_gateway_method.newsfeed_schedule_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "newsfeed_schedule_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.newsfeed_schedule.id
  http_method = aws_api_gateway_method.newsfeed_schedule_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "newsfeed_schedule_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.newsfeed_schedule.id
  http_method = aws_api_gateway_method.newsfeed_schedule_cors.http_method
  status_code = aws_api_gateway_method_response.newsfeed_schedule_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# /tenants/{tenantId}/newsfeed/schedule/{scheduleId} - Cancel scheduled post
resource "aws_api_gateway_resource" "newsfeed_schedule_id" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.newsfeed_schedule.id
  path_part   = "{scheduleId}"
}

resource "aws_api_gateway_method" "delete_newsfeed_schedule" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.newsfeed_schedule_id.id
  http_method   = "DELETE"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "delete_newsfeed_schedule" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.newsfeed_schedule_id.id
  http_method             = aws_api_gateway_method.delete_newsfeed_schedule.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_newsfeed.invoke_arn
}

resource "aws_api_gateway_method" "newsfeed_schedule_id_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.newsfeed_schedule_id.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "newsfeed_schedule_id_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.newsfeed_schedule_id.id
  http_method       = aws_api_gateway_method.newsfeed_schedule_id_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "newsfeed_schedule_id_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.newsfeed_schedule_id.id
  http_method = aws_api_gateway_method.newsfeed_schedule_id_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "newsfeed_schedule_id_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.newsfeed_schedule_id.id
  http_method = aws_api_gateway_method.newsfeed_schedule_id_cors.http_method
  status_code = aws_api_gateway_method_response.newsfeed_schedule_id_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'PUT,DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# PUT /tenants/{tenantId}/newsfeed/schedule/{scheduleId} - Update scheduled post
resource "aws_api_gateway_method" "put_newsfeed_schedule" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.newsfeed_schedule_id.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_newsfeed_schedule" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.newsfeed_schedule_id.id
  http_method             = aws_api_gateway_method.put_newsfeed_schedule.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_newsfeed.invoke_arn
}

# /tenants/{tenantId}/newsfeed/upload-url
resource "aws_api_gateway_resource" "newsfeed_upload_url" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.newsfeed.id
  path_part   = "upload-url"
}

resource "aws_api_gateway_method" "post_newsfeed_upload_url" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.newsfeed_upload_url.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_newsfeed_upload_url" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.newsfeed_upload_url.id
  http_method             = aws_api_gateway_method.post_newsfeed_upload_url.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_newsfeed.invoke_arn
}

resource "aws_api_gateway_method" "newsfeed_upload_url_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.newsfeed_upload_url.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "newsfeed_upload_url_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.newsfeed_upload_url.id
  http_method       = aws_api_gateway_method.newsfeed_upload_url_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "newsfeed_upload_url_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.newsfeed_upload_url.id
  http_method = aws_api_gateway_method.newsfeed_upload_url_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "newsfeed_upload_url_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.newsfeed_upload_url.id
  http_method = aws_api_gateway_method.newsfeed_upload_url_cors.http_method
  status_code = aws_api_gateway_method_response.newsfeed_upload_url_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# /tenants/{tenantId}/newsfeed/asset
resource "aws_api_gateway_resource" "newsfeed_asset" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.newsfeed.id
  path_part   = "asset"
}

resource "aws_api_gateway_method" "delete_newsfeed_asset" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.newsfeed_asset.id
  http_method   = "DELETE"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "delete_newsfeed_asset" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.newsfeed_asset.id
  http_method             = aws_api_gateway_method.delete_newsfeed_asset.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_newsfeed.invoke_arn
}

resource "aws_api_gateway_method" "newsfeed_asset_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.newsfeed_asset.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "newsfeed_asset_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.newsfeed_asset.id
  http_method       = aws_api_gateway_method.newsfeed_asset_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "newsfeed_asset_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.newsfeed_asset.id
  http_method = aws_api_gateway_method.newsfeed_asset_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "newsfeed_asset_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.newsfeed_asset.id
  http_method = aws_api_gateway_method.newsfeed_asset_cors.http_method
  status_code = aws_api_gateway_method_response.newsfeed_asset_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# ============================================================
# CROSSPOSTING SETTINGS - WhatsApp, Telegram, Email
# ============================================================

# DynamoDB Tables for Crossposting Settings
resource "aws_dynamodb_table" "whatsapp_settings" {
  name         = "${var.platform_name}-whatsapp-settings-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenant_id"
  attribute {
    name = "tenant_id"
    type = "S"
  }
  point_in_time_recovery {
    enabled = true
  }
  tags = merge(var.tags, { Name = "${var.platform_name}-whatsapp-settings" })
}

resource "aws_dynamodb_table" "telegram_settings" {
  name         = "${var.platform_name}-telegram-settings-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenant_id"
  attribute {
    name = "tenant_id"
    type = "S"
  }
  point_in_time_recovery {
    enabled = true
  }
  tags = merge(var.tags, { Name = "${var.platform_name}-telegram-settings" })
}

resource "aws_dynamodb_table" "email_settings" {
  name         = "${var.platform_name}-email-settings-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenant_id"
  attribute {
    name = "tenant_id"
    type = "S"
  }
  point_in_time_recovery {
    enabled = true
  }
  tags = merge(var.tags, { Name = "${var.platform_name}-email-settings" })
}

# Email Opt-Out Table for newsletter unsubscribes
resource "aws_dynamodb_table" "email_optout" {
  name         = "${var.platform_name}-email-optout-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "email"
  range_key    = "tenant_id"
  attribute {
    name = "email"
    type = "S"
  }
  attribute {
    name = "tenant_id"
    type = "S"
  }
  point_in_time_recovery {
    enabled = true
  }
  tags = merge(var.tags, { Name = "${var.platform_name}-email-optout" })
}

# ============================================================
# WHATSAPP SETTINGS LAMBDA - MOVED TO tenant-whatsapp MODULE
# ============================================================
# The WhatsApp settings Lambda and API Gateway resources have been
# moved to the tenant-whatsapp module for the new centralized
# WhatsApp broadcast system using AWS End User Messaging Social.
# 
# The DynamoDB table aws_dynamodb_table.whatsapp_settings is kept
# here for backwards compatibility with existing data.
# ============================================================

# ============================================================
# TELEGRAM SETTINGS LAMBDA
# ============================================================

data "archive_file" "telegram_settings_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/tenant-newsfeed-telegram"
  output_path = "${path.module}/../../tenant_newsfeed_telegram.zip"
}

resource "aws_iam_role" "telegram_settings_role" {
  name = "${var.platform_name}-telegram-settings-role-${var.environment}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
  tags = var.tags
}

resource "aws_iam_role_policy" "telegram_settings_policy" {
  name = "${var.platform_name}-telegram-settings-policy-${var.environment}"
  role = aws_iam_role.telegram_settings_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"], Resource = "arn:aws:logs:*:*:*" },
      { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:PutItem"], Resource = [aws_dynamodb_table.telegram_settings.arn] },
      { Effect = "Allow", Action = ["dynamodb:GetItem"], Resource = [var.user_tenants_table_arn] },
      { Effect = "Allow", Action = ["dynamodb:Query"], Resource = [var.tenants_table_arn, "${var.tenants_table_arn}/index/*"] }
    ]
  })
}

resource "aws_lambda_function" "telegram_settings" {
  filename         = data.archive_file.telegram_settings_zip.output_path
  source_code_hash = data.archive_file.telegram_settings_zip.output_base64sha256
  function_name    = "${var.platform_name}-telegram-settings-${var.environment}"
  role             = aws_iam_role.telegram_settings_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 30
  memory_size      = 256
  environment {
    variables = {
      TELEGRAM_SETTINGS_TABLE = aws_dynamodb_table.telegram_settings.name
      USER_TENANTS_TABLE      = var.user_tenants_table_name
      TENANTS_TABLE           = var.tenants_table_name
      REGION                  = var.aws_region
    }
  }
  tags       = var.tags
  depends_on = [aws_iam_role_policy.telegram_settings_policy]
}

# Telegram API Gateway Resources
resource "aws_api_gateway_resource" "telegram" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.api_gateway_root_resource_id
  path_part   = "telegram"
}

resource "aws_api_gateway_resource" "telegram_settings" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.telegram.id
  path_part   = "settings"
}

resource "aws_api_gateway_method" "get_telegram_settings" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.telegram_settings.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_telegram_settings" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.telegram_settings.id
  http_method             = aws_api_gateway_method.get_telegram_settings.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.telegram_settings.invoke_arn
}

resource "aws_api_gateway_method" "put_telegram_settings" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.telegram_settings.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_telegram_settings" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.telegram_settings.id
  http_method             = aws_api_gateway_method.put_telegram_settings.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.telegram_settings.invoke_arn
}

resource "aws_api_gateway_resource" "telegram_test" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.telegram.id
  path_part   = "test"
}

resource "aws_api_gateway_method" "post_telegram_test" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.telegram_test.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_telegram_test" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.telegram_test.id
  http_method             = aws_api_gateway_method.post_telegram_test.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.telegram_settings.invoke_arn
}

resource "aws_api_gateway_method" "telegram_settings_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.telegram_settings.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "telegram_settings_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.telegram_settings.id
  http_method       = aws_api_gateway_method.telegram_settings_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "telegram_settings_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.telegram_settings.id
  http_method = aws_api_gateway_method.telegram_settings_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "telegram_settings_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.telegram_settings.id
  http_method = aws_api_gateway_method.telegram_settings_cors.http_method
  status_code = aws_api_gateway_method_response.telegram_settings_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,PUT,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

resource "aws_api_gateway_method" "telegram_test_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.telegram_test.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "telegram_test_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.telegram_test.id
  http_method       = aws_api_gateway_method.telegram_test_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "telegram_test_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.telegram_test.id
  http_method = aws_api_gateway_method.telegram_test_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "telegram_test_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.telegram_test.id
  http_method = aws_api_gateway_method.telegram_test_cors.http_method
  status_code = aws_api_gateway_method_response.telegram_test_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

resource "aws_lambda_permission" "telegram_settings_api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.telegram_settings.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}

# ============================================================
# EMAIL SETTINGS LAMBDA
# ============================================================

data "archive_file" "email_settings_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/tenant-newsfeed-email"
  output_path = "${path.module}/../../tenant_newsfeed_email.zip"
}

resource "aws_iam_role" "email_settings_role" {
  name = "${var.platform_name}-email-settings-role-${var.environment}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
  tags = var.tags
}

resource "aws_iam_role_policy" "email_settings_policy" {
  name = "${var.platform_name}-email-settings-policy-${var.environment}"
  role = aws_iam_role.email_settings_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"], Resource = "arn:aws:logs:*:*:*" },
      { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:PutItem"], Resource = [aws_dynamodb_table.email_settings.arn] },
      { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem"], Resource = [aws_dynamodb_table.email_optout.arn] },
      { Effect = "Allow", Action = ["dynamodb:GetItem"], Resource = [var.user_tenants_table_arn] },
      { Effect = "Allow", Action = ["dynamodb:Query"], Resource = [var.tenants_table_arn, "${var.tenants_table_arn}/index/*"] },
      { Effect = "Allow", Action = ["ses:SendEmail", "ses:SendRawEmail"], Resource = "*" },
      { Effect = "Allow", Action = ["cognito-idp:AdminGetUser"], Resource = [var.user_pool_arn] }
    ]
  })
}

resource "aws_lambda_function" "email_settings" {
  filename         = data.archive_file.email_settings_zip.output_path
  source_code_hash = data.archive_file.email_settings_zip.output_base64sha256
  function_name    = "${var.platform_name}-email-settings-${var.environment}"
  role             = aws_iam_role.email_settings_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 30
  memory_size      = 256
  environment {
    variables = {
      EMAIL_SETTINGS_TABLE = aws_dynamodb_table.email_settings.name
      EMAIL_OPTOUT_TABLE   = aws_dynamodb_table.email_optout.name
      USER_TENANTS_TABLE   = var.user_tenants_table_name
      TENANTS_TABLE        = var.tenants_table_name
      REGION               = var.aws_region
      PLATFORM_DOMAIN      = var.platform_domain
      USER_POOL_ID         = var.user_pool_id
      API_URL              = "https://${var.api_gateway_id}.execute-api.${var.aws_region}.amazonaws.com/production"
    }
  }
  tags       = var.tags
  depends_on = [aws_iam_role_policy.email_settings_policy]
}

# Email API Gateway Resources
resource "aws_api_gateway_resource" "email" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.api_gateway_root_resource_id
  path_part   = "email"
}

resource "aws_api_gateway_resource" "email_settings" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.email.id
  path_part   = "settings"
}

resource "aws_api_gateway_method" "get_email_settings" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.email_settings.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_email_settings" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.email_settings.id
  http_method             = aws_api_gateway_method.get_email_settings.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.email_settings.invoke_arn
}

resource "aws_api_gateway_method" "put_email_settings" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.email_settings.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_email_settings" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.email_settings.id
  http_method             = aws_api_gateway_method.put_email_settings.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.email_settings.invoke_arn
}

resource "aws_api_gateway_resource" "email_test" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.email.id
  path_part   = "test"
}

resource "aws_api_gateway_method" "post_email_test" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.email_test.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_email_test" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.email_test.id
  http_method             = aws_api_gateway_method.post_email_test.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.email_settings.invoke_arn
}

resource "aws_api_gateway_method" "email_settings_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.email_settings.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "email_settings_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.email_settings.id
  http_method       = aws_api_gateway_method.email_settings_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "email_settings_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.email_settings.id
  http_method = aws_api_gateway_method.email_settings_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "email_settings_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.email_settings.id
  http_method = aws_api_gateway_method.email_settings_cors.http_method
  status_code = aws_api_gateway_method_response.email_settings_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,PUT,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

resource "aws_api_gateway_method" "email_test_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.email_test.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "email_test_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.email_test.id
  http_method       = aws_api_gateway_method.email_test_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "email_test_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.email_test.id
  http_method = aws_api_gateway_method.email_test_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "email_test_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.email_test.id
  http_method = aws_api_gateway_method.email_test_cors.http_method
  status_code = aws_api_gateway_method_response.email_test_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# Email Unsubscribe Endpoint (no auth required)
resource "aws_api_gateway_resource" "email_unsubscribe" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.email.id
  path_part   = "unsubscribe"
}

resource "aws_api_gateway_method" "get_email_unsubscribe" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.email_unsubscribe.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_email_unsubscribe" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.email_unsubscribe.id
  http_method             = aws_api_gateway_method.get_email_unsubscribe.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.email_settings.invoke_arn
}

# Email Resubscribe Endpoint (no auth required)
resource "aws_api_gateway_resource" "email_resubscribe" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.email.id
  path_part   = "resubscribe"
}

resource "aws_api_gateway_method" "get_email_resubscribe" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.email_resubscribe.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_email_resubscribe" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.email_resubscribe.id
  http_method             = aws_api_gateway_method.get_email_resubscribe.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.email_settings.invoke_arn
}

resource "aws_lambda_permission" "email_settings_api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.email_settings.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}


# ============================================================
# ADDITIONAL CROSSPOSTING PROVIDERS
# Discord, Slack, Facebook, Instagram, Signal, X (Twitter), LinkedIn
# ============================================================

# DynamoDB Tables for new providers
resource "aws_dynamodb_table" "discord_settings" {
  name         = "${var.platform_name}-discord-settings-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenant_id"
  attribute {
    name = "tenant_id"
    type = "S"
  }
  point_in_time_recovery {
    enabled = true
  }
  tags = merge(var.tags, { Name = "${var.platform_name}-discord-settings", BillingGroup = "crosspost" })
}

resource "aws_dynamodb_table" "slack_settings" {
  name         = "${var.platform_name}-slack-settings-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenant_id"
  attribute {
    name = "tenant_id"
    type = "S"
  }
  point_in_time_recovery {
    enabled = true
  }
  tags = merge(var.tags, { Name = "${var.platform_name}-slack-settings", BillingGroup = "crosspost" })
}

resource "aws_dynamodb_table" "facebook_settings" {
  name         = "${var.platform_name}-facebook-settings-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenant_id"
  attribute {
    name = "tenant_id"
    type = "S"
  }
  point_in_time_recovery {
    enabled = true
  }
  tags = merge(var.tags, { Name = "${var.platform_name}-facebook-settings", BillingGroup = "crosspost" })
}

resource "aws_dynamodb_table" "instagram_settings" {
  name         = "${var.platform_name}-instagram-settings-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenant_id"
  attribute {
    name = "tenant_id"
    type = "S"
  }
  point_in_time_recovery {
    enabled = true
  }
  tags = merge(var.tags, { Name = "${var.platform_name}-instagram-settings", BillingGroup = "crosspost" })
}

resource "aws_dynamodb_table" "signal_settings" {
  name         = "${var.platform_name}-signal-settings-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenant_id"
  attribute {
    name = "tenant_id"
    type = "S"
  }
  point_in_time_recovery {
    enabled = true
  }
  tags = merge(var.tags, { Name = "${var.platform_name}-signal-settings", BillingGroup = "crosspost" })
}

resource "aws_dynamodb_table" "xtwitter_settings" {
  name         = "${var.platform_name}-xtwitter-settings-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenant_id"
  attribute {
    name = "tenant_id"
    type = "S"
  }
  point_in_time_recovery {
    enabled = true
  }
  tags = merge(var.tags, { Name = "${var.platform_name}-xtwitter-settings", BillingGroup = "crosspost" })
}

resource "aws_dynamodb_table" "linkedin_settings" {
  name         = "${var.platform_name}-linkedin-settings-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenant_id"
  attribute {
    name = "tenant_id"
    type = "S"
  }
  point_in_time_recovery {
    enabled = true
  }
  tags = merge(var.tags, { Name = "${var.platform_name}-linkedin-settings", BillingGroup = "crosspost" })
}

resource "aws_dynamodb_table" "threads_settings" {
  name         = "${var.platform_name}-threads-settings-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenant_id"
  attribute {
    name = "tenant_id"
    type = "S"
  }
  point_in_time_recovery {
    enabled = true
  }
  tags = merge(var.tags, { Name = "${var.platform_name}-threads-settings", BillingGroup = "crosspost" })
}

resource "aws_dynamodb_table" "youtube_settings" {
  name         = "${var.platform_name}-youtube-settings-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenant_id"
  attribute {
    name = "tenant_id"
    type = "S"
  }
  point_in_time_recovery {
    enabled = true
  }
  tags = merge(var.tags, { Name = "${var.platform_name}-youtube-settings", BillingGroup = "crosspost" })
}

resource "aws_dynamodb_table" "bluesky_settings" {
  name         = "${var.platform_name}-bluesky-settings-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenant_id"
  attribute {
    name = "tenant_id"
    type = "S"
  }
  point_in_time_recovery {
    enabled = true
  }
  tags = merge(var.tags, { Name = "${var.platform_name}-bluesky-settings", BillingGroup = "crosspost" })
}

resource "aws_dynamodb_table" "mastodon_settings" {
  name         = "${var.platform_name}-mastodon-settings-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenant_id"
  attribute {
    name = "tenant_id"
    type = "S"
  }
  point_in_time_recovery {
    enabled = true
  }
  tags = merge(var.tags, { Name = "${var.platform_name}-mastodon-settings", BillingGroup = "crosspost" })
}

resource "aws_dynamodb_table" "tiktok_settings" {
  name         = "${var.platform_name}-tiktok-settings-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenant_id"
  attribute {
    name = "tenant_id"
    type = "S"
  }
  point_in_time_recovery {
    enabled = true
  }
  tags = merge(var.tags, { Name = "${var.platform_name}-tiktok-settings", BillingGroup = "crosspost" })
}

resource "aws_dynamodb_table" "snapchat_settings" {
  name         = "${var.platform_name}-snapchat-settings-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenant_id"
  attribute {
    name = "tenant_id"
    type = "S"
  }
  point_in_time_recovery {
    enabled = true
  }
  tags = merge(var.tags, { Name = "${var.platform_name}-snapchat-settings", BillingGroup = "crosspost" })
}

# ============================================================
# CROSSPOST SETTINGS LAMBDA (handles all new providers)
# ============================================================

data "archive_file" "crosspost_settings_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/tenant-newsfeed-crosspost"
  output_path = "${path.module}/../../tenant_newsfeed_crosspost.zip"
}

resource "aws_iam_role" "crosspost_settings_role" {
  name = "${var.platform_name}-crosspost-settings-role-${var.environment}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
  tags = var.tags
}

resource "aws_iam_role_policy" "crosspost_settings_policy" {
  name = "${var.platform_name}-crosspost-settings-policy-${var.environment}"
  role = aws_iam_role.crosspost_settings_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"], Resource = "arn:aws:logs:*:*:*" },
      { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:PutItem"], Resource = [
        aws_dynamodb_table.discord_settings.arn,
        aws_dynamodb_table.slack_settings.arn,
        aws_dynamodb_table.facebook_settings.arn,
        aws_dynamodb_table.instagram_settings.arn,
        aws_dynamodb_table.signal_settings.arn,
        aws_dynamodb_table.xtwitter_settings.arn,
        aws_dynamodb_table.linkedin_settings.arn,
        aws_dynamodb_table.threads_settings.arn,
        aws_dynamodb_table.youtube_settings.arn,
        aws_dynamodb_table.bluesky_settings.arn,
        aws_dynamodb_table.mastodon_settings.arn,
        aws_dynamodb_table.tiktok_settings.arn,
        aws_dynamodb_table.snapchat_settings.arn
      ] },
      { Effect = "Allow", Action = ["dynamodb:GetItem"], Resource = [var.user_tenants_table_arn] },
      { Effect = "Allow", Action = ["dynamodb:Query"], Resource = [var.tenants_table_arn, "${var.tenants_table_arn}/index/*"] }
    ]
  })
}

resource "aws_lambda_function" "crosspost_settings" {
  filename         = data.archive_file.crosspost_settings_zip.output_path
  source_code_hash = data.archive_file.crosspost_settings_zip.output_base64sha256
  function_name    = "${var.platform_name}-crosspost-settings-${var.environment}"
  role             = aws_iam_role.crosspost_settings_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 30
  memory_size      = 256
  environment {
    variables = {
      DISCORD_SETTINGS_TABLE   = aws_dynamodb_table.discord_settings.name
      SLACK_SETTINGS_TABLE     = aws_dynamodb_table.slack_settings.name
      FACEBOOK_SETTINGS_TABLE  = aws_dynamodb_table.facebook_settings.name
      INSTAGRAM_SETTINGS_TABLE = aws_dynamodb_table.instagram_settings.name
      SIGNAL_SETTINGS_TABLE    = aws_dynamodb_table.signal_settings.name
      XTWITTER_SETTINGS_TABLE  = aws_dynamodb_table.xtwitter_settings.name
      LINKEDIN_SETTINGS_TABLE  = aws_dynamodb_table.linkedin_settings.name
      THREADS_SETTINGS_TABLE   = aws_dynamodb_table.threads_settings.name
      YOUTUBE_SETTINGS_TABLE   = aws_dynamodb_table.youtube_settings.name
      BLUESKY_SETTINGS_TABLE   = aws_dynamodb_table.bluesky_settings.name
      MASTODON_SETTINGS_TABLE  = aws_dynamodb_table.mastodon_settings.name
      TIKTOK_SETTINGS_TABLE    = aws_dynamodb_table.tiktok_settings.name
      SNAPCHAT_SETTINGS_TABLE  = aws_dynamodb_table.snapchat_settings.name
      USER_TENANTS_TABLE       = var.user_tenants_table_name
      TENANTS_TABLE            = var.tenants_table_name
      REGION                   = var.aws_region
      # OAuth credentials (zentral verwaltet)
      META_APP_ID          = var.meta_app_id
      META_APP_SECRET      = var.meta_app_secret
      INSTAGRAM_APP_ID     = var.instagram_app_id
      INSTAGRAM_APP_SECRET = var.instagram_app_secret
      THREADS_APP_ID       = var.threads_app_id
      THREADS_APP_SECRET   = var.threads_app_secret
      GOOGLE_CLIENT_ID     = var.google_client_id
      GOOGLE_CLIENT_SECRET = var.google_client_secret
      LINKEDIN_CLIENT_ID     = var.linkedin_client_id
      LINKEDIN_CLIENT_SECRET = var.linkedin_client_secret
      TWITTER_CLIENT_ID     = var.twitter_client_id
      TWITTER_CLIENT_SECRET = var.twitter_client_secret
      TIKTOK_CLIENT_KEY    = var.tiktok_client_key
      TIKTOK_CLIENT_SECRET = var.tiktok_client_secret
    }
  }
  tags       = merge(var.tags, { BillingGroup = "crosspost" })
  depends_on = [aws_iam_role_policy.crosspost_settings_policy]
}

resource "aws_lambda_permission" "crosspost_settings_api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.crosspost_settings.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}



# ============================================================
# POSTING SLOTS API ENDPOINTS
# ============================================================

# /tenants/{tenantId}/newsfeed/slots - Get/Update posting slots
resource "aws_api_gateway_resource" "newsfeed_slots" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.newsfeed.id
  path_part   = "slots"
}

resource "aws_api_gateway_method" "get_newsfeed_slots" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.newsfeed_slots.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_newsfeed_slots" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.newsfeed_slots.id
  http_method             = aws_api_gateway_method.get_newsfeed_slots.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_newsfeed.invoke_arn
}

resource "aws_api_gateway_method" "put_newsfeed_slots" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.newsfeed_slots.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_newsfeed_slots" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.newsfeed_slots.id
  http_method             = aws_api_gateway_method.put_newsfeed_slots.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_newsfeed.invoke_arn
}

resource "aws_api_gateway_method" "newsfeed_slots_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.newsfeed_slots.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "newsfeed_slots_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.newsfeed_slots.id
  http_method       = aws_api_gateway_method.newsfeed_slots_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "newsfeed_slots_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.newsfeed_slots.id
  http_method = aws_api_gateway_method.newsfeed_slots_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "newsfeed_slots_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.newsfeed_slots.id
  http_method = aws_api_gateway_method.newsfeed_slots_cors.http_method
  status_code = aws_api_gateway_method_response.newsfeed_slots_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,PUT,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# /tenants/{tenantId}/newsfeed/slots/next - Get next available slot
resource "aws_api_gateway_resource" "newsfeed_slots_next" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.newsfeed_slots.id
  path_part   = "next"
}

resource "aws_api_gateway_method" "get_newsfeed_slots_next" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.newsfeed_slots_next.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_newsfeed_slots_next" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.newsfeed_slots_next.id
  http_method             = aws_api_gateway_method.get_newsfeed_slots_next.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_newsfeed.invoke_arn
}

resource "aws_api_gateway_method" "newsfeed_slots_next_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.newsfeed_slots_next.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "newsfeed_slots_next_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.newsfeed_slots_next.id
  http_method       = aws_api_gateway_method.newsfeed_slots_next_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "newsfeed_slots_next_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.newsfeed_slots_next.id
  http_method = aws_api_gateway_method.newsfeed_slots_next_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "newsfeed_slots_next_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.newsfeed_slots_next.id
  http_method = aws_api_gateway_method.newsfeed_slots_next_cors.http_method
  status_code = aws_api_gateway_method_response.newsfeed_slots_next_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}
