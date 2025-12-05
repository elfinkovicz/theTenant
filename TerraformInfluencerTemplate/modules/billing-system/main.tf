# Billing System Module
# Monatliche AWS-Kostenabrechnung + Stripe Integration

# Get current AWS account ID
data "aws_caller_identity" "current" {}

# DynamoDB Table für Billing Records
resource "aws_dynamodb_table" "billing" {
  name           = "${var.project_name}-billing"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "userId"
  range_key      = "invoiceId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "invoiceId"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "N"
  }

  global_secondary_index {
    name            = "StatusIndex"
    hash_key        = "status"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  tags = {
    Name = "${var.project_name}-billing"
  }
}

# DynamoDB Table für Customer Payment Methods
resource "aws_dynamodb_table" "payment_methods" {
  name         = "${var.project_name}-payment-methods"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"

  attribute {
    name = "userId"
    type = "S"
  }

  tags = {
    Name = "${var.project_name}-payment-methods"
  }
}

# DynamoDB Table für Invoice Counter (fortlaufende Rechnungsnummern)
resource "aws_dynamodb_table" "invoice_counter" {
  name         = "${var.project_name}-invoice-counter"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "counterId"

  attribute {
    name = "counterId"
    type = "S"
  }

  tags = {
    Name = "${var.project_name}-invoice-counter"
  }
}

# IAM Role für Cost Explorer Lambda
resource "aws_iam_role" "cost_calculator_lambda" {
  name = "${var.project_name}-cost-calculator-lambda"

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

# IAM Policy für Cost Explorer Access
resource "aws_iam_role_policy" "cost_calculator_policy" {
  name = "${var.project_name}-cost-calculator-policy"
  role = aws_iam_role.cost_calculator_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ce:GetCostAndUsage",
          "ce:GetCostForecast"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query"
        ]
        Resource = [
          aws_dynamodb_table.billing.arn,
          "${aws_dynamodb_table.billing.arn}/index/*",
          aws_dynamodb_table.payment_methods.arn,
          aws_dynamodb_table.invoice_counter.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sts:GetCallerIdentity"
        ]
        Resource = "*"
      },
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
          "secretsmanager:GetSecretValue"
        ]
        Resource = aws_secretsmanager_secret.stripe_keys.arn
      },
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:AdminGetUser"
        ]
        Resource = "arn:aws:cognito-idp:*:*:userpool/*"
      }
    ]
  })
}

# Secrets Manager für Stripe Keys
resource "aws_secretsmanager_secret" "stripe_keys" {
  name        = "${var.project_name}-stripe-keys"
  description = "Stripe API Keys für Billing System"
}

resource "aws_secretsmanager_secret_version" "stripe_keys" {
  secret_id = aws_secretsmanager_secret.stripe_keys.id
  secret_string = jsonencode({
    secret_key      = var.stripe_secret_key
    publishable_key = var.stripe_publishable_key
    webhook_secret  = var.stripe_webhook_secret
  })
}

# Cost Calculator Lambda
resource "aws_lambda_function" "cost_calculator" {
  filename         = "${path.module}/lambda/cost-calculator.zip"
  function_name    = "${var.project_name}-cost-calculator"
  role             = aws_iam_role.cost_calculator_lambda.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 60
  memory_size      = 512
  layers           = [var.aws_sdk_core_layer_arn, var.utilities_layer_arn]

  environment {
    variables = {
      BILLING_TABLE_NAME         = aws_dynamodb_table.billing.name
      PAYMENT_METHODS_TABLE_NAME = aws_dynamodb_table.payment_methods.name
      INVOICE_COUNTER_TABLE_NAME = aws_dynamodb_table.invoice_counter.name
      STRIPE_SECRET_ARN          = aws_secretsmanager_secret.stripe_keys.arn
      BASE_FEE                   = var.base_fee
      USER_POOL_ID               = var.user_pool_id
    }
  }
}

