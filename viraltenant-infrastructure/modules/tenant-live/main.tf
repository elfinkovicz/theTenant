# Tenant Live Module - Live Streaming Page Configuration
# Manages live stream settings, chat, and viewer interactions per tenant

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Get current AWS account ID
data "aws_caller_identity" "current" {}

# DynamoDB Table for Live Settings
resource "aws_dynamodb_table" "tenant_live" {
  name         = "${var.platform_name}-tenant-live-${var.environment}"
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
    Name         = "${var.platform_name}-tenant-live"
    BillingGroup = "multistream"
  })
}

# IAM Role
resource "aws_iam_role" "tenant_live_role" {
  name = "${var.platform_name}-tenant-live-role-${var.environment}"

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

# MediaLive IAM Role - Required for MediaLive to access resources
resource "aws_iam_role" "medialive_role" {
  name = "${var.platform_name}-medialive-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "medialive.amazonaws.com" }
    }]
  })
  tags = var.tags
}

resource "aws_iam_role_policy" "medialive_policy" {
  name = "${var.platform_name}-medialive-policy-${var.environment}"
  role = aws_iam_role.medialive_role.id

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
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "mediaconnect:*"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy" "tenant_live_policy" {
  name = "${var.platform_name}-tenant-live-policy-${var.environment}"
  role = aws_iam_role.tenant_live_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:Query"]
        Resource = [aws_dynamodb_table.tenant_live.arn, "${aws_dynamodb_table.tenant_live.arn}/index/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:Query"]
        Resource = [var.user_tenants_table_arn, "${var.user_tenants_table_arn}/index/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:Query"]
        Resource = [var.tenants_table_arn, "${var.tenants_table_arn}/index/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
        Resource = ["${var.creator_assets_bucket_arn}/tenants/*/live/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["ivs:GetChannel", "ivs:GetStreamKey", "ivs:GetStream", "ivs:ListChannels", "ivs:UpdateChannel"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["ivschat:GetRoom", "ivschat:CreateChatToken"]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "medialive:CreateChannel",
          "medialive:DeleteChannel",
          "medialive:StartChannel",
          "medialive:StopChannel",
          "medialive:DescribeChannel",
          "medialive:CreateInput",
          "medialive:DeleteInput",
          "medialive:DescribeInput",
          "medialive:ListChannels",
          "medialive:ListInputs",
          "medialive:CreateTags",
          "medialive:DeleteTags"
        ]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["iam:PassRole"]
        Resource = aws_iam_role.medialive_role.arn
      },
      {
        Effect = "Allow"
        Action = [
          "events:PutRule",
          "events:PutTargets",
          "events:DeleteRule",
          "events:RemoveTargets"
        ]
        Resource = "arn:aws:events:*:*:rule/${var.platform_name}-*"
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem"]
        Resource = var.tenant_newsfeed_table_arn != "" ? [var.tenant_newsfeed_table_arn] : ["arn:aws:dynamodb:*:*:table/placeholder"]
      },
      {
        Effect   = "Allow"
        Action   = ["lambda:InvokeFunction"]
        Resource = var.crosspost_dispatcher_lambda_arn != "" ? [var.crosspost_dispatcher_lambda_arn] : ["arn:aws:lambda:*:*:function:placeholder"]
      }
    ]
  })
}

# AWS IVS Channel per Tenant
resource "aws_ivs_channel" "tenant_channel" {
  count = var.create_ivs_channel ? 1 : 0

  name         = "${var.platform_name}-${var.tenant_id}-live-${var.environment}"
  type         = "STANDARD"
  latency_mode = "LOW"

  # Recording wird dynamisch über die Lambda aktiviert/deaktiviert
  # recording_configuration_arn wird per API gesetzt wenn autoSaveStream aktiviert wird

  tags = merge(var.tags, {
    Name         = "${var.platform_name}-${var.tenant_id}-live"
    BillingGroup = "multistream"
  })
}

# S3 Bucket für IVS Stream Recordings
resource "aws_s3_bucket" "ivs_recordings" {
  count  = var.create_ivs_channel ? 1 : 0
  bucket = "${var.platform_name}-${var.tenant_id}-recordings-${var.environment}"

  tags = merge(var.tags, {
    Name         = "${var.platform_name}-${var.tenant_id}-recordings"
    BillingGroup = "multistream"
  })
}

resource "aws_s3_bucket_lifecycle_configuration" "ivs_recordings_lifecycle" {
  count  = var.create_ivs_channel ? 1 : 0
  bucket = aws_s3_bucket.ivs_recordings[0].id

  rule {
    id     = "delete-old-recordings"
    status = "Enabled"

    expiration {
      days = 30  # Recordings nach 30 Tagen löschen
    }
  }
}

