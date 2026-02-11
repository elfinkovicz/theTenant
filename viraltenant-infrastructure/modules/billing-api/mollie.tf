# ============================================================
# MOLLIE API GATEWAY ROUTES
# ============================================================

# /billing/mollie
resource "aws_api_gateway_resource" "billing_mollie" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing.id
  path_part   = "mollie"
}

# /billing/mollie/customer
resource "aws_api_gateway_resource" "billing_mollie_customer" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_mollie.id
  path_part   = "customer"
}

# /billing/mollie/customer/{tenantId}
resource "aws_api_gateway_resource" "billing_mollie_customer_tenant" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_mollie_customer.id
  path_part   = "{tenantId}"
}

# /billing/mollie/create-customer
resource "aws_api_gateway_resource" "billing_mollie_create_customer" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_mollie.id
  path_part   = "create-customer"
}

# /billing/mollie/create-customer/{tenantId}
resource "aws_api_gateway_resource" "billing_mollie_create_customer_tenant" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_mollie_create_customer.id
  path_part   = "{tenantId}"
}

# /billing/mollie/create-first-payment
resource "aws_api_gateway_resource" "billing_mollie_create_first_payment" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_mollie.id
  path_part   = "create-first-payment"
}

# /billing/mollie/create-first-payment/{tenantId}
resource "aws_api_gateway_resource" "billing_mollie_create_first_payment_tenant" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_mollie_create_first_payment.id
  path_part   = "{tenantId}"
}

# /billing/mollie/charge
resource "aws_api_gateway_resource" "billing_mollie_charge" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_mollie.id
  path_part   = "charge"
}

# /billing/mollie/charge/{tenantId}
resource "aws_api_gateway_resource" "billing_mollie_charge_tenant" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_mollie_charge.id
  path_part   = "{tenantId}"
}

# /billing/mollie/webhook
resource "aws_api_gateway_resource" "billing_mollie_webhook" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_mollie.id
  path_part   = "webhook"
}

# /billing/mollie/payments
resource "aws_api_gateway_resource" "billing_mollie_payments" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_mollie.id
  path_part   = "payments"
}

# /billing/mollie/payments/{tenantId}
resource "aws_api_gateway_resource" "billing_mollie_payments_tenant" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_mollie_payments.id
  path_part   = "{tenantId}"
}

# /billing/mollie/mandate
resource "aws_api_gateway_resource" "billing_mollie_mandate" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_mollie.id
  path_part   = "mandate"
}

# /billing/mollie/mandate/{tenantId}
resource "aws_api_gateway_resource" "billing_mollie_mandate_tenant" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_mollie_mandate.id
  path_part   = "{tenantId}"
}

# /billing/mollie/process-monthly
resource "aws_api_gateway_resource" "billing_mollie_process_monthly" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_mollie.id
  path_part   = "process-monthly"
}

# ============================================================
# MOLLIE API METHODS
# ============================================================

# GET /billing/mollie/customer/{tenantId}
resource "aws_api_gateway_method" "get_mollie_customer" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_mollie_customer_tenant.id
  http_method   = "GET"
  authorization = "NONE"  # Public endpoint for checking status
}

resource "aws_api_gateway_integration" "get_mollie_customer" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.billing_mollie_customer_tenant.id
  http_method             = aws_api_gateway_method.get_mollie_customer.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# POST /billing/mollie/create-customer/{tenantId}
resource "aws_api_gateway_method" "post_mollie_create_customer" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_mollie_create_customer_tenant.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_mollie_create_customer" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.billing_mollie_create_customer_tenant.id
  http_method             = aws_api_gateway_method.post_mollie_create_customer.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# POST /billing/mollie/create-first-payment/{tenantId}
resource "aws_api_gateway_method" "post_mollie_create_first_payment" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_mollie_create_first_payment_tenant.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_mollie_create_first_payment" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.billing_mollie_create_first_payment_tenant.id
  http_method             = aws_api_gateway_method.post_mollie_create_first_payment.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# POST /billing/mollie/charge/{tenantId}
resource "aws_api_gateway_method" "post_mollie_charge" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_mollie_charge_tenant.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_mollie_charge" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.billing_mollie_charge_tenant.id
  http_method             = aws_api_gateway_method.post_mollie_charge.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# POST /billing/mollie/webhook (No auth - Mollie calls this)
resource "aws_api_gateway_method" "post_mollie_webhook" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_mollie_webhook.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "post_mollie_webhook" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.billing_mollie_webhook.id
  http_method             = aws_api_gateway_method.post_mollie_webhook.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# GET /billing/mollie/payments/{tenantId}
