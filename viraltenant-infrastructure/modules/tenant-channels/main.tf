# Tenant Channels Module - Channel Management per Tenant

terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

resource "aws_dynamodb_table" "tenant_channels" {
  name         = "${var.platform_name}-tenant-channels-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenant_id"
  attribute {
    name = "tenant_id"
    type = "S"
  }
  point_in_time_recovery {
    enabled = true
  }
  tags = merge(var.tags, { Name = "${var.platform_name}-tenant-channels" })
}

resource "aws_iam_role" "tenant_channels_role" {
  name = "${var.platform_name}-tenant-channels-role-${var.environment}"
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

resource "aws_iam_role_policy" "tenant_channels_policy" {
  name = "${var.platform_name}-tenant-channels-policy-${var.environment}"
  role = aws_iam_role.tenant_channels_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"], Resource = "arn:aws:logs:*:*:*" },
      { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem"], Resource = [aws_dynamodb_table.tenant_channels.arn] },
      { Effect = "Allow", Action = ["dynamodb:GetItem"], Resource = [var.user_tenants_table_arn] },
      { Effect = "Allow", Action = ["dynamodb:Query"], Resource = [var.tenants_table_arn, "${var.tenants_table_arn}/index/*"] },
      { Effect = "Allow", Action = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"], Resource = ["${var.creator_assets_bucket_arn}/tenants/*/channels/*"] }
    ]
  })
}

data "archive_file" "tenant_channels_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/tenant-channels"
  output_path = "${path.module}/../../tenant_channels.zip"
  excludes    = ["node_modules", "package-lock.json"]
}

resource "aws_lambda_function" "tenant_channels" {
  filename         = data.archive_file.tenant_channels_zip.output_path
  source_code_hash = data.archive_file.tenant_channels_zip.output_base64sha256
  function_name    = "${var.platform_name}-tenant-channels-${var.environment}"
  role             = aws_iam_role.tenant_channels_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 30
  memory_size      = 256
  layers           = [var.common_deps_layer_arn]
  environment {
    variables = {
      TENANT_CHANNELS_TABLE = aws_dynamodb_table.tenant_channels.name
      USER_TENANTS_TABLE    = var.user_tenants_table_name
      TENANTS_TABLE         = var.tenants_table_name
      ASSETS_BUCKET         = var.creator_assets_bucket_name
      CLOUDFRONT_DOMAIN     = var.cloudfront_domain_name
      REGION                = var.aws_region
    }
  }
  tags       = var.tags
  depends_on = [aws_iam_role_policy.tenant_channels_policy]
}

resource "aws_api_gateway_resource" "channels" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.tenant_by_id_resource_id
  path_part   = "channels"
}

resource "aws_api_gateway_method" "get_channels" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.channels.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_channels" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.channels.id
  http_method             = aws_api_gateway_method.get_channels.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_channels.invoke_arn
}

resource "aws_api_gateway_method" "put_channels" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.channels.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_channels" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.channels.id
  http_method             = aws_api_gateway_method.put_channels.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_channels.invoke_arn
}

resource "aws_api_gateway_method" "channels_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.channels.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "channels_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.channels.id
  http_method       = aws_api_gateway_method.channels_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "channels_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.channels.id
  http_method = aws_api_gateway_method.channels_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "channels_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.channels.id
  http_method = aws_api_gateway_method.channels_cors.http_method
  status_code = aws_api_gateway_method_response.channels_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,PUT,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.tenant_channels.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}

# /tenants/{tenantId}/channels/upload-url
resource "aws_api_gateway_resource" "channels_upload_url" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.channels.id
  path_part   = "upload-url"
}

resource "aws_api_gateway_method" "post_channels_upload_url" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.channels_upload_url.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_channels_upload_url" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.channels_upload_url.id
  http_method             = aws_api_gateway_method.post_channels_upload_url.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_channels.invoke_arn
}

resource "aws_api_gateway_method" "channels_upload_url_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.channels_upload_url.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "channels_upload_url_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.channels_upload_url.id
  http_method       = aws_api_gateway_method.channels_upload_url_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "channels_upload_url_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.channels_upload_url.id
  http_method = aws_api_gateway_method.channels_upload_url_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "channels_upload_url_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.channels_upload_url.id
  http_method = aws_api_gateway_method.channels_upload_url_cors.http_method
  status_code = aws_api_gateway_method_response.channels_upload_url_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# /tenants/{tenantId}/channels/asset
resource "aws_api_gateway_resource" "channels_asset" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.channels.id
  path_part   = "asset"
}

resource "aws_api_gateway_method" "delete_channels_asset" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.channels_asset.id
  http_method   = "DELETE"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "delete_channels_asset" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.channels_asset.id
  http_method             = aws_api_gateway_method.delete_channels_asset.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_channels.invoke_arn
}

resource "aws_api_gateway_method" "channels_asset_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.channels_asset.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "channels_asset_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.channels_asset.id
  http_method       = aws_api_gateway_method.channels_asset_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "channels_asset_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.channels_asset.id
  http_method = aws_api_gateway_method.channels_asset_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "channels_asset_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.channels_asset.id
  http_method = aws_api_gateway_method.channels_asset_cors.http_method
  status_code = aws_api_gateway_method_response.channels_asset_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}
