# ============================================================
# TENANT MEMBERSHIP - API GATEWAY ROUTES
# ============================================================

# /tenants/{tenantId}/membership
resource "aws_api_gateway_resource" "membership" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.tenant_by_id_resource_id
  path_part   = "membership"
}

# /tenants/{tenantId}/membership/settings
resource "aws_api_gateway_resource" "membership_settings" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.membership.id
  path_part   = "settings"
}

# /tenants/{tenantId}/membership/members
resource "aws_api_gateway_resource" "membership_members" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.membership.id
  path_part   = "members"
}

# /tenants/{tenantId}/membership/payouts
resource "aws_api_gateway_resource" "membership_payouts" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.membership.id
  path_part   = "payouts"
}

# /tenants/{tenantId}/membership/info (public)
resource "aws_api_gateway_resource" "membership_info" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.membership.id
  path_part   = "info"
}

# /tenants/{tenantId}/membership/subscribe
resource "aws_api_gateway_resource" "membership_subscribe" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.membership.id
  path_part   = "subscribe"
}

# /tenants/{tenantId}/membership/my-status
resource "aws_api_gateway_resource" "membership_my_status" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.membership.id
  path_part   = "my-status"
}

# /tenants/{tenantId}/membership/cancel
resource "aws_api_gateway_resource" "membership_cancel" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.membership.id
  path_part   = "cancel"
}

# /membership (root level for webhooks)
resource "aws_api_gateway_resource" "membership_root" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.api_gateway_root_resource_id
  path_part   = "membership"
}

# /membership/mollie
resource "aws_api_gateway_resource" "membership_mollie" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.membership_root.id
  path_part   = "mollie"
}

# /membership/mollie/webhook
resource "aws_api_gateway_resource" "membership_mollie_webhook" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.membership_mollie.id
  path_part   = "webhook"
}

# ============================================================
# ADMIN ENDPOINTS (Tenant-Betreiber)
# ============================================================

# GET /tenants/{tenantId}/membership/settings
resource "aws_api_gateway_method" "get_membership_settings" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.membership_settings.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_membership_settings" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.membership_settings.id
  http_method             = aws_api_gateway_method.get_membership_settings.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.membership_api.invoke_arn
}

# PUT /tenants/{tenantId}/membership/settings
resource "aws_api_gateway_method" "put_membership_settings" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.membership_settings.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_membership_settings" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.membership_settings.id
  http_method             = aws_api_gateway_method.put_membership_settings.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.membership_api.invoke_arn
}

# GET /tenants/{tenantId}/membership/members
resource "aws_api_gateway_method" "get_membership_members" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.membership_members.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_membership_members" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.membership_members.id
  http_method             = aws_api_gateway_method.get_membership_members.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.membership_api.invoke_arn
}

# GET /tenants/{tenantId}/membership/payouts
resource "aws_api_gateway_method" "get_membership_payouts" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.membership_payouts.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_membership_payouts" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.membership_payouts.id
  http_method             = aws_api_gateway_method.get_membership_payouts.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.membership_api.invoke_arn
}

# ============================================================
# USER ENDPOINTS (Mitglieder)
# ============================================================

# GET /tenants/{tenantId}/membership/info (PUBLIC - no auth)
resource "aws_api_gateway_method" "get_membership_info" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.membership_info.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_membership_info" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.membership_info.id
  http_method             = aws_api_gateway_method.get_membership_info.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.membership_api.invoke_arn
}

# POST /tenants/{tenantId}/membership/subscribe
resource "aws_api_gateway_method" "post_membership_subscribe" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.membership_subscribe.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_membership_subscribe" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.membership_subscribe.id
  http_method             = aws_api_gateway_method.post_membership_subscribe.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.membership_api.invoke_arn
}

# GET /tenants/{tenantId}/membership/my-status
resource "aws_api_gateway_method" "get_membership_my_status" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.membership_my_status.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_membership_my_status" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.membership_my_status.id
  http_method             = aws_api_gateway_method.get_membership_my_status.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.membership_api.invoke_arn
}

# POST /tenants/{tenantId}/membership/cancel
resource "aws_api_gateway_method" "post_membership_cancel" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.membership_cancel.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_membership_cancel" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.membership_cancel.id
  http_method             = aws_api_gateway_method.post_membership_cancel.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.membership_api.invoke_arn
}

# ============================================================
# WEBHOOK ENDPOINT (Mollie)
# ============================================================

# POST /membership/mollie/webhook (NO AUTH - Mollie calls this)
resource "aws_api_gateway_method" "post_membership_webhook" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.membership_mollie_webhook.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "post_membership_webhook" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.membership_mollie_webhook.id
  http_method             = aws_api_gateway_method.post_membership_webhook.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.membership_api.invoke_arn
}