resource "aws_api_gateway_method" "get_mollie_payments" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_mollie_payments_tenant.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_mollie_payments" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.billing_mollie_payments_tenant.id
  http_method             = aws_api_gateway_method.get_mollie_payments.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# DELETE /billing/mollie/mandate/{tenantId}
resource "aws_api_gateway_method" "delete_mollie_mandate" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_mollie_mandate_tenant.id
  http_method   = "DELETE"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "delete_mollie_mandate" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.billing_mollie_mandate_tenant.id
  http_method             = aws_api_gateway_method.delete_mollie_mandate.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# POST /billing/mollie/process-monthly (Admin/Cron only)
resource "aws_api_gateway_method" "post_mollie_process_monthly" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_mollie_process_monthly.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_mollie_process_monthly" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.billing_mollie_process_monthly.id
  http_method             = aws_api_gateway_method.post_mollie_process_monthly.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# ============================================================
# CORS FOR MOLLIE ENDPOINTS
# ============================================================

# CORS for /billing/mollie/create-customer/{tenantId}
resource "aws_api_gateway_method" "mollie_create_customer_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_mollie_create_customer_tenant.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "mollie_create_customer_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_mollie_create_customer_tenant.id
  http_method = aws_api_gateway_method.mollie_create_customer_cors.http_method
  type        = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "mollie_create_customer_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_mollie_create_customer_tenant.id
  http_method = aws_api_gateway_method.mollie_create_customer_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "mollie_create_customer_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_mollie_create_customer_tenant.id
  http_method = aws_api_gateway_method.mollie_create_customer_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_integration.mollie_create_customer_cors]
}

# CORS for /billing/mollie/charge/{tenantId}
resource "aws_api_gateway_method" "mollie_charge_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_mollie_charge_tenant.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "mollie_charge_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_mollie_charge_tenant.id
  http_method = aws_api_gateway_method.mollie_charge_cors.http_method
  type        = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "mollie_charge_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_mollie_charge_tenant.id
  http_method = aws_api_gateway_method.mollie_charge_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "mollie_charge_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_mollie_charge_tenant.id
  http_method = aws_api_gateway_method.mollie_charge_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_integration.mollie_charge_cors]
}

# CORS for /billing/mollie/customer/{tenantId}
resource "aws_api_gateway_method" "mollie_customer_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_mollie_customer_tenant.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "mollie_customer_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_mollie_customer_tenant.id
  http_method = aws_api_gateway_method.mollie_customer_cors.http_method
  type        = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "mollie_customer_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_mollie_customer_tenant.id
  http_method = aws_api_gateway_method.mollie_customer_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "mollie_customer_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_mollie_customer_tenant.id
  http_method = aws_api_gateway_method.mollie_customer_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_integration.mollie_customer_cors]
}

# CORS for /billing/mollie/create-first-payment/{tenantId}
resource "aws_api_gateway_method" "mollie_first_payment_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_mollie_create_first_payment_tenant.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "mollie_first_payment_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_mollie_create_first_payment_tenant.id
  http_method = aws_api_gateway_method.mollie_first_payment_cors.http_method
  type        = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "mollie_first_payment_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_mollie_create_first_payment_tenant.id
  http_method = aws_api_gateway_method.mollie_first_payment_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "mollie_first_payment_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_mollie_create_first_payment_tenant.id
  http_method = aws_api_gateway_method.mollie_first_payment_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_integration.mollie_first_payment_cors]
}

# CORS for /billing/mollie/mandate/{tenantId}
resource "aws_api_gateway_method" "mollie_mandate_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_mollie_mandate_tenant.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "mollie_mandate_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_mollie_mandate_tenant.id
  http_method = aws_api_gateway_method.mollie_mandate_cors.http_method
  type        = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "mollie_mandate_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_mollie_mandate_tenant.id
  http_method = aws_api_gateway_method.mollie_mandate_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "mollie_mandate_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_mollie_mandate_tenant.id
  http_method = aws_api_gateway_method.mollie_mandate_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_integration.mollie_mandate_cors]
}

# CORS for /billing/mollie/payments/{tenantId}
resource "aws_api_gateway_method" "mollie_payments_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_mollie_payments_tenant.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "mollie_payments_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_mollie_payments_tenant.id
  http_method = aws_api_gateway_method.mollie_payments_cors.http_method
  type        = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "mollie_payments_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_mollie_payments_tenant.id
  http_method = aws_api_gateway_method.mollie_payments_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "mollie_payments_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_mollie_payments_tenant.id
  http_method = aws_api_gateway_method.mollie_payments_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_integration.mollie_payments_cors]
}
