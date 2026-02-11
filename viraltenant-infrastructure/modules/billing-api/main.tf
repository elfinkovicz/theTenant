# Billing API Module
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# DynamoDB Table für Billing-Daten
resource "aws_dynamodb_table" "billing" {
  name         = "${var.platform_name}-billing-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"

  attribute {
    name = "user_id"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = merge(var.tags, {
    Name = "${var.platform_name}-billing"
    Type = "Billing"
  })
}

# DynamoDB Table für Invoices
resource "aws_dynamodb_table" "invoices" {
  name         = "${var.platform_name}-invoices-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "invoice_id"

  attribute {
    name = "invoice_id"
    type = "S"
  }

  attribute {
    name = "user_id"
    type = "S"
  }

  global_secondary_index {
    name            = "user-id-index"
    hash_key        = "user_id"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = merge(var.tags, {
    Name = "${var.platform_name}-invoices"
    Type = "Billing"
  })
}

# S3 Bucket für Rechnungs-PDFs
resource "aws_s3_bucket" "invoices" {
  bucket = "${var.platform_name}-invoices-${var.environment}"

  tags = merge(var.tags, {
    Name = "${var.platform_name}-invoices"
    Type = "Billing"
  })
}

resource "aws_s3_bucket_public_access_block" "invoices" {
  bucket = aws_s3_bucket.invoices.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "invoices" {
  bucket = aws_s3_bucket.invoices.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "invoices" {
  bucket = aws_s3_bucket.invoices.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# IAM Role für Billing Lambda
resource "aws_iam_role" "billing_api_role" {
  name = "${var.platform_name}-billing-api-role-${var.environment}"

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

# IAM Policy für Billing Lambda
resource "aws_iam_role_policy" "billing_api_policy" {
  name = "${var.platform_name}-billing-api-policy-${var.environment}"
  role = aws_iam_role.billing_api_role.id

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
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.billing.arn,
          "${aws_dynamodb_table.billing.arn}/index/*",
          aws_dynamodb_table.invoices.arn,
          "${aws_dynamodb_table.invoices.arn}/index/*",
          "arn:aws:dynamodb:${var.aws_region}:*:table/${var.platform_name}-tenants-${var.environment}",
          "arn:aws:dynamodb:${var.aws_region}:*:table/${var.platform_name}-tenants-${var.environment}/index/*",
          "arn:aws:dynamodb:${var.aws_region}:*:table/${var.platform_name}-tenant-live-${var.environment}",
          "arn:aws:dynamodb:${var.aws_region}:*:table/${var.platform_name}-tenant-live-${var.environment}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.invoices.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = [
          "${aws_s3_bucket.invoices.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ce:GetCostAndUsage",
          "ce:GetCostForecast"
        ]
        Resource = "*"
      }
    ]
  })
}

# Lambda Function für Billing API
resource "aws_lambda_function" "billing_api" {
  filename         = "billing_api.zip"
  source_code_hash = filebase64sha256("billing_api.zip")
  function_name    = "${var.platform_name}-billing-api-${var.environment}"
  role             = aws_iam_role.billing_api_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 60
  memory_size      = 512
  layers           = [var.common_deps_layer_arn]

  environment {
    variables = {
      BILLING_TABLE    = aws_dynamodb_table.billing.name
      INVOICES_TABLE   = aws_dynamodb_table.invoices.name
      INVOICES_BUCKET  = aws_s3_bucket.invoices.id
      TENANTS_TABLE    = "${var.platform_name}-tenants-${var.environment}"
      TENANT_LIVE_TABLE = "${var.platform_name}-tenant-live-${var.environment}"
      REGION           = var.aws_region
      STRIPE_SECRET_ID = aws_secretsmanager_secret.stripe_secrets.id
      MOLLIE_API_KEY   = var.mollie_api_key
      API_BASE_URL     = "https://${var.api_domain}"
      # Mollie Connect (OAuth) für Creator Mitglieder-Abrechnung
      MOLLIE_CLIENT_ID     = var.mollie_client_id
      MOLLIE_CLIENT_SECRET = var.mollie_client_secret
      MOLLIE_REDIRECT_URI  = var.mollie_redirect_uri != "" ? var.mollie_redirect_uri : "https://viraltenant.com/mollie-callback"
      MOLLIE_PROFILE_ID    = var.mollie_profile_id
      MOLLIE_TEST_API_KEY  = var.mollie_api_key
    }
  }

  tags = merge(var.tags, {
    Name = "${var.platform_name}-billing-api"
    Type = "BillingAPI"
  })

  depends_on = [aws_iam_role_policy.billing_api_policy]
}

# API Gateway Resource für Billing
resource "aws_api_gateway_resource" "billing" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.api_gateway_root_resource_id
  path_part   = "billing"
}

