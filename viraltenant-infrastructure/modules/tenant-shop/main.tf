# Tenant Shop Module - E-Commerce/Product Management per Tenant

terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

resource "aws_dynamodb_table" "tenant_shop" {
  name         = "${var.platform_name}-tenant-shop-${var.environment}"
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
    Name         = "${var.platform_name}-tenant-shop"
    BillingGroup = "videohost"
  })
}

# Separate Orders Table for tenant-specific orders
resource "aws_dynamodb_table" "tenant_orders" {
  name         = "${var.platform_name}-tenant-orders-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenant_id"
  range_key    = "order_id"

  attribute {
    name = "tenant_id"
    type = "S"
  }
  attribute {
    name = "order_id"
    type = "S"
  }
  attribute {
    name = "created_at"
    type = "S"
  }

  # GSI for querying orders by date
  global_secondary_index {
    name            = "tenant-date-index"
    hash_key        = "tenant_id"
    range_key       = "created_at"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = merge(var.tags, {
    Name         = "${var.platform_name}-tenant-orders"
    BillingGroup = "videohost"
  })
}

resource "aws_iam_role" "tenant_shop_role" {
  name = "${var.platform_name}-tenant-shop-role-${var.environment}"
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

resource "aws_iam_role_policy" "tenant_shop_policy" {
  name = "${var.platform_name}-tenant-shop-policy-${var.environment}"
  role = aws_iam_role.tenant_shop_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"], Resource = "arn:aws:logs:*:*:*" },
      { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:Query"], Resource = [aws_dynamodb_table.tenant_shop.arn, aws_dynamodb_table.tenant_orders.arn, "${aws_dynamodb_table.tenant_orders.arn}/index/*"] },
      { Effect = "Allow", Action = ["dynamodb:GetItem"], Resource = [var.user_tenants_table_arn] },
      { Effect = "Allow", Action = ["dynamodb:Query"], Resource = [var.tenants_table_arn, "${var.tenants_table_arn}/index/*"] },
      { Effect = "Allow", Action = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"], Resource = ["${var.creator_assets_bucket_arn}/tenants/*/shop/*"] },
      { Effect = "Allow", Action = ["ses:SendEmail", "ses:SendRawEmail"], Resource = "*" }
    ]
  })
}

data "archive_file" "tenant_shop_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/tenant-shop"
  output_path = "${path.module}/../../tenant_shop.zip"
  excludes    = ["node_modules", "package-lock.json"]
}

resource "aws_lambda_function" "tenant_shop" {
  filename         = data.archive_file.tenant_shop_zip.output_path
  source_code_hash = data.archive_file.tenant_shop_zip.output_base64sha256
  function_name    = "${var.platform_name}-tenant-shop-${var.environment}"
  role             = aws_iam_role.tenant_shop_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 30
  memory_size      = 256
  layers           = [var.common_deps_layer_arn]
  environment {
    variables = {
      TENANT_SHOP_TABLE   = aws_dynamodb_table.tenant_shop.name
      TENANT_ORDERS_TABLE = aws_dynamodb_table.tenant_orders.name
      USER_TENANTS_TABLE  = var.user_tenants_table_name
      TENANTS_TABLE       = var.tenants_table_name
      ASSETS_BUCKET       = var.creator_assets_bucket_name
      CLOUDFRONT_DOMAIN   = var.cloudfront_domain_name
      REGION              = var.aws_region
      SES_DOMAIN          = var.ses_domain
      API_URL             = "https://${var.api_gateway_id}.execute-api.${var.aws_region}.amazonaws.com/production"
      PLATFORM_URL        = "https://viraltenant.com"
    }
  }
  tags = merge(var.tags, {
    BillingGroup = "videohost"
  })
  depends_on = [aws_iam_role_policy.tenant_shop_policy]
}

resource "aws_api_gateway_resource" "shop" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.tenant_by_id_resource_id
  path_part   = "shop"
}

resource "aws_api_gateway_method" "get_shop" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.shop.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_shop" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.shop.id
  http_method             = aws_api_gateway_method.get_shop.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_shop.invoke_arn
}

resource "aws_api_gateway_method" "put_shop" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.shop.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_shop" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.shop.id
  http_method             = aws_api_gateway_method.put_shop.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_shop.invoke_arn
}

resource "aws_api_gateway_method" "shop_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.shop.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "shop_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.shop.id
  http_method       = aws_api_gateway_method.shop_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "shop_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.shop.id
  http_method = aws_api_gateway_method.shop_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "shop_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.shop.id
  http_method = aws_api_gateway_method.shop_cors.http_method
  status_code = aws_api_gateway_method_response.shop_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,PUT,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.tenant_shop.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}

# /tenants/{tenantId}/shop/upload-url
resource "aws_api_gateway_resource" "shop_upload_url" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.shop.id
  path_part   = "upload-url"
}

resource "aws_api_gateway_method" "post_shop_upload_url" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.shop_upload_url.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_shop_upload_url" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.shop_upload_url.id
  http_method             = aws_api_gateway_method.post_shop_upload_url.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_shop.invoke_arn
}

resource "aws_api_gateway_method" "shop_upload_url_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.shop_upload_url.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "shop_upload_url_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.shop_upload_url.id
  http_method       = aws_api_gateway_method.shop_upload_url_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "shop_upload_url_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.shop_upload_url.id
  http_method = aws_api_gateway_method.shop_upload_url_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "shop_upload_url_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.shop_upload_url.id
  http_method = aws_api_gateway_method.shop_upload_url_cors.http_method
  status_code = aws_api_gateway_method_response.shop_upload_url_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# /tenants/{tenantId}/shop/asset
resource "aws_api_gateway_resource" "shop_asset" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.shop.id
  path_part   = "asset"
}

resource "aws_api_gateway_method" "delete_shop_asset" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.shop_asset.id
  http_method   = "DELETE"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "delete_shop_asset" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.shop_asset.id
  http_method             = aws_api_gateway_method.delete_shop_asset.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_shop.invoke_arn
}

resource "aws_api_gateway_method" "shop_asset_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.shop_asset.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "shop_asset_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.shop_asset.id
  http_method       = aws_api_gateway_method.shop_asset_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "shop_asset_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.shop_asset.id
  http_method = aws_api_gateway_method.shop_asset_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "shop_asset_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.shop_asset.id
  http_method = aws_api_gateway_method.shop_asset_cors.http_method
  status_code = aws_api_gateway_method_response.shop_asset_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# ============================================================
# PAYMENT ENDPOINTS
# ============================================================

# /tenants/{tenantId}/shop/checkout
resource "aws_api_gateway_resource" "shop_checkout" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.shop.id
  path_part   = "checkout"
}

resource "aws_api_gateway_method" "post_shop_checkout" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.shop_checkout.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "post_shop_checkout" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.shop_checkout.id
  http_method             = aws_api_gateway_method.post_shop_checkout.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_shop.invoke_arn
}

resource "aws_api_gateway_method" "shop_checkout_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.shop_checkout.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "shop_checkout_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.shop_checkout.id
  http_method       = aws_api_gateway_method.shop_checkout_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "shop_checkout_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.shop_checkout.id
  http_method = aws_api_gateway_method.shop_checkout_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "shop_checkout_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.shop_checkout.id
  http_method = aws_api_gateway_method.shop_checkout_cors.http_method
  status_code = aws_api_gateway_method_response.shop_checkout_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# /tenants/{tenantId}/shop/capture
resource "aws_api_gateway_resource" "shop_capture" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.shop.id
  path_part   = "capture"
}

resource "aws_api_gateway_method" "post_shop_capture" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.shop_capture.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "post_shop_capture" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.shop_capture.id
  http_method             = aws_api_gateway_method.post_shop_capture.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_shop.invoke_arn
}

resource "aws_api_gateway_method" "shop_capture_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.shop_capture.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "shop_capture_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.shop_capture.id
  http_method       = aws_api_gateway_method.shop_capture_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "shop_capture_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.shop_capture.id
  http_method = aws_api_gateway_method.shop_capture_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "shop_capture_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.shop_capture.id
  http_method = aws_api_gateway_method.shop_capture_cors.http_method
  status_code = aws_api_gateway_method_response.shop_capture_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# /tenants/{tenantId}/shop/webhook
resource "aws_api_gateway_resource" "shop_webhook" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.shop.id
  path_part   = "webhook"
}

resource "aws_api_gateway_method" "post_shop_webhook" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.shop_webhook.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "post_shop_webhook" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.shop_webhook.id
  http_method             = aws_api_gateway_method.post_shop_webhook.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_shop.invoke_arn
}

# /tenants/{tenantId}/shop/orders
resource "aws_api_gateway_resource" "shop_orders" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.shop.id
  path_part   = "orders"
}

resource "aws_api_gateway_method" "get_shop_orders" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.shop_orders.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_shop_orders" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.shop_orders.id
  http_method             = aws_api_gateway_method.get_shop_orders.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_shop.invoke_arn
}

resource "aws_api_gateway_method" "shop_orders_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.shop_orders.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "shop_orders_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.shop_orders.id
  http_method       = aws_api_gateway_method.shop_orders_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "shop_orders_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.shop_orders.id
  http_method = aws_api_gateway_method.shop_orders_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "shop_orders_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.shop_orders.id
  http_method = aws_api_gateway_method.shop_orders_cors.http_method
  status_code = aws_api_gateway_method_response.shop_orders_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# /tenants/{tenantId}/shop/payment-config
resource "aws_api_gateway_resource" "shop_payment_config" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.shop.id
  path_part   = "payment-config"
}

resource "aws_api_gateway_method" "get_shop_payment_config" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.shop_payment_config.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_shop_payment_config" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.shop_payment_config.id
  http_method             = aws_api_gateway_method.get_shop_payment_config.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_shop.invoke_arn
}

resource "aws_api_gateway_method" "shop_payment_config_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.shop_payment_config.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "shop_payment_config_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.shop_payment_config.id
  http_method       = aws_api_gateway_method.shop_payment_config_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "shop_payment_config_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.shop_payment_config.id
  http_method = aws_api_gateway_method.shop_payment_config_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "shop_payment_config_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.shop_payment_config.id
  http_method = aws_api_gateway_method.shop_payment_config_cors.http_method
  status_code = aws_api_gateway_method_response.shop_payment_config_cors.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}
