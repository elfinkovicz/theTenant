# Shop Module
# E-Commerce System mit Stripe Integration

# DynamoDB Table für Produkte
resource "aws_dynamodb_table" "products" {
  name         = "${var.project_name}-products"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "productId"

  attribute {
    name = "productId"
    type = "S"
  }

  attribute {
    name = "category"
    type = "S"
  }

  global_secondary_index {
    name            = "CategoryIndex"
    hash_key        = "category"
    projection_type = "ALL"
  }

  tags = {
    Name = "${var.project_name}-products"
  }
}

# DynamoDB Table für Bestellungen
resource "aws_dynamodb_table" "orders" {
  name         = "${var.project_name}-orders"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "orderId"
  range_key    = "userId"

  attribute {
    name = "orderId"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  global_secondary_index {
    name            = "UserOrdersIndex"
    hash_key        = "userId"
    range_key       = "orderId"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "StatusIndex"
    hash_key        = "status"
    projection_type = "ALL"
  }

  tags = {
    Name = "${var.project_name}-orders"
  }
}

# S3 Bucket für Produkt-Bilder
resource "aws_s3_bucket" "product_images" {
  bucket = "${var.project_name}-product-images-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name = "${var.project_name}-product-images"
  }
  
  lifecycle {
    prevent_destroy = true
    ignore_changes = [tags, tags_all, bucket]
  }
}

resource "aws_s3_bucket_public_access_block" "product_images" {
  bucket = aws_s3_bucket.product_images.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_cors_configuration" "product_images" {
  bucket = aws_s3_bucket.product_images.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_policy" "product_images" {
  bucket = aws_s3_bucket.product_images.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "PublicReadGetObject"
      Effect    = "Allow"
      Principal = "*"
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.product_images.arn}/*"
    }]
  })

  depends_on = [aws_s3_bucket_public_access_block.product_images]
}

# IAM Role für Lambda Functions
resource "aws_iam_role" "shop_lambda" {
  name = "${var.project_name}-shop-lambda"

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
}

resource "aws_iam_role_policy_attachment" "shop_lambda_basic" {
  role       = aws_iam_role.shop_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "shop_lambda_dynamodb" {
  name = "dynamodb-access"
  role = aws_iam_role.shop_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
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
        aws_dynamodb_table.products.arn,
        "${aws_dynamodb_table.products.arn}/index/*",
        aws_dynamodb_table.orders.arn,
        "${aws_dynamodb_table.orders.arn}/index/*"
      ]
    }]
  })
}

# Note: Product listing is now handled by product-management module
# This module only handles orders and payments

# Lambda Function: Create Order
resource "aws_lambda_function" "create_order" {
  filename         = data.archive_file.create_order.output_path
  function_name    = "${var.project_name}-shop-create-order"
  role             = aws_iam_role.shop_lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.create_order.output_base64sha256
  runtime          = "nodejs20.x"

  # Use Lambda Layers for dependencies
  layers = [
    var.aws_sdk_core_layer_arn,
    var.aws_sdk_extended_layer_arn,
    var.utilities_layer_arn,
  ]
  timeout          = 30

  environment {
    variables = {
      ORDERS_TABLE      = aws_dynamodb_table.orders.name
      PRODUCTS_TABLE    = aws_dynamodb_table.products.name
      STRIPE_SECRET_KEY = var.stripe_secret_key
    }
  }
}

data "archive_file" "create_order" {
  type        = "zip"
  output_path = "${path.module}/lambda/create-order.zip"

  source {
    content  = file("${path.module}/lambda/create-order.js")
    filename = "index.js"
  }
}

# Lambda Function: Process Payment
resource "aws_lambda_function" "process_payment" {
  filename         = data.archive_file.process_payment.output_path
  function_name    = "${var.project_name}-shop-process-payment"
  role             = aws_iam_role.shop_lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.process_payment.output_base64sha256
  runtime          = "nodejs20.x"

  # Use Lambda Layers for dependencies
  layers = [
    var.aws_sdk_core_layer_arn,
    var.aws_sdk_extended_layer_arn,
    var.utilities_layer_arn,
  ]
  timeout          = 30

  environment {
    variables = {
      ORDERS_TABLE      = aws_dynamodb_table.orders.name
      STRIPE_SECRET_KEY = var.stripe_secret_key
    }
  }
}

data "archive_file" "process_payment" {
  type        = "zip"
  output_path = "${path.module}/lambda/process-payment.zip"

  source {
    content  = file("${path.module}/lambda/process-payment.js")
    filename = "index.js"
  }
}

# API Gateway
resource "aws_apigatewayv2_api" "shop_api" {
  name          = "${var.project_name}-shop-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = var.allowed_origins
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["content-type", "authorization"]
    max_age       = 300
  }
}

resource "aws_apigatewayv2_stage" "shop_api" {
  api_id      = aws_apigatewayv2_api.shop_api.id
  name        = "$default"
  auto_deploy = true
}

# API Gateway Integrations
resource "aws_apigatewayv2_integration" "create_order" {
  api_id           = aws_apigatewayv2_api.shop_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.create_order.invoke_arn
}

resource "aws_apigatewayv2_integration" "process_payment" {
  api_id           = aws_apigatewayv2_api.shop_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.process_payment.invoke_arn
}

# API Gateway Routes
# Note: GET /products route is handled by product-management module
# Note: Old routes commented out - replaced by multi-provider versions below
# resource "aws_apigatewayv2_route" "create_order" {
#   api_id    = aws_apigatewayv2_api.shop_api.id
#   route_key = "POST /orders"
#   target    = "integrations/${aws_apigatewayv2_integration.create_order.id}"
# }

resource "aws_apigatewayv2_route" "process_payment" {
  api_id    = aws_apigatewayv2_api.shop_api.id
  route_key = "POST /orders/{orderId}/payment"
  target    = "integrations/${aws_apigatewayv2_integration.process_payment.id}"
}

# Lambda Permissions
resource "aws_lambda_permission" "create_order" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.create_order.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.shop_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "process_payment" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.process_payment.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.shop_api.execution_arn}/*/*"
}