# IVS Recording Configuration
resource "aws_ivs_recording_configuration" "tenant_recording" {
  count = var.create_ivs_channel ? 1 : 0
  name  = "${var.platform_name}-${var.tenant_id}-recording-${var.environment}"

  destination_configuration {
    s3 {
      bucket_name = aws_s3_bucket.ivs_recordings[0].id
    }
  }

  thumbnail_configuration {
    recording_mode = "INTERVAL"
    target_interval_seconds = 60
  }

  tags = merge(var.tags, {
    Name         = "${var.platform_name}-${var.tenant_id}-recording"
    BillingGroup = "multistream"
  })
}

# Get the automatically created stream key for the channel
data "aws_ivs_stream_key" "tenant_stream_key" {
  count = var.create_ivs_channel ? 1 : 0

  channel_arn = aws_ivs_channel.tenant_channel[0].arn
}

# AWS IVS Chat Room per Tenant
resource "aws_ivschat_room" "tenant_chat" {
  count = var.create_ivs_channel ? 1 : 0

  name = "${var.platform_name}-${var.tenant_id}-chat-${var.environment}"

  tags = merge(var.tags, {
    Name         = "${var.platform_name}-${var.tenant_id}-chat"
    BillingGroup = "multistream"
  })
}

# Store IVS Channel Info in DynamoDB
resource "aws_dynamodb_table_item" "tenant_ivs_config" {
  count      = var.create_ivs_channel ? 1 : 0
  table_name = aws_dynamodb_table.tenant_live.name
  hash_key   = aws_dynamodb_table.tenant_live.hash_key

  item = jsonencode({
    tenant_id = {
      S = var.tenant_id
    }
    ivs_channel_arn = {
      S = aws_ivs_channel.tenant_channel[0].arn
    }
    ivs_ingest_endpoint = {
      S = aws_ivs_channel.tenant_channel[0].ingest_endpoint
    }
    ivs_stream_key = {
      S = data.aws_ivs_stream_key.tenant_stream_key[0].value
    }
    ivs_playback_url = {
      S = aws_ivs_channel.tenant_channel[0].playback_url
    }
    ivs_chat_room_arn = {
      S = aws_ivschat_room.tenant_chat[0].arn
    }
    ivs_recording_config_arn = {
      S = aws_ivs_recording_configuration.tenant_recording[0].arn
    }
    ivs_recordings_bucket = {
      S = aws_s3_bucket.ivs_recordings[0].id
    }
    created_at = {
      S = timestamp()
    }
    updated_at = {
      S = timestamp()
    }
  })
}

# Lambda Function
data "archive_file" "tenant_live_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/tenant-live"
  output_path = "${path.module}/../../tenant_live.zip"
  excludes    = ["node_modules", "package-lock.json"]
}

resource "aws_lambda_function" "tenant_live" {
  filename         = data.archive_file.tenant_live_zip.output_path
  source_code_hash = data.archive_file.tenant_live_zip.output_base64sha256
  function_name    = "${var.platform_name}-tenant-live-${var.environment}"
  role             = aws_iam_role.tenant_live_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 120
  memory_size      = 256
  layers           = [var.common_deps_layer_arn]

  environment {
    variables = {
      TENANT_LIVE_TABLE  = aws_dynamodb_table.tenant_live.name
      USER_TENANTS_TABLE = var.user_tenants_table_name
      TENANTS_TABLE      = var.tenants_table_name
      ASSETS_BUCKET      = var.creator_assets_bucket_name
      CLOUDFRONT_DOMAIN  = var.cloudfront_domain_name
      REGION             = var.aws_region
      PLATFORM_NAME      = var.platform_name
      MEDIALIVE_ROLE_ARN = aws_iam_role.medialive_role.arn
      LAMBDA_ARN         = "arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:${var.platform_name}-tenant-live-${var.environment}"
      # YouTube OAuth
      OAUTH_TOKENS_TABLE       = aws_dynamodb_table.oauth_tokens.name
      YOUTUBE_BROADCASTS_TABLE = aws_dynamodb_table.youtube_broadcasts.name
      YOUTUBE_CLIENT_ID        = var.youtube_client_id
      YOUTUBE_CLIENT_SECRET    = var.youtube_client_secret
      API_BASE_URL             = var.api_base_url
      ENCRYPTION_KEY           = var.encryption_key
      # Auto-Publish to Newsfeed
      TENANT_NEWSFEED_TABLE    = var.tenant_newsfeed_table_name
      CROSSPOST_DISPATCHER_LAMBDA = var.crosspost_dispatcher_lambda_name
    }
  }
  tags = merge(var.tags, {
    BillingGroup = "multistream"
  })
  depends_on = [aws_iam_role_policy.tenant_live_policy, aws_iam_role_policy.tenant_live_oauth_policy]
}