# Billing Estimate Resource
resource "aws_api_gateway_resource" "billing_estimate" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing.id
  path_part   = "estimate"
}

resource "aws_api_gateway_resource" "billing_estimate_tenant" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_estimate.id
  path_part   = "{tenantId}"
}

# Billing Setup Intent Resource
resource "aws_api_gateway_resource" "billing_setup_intent" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing.id
  path_part   = "setup-intent"
}

# Billing Charge Resource
resource "aws_api_gateway_resource" "billing_charge" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing.id
  path_part   = "charge"
}

# Billing Invoice Resource (legacy)
resource "aws_api_gateway_resource" "billing_invoice" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing.id
  path_part   = "invoice"
}

resource "aws_api_gateway_resource" "billing_invoice_id" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_invoice.id
  path_part   = "{invoiceId}"
}

resource "aws_api_gateway_resource" "billing_invoice_pdf" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_invoice_id.id
  path_part   = "pdf"
}

# Billing Invoices Resource (new - /billing/invoices/{tenantId})
resource "aws_api_gateway_resource" "billing_invoices" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing.id
  path_part   = "invoices"
}

resource "aws_api_gateway_resource" "billing_invoices_tenant" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_invoices.id
  path_part   = "{tenantId}"
}

resource "aws_api_gateway_resource" "billing_invoices_tenant_invoice" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_invoices_tenant.id
  path_part   = "{invoiceId}"
}

resource "aws_api_gateway_resource" "billing_invoices_tenant_invoice_pdf" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_invoices_tenant_invoice.id
  path_part   = "pdf"
}

# Billing Payment Method Resource (/billing/payment-method/{tenantId})
resource "aws_api_gateway_resource" "billing_payment_method" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing.id
  path_part   = "payment-method"
}

resource "aws_api_gateway_resource" "billing_payment_method_tenant" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_payment_method.id
  path_part   = "{tenantId}"
}

# Billing Setup Intent with Tenant (/billing/setup-intent/{tenantId})
resource "aws_api_gateway_resource" "billing_setup_intent_tenant" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_setup_intent.id
  path_part   = "{tenantId}"
}

# Billing Charge with Tenant (/billing/charge/{tenantId})
resource "aws_api_gateway_resource" "billing_charge_tenant" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_charge.id
  path_part   = "{tenantId}"
}

# GET /billing
resource "aws_api_gateway_method" "get_billing" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_billing" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_method.get_billing.resource_id
  http_method             = aws_api_gateway_method.get_billing.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# GET /billing/estimate/{tenantId}
resource "aws_api_gateway_method" "get_billing_estimate" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_estimate_tenant.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id

  request_parameters = {
    "method.request.path.tenantId"     = true
    "method.request.querystring.month" = false
  }
}

resource "aws_api_gateway_integration" "get_billing_estimate" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_method.get_billing_estimate.resource_id
  http_method             = aws_api_gateway_method.get_billing_estimate.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# GET /billing/setup-intent
resource "aws_api_gateway_method" "get_billing_setup_intent" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_setup_intent.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_billing_setup_intent" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_method.get_billing_setup_intent.resource_id
  http_method             = aws_api_gateway_method.get_billing_setup_intent.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# POST /billing/setup-intent
resource "aws_api_gateway_method" "post_billing_setup_intent" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_setup_intent.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_billing_setup_intent" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_method.post_billing_setup_intent.resource_id
  http_method             = aws_api_gateway_method.post_billing_setup_intent.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# POST /billing/charge
resource "aws_api_gateway_method" "post_billing_charge" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_charge.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_billing_charge" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_method.post_billing_charge.resource_id
  http_method             = aws_api_gateway_method.post_billing_charge.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# GET /billing/invoice/{invoiceId}/pdf
