# AI Thumbnail Generation with Bedrock
# This module adds AI-powered thumbnail generation using AWS Bedrock Stable Diffusion XL
# Requires: aws_api_gateway_resource.videos from main.tf

# Lambda Function: Extract Video Frames (returns video URL for client-side extraction)
data "archive_file" "video_frame_extractor_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/video-frame-extractor"
  output_path = "${path.module}/../../video_frame_extractor.zip"
  excludes    = ["node_modules", "package-lock.json"]
}

resource "aws_lambda_function" "video_frame_extractor" {
  filename         = data.archive_file.video_frame_extractor_zip.output_path
  source_code_hash = data.archive_file.video_frame_extractor_zip.output_base64sha256
  function_name    = "${var.platform_name}-video-frame-extractor-${var.environment}"
  role            = aws_iam_role.video_frame_extractor_role.arn
  handler         = "index.handler"
  runtime          = "nodejs18.x"
  timeout         = 30
  memory_size     = 256
  
  # Use existing shared Lambda layer
  layers = [var.common_deps_layer_arn]

  environment {
    variables = {
      ASSETS_BUCKET     = var.creator_assets_bucket_name
      CLOUDFRONT_DOMAIN = var.cloudfront_domain_name
    }
  }
  
  tags = var.tags
}

# Lambda Function: AI Thumbnail Generator
data "archive_file" "ai_thumbnail_generator_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/ai-thumbnail-generator"
  output_path = "${path.module}/../../ai_thumbnail_generator.zip"
  excludes    = ["node_modules", "package-lock.json"]
}

resource "aws_lambda_function" "ai_thumbnail_generator" {
  filename         = data.archive_file.ai_thumbnail_generator_zip.output_path
  source_code_hash = data.archive_file.ai_thumbnail_generator_zip.output_base64sha256
  function_name    = "${var.platform_name}-ai-thumbnail-generator-${var.environment}"
  role            = aws_iam_role.ai_thumbnail_generator_role.arn
  handler         = "index.handler"
  runtime          = "nodejs18.x"
  timeout         = 60
  memory_size     = 1024
  
  # Use existing shared Lambda layer
  layers = [var.common_deps_layer_arn]

  environment {
    variables = {
      ASSETS_BUCKET     = var.creator_assets_bucket_name
      CLOUDFRONT_DOMAIN = var.cloudfront_domain_name
      BEDROCK_REGION    = "us-west-2"
    }
  }
  
  tags = var.tags
}

# IAM Role for Frame Extractor
resource "aws_iam_role" "video_frame_extractor_role" {
  name = "${var.platform_name}-video-frame-extractor-role-${var.environment}"

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

resource "aws_iam_role_policy" "video_frame_extractor_policy" {
  name = "${var.platform_name}-video-frame-extractor-policy"
  role = aws_iam_role.video_frame_extractor_role.id

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
        Resource = "${var.creator_assets_bucket_arn}/*"
      }
    ]
  })
}

# IAM Role for AI Thumbnail Generator
resource "aws_iam_role" "ai_thumbnail_generator_role" {
  name = "${var.platform_name}-ai-thumbnail-generator-role-${var.environment}"

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

resource "aws_iam_role_policy" "ai_thumbnail_generator_policy" {
  name = "${var.platform_name}-ai-thumbnail-generator-policy"
  role = aws_iam_role.ai_thumbnail_generator_role.id

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
        Resource = "${var.creator_assets_bucket_arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel"
        ]
        Resource = [
          "arn:aws:bedrock:us-west-2::foundation-model/stability.stable-image-ultra-v1:1",
          "arn:aws:bedrock:us-west-2::foundation-model/stability.sd3-5-large-v1:0"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "aws-marketplace:ViewSubscriptions",
          "aws-marketplace:Subscribe",
          "aws-marketplace:Unsubscribe",
          "aws-marketplace:GetEntitlements"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "bedrock:GetFoundationModel",
          "bedrock:ListFoundationModels",
          "bedrock:GetModelInvocationLoggingConfiguration"
        ]
        Resource = "*"
      }
    ]
  })
}

# API Gateway Integration - /tenants/{tenantId}/videos/extract-frames
resource "aws_api_gateway_resource" "extract_frames" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.videos.id
  path_part   = "extract-frames"
}

resource "aws_api_gateway_method" "post_extract_frames" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.extract_frames.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_extract_frames" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.extract_frames.id
  http_method             = aws_api_gateway_method.post_extract_frames.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.video_frame_extractor.invoke_arn
}

resource "aws_api_gateway_method" "extract_frames_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.extract_frames.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "extract_frames_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.extract_frames.id
  http_method       = aws_api_gateway_method.extract_frames_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "extract_frames_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.extract_frames.id
  http_method = aws_api_gateway_method.extract_frames_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "extract_frames_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.extract_frames.id
  http_method = aws_api_gateway_method.extract_frames_cors.http_method
  status_code = aws_api_gateway_method_response.extract_frames_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# API Gateway Integration - /tenants/{tenantId}/videos/generate-ai-thumbnail
resource "aws_api_gateway_resource" "generate_ai_thumbnail" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.videos.id
  path_part   = "generate-ai-thumbnail"
}

resource "aws_api_gateway_method" "post_generate_ai_thumbnail" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.generate_ai_thumbnail.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_generate_ai_thumbnail" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.generate_ai_thumbnail.id
  http_method             = aws_api_gateway_method.post_generate_ai_thumbnail.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.ai_thumbnail_generator.invoke_arn
}

resource "aws_api_gateway_method" "generate_ai_thumbnail_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.generate_ai_thumbnail.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "generate_ai_thumbnail_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.generate_ai_thumbnail.id
  http_method       = aws_api_gateway_method.generate_ai_thumbnail_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "generate_ai_thumbnail_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.generate_ai_thumbnail.id
  http_method = aws_api_gateway_method.generate_ai_thumbnail_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "generate_ai_thumbnail_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.generate_ai_thumbnail.id
  http_method = aws_api_gateway_method.generate_ai_thumbnail_cors.http_method
  status_code = aws_api_gateway_method_response.generate_ai_thumbnail_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# Lambda Permissions
resource "aws_lambda_permission" "extract_frames_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.video_frame_extractor.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}

resource "aws_lambda_permission" "generate_thumbnail_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ai_thumbnail_generator.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}

output "frame_extractor_function_name" {
  value = aws_lambda_function.video_frame_extractor.function_name
}

output "ai_thumbnail_generator_function_name" {
  value = aws_lambda_function.ai_thumbnail_generator.function_name
}