# API Gateway Resource: /tenants/{tenantId}/live
resource "aws_api_gateway_resource" "live" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.tenant_by_id_resource_id
  path_part   = "live"
}

# GET /tenants/{tenantId}/live - Public
resource "aws_api_gateway_method" "get_live" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.live.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_live" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.live.id
  http_method             = aws_api_gateway_method.get_live.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_live.invoke_arn
}

# PUT /tenants/{tenantId}/live - Admin only
resource "aws_api_gateway_method" "put_live" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.live.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_live" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.live.id
  http_method             = aws_api_gateway_method.put_live.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_live.invoke_arn
}

# CORS
resource "aws_api_gateway_method" "live_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.live.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "live_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.live.id
  http_method       = aws_api_gateway_method.live_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "live_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.live.id
  http_method = aws_api_gateway_method.live_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "live_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.live.id
  http_method = aws_api_gateway_method.live_cors.http_method
  status_code = aws_api_gateway_method_response.live_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,PUT,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# Lambda Permission for API Gateway
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.tenant_live.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}

# Lambda Permission for EventBridge (Auto-Stop Timer)
resource "aws_lambda_permission" "eventbridge_autostop" {
  statement_id_prefix = "AllowExecutionFromEventBridge-"
  action              = "lambda:InvokeFunction"
  function_name       = aws_lambda_function.tenant_live.function_name
  principal           = "events.amazonaws.com"
  source_arn          = "arn:aws:events:${var.aws_region}:${data.aws_caller_identity.current.account_id}:rule/${var.platform_name}-autostop-*"
}

# EventBridge Rule for IVS Recording State Change (Recording End)
resource "aws_cloudwatch_event_rule" "ivs_recording_end" {
  name        = "${var.platform_name}-ivs-recording-end-${var.environment}"
  description = "Trigger when IVS stream recording ends to auto-publish to newsfeed"

  event_pattern = jsonencode({
    source      = ["aws.ivs"]
    detail-type = ["IVS Recording State Change"]
    detail = {
      recording_status = ["Recording End"]
    }
  })

  tags = var.tags
}

resource "aws_cloudwatch_event_target" "ivs_recording_end_target" {
  rule      = aws_cloudwatch_event_rule.ivs_recording_end.name
  target_id = "tenant-live-recording-handler"
  arn       = aws_lambda_function.tenant_live.arn
}

resource "aws_lambda_permission" "eventbridge_ivs_recording" {
  statement_id  = "AllowIVSRecordingEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.tenant_live.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.ivs_recording_end.arn
}

# /tenants/{tenantId}/live/upload-url
resource "aws_api_gateway_resource" "live_upload_url" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.live.id
  path_part   = "upload-url"
}

resource "aws_api_gateway_method" "post_live_upload_url" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.live_upload_url.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_live_upload_url" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.live_upload_url.id
  http_method             = aws_api_gateway_method.post_live_upload_url.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_live.invoke_arn
}

resource "aws_api_gateway_method" "live_upload_url_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.live_upload_url.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "live_upload_url_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.live_upload_url.id
  http_method       = aws_api_gateway_method.live_upload_url_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "live_upload_url_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.live_upload_url.id
  http_method = aws_api_gateway_method.live_upload_url_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "live_upload_url_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.live_upload_url.id
  http_method = aws_api_gateway_method.live_upload_url_cors.http_method
  status_code = aws_api_gateway_method_response.live_upload_url_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# /tenants/{tenantId}/live/asset
resource "aws_api_gateway_resource" "live_asset" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.live.id
  path_part   = "asset"
}

resource "aws_api_gateway_method" "delete_live_asset" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.live_asset.id
  http_method   = "DELETE"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "delete_live_asset" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.live_asset.id
  http_method             = aws_api_gateway_method.delete_live_asset.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_live.invoke_arn
}

resource "aws_api_gateway_method" "live_asset_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.live_asset.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "live_asset_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.live_asset.id
  http_method       = aws_api_gateway_method.live_asset_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "live_asset_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.live_asset.id
  http_method = aws_api_gateway_method.live_asset_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "live_asset_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.live_asset.id
  http_method = aws_api_gateway_method.live_asset_cors.http_method
  status_code = aws_api_gateway_method_response.live_asset_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}