resource "aws_api_gateway_method" "get_billing_invoice_pdf" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_invoice_pdf.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_billing_invoice_pdf" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_method.get_billing_invoice_pdf.resource_id
  http_method             = aws_api_gateway_method.get_billing_invoice_pdf.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# GET /billing/invoices/{tenantId}
resource "aws_api_gateway_method" "get_billing_invoices_tenant" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_invoices_tenant.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id

  request_parameters = {
    "method.request.path.tenantId" = true
  }
}

resource "aws_api_gateway_integration" "get_billing_invoices_tenant" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_method.get_billing_invoices_tenant.resource_id
  http_method             = aws_api_gateway_method.get_billing_invoices_tenant.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# GET /billing/invoices/{tenantId}/{invoiceId}/pdf
resource "aws_api_gateway_method" "get_billing_invoices_tenant_pdf" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_invoices_tenant_invoice_pdf.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id

  request_parameters = {
    "method.request.path.tenantId"  = true
    "method.request.path.invoiceId" = true
  }
}

resource "aws_api_gateway_integration" "get_billing_invoices_tenant_pdf" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_method.get_billing_invoices_tenant_pdf.resource_id
  http_method             = aws_api_gateway_method.get_billing_invoices_tenant_pdf.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# GET /billing/payment-method/{tenantId}
resource "aws_api_gateway_method" "get_billing_payment_method" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_payment_method_tenant.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id

  request_parameters = {
    "method.request.path.tenantId" = true
  }
}

resource "aws_api_gateway_integration" "get_billing_payment_method" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_method.get_billing_payment_method.resource_id
  http_method             = aws_api_gateway_method.get_billing_payment_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# POST /billing/setup-intent/{tenantId}
resource "aws_api_gateway_method" "post_billing_setup_intent_tenant" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_setup_intent_tenant.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id

  request_parameters = {
    "method.request.path.tenantId" = true
  }
}

resource "aws_api_gateway_integration" "post_billing_setup_intent_tenant" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_method.post_billing_setup_intent_tenant.resource_id
  http_method             = aws_api_gateway_method.post_billing_setup_intent_tenant.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# POST /billing/charge/{tenantId}
resource "aws_api_gateway_method" "post_billing_charge_tenant" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_charge_tenant.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id

  request_parameters = {
    "method.request.path.tenantId" = true
  }
}

resource "aws_api_gateway_integration" "post_billing_charge_tenant" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_method.post_billing_charge_tenant.resource_id
  http_method             = aws_api_gateway_method.post_billing_charge_tenant.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# CORS für alle Billing-Endpunkte
resource "aws_api_gateway_method" "billing_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "billing_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_method.billing_cors.resource_id
  http_method = aws_api_gateway_method.billing_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_method_response" "billing_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing.id
  http_method = aws_api_gateway_method.billing_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "billing_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing.id
  http_method = aws_api_gateway_method.billing_cors.http_method
  status_code = aws_api_gateway_method_response.billing_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# CORS für /billing/setup-intent
resource "aws_api_gateway_method" "billing_setup_intent_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_setup_intent.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "billing_setup_intent_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_method.billing_setup_intent_cors.resource_id
  http_method = aws_api_gateway_method.billing_setup_intent_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_method_response" "billing_setup_intent_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_setup_intent.id
  http_method = aws_api_gateway_method.billing_setup_intent_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "billing_setup_intent_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_setup_intent.id
  http_method = aws_api_gateway_method.billing_setup_intent_cors.http_method
  status_code = aws_api_gateway_method_response.billing_setup_intent_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# CORS für /billing/charge
resource "aws_api_gateway_method" "billing_charge_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_charge.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "billing_charge_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_method.billing_charge_cors.resource_id
  http_method = aws_api_gateway_method.billing_charge_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_method_response" "billing_charge_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_charge.id
  http_method = aws_api_gateway_method.billing_charge_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "billing_charge_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_charge.id
  http_method = aws_api_gateway_method.billing_charge_cors.http_method
  status_code = aws_api_gateway_method_response.billing_charge_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# CORS für /billing/invoices/{tenantId}
