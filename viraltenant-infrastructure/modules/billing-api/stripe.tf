# ============================================================
# STRIPE INTEGRATION FOR TENANT BILLING
# ============================================================
# Handles: Subscriptions (30€/month), Usage-based billing, Payment Methods
# Tenant Isolation: Each tenant gets their own Stripe Customer

# Secrets Manager for Stripe API Keys
resource "aws_secretsmanager_secret" "stripe_secrets" {
  name        = "${var.platform_name}-stripe-secrets-${var.environment}"
  description = "Stripe API keys for tenant billing"

  tags = merge(var.tags, {
    Name = "${var.platform_name}-stripe-secrets"
    Type = "Billing"
  })
}

resource "aws_secretsmanager_secret_version" "stripe_secrets" {
  secret_id = aws_secretsmanager_secret.stripe_secrets.id
  secret_string = jsonencode({
    secret_key      = var.stripe_secret_key
    publishable_key = var.stripe_publishable_key
    webhook_secret  = var.stripe_webhook_secret
    price_id        = var.stripe_price_id
  })
}

# IAM Policy for Stripe Lambda to access Secrets Manager
resource "aws_iam_role_policy" "billing_api_secrets_policy" {
  name = "${var.platform_name}-billing-api-secrets-policy-${var.environment}"
  role = aws_iam_role.billing_api_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = aws_secretsmanager_secret.stripe_secrets.arn
      }
    ]
  })
}

# ============================================================
# STRIPE WEBHOOK LAMBDA
# ============================================================

# IAM Role for Stripe Webhook Lambda
resource "aws_iam_role" "stripe_webhook_role" {
  name = "${var.platform_name}-stripe-webhook-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "stripe_webhook_policy" {
  name = "${var.platform_name}-stripe-webhook-policy-${var.environment}"
  role = aws_iam_role.stripe_webhook_role.id

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
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query"
        ]
        Resource = [
          aws_dynamodb_table.billing.arn,
          "${aws_dynamodb_table.billing.arn}/index/*",
          aws_dynamodb_table.invoices.arn,
          "${aws_dynamodb_table.invoices.arn}/index/*",
          "arn:aws:dynamodb:${var.aws_region}:*:table/${var.platform_name}-tenants-${var.environment}",
          "arn:aws:dynamodb:${var.aws_region}:*:table/${var.platform_name}-tenants-${var.environment}/index/*"
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = aws_secretsmanager_secret.stripe_secrets.arn
      }
    ]
  })
}

# Stripe Webhook Lambda Function (uses common-deps layer)
resource "aws_lambda_function" "stripe_webhook" {
  filename         = "stripe_webhook.zip"
  source_code_hash = fileexists("stripe_webhook.zip") ? filebase64sha256("stripe_webhook.zip") : null
  function_name    = "${var.platform_name}-stripe-webhook-${var.environment}"
  role             = aws_iam_role.stripe_webhook_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 30
  memory_size      = 256
  layers           = [var.common_deps_layer_arn]

  environment {
    variables = {
      BILLING_TABLE    = aws_dynamodb_table.billing.name
      INVOICES_TABLE   = aws_dynamodb_table.invoices.name
      TENANTS_TABLE    = "${var.platform_name}-tenants-${var.environment}"
      STRIPE_SECRET_ID = aws_secretsmanager_secret.stripe_secrets.id
      REGION           = var.aws_region
    }
  }

  tags = merge(var.tags, {
    Name = "${var.platform_name}-stripe-webhook"
    Type = "Billing"
  })
}

# Lambda Permission for API Gateway
resource "aws_lambda_permission" "stripe_webhook_permission" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.stripe_webhook.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}

# ============================================================
# API GATEWAY RESOURCES FOR STRIPE
# ============================================================

# /billing/stripe resource
resource "aws_api_gateway_resource" "billing_stripe" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing.id
  path_part   = "stripe"
}

# /billing/stripe/webhook - Public endpoint for Stripe webhooks
resource "aws_api_gateway_resource" "stripe_webhook" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_stripe.id
  path_part   = "webhook"
}

resource "aws_api_gateway_method" "stripe_webhook_post" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.stripe_webhook.id
  http_method   = "POST"
  authorization = "NONE"  # Webhooks are verified via signature
}

resource "aws_api_gateway_integration" "stripe_webhook_post" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.stripe_webhook.id
  http_method             = aws_api_gateway_method.stripe_webhook_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.stripe_webhook.invoke_arn
}

# /billing/stripe/create-subscription/{tenantId}
resource "aws_api_gateway_resource" "stripe_create_subscription" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_stripe.id
  path_part   = "create-subscription"
}

resource "aws_api_gateway_resource" "stripe_create_subscription_tenant" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.stripe_create_subscription.id
  path_part   = "{tenantId}"
}

resource "aws_api_gateway_method" "stripe_create_subscription_post" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.stripe_create_subscription_tenant.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id

  request_parameters = {
    "method.request.path.tenantId" = true
  }
}