# /tenants/{tenantId}/live/ivs-info - AWS IVS Channel Info
resource "aws_api_gateway_resource" "live_ivs_info" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.live.id
  path_part   = "ivs-info"
}

resource "aws_api_gateway_method" "get_live_ivs_info" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.live_ivs_info.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_live_ivs_info" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.live_ivs_info.id
  http_method             = aws_api_gateway_method.get_live_ivs_info.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_live.invoke_arn
}

resource "aws_api_gateway_method" "live_ivs_info_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.live_ivs_info.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "live_ivs_info_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.live_ivs_info.id
  http_method       = aws_api_gateway_method.live_ivs_info_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "live_ivs_info_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.live_ivs_info.id
  http_method = aws_api_gateway_method.live_ivs_info_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "live_ivs_info_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.live_ivs_info.id
  http_method = aws_api_gateway_method.live_ivs_info_cors.http_method
  status_code = aws_api_gateway_method_response.live_ivs_info_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# /tenants/{tenantId}/live/chat-token - AWS IVS Chat Token
resource "aws_api_gateway_resource" "live_chat_token" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.live.id
  path_part   = "chat-token"
}

resource "aws_api_gateway_method" "post_live_chat_token" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.live_chat_token.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_live_chat_token" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.live_chat_token.id
  http_method             = aws_api_gateway_method.post_live_chat_token.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_live.invoke_arn
}

resource "aws_api_gateway_method" "live_chat_token_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.live_chat_token.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "live_chat_token_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.live_chat_token.id
  http_method       = aws_api_gateway_method.live_chat_token_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "live_chat_token_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.live_chat_token.id
  http_method = aws_api_gateway_method.live_chat_token_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "live_chat_token_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.live_chat_token.id
  http_method = aws_api_gateway_method.live_chat_token_cors.http_method
  status_code = aws_api_gateway_method_response.live_chat_token_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# /tenants/{tenantId}/live/destinations - Stream Destinations
resource "aws_api_gateway_resource" "live_destinations" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.live.id
  path_part   = "destinations"
}

resource "aws_api_gateway_method" "get_live_destinations" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.live_destinations.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_live_destinations" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.live_destinations.id
  http_method             = aws_api_gateway_method.get_live_destinations.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_live.invoke_arn
}

resource "aws_api_gateway_method" "post_live_destinations" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.live_destinations.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_live_destinations" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.live_destinations.id
  http_method             = aws_api_gateway_method.post_live_destinations.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_live.invoke_arn
}

resource "aws_api_gateway_method" "live_destinations_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.live_destinations.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "live_destinations_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.live_destinations.id
  http_method       = aws_api_gateway_method.live_destinations_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "live_destinations_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.live_destinations.id
  http_method = aws_api_gateway_method.live_destinations_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "live_destinations_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.live_destinations.id
  http_method = aws_api_gateway_method.live_destinations_cors.http_method
  status_code = aws_api_gateway_method_response.live_destinations_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# /tenants/{tenantId}/live/destinations/{destinationId} - Individual Destination
resource "aws_api_gateway_resource" "live_destination_by_id" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.live_destinations.id
  path_part   = "{destinationId}"
}

resource "aws_api_gateway_method" "put_live_destination" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.live_destination_by_id.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_live_destination" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.live_destination_by_id.id
  http_method             = aws_api_gateway_method.put_live_destination.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_live.invoke_arn
}

resource "aws_api_gateway_method" "delete_live_destination" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.live_destination_by_id.id
  http_method   = "DELETE"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "delete_live_destination" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.live_destination_by_id.id
  http_method             = aws_api_gateway_method.delete_live_destination.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_live.invoke_arn
}

resource "aws_api_gateway_method" "live_destination_by_id_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.live_destination_by_id.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "live_destination_by_id_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.live_destination_by_id.id
  http_method       = aws_api_gateway_method.live_destination_by_id_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "live_destination_by_id_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.live_destination_by_id.id
  http_method = aws_api_gateway_method.live_destination_by_id_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "live_destination_by_id_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.live_destination_by_id.id
  http_method = aws_api_gateway_method.live_destination_by_id_cors.http_method
  status_code = aws_api_gateway_method_response.live_destination_by_id_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'PUT,DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}


# ============================================
# Restreaming API Endpoints
# ============================================

# /tenants/{tenantId}/live/restreaming
resource "aws_api_gateway_resource" "live_restreaming" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.live.id
  path_part   = "restreaming"
}

