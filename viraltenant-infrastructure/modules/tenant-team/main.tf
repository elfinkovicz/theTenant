# Tenant Team Module - Team Member Management per Tenant

terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

resource "aws_dynamodb_table" "tenant_team" {
  name         = "${var.platform_name}-tenant-team-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenant_id"
  attribute {
    name = "tenant_id"
    type = "S"
  }
  point_in_time_recovery {
    enabled = true
  }
  tags = merge(var.tags, { Name = "${var.platform_name}-tenant-team" })
}

resource "aws_iam_role" "tenant_team_role" {
  name = "${var.platform_name}-tenant-team-role-${var.environment}"
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

resource "aws_iam_role_policy" "tenant_team_policy" {
  name = "${var.platform_name}-tenant-team-policy-${var.environment}"
  role = aws_iam_role.tenant_team_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"], Resource = "arn:aws:logs:*:*:*" },
      { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem"], Resource = [aws_dynamodb_table.tenant_team.arn] },
      { Effect = "Allow", Action = ["dynamodb:GetItem"], Resource = [var.user_tenants_table_arn] },
      { Effect = "Allow", Action = ["dynamodb:Query"], Resource = [var.tenants_table_arn, "${var.tenants_table_arn}/index/*"] },
      { Effect = "Allow", Action = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"], Resource = ["${var.creator_assets_bucket_arn}/tenants/*/team/*"] }
    ]
  })
}

data "archive_file" "tenant_team_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/tenant-team"
  output_path = "${path.module}/../../tenant_team.zip"
  excludes    = ["node_modules", "package-lock.json"]
}

resource "aws_lambda_function" "tenant_team" {
  filename         = data.archive_file.tenant_team_zip.output_path
  source_code_hash = data.archive_file.tenant_team_zip.output_base64sha256
  function_name    = "${var.platform_name}-tenant-team-${var.environment}"
  role             = aws_iam_role.tenant_team_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 30
  memory_size      = 256
  layers           = [var.common_deps_layer_arn]
  environment {
    variables = {
      TENANT_TEAM_TABLE  = aws_dynamodb_table.tenant_team.name
      USER_TENANTS_TABLE = var.user_tenants_table_name
      TENANTS_TABLE      = var.tenants_table_name # Für Subdomain-Auflösung
      ASSETS_BUCKET      = var.creator_assets_bucket_name
      CLOUDFRONT_DOMAIN  = var.cloudfront_domain_name
      REGION             = var.aws_region
    }
  }
  tags       = var.tags
  depends_on = [aws_iam_role_policy.tenant_team_policy]
}

resource "aws_api_gateway_resource" "team" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.tenant_by_id_resource_id
  path_part   = "team"
}

resource "aws_api_gateway_method" "get_team" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.team.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_team" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.team.id
  http_method             = aws_api_gateway_method.get_team.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_team.invoke_arn
}

resource "aws_api_gateway_method" "put_team" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.team.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_team" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.team.id
  http_method             = aws_api_gateway_method.put_team.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_team.invoke_arn
}

resource "aws_api_gateway_method" "team_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.team.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "team_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.team.id
  http_method       = aws_api_gateway_method.team_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "team_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.team.id
  http_method = aws_api_gateway_method.team_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "team_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.team.id
  http_method = aws_api_gateway_method.team_cors.http_method
  status_code = aws_api_gateway_method_response.team_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,PUT,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.tenant_team.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}

# /tenants/{tenantId}/team/upload-url
resource "aws_api_gateway_resource" "team_upload_url" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.team.id
  path_part   = "upload-url"
}

resource "aws_api_gateway_method" "post_team_upload_url" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.team_upload_url.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_team_upload_url" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.team_upload_url.id
  http_method             = aws_api_gateway_method.post_team_upload_url.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_team.invoke_arn
}

resource "aws_api_gateway_method" "team_upload_url_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.team_upload_url.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "team_upload_url_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.team_upload_url.id
  http_method       = aws_api_gateway_method.team_upload_url_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "team_upload_url_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.team_upload_url.id
  http_method = aws_api_gateway_method.team_upload_url_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "team_upload_url_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.team_upload_url.id
  http_method = aws_api_gateway_method.team_upload_url_cors.http_method
  status_code = aws_api_gateway_method_response.team_upload_url_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# /tenants/{tenantId}/team/asset
resource "aws_api_gateway_resource" "team_asset" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.team.id
  path_part   = "asset"
}

resource "aws_api_gateway_method" "delete_team_asset" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.team_asset.id
  http_method   = "DELETE"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "delete_team_asset" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.team_asset.id
  http_method             = aws_api_gateway_method.delete_team_asset.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_team.invoke_arn
}

resource "aws_api_gateway_method" "team_asset_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.team_asset.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "team_asset_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.team_asset.id
  http_method       = aws_api_gateway_method.team_asset_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "team_asset_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.team_asset.id
  http_method = aws_api_gateway_method.team_asset_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "team_asset_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.team_asset.id
  http_method = aws_api_gateway_method.team_asset_cors.http_method
  status_code = aws_api_gateway_method_response.team_asset_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}