resource "aws_api_gateway_method" "billing_invoices_tenant_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_invoices_tenant.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "billing_invoices_tenant_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_method.billing_invoices_tenant_cors.resource_id
  http_method = aws_api_gateway_method.billing_invoices_tenant_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_method_response" "billing_invoices_tenant_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_invoices_tenant.id
  http_method = aws_api_gateway_method.billing_invoices_tenant_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "billing_invoices_tenant_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_invoices_tenant.id
  http_method = aws_api_gateway_method.billing_invoices_tenant_cors.http_method
  status_code = aws_api_gateway_method_response.billing_invoices_tenant_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# CORS für /billing/invoices/{tenantId}/{invoiceId}/pdf
resource "aws_api_gateway_method" "billing_invoices_tenant_pdf_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_invoices_tenant_invoice_pdf.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "billing_invoices_tenant_pdf_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_method.billing_invoices_tenant_pdf_cors.resource_id
  http_method = aws_api_gateway_method.billing_invoices_tenant_pdf_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_method_response" "billing_invoices_tenant_pdf_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_invoices_tenant_invoice_pdf.id
  http_method = aws_api_gateway_method.billing_invoices_tenant_pdf_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "billing_invoices_tenant_pdf_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_invoices_tenant_invoice_pdf.id
  http_method = aws_api_gateway_method.billing_invoices_tenant_pdf_cors.http_method
  status_code = aws_api_gateway_method_response.billing_invoices_tenant_pdf_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# CORS für /billing/payment-method/{tenantId}
resource "aws_api_gateway_method" "billing_payment_method_tenant_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_payment_method_tenant.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "billing_payment_method_tenant_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_method.billing_payment_method_tenant_cors.resource_id
  http_method = aws_api_gateway_method.billing_payment_method_tenant_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_method_response" "billing_payment_method_tenant_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_payment_method_tenant.id
  http_method = aws_api_gateway_method.billing_payment_method_tenant_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "billing_payment_method_tenant_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_payment_method_tenant.id
  http_method = aws_api_gateway_method.billing_payment_method_tenant_cors.http_method
  status_code = aws_api_gateway_method_response.billing_payment_method_tenant_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# CORS für /billing/setup-intent/{tenantId}
resource "aws_api_gateway_method" "billing_setup_intent_tenant_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_setup_intent_tenant.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "billing_setup_intent_tenant_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_method.billing_setup_intent_tenant_cors.resource_id
  http_method = aws_api_gateway_method.billing_setup_intent_tenant_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_method_response" "billing_setup_intent_tenant_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_setup_intent_tenant.id
  http_method = aws_api_gateway_method.billing_setup_intent_tenant_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "billing_setup_intent_tenant_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_setup_intent_tenant.id
  http_method = aws_api_gateway_method.billing_setup_intent_tenant_cors.http_method
  status_code = aws_api_gateway_method_response.billing_setup_intent_tenant_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# CORS für /billing/charge/{tenantId}
resource "aws_api_gateway_method" "billing_charge_tenant_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_charge_tenant.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "billing_charge_tenant_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_method.billing_charge_tenant_cors.resource_id
  http_method = aws_api_gateway_method.billing_charge_tenant_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_method_response" "billing_charge_tenant_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_charge_tenant.id
  http_method = aws_api_gateway_method.billing_charge_tenant_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "billing_charge_tenant_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_charge_tenant.id
  http_method = aws_api_gateway_method.billing_charge_tenant_cors.http_method
  status_code = aws_api_gateway_method_response.billing_charge_tenant_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# Lambda Permission für API Gateway
resource "aws_lambda_permission" "billing_api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.billing_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}

# ============================================================
# PayPal Billing Endpoints
# ============================================================

# /billing/paypal
resource "aws_api_gateway_resource" "billing_paypal" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing.id
  path_part   = "paypal"
}

# /billing/paypal/create-order
resource "aws_api_gateway_resource" "billing_paypal_create_order" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_paypal.id
  path_part   = "create-order"
}

# /billing/paypal/create-order/{tenantId}
resource "aws_api_gateway_resource" "billing_paypal_create_order_tenant" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_paypal_create_order.id
  path_part   = "{tenantId}"
}

# /billing/paypal/capture
resource "aws_api_gateway_resource" "billing_paypal_capture" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_paypal.id
  path_part   = "capture"
}

# /billing/paypal/capture/{tenantId}
resource "aws_api_gateway_resource" "billing_paypal_capture_tenant" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_paypal_capture.id
  path_part   = "{tenantId}"
}

# /billing/payment-methods
resource "aws_api_gateway_resource" "billing_payment_methods" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing.id
  path_part   = "payment-methods"
}