# /tenants/{tenantId}/live/restreaming/status - GET
resource "aws_api_gateway_resource" "restreaming_status" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.live_restreaming.id
  path_part   = "status"
}

resource "aws_api_gateway_method" "get_restreaming_status" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.restreaming_status.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_restreaming_status" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.restreaming_status.id
  http_method             = aws_api_gateway_method.get_restreaming_status.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_live.invoke_arn
}

resource "aws_api_gateway_method" "restreaming_status_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.restreaming_status.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "restreaming_status_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.restreaming_status.id
  http_method       = aws_api_gateway_method.restreaming_status_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "restreaming_status_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.restreaming_status.id
  http_method = aws_api_gateway_method.restreaming_status_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "restreaming_status_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.restreaming_status.id
  http_method = aws_api_gateway_method.restreaming_status_cors.http_method
  status_code = aws_api_gateway_method_response.restreaming_status_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# /tenants/{tenantId}/live/restreaming/stop-all - POST
resource "aws_api_gateway_resource" "restreaming_stop_all" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.live_restreaming.id
  path_part   = "stop-all"
}

resource "aws_api_gateway_method" "post_restreaming_stop_all" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.restreaming_stop_all.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_restreaming_stop_all" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.restreaming_stop_all.id
  http_method             = aws_api_gateway_method.post_restreaming_stop_all.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_live.invoke_arn
}

resource "aws_api_gateway_method" "restreaming_stop_all_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.restreaming_stop_all.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "restreaming_stop_all_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.restreaming_stop_all.id
  http_method       = aws_api_gateway_method.restreaming_stop_all_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "restreaming_stop_all_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.restreaming_stop_all.id
  http_method = aws_api_gateway_method.restreaming_stop_all_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "restreaming_stop_all_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.restreaming_stop_all.id
  http_method = aws_api_gateway_method.restreaming_stop_all_cors.http_method
  status_code = aws_api_gateway_method_response.restreaming_stop_all_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# /tenants/{tenantId}/live/restreaming/auto-destroy - PUT
resource "aws_api_gateway_resource" "restreaming_auto_destroy" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.live_restreaming.id
  path_part   = "auto-destroy"
}

resource "aws_api_gateway_method" "put_restreaming_auto_destroy" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.restreaming_auto_destroy.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_restreaming_auto_destroy" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.restreaming_auto_destroy.id
  http_method             = aws_api_gateway_method.put_restreaming_auto_destroy.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_live.invoke_arn
}

resource "aws_api_gateway_method" "restreaming_auto_destroy_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.restreaming_auto_destroy.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "restreaming_auto_destroy_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.restreaming_auto_destroy.id
  http_method       = aws_api_gateway_method.restreaming_auto_destroy_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "restreaming_auto_destroy_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.restreaming_auto_destroy.id
  http_method = aws_api_gateway_method.restreaming_auto_destroy_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "restreaming_auto_destroy_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.restreaming_auto_destroy.id
  http_method = aws_api_gateway_method.restreaming_auto_destroy_cors.http_method
  status_code = aws_api_gateway_method_response.restreaming_auto_destroy_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'PUT,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# /tenants/{tenantId}/live/restreaming/{destinationId}
resource "aws_api_gateway_resource" "restreaming_destination" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.live_restreaming.id
  path_part   = "{destinationId}"
}

# /tenants/{tenantId}/live/restreaming/{destinationId}/start - POST
resource "aws_api_gateway_resource" "restreaming_start" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.restreaming_destination.id
  path_part   = "start"
}

resource "aws_api_gateway_method" "post_restreaming_start" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.restreaming_start.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_restreaming_start" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.restreaming_start.id
  http_method             = aws_api_gateway_method.post_restreaming_start.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_live.invoke_arn
}

resource "aws_api_gateway_method" "restreaming_start_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.restreaming_start.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "restreaming_start_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.restreaming_start.id
  http_method       = aws_api_gateway_method.restreaming_start_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "restreaming_start_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.restreaming_start.id
  http_method = aws_api_gateway_method.restreaming_start_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "restreaming_start_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.restreaming_start.id
  http_method = aws_api_gateway_method.restreaming_start_cors.http_method
  status_code = aws_api_gateway_method_response.restreaming_start_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# /tenants/{tenantId}/live/restreaming/{destinationId}/stop - POST
resource "aws_api_gateway_resource" "restreaming_stop" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.restreaming_destination.id
  path_part   = "stop"
}

resource "aws_api_gateway_method" "post_restreaming_stop" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.restreaming_stop.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_restreaming_stop" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.restreaming_stop.id
  http_method             = aws_api_gateway_method.post_restreaming_stop.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_live.invoke_arn
}