# EventBridge Scheduler Role
resource "aws_iam_role" "scheduler" {
  name = "${var.project_name}-billing-scheduler"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "scheduler.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "scheduler_invoke" {
  name = "${var.project_name}-scheduler-invoke"
  role = aws_iam_role.scheduler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "lambda:InvokeFunction"
      Resource = aws_lambda_function.cost_calculator.arn
    }]
  })
}

# EventBridge Scheduler - Monatliche Abrechnung (1. Tag des Monats um 00:00 UTC)
resource "aws_scheduler_schedule" "monthly_billing" {
  name       = "${var.project_name}-monthly-billing"
  group_name = "default"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression = "cron(0 0 1 * ? *)"

  target {
    arn      = aws_lambda_function.cost_calculator.arn
    role_arn = aws_iam_role.scheduler.arn

    input = jsonencode({
      action = "calculate_and_invoice"
    })
  }
}

# Lambda Permission für EventBridge
resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cost_calculator.function_name
  principal     = "scheduler.amazonaws.com"
  source_arn    = aws_scheduler_schedule.monthly_billing.arn
}

# Payment Setup Lambda (für Payment Element)
resource "aws_iam_role" "payment_setup_lambda" {
  name = "${var.project_name}-payment-setup-lambda"

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

resource "aws_iam_role_policy" "payment_setup_policy" {
  name = "${var.project_name}-payment-setup-policy"
  role = aws_iam_role.payment_setup_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem"
        ]
        Resource = aws_dynamodb_table.payment_methods.arn
      },
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
          "secretsmanager:GetSecretValue"
        ]
        Resource = aws_secretsmanager_secret.stripe_keys.arn
      },
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:AdminGetUser"
        ]
        Resource = "arn:aws:cognito-idp:*:*:userpool/*"
      }
    ]
  })
}

resource "aws_lambda_function" "payment_setup" {
  filename         = "${path.module}/lambda/payment-setup.zip"
  function_name    = "${var.project_name}-payment-setup"
  role             = aws_iam_role.payment_setup_lambda.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 30
  layers           = [var.aws_sdk_core_layer_arn, var.utilities_layer_arn]

  environment {
    variables = {
      PAYMENT_METHODS_TABLE_NAME = aws_dynamodb_table.payment_methods.name
      STRIPE_SECRET_ARN          = aws_secretsmanager_secret.stripe_keys.arn
      USER_POOL_ID               = var.user_pool_id
    }
  }
}

# Stripe Webhook Handler Lambda
resource "aws_iam_role" "webhook_lambda" {
  name = "${var.project_name}-stripe-webhook-lambda"

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

resource "aws_iam_role_policy" "webhook_policy" {
  name = "${var.project_name}-webhook-policy"
  role = aws_iam_role.webhook_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:UpdateItem",
          "dynamodb:GetItem"
        ]
        Resource = [
          aws_dynamodb_table.billing.arn,
          aws_dynamodb_table.payment_methods.arn
        ]
      },
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
          "secretsmanager:GetSecretValue"
        ]
        Resource = aws_secretsmanager_secret.stripe_keys.arn
      }
    ]
  })
}

resource "aws_lambda_function" "webhook_handler" {
  filename         = "${path.module}/lambda/webhook-handler.zip"
  function_name    = "${var.project_name}-stripe-webhook"
  role             = aws_iam_role.webhook_lambda.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 30
  layers           = [var.aws_sdk_core_layer_arn, var.utilities_layer_arn]

  environment {
    variables = {
      BILLING_TABLE_NAME         = aws_dynamodb_table.billing.name
      PAYMENT_METHODS_TABLE_NAME = aws_dynamodb_table.payment_methods.name
      STRIPE_SECRET_ARN          = aws_secretsmanager_secret.stripe_keys.arn
    }
  }
}

# API Gateway v2 Integration