# /billing/payment-methods/{tenantId}
resource "aws_api_gateway_resource" "billing_payment_methods_tenant" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_payment_methods.id
  path_part   = "{tenantId}"
}

# POST /billing/paypal/create-order/{tenantId}
resource "aws_api_gateway_method" "post_billing_paypal_create_order" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_paypal_create_order_tenant.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id

  request_parameters = {
    "method.request.path.tenantId" = true
  }
}

resource "aws_api_gateway_integration" "post_billing_paypal_create_order" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_method.post_billing_paypal_create_order.resource_id
  http_method             = aws_api_gateway_method.post_billing_paypal_create_order.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# POST /billing/paypal/capture/{tenantId}
resource "aws_api_gateway_method" "post_billing_paypal_capture" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_paypal_capture_tenant.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id

  request_parameters = {
    "method.request.path.tenantId" = true
  }
}

resource "aws_api_gateway_integration" "post_billing_paypal_capture" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_method.post_billing_paypal_capture.resource_id
  http_method             = aws_api_gateway_method.post_billing_paypal_capture.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# GET /billing/payment-methods/{tenantId}
resource "aws_api_gateway_method" "get_billing_payment_methods" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_payment_methods_tenant.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id

  request_parameters = {
    "method.request.path.tenantId" = true
  }
}

resource "aws_api_gateway_integration" "get_billing_payment_methods" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_method.get_billing_payment_methods.resource_id
  http_method             = aws_api_gateway_method.get_billing_payment_methods.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# CORS für /billing/paypal/create-order/{tenantId}
resource "aws_api_gateway_method" "billing_paypal_create_order_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_paypal_create_order_tenant.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "billing_paypal_create_order_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_method.billing_paypal_create_order_cors.resource_id
  http_method = aws_api_gateway_method.billing_paypal_create_order_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({ statusCode = 200 })
  }
}

resource "aws_api_gateway_method_response" "billing_paypal_create_order_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_paypal_create_order_tenant.id
  http_method = aws_api_gateway_method.billing_paypal_create_order_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "billing_paypal_create_order_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_paypal_create_order_tenant.id
  http_method = aws_api_gateway_method.billing_paypal_create_order_cors.http_method
  status_code = aws_api_gateway_method_response.billing_paypal_create_order_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# CORS für /billing/paypal/capture/{tenantId}
resource "aws_api_gateway_method" "billing_paypal_capture_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_paypal_capture_tenant.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "billing_paypal_capture_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_method.billing_paypal_capture_cors.resource_id
  http_method = aws_api_gateway_method.billing_paypal_capture_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({ statusCode = 200 })
  }
}

resource "aws_api_gateway_method_response" "billing_paypal_capture_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_paypal_capture_tenant.id
  http_method = aws_api_gateway_method.billing_paypal_capture_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "billing_paypal_capture_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_paypal_capture_tenant.id
  http_method = aws_api_gateway_method.billing_paypal_capture_cors.http_method
  status_code = aws_api_gateway_method_response.billing_paypal_capture_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# CORS für /billing/payment-methods/{tenantId}
resource "aws_api_gateway_method" "billing_payment_methods_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_payment_methods_tenant.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "billing_payment_methods_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_method.billing_payment_methods_cors.resource_id
  http_method = aws_api_gateway_method.billing_payment_methods_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({ statusCode = 200 })
  }
}

resource "aws_api_gateway_method_response" "billing_payment_methods_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_payment_methods_tenant.id
  http_method = aws_api_gateway_method.billing_payment_methods_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "billing_payment_methods_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_payment_methods_tenant.id
  http_method = aws_api_gateway_method.billing_payment_methods_cors.http_method
  status_code = aws_api_gateway_method_response.billing_payment_methods_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}


# ============================================================
# Paddle Payment Routes
# ============================================================

# /billing/paddle
resource "aws_api_gateway_resource" "billing_paddle" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing.id
  path_part   = "paddle"
}

# /billing/paddle/create-transaction
resource "aws_api_gateway_resource" "billing_paddle_create_transaction" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_paddle.id
  path_part   = "create-transaction"
}

# /billing/paddle/create-transaction/{tenantId}
resource "aws_api_gateway_resource" "billing_paddle_create_transaction_tenant" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_paddle_create_transaction.id
  path_part   = "{tenantId}"
}