data "aws_caller_identity" "current" {}


# ============================================
# EXTENDED SHOP MODULE - Multi-Provider Support
# ============================================

# Cognito Authorizer for Shop API
resource "aws_apigatewayv2_authorizer" "cognito" {
  count = var.cognito_authorizer_id != "" ? 0 : 1
  
  api_id           = aws_apigatewayv2_api.shop_api.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${var.project_name}-shop-authorizer"

  jwt_configuration {
    audience = [var.cognito_client_id]
    issuer   = "https://cognito-idp.${data.aws_region.current.name}.amazonaws.com/${var.cognito_user_pool_id}"
  }
}

data "aws_region" "current" {}

# DynamoDB Table für Shop Settings
resource "aws_dynamodb_table" "shop_settings" {
  name         = "${var.project_name}-shop-settings"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "settingKey"

  attribute {
    name = "settingKey"
    type = "S"
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name = "${var.project_name}-shop-settings"
  }
}

# KMS Key for encrypting payment credentials
resource "aws_kms_key" "shop_encryption" {
  description             = "KMS key for shop payment credentials encryption"
  deletion_window_in_days = 10
  enable_key_rotation     = true

  tags = {
    Name = "${var.project_name}-shop-encryption"
  }
}

resource "aws_kms_alias" "shop_encryption" {
  name          = "alias/${var.project_name}-shop-encryption"
  target_key_id = aws_kms_key.shop_encryption.key_id
}

# IAM Policy for KMS
resource "aws_iam_role_policy" "shop_lambda_kms" {
  name = "kms-access"
  role = aws_iam_role.shop_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "kms:Decrypt",
        "kms:Encrypt",
        "kms:GenerateDataKey"
      ]
      Resource = aws_kms_key.shop_encryption.arn
    }]
  })
}