resource "aws_api_gateway_method" "restreaming_stop_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.restreaming_stop.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "restreaming_stop_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.restreaming_stop.id
  http_method       = aws_api_gateway_method.restreaming_stop_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "restreaming_stop_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.restreaming_stop.id
  http_method = aws_api_gateway_method.restreaming_stop_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "restreaming_stop_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.restreaming_stop.id
  http_method = aws_api_gateway_method.restreaming_stop_cors.http_method
  status_code = aws_api_gateway_method_response.restreaming_stop_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}


# ============================================
# YouTube OAuth Integration
# ============================================

# DynamoDB Table for OAuth Tokens (tenant-specific)
resource "aws_dynamodb_table" "oauth_tokens" {
  name         = "${var.platform_name}-oauth-tokens-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenant_id"
  range_key    = "platform"

  attribute {
    name = "tenant_id"
    type = "S"
  }

  attribute {
    name = "platform"
    type = "S"
  }

  # TTL für automatisches Löschen abgelaufener Tokens
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = merge(var.tags, {
    Name         = "${var.platform_name}-oauth-tokens"
    BillingGroup = "multistream"
  })
}

# DynamoDB Table for YouTube Broadcasts
resource "aws_dynamodb_table" "youtube_broadcasts" {
  name         = "${var.platform_name}-youtube-broadcasts-${var.environment}"
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
    Name         = "${var.platform_name}-youtube-broadcasts"
    BillingGroup = "multistream"
  })
}

# Update Lambda IAM Policy for OAuth tables and SSM
resource "aws_iam_role_policy" "tenant_live_oauth_policy" {
  name = "${var.platform_name}-tenant-live-oauth-policy-${var.environment}"
  role = aws_iam_role.tenant_live_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:Query"]
        Resource = [
          aws_dynamodb_table.oauth_tokens.arn,
          aws_dynamodb_table.youtube_broadcasts.arn
        ]
      },
      {
        Effect = "Allow"
        Action = ["ssm:GetParameter"]
        Resource = [
          "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/viraltenant/youtube/*",
          "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.platform_name}/youtube/*"
        ]
      }
    ]
  })
}

# /tenants/{tenantId}/youtube - YouTube OAuth Base Resource
resource "aws_api_gateway_resource" "youtube" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.tenant_by_id_resource_id
  path_part   = "youtube"
}

# /tenants/{tenantId}/youtube/oauth
resource "aws_api_gateway_resource" "youtube_oauth" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.youtube.id
  path_part   = "oauth"
}

# /tenants/{tenantId}/youtube/oauth/initiate - POST (Start OAuth flow)
resource "aws_api_gateway_resource" "youtube_oauth_initiate" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.youtube_oauth.id
  path_part   = "initiate"
}

resource "aws_api_gateway_method" "post_youtube_oauth_initiate" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.youtube_oauth_initiate.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_youtube_oauth_initiate" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.youtube_oauth_initiate.id
  http_method             = aws_api_gateway_method.post_youtube_oauth_initiate.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_live.invoke_arn
}

resource "aws_api_gateway_method" "youtube_oauth_initiate_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.youtube_oauth_initiate.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "youtube_oauth_initiate_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.youtube_oauth_initiate.id
  http_method       = aws_api_gateway_method.youtube_oauth_initiate_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "youtube_oauth_initiate_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.youtube_oauth_initiate.id
  http_method = aws_api_gateway_method.youtube_oauth_initiate_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "youtube_oauth_initiate_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.youtube_oauth_initiate.id
  http_method = aws_api_gateway_method.youtube_oauth_initiate_cors.http_method
  status_code = aws_api_gateway_method_response.youtube_oauth_initiate_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# /tenants/{tenantId}/youtube/oauth/callback - GET (OAuth callback - public)
resource "aws_api_gateway_resource" "youtube_oauth_callback" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.youtube_oauth.id
  path_part   = "callback"
}

resource "aws_api_gateway_method" "get_youtube_oauth_callback" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.youtube_oauth_callback.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_youtube_oauth_callback" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.youtube_oauth_callback.id
  http_method             = aws_api_gateway_method.get_youtube_oauth_callback.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_live.invoke_arn
}

