# AI Transcription and Description Generation for Podcasts

# S3 Bucket for Transcripts
resource "aws_s3_bucket" "podcast_transcripts" {
  bucket = "${var.platform_name}-podcast-transcripts-${var.environment}"
  tags   = merge(var.tags, { Name = "${var.platform_name}-podcast-transcripts" })
}

resource "aws_s3_bucket_lifecycle_configuration" "transcripts_lifecycle" {
  bucket = aws_s3_bucket.podcast_transcripts.id

  rule {
    id     = "delete-old-transcripts"
    status = "Enabled"

    expiration {
      days = 30
    }
  }
}

# Lambda: Start Transcription
resource "aws_iam_role" "ai_transcribe_role" {
  name = "${var.platform_name}-podcast-ai-transcribe-role-${var.environment}"
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

resource "aws_iam_role_policy" "ai_transcribe_policy" {
  name = "${var.platform_name}-podcast-ai-transcribe-policy-${var.environment}"
  role = aws_iam_role.ai_transcribe_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"], Resource = "arn:aws:logs:*:*:*" },
      { Effect = "Allow", Action = ["transcribe:StartTranscriptionJob", "transcribe:GetTranscriptionJob"], Resource = "*" },
      { Effect = "Allow", Action = ["s3:GetObject"], Resource = ["${var.creator_assets_bucket_arn}/*"] },
      { Effect = "Allow", Action = ["s3:PutObject", "s3:GetObject"], Resource = ["${aws_s3_bucket.podcast_transcripts.arn}/*"] },
      { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:UpdateItem"], Resource = [aws_dynamodb_table.tenant_podcasts.arn] }
    ]
  })
}

data "archive_file" "ai_transcribe_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/podcast-ai-transcribe"
  output_path = "${path.module}/../../podcast_ai_transcribe.zip"
}

resource "aws_lambda_function" "ai_transcribe" {
  filename         = data.archive_file.ai_transcribe_zip.output_path
  source_code_hash = data.archive_file.ai_transcribe_zip.output_base64sha256
  function_name    = "${var.platform_name}-podcast-ai-transcribe-${var.environment}"
  role             = aws_iam_role.ai_transcribe_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 30
  memory_size      = 256
  layers           = [var.common_deps_layer_arn]
  environment {
    variables = {
      REGION                = var.aws_region
      ASSETS_BUCKET         = var.creator_assets_bucket_name
      TRANSCRIPTS_BUCKET    = aws_s3_bucket.podcast_transcripts.id
      TENANT_PODCASTS_TABLE = aws_dynamodb_table.tenant_podcasts.name
      AI_USAGE_TABLE        = aws_dynamodb_table.ai_usage.name
    }
  }
  tags = var.tags
}

# Lambda: Generate Description with Bedrock
resource "aws_iam_role" "ai_describe_role" {
  name = "${var.platform_name}-podcast-ai-describe-role-${var.environment}"
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

resource "aws_iam_role_policy" "ai_describe_policy" {
  name = "${var.platform_name}-podcast-ai-describe-policy-${var.environment}"
  role = aws_iam_role.ai_describe_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"], Resource = "arn:aws:logs:*:*:*" },
      { Effect = "Allow", Action = ["bedrock:InvokeModel"], Resource = ["arn:aws:bedrock:${var.aws_region}::foundation-model/anthropic.claude-3-haiku-20240307-v1:0"] },
      { Effect = "Allow", Action = ["s3:GetObject", "s3:ListBucket"], Resource = ["${aws_s3_bucket.podcast_transcripts.arn}", "${aws_s3_bucket.podcast_transcripts.arn}/*"] },
      { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:UpdateItem"], Resource = [aws_dynamodb_table.tenant_podcasts.arn] }
    ]
  })
}

data "archive_file" "ai_describe_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/podcast-ai-describe"
  output_path = "${path.module}/../../podcast_ai_describe.zip"
}

resource "aws_lambda_function" "ai_describe" {
  filename         = data.archive_file.ai_describe_zip.output_path
  source_code_hash = data.archive_file.ai_describe_zip.output_base64sha256
  function_name    = "${var.platform_name}-podcast-ai-describe-${var.environment}"
  role             = aws_iam_role.ai_describe_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 60
  memory_size      = 512
  layers           = [var.common_deps_layer_arn]
  environment {
    variables = {
      REGION                = var.aws_region
      TRANSCRIPTS_BUCKET    = aws_s3_bucket.podcast_transcripts.id
      TENANT_PODCASTS_TABLE = aws_dynamodb_table.tenant_podcasts.name
      AI_USAGE_TABLE        = aws_dynamodb_table.ai_usage.name
    }
  }
  tags = var.tags
}

# EventBridge Rule for Transcribe Completion
resource "aws_cloudwatch_event_rule" "transcribe_complete" {
  name        = "${var.platform_name}-podcast-transcribe-complete-${var.environment}"
  description = "Trigger when podcast transcription completes"
  event_pattern = jsonencode({
    source      = ["aws.transcribe"]
    detail-type = ["Transcribe Job State Change"]
    detail = {
      TranscriptionJobStatus = ["COMPLETED"]
      TranscriptionJobName   = [{ prefix = "podcast-" }]
    }
  })
  tags = var.tags
}

resource "aws_cloudwatch_event_target" "transcribe_complete_target" {
  rule      = aws_cloudwatch_event_rule.transcribe_complete.name
  target_id = "podcast-ai-describe"
  arn       = aws_lambda_function.ai_describe.arn
}

resource "aws_lambda_permission" "eventbridge_invoke" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ai_describe.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.transcribe_complete.arn
}

# API Gateway Routes for AI Transcription
resource "aws_api_gateway_resource" "ai_transcribe" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.podcasts.id
  path_part   = "ai-transcribe"
}

resource "aws_api_gateway_method" "post_ai_transcribe" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.ai_transcribe.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_ai_transcribe" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.ai_transcribe.id
  http_method             = aws_api_gateway_method.post_ai_transcribe.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.ai_transcribe.invoke_arn
}

resource "aws_api_gateway_method" "ai_transcribe_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.ai_transcribe.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "ai_transcribe_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.ai_transcribe.id
  http_method       = aws_api_gateway_method.ai_transcribe_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "ai_transcribe_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.ai_transcribe.id
  http_method = aws_api_gateway_method.ai_transcribe_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "ai_transcribe_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.ai_transcribe.id
  http_method = aws_api_gateway_method.ai_transcribe_cors.http_method
  status_code = aws_api_gateway_method_response.ai_transcribe_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# AI Status endpoint
resource "aws_api_gateway_resource" "ai_status" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.podcasts.id
  path_part   = "ai-status"
}

resource "aws_api_gateway_resource" "ai_status_podcast" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.ai_status.id
  path_part   = "{podcastId}"
}

resource "aws_api_gateway_method" "get_ai_status" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.ai_status_podcast.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_ai_status" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.ai_status_podcast.id
  http_method             = aws_api_gateway_method.get_ai_status.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.ai_transcribe.invoke_arn
}

resource "aws_api_gateway_method" "ai_status_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.ai_status_podcast.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "ai_status_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.ai_status_podcast.id
  http_method       = aws_api_gateway_method.ai_status_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "ai_status_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.ai_status_podcast.id
  http_method = aws_api_gateway_method.ai_status_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "ai_status_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.ai_status_podcast.id
  http_method = aws_api_gateway_method.ai_status_cors.http_method
  status_code = aws_api_gateway_method_response.ai_status_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# Lambda permissions for API Gateway
resource "aws_lambda_permission" "ai_transcribe_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ai_transcribe.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}