resource "aws_api_gateway_integration" "stripe_create_subscription_post" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.stripe_create_subscription_tenant.id
  http_method             = aws_api_gateway_method.stripe_create_subscription_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# /billing/stripe/cancel-subscription/{tenantId}
resource "aws_api_gateway_resource" "stripe_cancel_subscription" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_stripe.id
  path_part   = "cancel-subscription"
}

resource "aws_api_gateway_resource" "stripe_cancel_subscription_tenant" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.stripe_cancel_subscription.id
  path_part   = "{tenantId}"
}

resource "aws_api_gateway_method" "stripe_cancel_subscription_post" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.stripe_cancel_subscription_tenant.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id

  request_parameters = {
    "method.request.path.tenantId" = true
  }
}

resource "aws_api_gateway_integration" "stripe_cancel_subscription_post" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.stripe_cancel_subscription_tenant.id
  http_method             = aws_api_gateway_method.stripe_cancel_subscription_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# /billing/stripe/subscription/{tenantId} - GET subscription status
resource "aws_api_gateway_resource" "stripe_subscription" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_stripe.id
  path_part   = "subscription"
}

resource "aws_api_gateway_resource" "stripe_subscription_tenant" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.stripe_subscription.id
  path_part   = "{tenantId}"
}

resource "aws_api_gateway_method" "stripe_subscription_get" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.stripe_subscription_tenant.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id

  request_parameters = {
    "method.request.path.tenantId" = true
  }
}

resource "aws_api_gateway_integration" "stripe_subscription_get" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.stripe_subscription_tenant.id
  http_method             = aws_api_gateway_method.stripe_subscription_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# /billing/stripe/payment-method/{tenantId} - Manage payment methods
resource "aws_api_gateway_resource" "stripe_payment_method" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_stripe.id
  path_part   = "payment-method"
}

resource "aws_api_gateway_resource" "stripe_payment_method_tenant" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.stripe_payment_method.id
  path_part   = "{tenantId}"
}

# GET payment method
resource "aws_api_gateway_method" "stripe_payment_method_get" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.stripe_payment_method_tenant.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id

  request_parameters = {
    "method.request.path.tenantId" = true
  }
}

resource "aws_api_gateway_integration" "stripe_payment_method_get" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.stripe_payment_method_tenant.id
  http_method             = aws_api_gateway_method.stripe_payment_method_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# POST/PUT payment method (attach new payment method)
resource "aws_api_gateway_method" "stripe_payment_method_post" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.stripe_payment_method_tenant.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id

  request_parameters = {
    "method.request.path.tenantId" = true
  }
}

resource "aws_api_gateway_integration" "stripe_payment_method_post" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.stripe_payment_method_tenant.id
  http_method             = aws_api_gateway_method.stripe_payment_method_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# DELETE payment method
resource "aws_api_gateway_method" "stripe_payment_method_delete" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.stripe_payment_method_tenant.id
  http_method   = "DELETE"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id

  request_parameters = {
    "method.request.path.tenantId" = true
  }
}

resource "aws_api_gateway_integration" "stripe_payment_method_delete" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.stripe_payment_method_tenant.id
  http_method             = aws_api_gateway_method.stripe_payment_method_delete.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# /billing/stripe/add-usage/{tenantId} - Add usage-based charges
resource "aws_api_gateway_resource" "stripe_add_usage" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_stripe.id
  path_part   = "add-usage"
}

resource "aws_api_gateway_resource" "stripe_add_usage_tenant" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.stripe_add_usage.id
  path_part   = "{tenantId}"
}

resource "aws_api_gateway_method" "stripe_add_usage_post" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.stripe_add_usage_tenant.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id

  request_parameters = {
    "method.request.path.tenantId" = true
  }
}

resource "aws_api_gateway_integration" "stripe_add_usage_post" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.stripe_add_usage_tenant.id
  http_method             = aws_api_gateway_method.stripe_add_usage_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# /billing/stripe/invoices/{tenantId} - Get Stripe invoices
resource "aws_api_gateway_resource" "stripe_invoices" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_stripe.id
  path_part   = "invoices"
}

resource "aws_api_gateway_resource" "stripe_invoices_tenant" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.stripe_invoices.id
  path_part   = "{tenantId}"
}

resource "aws_api_gateway_method" "stripe_invoices_get" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.stripe_invoices_tenant.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id

  request_parameters = {
    "method.request.path.tenantId" = true
  }
}

resource "aws_api_gateway_integration" "stripe_invoices_get" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.stripe_invoices_tenant.id
  http_method             = aws_api_gateway_method.stripe_invoices_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# ============================================================
# CORS FOR STRIPE ENDPOINTS
# ============================================================

