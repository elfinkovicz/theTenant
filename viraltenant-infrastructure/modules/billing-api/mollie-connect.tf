# ============================================================
# MOLLIE CONNECT API GATEWAY ROUTES
# Creator → Mitglieder Abrechnung via OAuth
# ============================================================

# /billing/mollie/connect
resource "aws_api_gateway_resource" "billing_mollie_connect" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_mollie.id
  path_part   = "connect"
}

# /billing/mollie/connect/authorize
resource "aws_api_gateway_resource" "billing_mollie_connect_authorize" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_mollie_connect.id
  path_part   = "authorize"
}

# /billing/mollie/connect/authorize/{tenantId}
resource "aws_api_gateway_resource" "billing_mollie_connect_authorize_tenant" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_mollie_connect_authorize.id
  path_part   = "{tenantId}"
}

# /billing/mollie/connect/callback
resource "aws_api_gateway_resource" "billing_mollie_connect_callback" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_mollie_connect.id
  path_part   = "callback"
}

# /billing/mollie/connect/status
resource "aws_api_gateway_resource" "billing_mollie_connect_status" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_mollie_connect.id
  path_part   = "status"
}

# /billing/mollie/connect/status/{tenantId}
resource "aws_api_gateway_resource" "billing_mollie_connect_status_tenant" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_mollie_connect_status.id
  path_part   = "{tenantId}"
}

# /billing/mollie/connect/{tenantId} (for disconnect)
resource "aws_api_gateway_resource" "billing_mollie_connect_tenant" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_mollie_connect.id
  path_part   = "{tenantId}"
}

# /billing/mollie/connect/create-member-customer
resource "aws_api_gateway_resource" "billing_mollie_connect_create_member_customer" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_mollie_connect.id
  path_part   = "create-member-customer"
}

# /billing/mollie/connect/create-member-customer/{tenantId}
resource "aws_api_gateway_resource" "billing_mollie_connect_create_member_customer_tenant" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_mollie_connect_create_member_customer.id
  path_part   = "{tenantId}"
}

# /billing/mollie/connect/create-member-mandate
resource "aws_api_gateway_resource" "billing_mollie_connect_create_member_mandate" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_mollie_connect.id
  path_part   = "create-member-mandate"
}

# /billing/mollie/connect/create-member-mandate/{tenantId}
resource "aws_api_gateway_resource" "billing_mollie_connect_create_member_mandate_tenant" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_mollie_connect_create_member_mandate.id
  path_part   = "{tenantId}"
}

# /billing/mollie/connect/create-member-subscription
resource "aws_api_gateway_resource" "billing_mollie_connect_create_member_subscription" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_mollie_connect.id
  path_part   = "create-member-subscription"
}

# /billing/mollie/connect/create-member-subscription/{tenantId}
resource "aws_api_gateway_resource" "billing_mollie_connect_create_member_subscription_tenant" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_mollie_connect_create_member_subscription.id
  path_part   = "{tenantId}"
}

# /billing/mollie/connect/member-subscriptions
resource "aws_api_gateway_resource" "billing_mollie_connect_member_subscriptions" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_mollie_connect.id
  path_part   = "member-subscriptions"
}

# /billing/mollie/connect/member-subscriptions/{tenantId}
resource "aws_api_gateway_resource" "billing_mollie_connect_member_subscriptions_tenant" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_mollie_connect_member_subscriptions.id
  path_part   = "{tenantId}"
}

# /billing/mollie/connect/member-subscription
resource "aws_api_gateway_resource" "billing_mollie_connect_member_subscription" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_mollie_connect.id
  path_part   = "member-subscription"
}

# /billing/mollie/connect/member-subscription/{tenantId}
resource "aws_api_gateway_resource" "billing_mollie_connect_member_subscription_tenant" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_mollie_connect_member_subscription.id
  path_part   = "{tenantId}"
}

# /billing/mollie/connect/member-subscription/{tenantId}/{subscriptionId}
resource "aws_api_gateway_resource" "billing_mollie_connect_member_subscription_id" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_mollie_connect_member_subscription_tenant.id
  path_part   = "{subscriptionId}"
}

# /billing/mollie/connect/webhook
resource "aws_api_gateway_resource" "billing_mollie_connect_webhook" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.billing_mollie_connect.id
  path_part   = "webhook"
}

# ============================================================
# MOLLIE CONNECT API METHODS
# ============================================================

# POST /billing/mollie/connect/authorize/{tenantId}
resource "aws_api_gateway_method" "post_mollie_connect_authorize" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_mollie_connect_authorize_tenant.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_mollie_connect_authorize" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.billing_mollie_connect_authorize_tenant.id
  http_method             = aws_api_gateway_method.post_mollie_connect_authorize.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# GET /billing/mollie/connect/callback (No auth - Mollie redirects here)
resource "aws_api_gateway_method" "get_mollie_connect_callback" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_mollie_connect_callback.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_mollie_connect_callback" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.billing_mollie_connect_callback.id
  http_method             = aws_api_gateway_method.get_mollie_connect_callback.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# GET /billing/mollie/connect/status/{tenantId}
resource "aws_api_gateway_method" "get_mollie_connect_status" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_mollie_connect_status_tenant.id
  http_method   = "GET"
  authorization = "NONE"  # Public - just returns connection status
}

resource "aws_api_gateway_integration" "get_mollie_connect_status" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.billing_mollie_connect_status_tenant.id
  http_method             = aws_api_gateway_method.get_mollie_connect_status.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# DELETE /billing/mollie/connect/{tenantId}