# POST /billing/paddle/create-transaction/{tenantId}
resource "aws_api_gateway_method" "post_billing_paddle_create_transaction" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_paddle_create_transaction_tenant.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id

  request_parameters = {
    "method.request.path.tenantId" = true
  }
}

resource "aws_api_gateway_integration" "post_billing_paddle_create_transaction" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.billing_paddle_create_transaction_tenant.id
  http_method             = aws_api_gateway_method.post_billing_paddle_create_transaction.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# CORS für /billing/paddle/create-transaction/{tenantId}
resource "aws_api_gateway_method" "billing_paddle_create_transaction_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_paddle_create_transaction_tenant.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "billing_paddle_create_transaction_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_paddle_create_transaction_tenant.id
  http_method = aws_api_gateway_method.billing_paddle_create_transaction_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "billing_paddle_create_transaction_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_paddle_create_transaction_tenant.id
  http_method = aws_api_gateway_method.billing_paddle_create_transaction_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "billing_paddle_create_transaction_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_paddle_create_transaction_tenant.id
  http_method = aws_api_gateway_method.billing_paddle_create_transaction_cors.http_method
  status_code = aws_api_gateway_method_response.billing_paddle_create_transaction_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# /billing/paddle/verify
resource "aws_api_gateway_resource" "billing_paddle_verify" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_paddle.id
  path_part   = "verify"
}

# /billing/paddle/verify/{tenantId}
resource "aws_api_gateway_resource" "billing_paddle_verify_tenant" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_paddle_verify.id
  path_part   = "{tenantId}"
}

# POST /billing/paddle/verify/{tenantId}
resource "aws_api_gateway_method" "post_billing_paddle_verify" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_paddle_verify_tenant.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id

  request_parameters = {
    "method.request.path.tenantId" = true
  }
}

resource "aws_api_gateway_integration" "post_billing_paddle_verify" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.billing_paddle_verify_tenant.id
  http_method             = aws_api_gateway_method.post_billing_paddle_verify.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# CORS für /billing/paddle/verify/{tenantId}
resource "aws_api_gateway_method" "billing_paddle_verify_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_paddle_verify_tenant.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "billing_paddle_verify_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_paddle_verify_tenant.id
  http_method = aws_api_gateway_method.billing_paddle_verify_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "billing_paddle_verify_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_paddle_verify_tenant.id
  http_method = aws_api_gateway_method.billing_paddle_verify_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "billing_paddle_verify_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_paddle_verify_tenant.id
  http_method = aws_api_gateway_method.billing_paddle_verify_cors.http_method
  status_code = aws_api_gateway_method_response.billing_paddle_verify_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.billing_paddle_verify_cors]
}


# ============================================================
# Paddle Subscription Routes
# ============================================================

# /billing/paddle/subscription
resource "aws_api_gateway_resource" "billing_paddle_subscription" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_paddle.id
  path_part   = "subscription"
}

# /billing/paddle/subscription/{tenantId}
resource "aws_api_gateway_resource" "billing_paddle_subscription_tenant" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_paddle_subscription.id
  path_part   = "{tenantId}"
}

# PUT /billing/paddle/subscription/{tenantId}
resource "aws_api_gateway_method" "put_billing_paddle_subscription" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_paddle_subscription_tenant.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id

  request_parameters = {
    "method.request.path.tenantId" = true
  }
}

resource "aws_api_gateway_integration" "put_billing_paddle_subscription" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.billing_paddle_subscription_tenant.id
  http_method             = aws_api_gateway_method.put_billing_paddle_subscription.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# GET /billing/paddle/subscription/{tenantId}
resource "aws_api_gateway_method" "get_billing_paddle_subscription" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_paddle_subscription_tenant.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id

  request_parameters = {
    "method.request.path.tenantId" = true
  }
}

resource "aws_api_gateway_integration" "get_billing_paddle_subscription" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.billing_paddle_subscription_tenant.id
  http_method             = aws_api_gateway_method.get_billing_paddle_subscription.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# CORS für /billing/paddle/subscription/{tenantId}