# CORS for /billing/stripe
resource "aws_api_gateway_method" "billing_stripe_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_stripe.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "billing_stripe_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_stripe.id
  http_method = aws_api_gateway_method.billing_stripe_cors.http_method
  type        = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "billing_stripe_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_stripe.id
  http_method = aws_api_gateway_method.billing_stripe_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "billing_stripe_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_stripe.id
  http_method = aws_api_gateway_method.billing_stripe_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,PUT,DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [
    aws_api_gateway_integration.billing_stripe_cors,
    aws_api_gateway_method_response.billing_stripe_cors
  ]
}

# CORS for /billing/stripe/subscription/{tenantId}
resource "aws_api_gateway_method" "stripe_subscription_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.stripe_subscription_tenant.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "stripe_subscription_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.stripe_subscription_tenant.id
  http_method = aws_api_gateway_method.stripe_subscription_cors.http_method
  type        = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "stripe_subscription_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.stripe_subscription_tenant.id
  http_method = aws_api_gateway_method.stripe_subscription_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "stripe_subscription_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.stripe_subscription_tenant.id
  http_method = aws_api_gateway_method.stripe_subscription_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [
    aws_api_gateway_integration.stripe_subscription_cors,
    aws_api_gateway_method_response.stripe_subscription_cors
  ]
}

# CORS for /billing/stripe/payment-method/{tenantId}
resource "aws_api_gateway_method" "stripe_payment_method_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.stripe_payment_method_tenant.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "stripe_payment_method_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.stripe_payment_method_tenant.id
  http_method = aws_api_gateway_method.stripe_payment_method_cors.http_method
  type        = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "stripe_payment_method_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.stripe_payment_method_tenant.id
  http_method = aws_api_gateway_method.stripe_payment_method_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "stripe_payment_method_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.stripe_payment_method_tenant.id
  http_method = aws_api_gateway_method.stripe_payment_method_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [
    aws_api_gateway_integration.stripe_payment_method_cors,
    aws_api_gateway_method_response.stripe_payment_method_cors
  ]
}

# CORS for /billing/stripe/create-subscription/{tenantId}
resource "aws_api_gateway_method" "stripe_create_subscription_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.stripe_create_subscription_tenant.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "stripe_create_subscription_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.stripe_create_subscription_tenant.id
  http_method = aws_api_gateway_method.stripe_create_subscription_cors.http_method
  type        = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "stripe_create_subscription_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.stripe_create_subscription_tenant.id
  http_method = aws_api_gateway_method.stripe_create_subscription_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "stripe_create_subscription_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.stripe_create_subscription_tenant.id
  http_method = aws_api_gateway_method.stripe_create_subscription_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [
    aws_api_gateway_integration.stripe_create_subscription_cors,
    aws_api_gateway_method_response.stripe_create_subscription_cors
  ]
}

# CORS for /billing/stripe/invoices/{tenantId}
resource "aws_api_gateway_method" "stripe_invoices_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.stripe_invoices_tenant.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "stripe_invoices_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.stripe_invoices_tenant.id
  http_method = aws_api_gateway_method.stripe_invoices_cors.http_method
  type        = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "stripe_invoices_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.stripe_invoices_tenant.id
  http_method = aws_api_gateway_method.stripe_invoices_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "stripe_invoices_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.stripe_invoices_tenant.id
  http_method = aws_api_gateway_method.stripe_invoices_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [
    aws_api_gateway_integration.stripe_invoices_cors,
    aws_api_gateway_method_response.stripe_invoices_cors
  ]
}

# ============================================================
# SETUP INTENT ENDPOINT
# ============================================================

# /billing/stripe/setup-intent
resource "aws_api_gateway_resource" "stripe_setup_intent" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_stripe.id
  path_part   = "setup-intent"
}

# /billing/stripe/setup-intent/{tenantId}
resource "aws_api_gateway_resource" "stripe_setup_intent_tenant" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.stripe_setup_intent.id
  path_part   = "{tenantId}"
}

# POST /billing/stripe/setup-intent/{tenantId}
resource "aws_api_gateway_method" "stripe_setup_intent_post" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.stripe_setup_intent_tenant.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id

  request_parameters = {
    "method.request.path.tenantId" = true
  }
}

resource "aws_api_gateway_integration" "stripe_setup_intent_post" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.stripe_setup_intent_tenant.id
  http_method             = aws_api_gateway_method.stripe_setup_intent_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# CORS for /billing/stripe/setup-intent/{tenantId}
resource "aws_api_gateway_method" "stripe_setup_intent_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.stripe_setup_intent_tenant.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "stripe_setup_intent_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.stripe_setup_intent_tenant.id
  http_method = aws_api_gateway_method.stripe_setup_intent_cors.http_method
  type        = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "stripe_setup_intent_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.stripe_setup_intent_tenant.id
  http_method = aws_api_gateway_method.stripe_setup_intent_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "stripe_setup_intent_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.stripe_setup_intent_tenant.id
  http_method = aws_api_gateway_method.stripe_setup_intent_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [
    aws_api_gateway_integration.stripe_setup_intent_cors,
    aws_api_gateway_method_response.stripe_setup_intent_cors
  ]
}