# Cost Calculator Integration (GET /billing)
resource "aws_apigatewayv2_integration" "cost_calculator" {
  api_id           = var.api_gateway_id
  integration_type = "AWS_PROXY"

  integration_uri    = aws_lambda_function.cost_calculator.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "get_billing" {
  api_id             = var.api_gateway_id
  route_key          = "GET /billing"
  target             = "integrations/${aws_apigatewayv2_integration.cost_calculator.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

resource "aws_apigatewayv2_route" "create_invoice" {
  api_id             = var.api_gateway_id
  route_key          = "POST /billing/charge"
  target             = "integrations/${aws_apigatewayv2_integration.cost_calculator.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

# Payment Setup Integration (POST /billing/setup-intent)
resource "aws_apigatewayv2_integration" "payment_setup" {
  api_id           = var.api_gateway_id
  integration_type = "AWS_PROXY"

  integration_uri    = aws_lambda_function.payment_setup.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "create_setup_intent" {
  api_id             = var.api_gateway_id
  route_key          = "POST /billing/setup-intent"
  target             = "integrations/${aws_apigatewayv2_integration.payment_setup.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

resource "aws_apigatewayv2_route" "get_payment_status" {
  api_id             = var.api_gateway_id
  route_key          = "GET /billing/setup-intent"
  target             = "integrations/${aws_apigatewayv2_integration.payment_setup.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

# Webhook Integration (POST /billing/webhook - no auth)
resource "aws_apigatewayv2_integration" "webhook" {
  api_id           = var.api_gateway_id
  integration_type = "AWS_PROXY"

  integration_uri    = aws_lambda_function.webhook_handler.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "webhook" {
  api_id    = var.api_gateway_id
  route_key = "POST /billing/webhook"
  target    = "integrations/${aws_apigatewayv2_integration.webhook.id}"
}

# S3 Bucket für Invoice PDFs
resource "aws_s3_bucket" "invoices" {
  bucket = "${var.project_name}-invoices-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name = "${var.project_name}-invoices"
  }
}

resource "aws_s3_bucket_public_access_block" "invoices" {
  bucket = aws_s3_bucket.invoices.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "invoices" {
  bucket = aws_s3_bucket.invoices.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "PublicReadGetObject"
      Effect    = "Allow"
      Principal = "*"
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.invoices.arn}/*"
    }]
  })

  depends_on = [aws_s3_bucket_public_access_block.invoices]
}

# PDF Generator Lambda
resource "aws_iam_role" "pdf_generator_lambda" {
  name = "${var.project_name}-pdf-generator-lambda"

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

resource "aws_iam_role_policy" "pdf_generator_policy" {
  name = "${var.project_name}-pdf-generator-policy"
  role = aws_iam_role.pdf_generator_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem"
        ]
        Resource = aws_dynamodb_table.billing.arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl"
        ]
        Resource = "${aws_s3_bucket.invoices.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

resource "aws_lambda_function" "pdf_generator" {
  filename         = "${path.module}/lambda/pdf-generator.zip"
  function_name    = "${var.project_name}-pdf-generator"
  role             = aws_iam_role.pdf_generator_lambda.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 30
  memory_size      = 512
  layers           = [var.aws_sdk_core_layer_arn, var.utilities_layer_arn]

  environment {
    variables = {
      BILLING_TABLE_NAME = aws_dynamodb_table.billing.name
      INVOICES_BUCKET    = aws_s3_bucket.invoices.id
    }
  }
}

# API Gateway Integration für PDF Generator
resource "aws_apigatewayv2_integration" "pdf_generator" {
  api_id           = var.api_gateway_id
  integration_type = "AWS_PROXY"

  integration_uri    = aws_lambda_function.pdf_generator.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "download_invoice" {
  api_id             = var.api_gateway_id
  route_key          = "GET /billing/invoice/{invoiceId}/pdf"
  target             = "integrations/${aws_apigatewayv2_integration.pdf_generator.id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

# Lambda Permissions
resource "aws_lambda_permission" "api_gateway_cost_calculator" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cost_calculator.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gateway_payment_setup" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.payment_setup.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gateway_webhook" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.webhook_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gateway_pdf_generator" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.pdf_generator.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}