resource "aws_api_gateway_method" "billing_paddle_subscription_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_paddle_subscription_tenant.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "billing_paddle_subscription_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_paddle_subscription_tenant.id
  http_method = aws_api_gateway_method.billing_paddle_subscription_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "billing_paddle_subscription_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_paddle_subscription_tenant.id
  http_method = aws_api_gateway_method.billing_paddle_subscription_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "billing_paddle_subscription_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_paddle_subscription_tenant.id
  http_method = aws_api_gateway_method.billing_paddle_subscription_cors.http_method
  status_code = aws_api_gateway_method_response.billing_paddle_subscription_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,PUT,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.billing_paddle_subscription_cors]
}

# /billing/paddle/add-aws-costs
resource "aws_api_gateway_resource" "billing_paddle_add_aws_costs" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_paddle.id
  path_part   = "add-aws-costs"
}

# /billing/paddle/add-aws-costs/{tenantId}
resource "aws_api_gateway_resource" "billing_paddle_add_aws_costs_tenant" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_paddle_add_aws_costs.id
  path_part   = "{tenantId}"
}

# POST /billing/paddle/add-aws-costs/{tenantId}
resource "aws_api_gateway_method" "post_billing_paddle_add_aws_costs" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_paddle_add_aws_costs_tenant.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id

  request_parameters = {
    "method.request.path.tenantId" = true
  }
}

resource "aws_api_gateway_integration" "post_billing_paddle_add_aws_costs" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.billing_paddle_add_aws_costs_tenant.id
  http_method             = aws_api_gateway_method.post_billing_paddle_add_aws_costs.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# CORS für /billing/paddle/add-aws-costs/{tenantId}
resource "aws_api_gateway_method" "billing_paddle_add_aws_costs_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_paddle_add_aws_costs_tenant.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "billing_paddle_add_aws_costs_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_paddle_add_aws_costs_tenant.id
  http_method = aws_api_gateway_method.billing_paddle_add_aws_costs_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "billing_paddle_add_aws_costs_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_paddle_add_aws_costs_tenant.id
  http_method = aws_api_gateway_method.billing_paddle_add_aws_costs_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "billing_paddle_add_aws_costs_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_paddle_add_aws_costs_tenant.id
  http_method = aws_api_gateway_method.billing_paddle_add_aws_costs_cors.http_method
  status_code = aws_api_gateway_method_response.billing_paddle_add_aws_costs_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.billing_paddle_add_aws_costs_cors]
}

# /billing/paddle/process-monthly
resource "aws_api_gateway_resource" "billing_paddle_process_monthly" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_paddle.id
  path_part   = "process-monthly"
}

# POST /billing/paddle/process-monthly (für Cron-Job)
resource "aws_api_gateway_method" "post_billing_paddle_process_monthly" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_paddle_process_monthly.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_billing_paddle_process_monthly" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.billing_paddle_process_monthly.id
  http_method             = aws_api_gateway_method.post_billing_paddle_process_monthly.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# CORS für /billing/paddle/process-monthly
resource "aws_api_gateway_method" "billing_paddle_process_monthly_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_paddle_process_monthly.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "billing_paddle_process_monthly_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_paddle_process_monthly.id
  http_method = aws_api_gateway_method.billing_paddle_process_monthly_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "billing_paddle_process_monthly_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_paddle_process_monthly.id
  http_method = aws_api_gateway_method.billing_paddle_process_monthly_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "billing_paddle_process_monthly_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_paddle_process_monthly.id
  http_method = aws_api_gateway_method.billing_paddle_process_monthly_cors.http_method
  status_code = aws_api_gateway_method_response.billing_paddle_process_monthly_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.billing_paddle_process_monthly_cors]
}

# ============================================================
# ADMIN ENDPOINTS - For Billing Dashboard
# ============================================================

# /billing/admin
resource "aws_api_gateway_resource" "billing_admin" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing.id
  path_part   = "admin"
}

# /billing/admin/tenants
resource "aws_api_gateway_resource" "billing_admin_tenants" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_admin.id
  path_part   = "tenants"
}

# /billing/admin/invoices
resource "aws_api_gateway_resource" "billing_admin_invoices" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_admin.id
  path_part   = "invoices"
}

# GET /billing/admin/tenants
resource "aws_api_gateway_method" "get_billing_admin_tenants" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_admin_tenants.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_billing_admin_tenants" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.billing_admin_tenants.id
  http_method             = aws_api_gateway_method.get_billing_admin_tenants.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# GET /billing/admin/invoices
