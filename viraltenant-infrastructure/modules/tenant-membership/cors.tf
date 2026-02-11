# ============================================================
# TENANT MEMBERSHIP - CORS CONFIGURATION
# ============================================================

locals {
  cors_headers = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
  cors_response = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,PUT,DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# CORS for /tenants/{tenantId}/membership/settings
resource "aws_api_gateway_method" "membership_settings_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.membership_settings.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "membership_settings_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.membership_settings.id
  http_method       = aws_api_gateway_method.membership_settings_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "membership_settings_cors" {
  rest_api_id         = var.api_gateway_id
  resource_id         = aws_api_gateway_resource.membership_settings.id
  http_method         = aws_api_gateway_method.membership_settings_cors.http_method
  status_code         = "200"
  response_parameters = local.cors_headers
}

resource "aws_api_gateway_integration_response" "membership_settings_cors" {
  rest_api_id         = var.api_gateway_id
  resource_id         = aws_api_gateway_resource.membership_settings.id
  http_method         = aws_api_gateway_method.membership_settings_cors.http_method
  status_code         = "200"
  response_parameters = local.cors_response
  depends_on          = [aws_api_gateway_integration.membership_settings_cors]
}

# CORS for /tenants/{tenantId}/membership/members
resource "aws_api_gateway_method" "membership_members_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.membership_members.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "membership_members_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.membership_members.id
  http_method       = aws_api_gateway_method.membership_members_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "membership_members_cors" {
  rest_api_id         = var.api_gateway_id
  resource_id         = aws_api_gateway_resource.membership_members.id
  http_method         = aws_api_gateway_method.membership_members_cors.http_method
  status_code         = "200"
  response_parameters = local.cors_headers
}

resource "aws_api_gateway_integration_response" "membership_members_cors" {
  rest_api_id         = var.api_gateway_id
  resource_id         = aws_api_gateway_resource.membership_members.id
  http_method         = aws_api_gateway_method.membership_members_cors.http_method
  status_code         = "200"
  response_parameters = local.cors_response
  depends_on          = [aws_api_gateway_integration.membership_members_cors]
}

# CORS for /tenants/{tenantId}/membership/payouts
resource "aws_api_gateway_method" "membership_payouts_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.membership_payouts.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "membership_payouts_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.membership_payouts.id
  http_method       = aws_api_gateway_method.membership_payouts_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "membership_payouts_cors" {
  rest_api_id         = var.api_gateway_id
  resource_id         = aws_api_gateway_resource.membership_payouts.id
  http_method         = aws_api_gateway_method.membership_payouts_cors.http_method
  status_code         = "200"
  response_parameters = local.cors_headers
}

resource "aws_api_gateway_integration_response" "membership_payouts_cors" {
  rest_api_id         = var.api_gateway_id
  resource_id         = aws_api_gateway_resource.membership_payouts.id
  http_method         = aws_api_gateway_method.membership_payouts_cors.http_method
  status_code         = "200"
  response_parameters = local.cors_response
  depends_on          = [aws_api_gateway_integration.membership_payouts_cors]
}

# CORS for /tenants/{tenantId}/membership/info
resource "aws_api_gateway_method" "membership_info_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.membership_info.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "membership_info_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.membership_info.id
  http_method       = aws_api_gateway_method.membership_info_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "membership_info_cors" {
  rest_api_id         = var.api_gateway_id
  resource_id         = aws_api_gateway_resource.membership_info.id
  http_method         = aws_api_gateway_method.membership_info_cors.http_method
  status_code         = "200"
  response_parameters = local.cors_headers
}

resource "aws_api_gateway_integration_response" "membership_info_cors" {
  rest_api_id         = var.api_gateway_id
  resource_id         = aws_api_gateway_resource.membership_info.id
  http_method         = aws_api_gateway_method.membership_info_cors.http_method
  status_code         = "200"
  response_parameters = local.cors_response
  depends_on          = [aws_api_gateway_integration.membership_info_cors]
}

# CORS for /tenants/{tenantId}/membership/subscribe
resource "aws_api_gateway_method" "membership_subscribe_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.membership_subscribe.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "membership_subscribe_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.membership_subscribe.id
  http_method       = aws_api_gateway_method.membership_subscribe_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "membership_subscribe_cors" {
  rest_api_id         = var.api_gateway_id
  resource_id         = aws_api_gateway_resource.membership_subscribe.id
  http_method         = aws_api_gateway_method.membership_subscribe_cors.http_method
  status_code         = "200"
  response_parameters = local.cors_headers
}

resource "aws_api_gateway_integration_response" "membership_subscribe_cors" {
  rest_api_id         = var.api_gateway_id
  resource_id         = aws_api_gateway_resource.membership_subscribe.id
  http_method         = aws_api_gateway_method.membership_subscribe_cors.http_method
  status_code         = "200"
  response_parameters = local.cors_response
  depends_on          = [aws_api_gateway_integration.membership_subscribe_cors]
}

# CORS for /tenants/{tenantId}/membership/my-status
resource "aws_api_gateway_method" "membership_my_status_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.membership_my_status.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "membership_my_status_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.membership_my_status.id
  http_method       = aws_api_gateway_method.membership_my_status_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "membership_my_status_cors" {
  rest_api_id         = var.api_gateway_id
  resource_id         = aws_api_gateway_resource.membership_my_status.id
  http_method         = aws_api_gateway_method.membership_my_status_cors.http_method
  status_code         = "200"
  response_parameters = local.cors_headers
}

resource "aws_api_gateway_integration_response" "membership_my_status_cors" {
  rest_api_id         = var.api_gateway_id
  resource_id         = aws_api_gateway_resource.membership_my_status.id
  http_method         = aws_api_gateway_method.membership_my_status_cors.http_method
  status_code         = "200"
  response_parameters = local.cors_response
  depends_on          = [aws_api_gateway_integration.membership_my_status_cors]
}

# CORS for /tenants/{tenantId}/membership/cancel
resource "aws_api_gateway_method" "membership_cancel_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.membership_cancel.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "membership_cancel_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.membership_cancel.id
  http_method       = aws_api_gateway_method.membership_cancel_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "membership_cancel_cors" {
  rest_api_id         = var.api_gateway_id
  resource_id         = aws_api_gateway_resource.membership_cancel.id
  http_method         = aws_api_gateway_method.membership_cancel_cors.http_method
  status_code         = "200"
  response_parameters = local.cors_headers
}

resource "aws_api_gateway_integration_response" "membership_cancel_cors" {
  rest_api_id         = var.api_gateway_id
  resource_id         = aws_api_gateway_resource.membership_cancel.id
  http_method         = aws_api_gateway_method.membership_cancel_cors.http_method
  status_code         = "200"
  response_parameters = local.cors_response
  depends_on          = [aws_api_gateway_integration.membership_cancel_cors]
}