resource "aws_api_gateway_method" "delete_mollie_connect" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_mollie_connect_tenant.id
  http_method   = "DELETE"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "delete_mollie_connect" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.billing_mollie_connect_tenant.id
  http_method             = aws_api_gateway_method.delete_mollie_connect.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# POST /billing/mollie/connect/create-member-customer/{tenantId}
resource "aws_api_gateway_method" "post_mollie_connect_create_member_customer" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_mollie_connect_create_member_customer_tenant.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_mollie_connect_create_member_customer" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.billing_mollie_connect_create_member_customer_tenant.id
  http_method             = aws_api_gateway_method.post_mollie_connect_create_member_customer.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# POST /billing/mollie/connect/create-member-mandate/{tenantId}
resource "aws_api_gateway_method" "post_mollie_connect_create_member_mandate" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_mollie_connect_create_member_mandate_tenant.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_mollie_connect_create_member_mandate" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.billing_mollie_connect_create_member_mandate_tenant.id
  http_method             = aws_api_gateway_method.post_mollie_connect_create_member_mandate.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# POST /billing/mollie/connect/create-member-subscription/{tenantId}
resource "aws_api_gateway_method" "post_mollie_connect_create_member_subscription" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_mollie_connect_create_member_subscription_tenant.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_mollie_connect_create_member_subscription" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.billing_mollie_connect_create_member_subscription_tenant.id
  http_method             = aws_api_gateway_method.post_mollie_connect_create_member_subscription.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# GET /billing/mollie/connect/member-subscriptions/{tenantId}
resource "aws_api_gateway_method" "get_mollie_connect_member_subscriptions" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_mollie_connect_member_subscriptions_tenant.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_mollie_connect_member_subscriptions" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.billing_mollie_connect_member_subscriptions_tenant.id
  http_method             = aws_api_gateway_method.get_mollie_connect_member_subscriptions.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# DELETE /billing/mollie/connect/member-subscription/{tenantId}/{subscriptionId}
resource "aws_api_gateway_method" "delete_mollie_connect_member_subscription" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_mollie_connect_member_subscription_id.id
  http_method   = "DELETE"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "delete_mollie_connect_member_subscription" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.billing_mollie_connect_member_subscription_id.id
  http_method             = aws_api_gateway_method.delete_mollie_connect_member_subscription.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# POST /billing/mollie/connect/webhook (No auth - Mollie calls this)
resource "aws_api_gateway_method" "post_mollie_connect_webhook" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_mollie_connect_webhook.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "post_mollie_connect_webhook" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.billing_mollie_connect_webhook.id
  http_method             = aws_api_gateway_method.post_mollie_connect_webhook.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.billing_api.invoke_arn
}

# ============================================================
# CORS FOR MOLLIE CONNECT ENDPOINTS
# ============================================================

# CORS for /billing/mollie/connect/authorize/{tenantId}
resource "aws_api_gateway_method" "mollie_connect_authorize_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_mollie_connect_authorize_tenant.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "mollie_connect_authorize_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_mollie_connect_authorize_tenant.id
  http_method = aws_api_gateway_method.mollie_connect_authorize_cors.http_method
  type        = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "mollie_connect_authorize_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_mollie_connect_authorize_tenant.id
  http_method = aws_api_gateway_method.mollie_connect_authorize_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "mollie_connect_authorize_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_mollie_connect_authorize_tenant.id
  http_method = aws_api_gateway_method.mollie_connect_authorize_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_integration.mollie_connect_authorize_cors]
}

# CORS for /billing/mollie/connect/status/{tenantId}
resource "aws_api_gateway_method" "mollie_connect_status_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_mollie_connect_status_tenant.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "mollie_connect_status_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_mollie_connect_status_tenant.id
  http_method = aws_api_gateway_method.mollie_connect_status_cors.http_method
  type        = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "mollie_connect_status_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_mollie_connect_status_tenant.id
  http_method = aws_api_gateway_method.mollie_connect_status_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "mollie_connect_status_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_mollie_connect_status_tenant.id
  http_method = aws_api_gateway_method.mollie_connect_status_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_integration.mollie_connect_status_cors]
}

# CORS for /billing/mollie/connect/{tenantId}
resource "aws_api_gateway_method" "mollie_connect_tenant_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_mollie_connect_tenant.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "mollie_connect_tenant_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_mollie_connect_tenant.id
  http_method = aws_api_gateway_method.mollie_connect_tenant_cors.http_method
  type        = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "mollie_connect_tenant_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_mollie_connect_tenant.id
  http_method = aws_api_gateway_method.mollie_connect_tenant_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "mollie_connect_tenant_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_mollie_connect_tenant.id
  http_method = aws_api_gateway_method.mollie_connect_tenant_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_integration.mollie_connect_tenant_cors]
}

# CORS for /billing/mollie/connect/member-subscriptions/{tenantId}
resource "aws_api_gateway_method" "mollie_connect_member_subscriptions_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.billing_mollie_connect_member_subscriptions_tenant.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "mollie_connect_member_subscriptions_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_mollie_connect_member_subscriptions_tenant.id
  http_method = aws_api_gateway_method.mollie_connect_member_subscriptions_cors.http_method
  type        = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "mollie_connect_member_subscriptions_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_mollie_connect_member_subscriptions_tenant.id
  http_method = aws_api_gateway_method.mollie_connect_member_subscriptions_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "mollie_connect_member_subscriptions_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.billing_mollie_connect_member_subscriptions_tenant.id
  http_method = aws_api_gateway_method.mollie_connect_member_subscriptions_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_integration.mollie_connect_member_subscriptions_cors]
}
