# Tenant Events Module - Event Management per Tenant

terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

resource "aws_dynamodb_table" "tenant_events" {
  name         = "${var.platform_name}-tenant-events-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenant_id"
  attribute {
    name = "tenant_id"
    type = "S"
  }
  point_in_time_recovery {
    enabled = true
  }
  tags = merge(var.tags, { Name = "${var.platform_name}-tenant-events" })
}

resource "aws_iam_role" "tenant_events_role" {
  name = "${var.platform_name}-tenant-events-role-${var.environment}"
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

resource "aws_iam_role_policy" "tenant_events_policy" {
  name = "${var.platform_name}-tenant-events-policy-${var.environment}"
  role = aws_iam_role.tenant_events_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"], Resource = "arn:aws:logs:*:*:*" },
      { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem"], Resource = [aws_dynamodb_table.tenant_events.arn] },
      { Effect = "Allow", Action = ["dynamodb:GetItem"], Resource = [var.user_tenants_table_arn] },
      { Effect = "Allow", Action = ["dynamodb:Query"], Resource = [var.tenants_table_arn, "${var.tenants_table_arn}/index/*"] },
      { Effect = "Allow", Action = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"], Resource = ["${var.creator_assets_bucket_arn}/tenants/*/events/*"] }
    ]
  })
}

data "archive_file" "tenant_events_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/tenant-events"
  output_path = "${path.module}/../../tenant_events.zip"
  excludes    = ["node_modules", "package-lock.json"]
}

resource "aws_lambda_function" "tenant_events" {
  filename         = data.archive_file.tenant_events_zip.output_path
  source_code_hash = data.archive_file.tenant_events_zip.output_base64sha256
  function_name    = "${var.platform_name}-tenant-events-${var.environment}"
  role             = aws_iam_role.tenant_events_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 30
  memory_size      = 256
  layers           = [var.common_deps_layer_arn]
  environment {
    variables = {
      TENANT_EVENTS_TABLE = aws_dynamodb_table.tenant_events.name
      USER_TENANTS_TABLE  = var.user_tenants_table_name
      TENANTS_TABLE       = var.tenants_table_name # Für Subdomain-Auflösung
      ASSETS_BUCKET       = var.creator_assets_bucket_name
      CLOUDFRONT_DOMAIN   = var.cloudfront_domain_name
      REGION              = var.aws_region
    }
  }
  tags       = var.tags
  depends_on = [aws_iam_role_policy.tenant_events_policy]
}

resource "aws_api_gateway_resource" "events" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.tenant_by_id_resource_id
  path_part   = "events"
}

resource "aws_api_gateway_method" "get_events" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.events.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_events" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.events.id
  http_method             = aws_api_gateway_method.get_events.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_events.invoke_arn
}

resource "aws_api_gateway_method" "put_events" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.events.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_events" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.events.id
  http_method             = aws_api_gateway_method.put_events.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_events.invoke_arn
}

resource "aws_api_gateway_method" "events_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.events.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "events_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.events.id
  http_method       = aws_api_gateway_method.events_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "events_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.events.id
  http_method = aws_api_gateway_method.events_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "events_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.events.id
  http_method = aws_api_gateway_method.events_cors.http_method
  status_code = aws_api_gateway_method_response.events_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,PUT,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.tenant_events.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}

# /tenants/{tenantId}/events/upload-url
resource "aws_api_gateway_resource" "events_upload_url" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.events.id
  path_part   = "upload-url"
}

resource "aws_api_gateway_method" "post_events_upload_url" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.events_upload_url.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_events_upload_url" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.events_upload_url.id
  http_method             = aws_api_gateway_method.post_events_upload_url.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_events.invoke_arn
}

resource "aws_api_gateway_method" "events_upload_url_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.events_upload_url.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "events_upload_url_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.events_upload_url.id
  http_method       = aws_api_gateway_method.events_upload_url_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "events_upload_url_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.events_upload_url.id
  http_method = aws_api_gateway_method.events_upload_url_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "events_upload_url_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.events_upload_url.id
  http_method = aws_api_gateway_method.events_upload_url_cors.http_method
  status_code = aws_api_gateway_method_response.events_upload_url_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# /tenants/{tenantId}/events/asset
resource "aws_api_gateway_resource" "events_asset" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.events.id
  path_part   = "asset"
}

resource "aws_api_gateway_method" "delete_events_asset" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.events_asset.id
  http_method   = "DELETE"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "delete_events_asset" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.events_asset.id
  http_method             = aws_api_gateway_method.delete_events_asset.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_events.invoke_arn
}

resource "aws_api_gateway_method" "events_asset_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.events_asset.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "events_asset_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.events_asset.id
  http_method       = aws_api_gateway_method.events_asset_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "events_asset_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.events_asset.id
  http_method = aws_api_gateway_method.events_asset_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "events_asset_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.events_asset.id
  http_method = aws_api_gateway_method.events_asset_cors.http_method
  status_code = aws_api_gateway_method_response.events_asset_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}