resource "aws_api_gateway_method" "youtube_oauth_callback_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.youtube_oauth_callback.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "youtube_oauth_callback_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.youtube_oauth_callback.id
  http_method       = aws_api_gateway_method.youtube_oauth_callback_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "youtube_oauth_callback_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.youtube_oauth_callback.id
  http_method = aws_api_gateway_method.youtube_oauth_callback_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "youtube_oauth_callback_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.youtube_oauth_callback.id
  http_method = aws_api_gateway_method.youtube_oauth_callback_cors.http_method
  status_code = aws_api_gateway_method_response.youtube_oauth_callback_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# /tenants/{tenantId}/youtube/oauth/status - GET
resource "aws_api_gateway_resource" "youtube_oauth_status" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.youtube_oauth.id
  path_part   = "status"
}

resource "aws_api_gateway_method" "get_youtube_oauth_status" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.youtube_oauth_status.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_youtube_oauth_status" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.youtube_oauth_status.id
  http_method             = aws_api_gateway_method.get_youtube_oauth_status.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_live.invoke_arn
}

resource "aws_api_gateway_method" "youtube_oauth_status_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.youtube_oauth_status.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "youtube_oauth_status_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.youtube_oauth_status.id
  http_method       = aws_api_gateway_method.youtube_oauth_status_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "youtube_oauth_status_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.youtube_oauth_status.id
  http_method = aws_api_gateway_method.youtube_oauth_status_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "youtube_oauth_status_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.youtube_oauth_status.id
  http_method = aws_api_gateway_method.youtube_oauth_status_cors.http_method
  status_code = aws_api_gateway_method_response.youtube_oauth_status_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# /tenants/{tenantId}/youtube/oauth/disconnect - DELETE
resource "aws_api_gateway_resource" "youtube_oauth_disconnect" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.youtube_oauth.id
  path_part   = "disconnect"
}

resource "aws_api_gateway_method" "delete_youtube_oauth_disconnect" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.youtube_oauth_disconnect.id
  http_method   = "DELETE"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "delete_youtube_oauth_disconnect" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.youtube_oauth_disconnect.id
  http_method             = aws_api_gateway_method.delete_youtube_oauth_disconnect.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_live.invoke_arn
}

resource "aws_api_gateway_method" "youtube_oauth_disconnect_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.youtube_oauth_disconnect.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "youtube_oauth_disconnect_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.youtube_oauth_disconnect.id
  http_method       = aws_api_gateway_method.youtube_oauth_disconnect_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "youtube_oauth_disconnect_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.youtube_oauth_disconnect.id
  http_method = aws_api_gateway_method.youtube_oauth_disconnect_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "youtube_oauth_disconnect_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.youtube_oauth_disconnect.id
  http_method = aws_api_gateway_method.youtube_oauth_disconnect_cors.http_method
  status_code = aws_api_gateway_method_response.youtube_oauth_disconnect_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# /tenants/{tenantId}/youtube/broadcast - YouTube Broadcast Management
resource "aws_api_gateway_resource" "youtube_broadcast" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.youtube.id
  path_part   = "broadcast"
}

resource "aws_api_gateway_method" "post_youtube_broadcast" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.youtube_broadcast.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_youtube_broadcast" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.youtube_broadcast.id
  http_method             = aws_api_gateway_method.post_youtube_broadcast.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_live.invoke_arn
}

resource "aws_api_gateway_method" "youtube_broadcast_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.youtube_broadcast.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "youtube_broadcast_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.youtube_broadcast.id
  http_method       = aws_api_gateway_method.youtube_broadcast_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "youtube_broadcast_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.youtube_broadcast.id
  http_method = aws_api_gateway_method.youtube_broadcast_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "youtube_broadcast_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.youtube_broadcast.id
  http_method = aws_api_gateway_method.youtube_broadcast_cors.http_method
  status_code = aws_api_gateway_method_response.youtube_broadcast_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# /tenants/{tenantId}/youtube/broadcast/current - GET current broadcast
resource "aws_api_gateway_resource" "youtube_broadcast_current" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.youtube_broadcast.id
  path_part   = "current"
}

resource "aws_api_gateway_method" "get_youtube_broadcast_current" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.youtube_broadcast_current.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_youtube_broadcast_current" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.youtube_broadcast_current.id
  http_method             = aws_api_gateway_method.get_youtube_broadcast_current.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_live.invoke_arn
}

resource "aws_api_gateway_method" "youtube_broadcast_current_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.youtube_broadcast_current.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "youtube_broadcast_current_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.youtube_broadcast_current.id
  http_method       = aws_api_gateway_method.youtube_broadcast_current_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "youtube_broadcast_current_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.youtube_broadcast_current.id
  http_method = aws_api_gateway_method.youtube_broadcast_current_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "youtube_broadcast_current_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.youtube_broadcast_current.id
  http_method = aws_api_gateway_method.youtube_broadcast_current_cors.http_method
  status_code = aws_api_gateway_method_response.youtube_broadcast_current_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# /tenants/{tenantId}/youtube/broadcast/{broadcastId} - PUT update broadcast