# IAM Policy for SES
resource "aws_iam_role_policy" "shop_lambda_ses" {
  name = "ses-access"
  role = aws_iam_role.shop_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ses:SendEmail",
        "ses:SendRawEmail",
        "ses:SendTemplatedEmail"
      ]
      Resource = "*"
    }]
  })
}

# Update DynamoDB policy to include settings table
resource "aws_iam_role_policy" "shop_lambda_dynamodb_settings" {
  name = "dynamodb-settings-access"
  role = aws_iam_role.shop_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem"
      ]
      Resource = aws_dynamodb_table.shop_settings.arn
    }]
  })
}

# Lambda Function: Create Order with PayPal
resource "aws_lambda_function" "create_order_multi" {
  filename         = "${path.module}/lambda/create-order-paypal.zip"
  function_name    = "${var.project_name}-shop-create-order-v2"
  role             = aws_iam_role.shop_lambda.arn
  handler          = "create-order-paypal.handler"
  source_code_hash = filebase64sha256("${path.module}/lambda/create-order-paypal.zip")
  runtime          = "nodejs20.x"

  # Use Lambda Layers for dependencies
  layers = [
    var.aws_sdk_core_layer_arn,
    var.aws_sdk_extended_layer_arn,
    var.utilities_layer_arn,
  ]
  timeout          = 30

  environment {
    variables = {
      ORDERS_TABLE    = aws_dynamodb_table.orders.name
      PRODUCTS_TABLE  = aws_dynamodb_table.products.name
      SETTINGS_TABLE  = aws_dynamodb_table.shop_settings.name
      FRONTEND_URL    = var.frontend_url
    }
  }
}

# Lambda Function: Verify Payment with PayPal
resource "aws_lambda_function" "verify_payment" {
  filename         = "${path.module}/lambda/verify-payment-paypal.zip"
  function_name    = "${var.project_name}-shop-verify-payment"
  role             = aws_iam_role.shop_lambda.arn
  handler          = "verify-payment-paypal.handler"
  source_code_hash = filebase64sha256("${path.module}/lambda/verify-payment-paypal.zip")
  runtime          = "nodejs20.x"

  # Use Lambda Layers for dependencies
  layers = [
    var.aws_sdk_core_layer_arn,
    var.aws_sdk_extended_layer_arn,
    var.utilities_layer_arn,
  ]
  timeout          = 30

  environment {
    variables = {
      ORDERS_TABLE     = aws_dynamodb_table.orders.name
      SETTINGS_TABLE   = aws_dynamodb_table.shop_settings.name
      SENDER_EMAIL     = var.sender_email
      SHOP_OWNER_EMAIL = var.shop_owner_email
    }
  }
}

# Lambda Function: Get Order
resource "aws_lambda_function" "get_order" {
  filename         = "${path.module}/lambda/get-order.zip"
  function_name    = "${var.project_name}-shop-get-order"
  role             = aws_iam_role.shop_lambda.arn
  handler          = "get-order.handler"
  source_code_hash = filebase64sha256("${path.module}/lambda/get-order.zip")
  runtime          = "nodejs20.x"

  # Use Lambda Layers for dependencies
  layers = [
    var.aws_sdk_core_layer_arn,
    var.aws_sdk_extended_layer_arn,
    var.utilities_layer_arn,
  ]
  timeout          = 10

  environment {
    variables = {
      ORDERS_TABLE = aws_dynamodb_table.orders.name
    }
  }
}