resource "aws_api_gateway_method" "get_billing_admin_invoices" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_admin_invoices.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_billing_admin_invoices" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.billing_admin_invoices.id
  http_method             = aws_api_gateway_method.get_billing_admin_invoices.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# CORS für /billing/admin/tenants
resource "aws_api_gateway_method" "billing_admin_tenants_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_admin_tenants.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "billing_admin_tenants_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_admin_tenants.id
  http_method = aws_api_gateway_method.billing_admin_tenants_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "billing_admin_tenants_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_admin_tenants.id
  http_method = aws_api_gateway_method.billing_admin_tenants_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "billing_admin_tenants_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_admin_tenants.id
  http_method = aws_api_gateway_method.billing_admin_tenants_cors.http_method
  status_code = aws_api_gateway_method_response.billing_admin_tenants_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.billing_admin_tenants_cors]
}

# CORS für /billing/admin/invoices
resource "aws_api_gateway_method" "billing_admin_invoices_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_admin_invoices.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "billing_admin_invoices_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_admin_invoices.id
  http_method = aws_api_gateway_method.billing_admin_invoices_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "billing_admin_invoices_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_admin_invoices.id
  http_method = aws_api_gateway_method.billing_admin_invoices_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "billing_admin_invoices_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_admin_invoices.id
  http_method = aws_api_gateway_method.billing_admin_invoices_cors.http_method
  status_code = aws_api_gateway_method_response.billing_admin_invoices_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.billing_admin_invoices_cors]
}

# ============================================================
# /billing/admin/tenants/{tenantId} - Single tenant operations
# ============================================================

resource "aws_api_gateway_resource" "billing_admin_tenant_id" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_admin_tenants.id
  path_part   = "{tenantId}"
}

# GET /billing/admin/tenants/{tenantId}
resource "aws_api_gateway_method" "get_billing_admin_tenant" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_admin_tenant_id.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_billing_admin_tenant" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.billing_admin_tenant_id.id
  http_method             = aws_api_gateway_method.get_billing_admin_tenant.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# DELETE /billing/admin/tenants/{tenantId}
resource "aws_api_gateway_method" "delete_billing_admin_tenant" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_admin_tenant_id.id
  http_method   = "DELETE"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "delete_billing_admin_tenant" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.billing_admin_tenant_id.id
  http_method             = aws_api_gateway_method.delete_billing_admin_tenant.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# CORS für /billing/admin/tenants/{tenantId}
resource "aws_api_gateway_method" "billing_admin_tenant_id_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_admin_tenant_id.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "billing_admin_tenant_id_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_admin_tenant_id.id
  http_method = aws_api_gateway_method.billing_admin_tenant_id_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "billing_admin_tenant_id_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_admin_tenant_id.id
  http_method = aws_api_gateway_method.billing_admin_tenant_id_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "billing_admin_tenant_id_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_admin_tenant_id.id
  http_method = aws_api_gateway_method.billing_admin_tenant_id_cors.http_method
  status_code = aws_api_gateway_method_response.billing_admin_tenant_id_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.billing_admin_tenant_id_cors]
}

# ============================================================
# /billing/admin/tenants/{tenantId}/status - Tenant status operations
# ============================================================

resource "aws_api_gateway_resource" "billing_admin_tenant_status" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_admin_tenant_id.id
  path_part   = "status"
}

# PUT /billing/admin/tenants/{tenantId}/status
resource "aws_api_gateway_method" "put_billing_admin_tenant_status" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_admin_tenant_status.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_billing_admin_tenant_status" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.billing_admin_tenant_status.id
  http_method             = aws_api_gateway_method.put_billing_admin_tenant_status.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# CORS für /billing/admin/tenants/{tenantId}/status
resource "aws_api_gateway_method" "billing_admin_tenant_status_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_admin_tenant_status.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "billing_admin_tenant_status_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_admin_tenant_status.id
  http_method = aws_api_gateway_method.billing_admin_tenant_status_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "billing_admin_tenant_status_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_admin_tenant_status.id
  http_method = aws_api_gateway_method.billing_admin_tenant_status_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "billing_admin_tenant_status_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_admin_tenant_status.id
  http_method = aws_api_gateway_method.billing_admin_tenant_status_cors.http_method
  status_code = aws_api_gateway_method_response.billing_admin_tenant_status_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'PUT,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.billing_admin_tenant_status_cors]
}
