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
}

resource "aws_s3_bucket_public_access_block" "product_images" {
  bucket = aws_s3_bucket.product_images.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
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

# Lambda Function: Get Products
resource "aws_lambda_function" "get_products" {
  filename         = data.archive_file.get_products.output_path
  function_name    = "${var.project_name}-shop-get-products"
  role             = aws_iam_role.shop_lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.get_products.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = 10

  environment {
    variables = {
      PRODUCTS_TABLE = aws_dynamodb_table.products.name
    }
  }
}

data "archive_file" "get_products" {
  type        = "zip"
  output_path = "${path.module}/lambda/get-products.zip"

  source {
    content  = file("${path.module}/lambda/get-products.js")
    filename = "index.js"
  }
}

# Lambda Function: Create Order
resource "aws_lambda_function" "create_order" {
  filename         = data.archive_file.create_order.output_path
  function_name    = "${var.project_name}-shop-create-order"
  role             = aws_iam_role.shop_lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.create_order.output_base64sha256
  runtime          = "nodejs20.x"
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
resource "aws_apigatewayv2_integration" "get_products" {
  api_id           = aws_apigatewayv2_api.shop_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.get_products.invoke_arn
}

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
resource "aws_apigatewayv2_route" "get_products" {
  api_id    = aws_apigatewayv2_api.shop_api.id
  route_key = "GET /products"
  target    = "integrations/${aws_apigatewayv2_integration.get_products.id}"
}

resource "aws_apigatewayv2_route" "create_order" {
  api_id    = aws_apigatewayv2_api.shop_api.id
  route_key = "POST /orders"
  target    = "integrations/${aws_apigatewayv2_integration.create_order.id}"
}

resource "aws_apigatewayv2_route" "process_payment" {
  api_id    = aws_apigatewayv2_api.shop_api.id
  route_key = "POST /orders/{orderId}/payment"
  target    = "integrations/${aws_apigatewayv2_integration.process_payment.id}"
}

# Lambda Permissions
resource "aws_lambda_permission" "get_products" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_products.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.shop_api.execution_arn}/*/*"
}

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