resource "aws_api_gateway_resource" "youtube_broadcast_by_id" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.youtube_broadcast.id
  path_part   = "{broadcastId}"
}

resource "aws_api_gateway_method" "put_youtube_broadcast" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.youtube_broadcast_by_id.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_youtube_broadcast" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.youtube_broadcast_by_id.id
  http_method             = aws_api_gateway_method.put_youtube_broadcast.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_live.invoke_arn
}

resource "aws_api_gateway_method" "youtube_broadcast_by_id_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.youtube_broadcast_by_id.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "youtube_broadcast_by_id_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.youtube_broadcast_by_id.id
  http_method       = aws_api_gateway_method.youtube_broadcast_by_id_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "youtube_broadcast_by_id_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.youtube_broadcast_by_id.id
  http_method = aws_api_gateway_method.youtube_broadcast_by_id_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "youtube_broadcast_by_id_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.youtube_broadcast_by_id.id
  http_method = aws_api_gateway_method.youtube_broadcast_by_id_cors.http_method
  status_code = aws_api_gateway_method_response.youtube_broadcast_by_id_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'PUT,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# /tenants/{tenantId}/youtube/stream-credentials - GET stream credentials
resource "aws_api_gateway_resource" "youtube_stream_credentials" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.youtube.id
  path_part   = "stream-credentials"
}

resource "aws_api_gateway_method" "get_youtube_stream_credentials" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.youtube_stream_credentials.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_youtube_stream_credentials" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.youtube_stream_credentials.id
  http_method             = aws_api_gateway_method.get_youtube_stream_credentials.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_live.invoke_arn
}

resource "aws_api_gateway_method" "youtube_stream_credentials_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.youtube_stream_credentials.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "youtube_stream_credentials_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.youtube_stream_credentials.id
  http_method       = aws_api_gateway_method.youtube_stream_credentials_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "youtube_stream_credentials_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.youtube_stream_credentials.id
  http_method = aws_api_gateway_method.youtube_stream_credentials_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "youtube_stream_credentials_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.youtube_stream_credentials.id
  http_method = aws_api_gateway_method.youtube_stream_credentials_cors.http_method
  status_code = aws_api_gateway_method_response.youtube_stream_credentials_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# =============================================================================
# Offline Image Endpoints
# =============================================================================

# /tenants/{tenantId}/live/offline-image
resource "aws_api_gateway_resource" "live_offline_image" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.live.id
  path_part   = "offline-image"
}

# DELETE /tenants/{tenantId}/live/offline-image
resource "aws_api_gateway_method" "delete_offline_image" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.live_offline_image.id
  http_method   = "DELETE"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "delete_offline_image" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.live_offline_image.id
  http_method             = aws_api_gateway_method.delete_offline_image.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_live.invoke_arn
}

resource "aws_api_gateway_method" "offline_image_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.live_offline_image.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "offline_image_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.live_offline_image.id
  http_method       = aws_api_gateway_method.offline_image_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "offline_image_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.live_offline_image.id
  http_method = aws_api_gateway_method.offline_image_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "offline_image_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.live_offline_image.id
  http_method = aws_api_gateway_method.offline_image_cors.http_method
  status_code = aws_api_gateway_method_response.offline_image_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# /tenants/{tenantId}/live/offline-image/upload-url
resource "aws_api_gateway_resource" "live_offline_image_upload_url" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.live_offline_image.id
  path_part   = "upload-url"
}

# POST /tenants/{tenantId}/live/offline-image/upload-url
resource "aws_api_gateway_method" "post_offline_image_upload_url" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.live_offline_image_upload_url.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_offline_image_upload_url" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.live_offline_image_upload_url.id
  http_method             = aws_api_gateway_method.post_offline_image_upload_url.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_live.invoke_arn
}

resource "aws_api_gateway_method" "offline_image_upload_url_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.live_offline_image_upload_url.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "offline_image_upload_url_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.live_offline_image_upload_url.id
  http_method       = aws_api_gateway_method.offline_image_upload_url_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "offline_image_upload_url_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.live_offline_image_upload_url.id
  http_method = aws_api_gateway_method.offline_image_upload_url_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "offline_image_upload_url_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.live_offline_image_upload_url.id
  http_method = aws_api_gateway_method.offline_image_upload_url_cors.http_method
  status_code = aws_api_gateway_method_response.offline_image_upload_url_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}