# Lambda Function: Shop Settings (Admin)
resource "aws_lambda_function" "shop_settings" {
  filename         = "${path.module}/lambda/shop-settings.zip"
  function_name    = "${var.project_name}-shop-settings"
  role             = aws_iam_role.shop_lambda.arn
  handler          = "shop-settings.handler"
  source_code_hash = filebase64sha256("${path.module}/lambda/shop-settings.zip")
  runtime          = "nodejs20.x"

  # Use Lambda Layers for dependencies
  layers = [
    var.aws_sdk_core_layer_arn,
    var.aws_sdk_extended_layer_arn,
    var.utilities_layer_arn,
  ]
  timeout          = 10

  environment {
    variables = {
      SETTINGS_TABLE = aws_dynamodb_table.shop_settings.name
      KMS_KEY_ID     = aws_kms_key.shop_encryption.id
    }
  }
}

# API Gateway Integrations
resource "aws_apigatewayv2_integration" "create_order_multi" {
  api_id           = aws_apigatewayv2_api.shop_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.create_order_multi.invoke_arn
}

resource "aws_apigatewayv2_integration" "verify_payment" {
  api_id           = aws_apigatewayv2_api.shop_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.verify_payment.invoke_arn
}

resource "aws_apigatewayv2_integration" "get_order" {
  api_id           = aws_apigatewayv2_api.shop_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.get_order.invoke_arn
}

resource "aws_apigatewayv2_integration" "shop_settings" {
  api_id           = aws_apigatewayv2_api.shop_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.shop_settings.invoke_arn
}

# API Gateway Routes
# Note: Orders route allows guest checkout (no authentication required)
resource "aws_apigatewayv2_route" "create_order_v2" {
  api_id             = aws_apigatewayv2_api.shop_api.id
  route_key          = "POST /orders"
  target             = "integrations/${aws_apigatewayv2_integration.create_order_multi.id}"
  authorization_type = "NONE"
}

resource "aws_apigatewayv2_route" "verify_payment" {
  api_id             = aws_apigatewayv2_api.shop_api.id
  route_key          = "POST /orders/verify"
  target             = "integrations/${aws_apigatewayv2_integration.verify_payment.id}"
  authorization_type = var.cognito_user_pool_id != "" ? "JWT" : "NONE"
  authorizer_id      = var.cognito_user_pool_id != "" ? aws_apigatewayv2_authorizer.cognito[0].id : null
}

resource "aws_apigatewayv2_route" "get_order" {
  api_id             = aws_apigatewayv2_api.shop_api.id
  route_key          = "GET /orders/{orderId}"
  target             = "integrations/${aws_apigatewayv2_integration.get_order.id}"
  authorization_type = var.cognito_user_pool_id != "" ? "JWT" : "NONE"
  authorizer_id      = var.cognito_user_pool_id != "" ? aws_apigatewayv2_authorizer.cognito[0].id : null
}

resource "aws_apigatewayv2_route" "get_settings" {
  api_id             = aws_apigatewayv2_api.shop_api.id
  route_key          = "GET /settings"
  target             = "integrations/${aws_apigatewayv2_integration.shop_settings.id}"
  authorization_type = var.cognito_user_pool_id != "" ? "JWT" : "NONE"
  authorizer_id      = var.cognito_user_pool_id != "" ? aws_apigatewayv2_authorizer.cognito[0].id : null
}

resource "aws_apigatewayv2_route" "update_settings" {
  api_id             = aws_apigatewayv2_api.shop_api.id
  route_key          = "PUT /settings"
  target             = "integrations/${aws_apigatewayv2_integration.shop_settings.id}"
  authorization_type = var.cognito_user_pool_id != "" ? "JWT" : "NONE"
  authorizer_id      = var.cognito_user_pool_id != "" ? aws_apigatewayv2_authorizer.cognito[0].id : null
}

# Lambda Permissions
resource "aws_lambda_permission" "create_order_multi" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.create_order_multi.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.shop_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "verify_payment" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.verify_payment.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.shop_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "get_order" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_order.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.shop_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "shop_settings" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.shop_settings.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.shop_api.execution_arn}/*/*"
}
