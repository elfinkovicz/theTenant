# API Gateway v2 (HTTP API) Integration für Stream Restreaming
# Verwendet die bestehende API Gateway vom User Auth Modul

# Lambda Integration
resource "aws_apigatewayv2_integration" "stream_restreaming" {
  api_id           = var.api_gateway_id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.stream_restreaming.invoke_arn
  payload_format_version = "2.0"
}

# Routes
# GET /stream-destinations
resource "aws_apigatewayv2_route" "get_destinations" {
  api_id    = var.api_gateway_id
  route_key = "GET /stream-destinations"
  target    = "integrations/${aws_apigatewayv2_integration.stream_restreaming.id}"
  authorization_type = "JWT"
  authorizer_id = var.authorizer_id
}

# POST /stream-destinations
resource "aws_apigatewayv2_route" "create_destination" {
  api_id    = var.api_gateway_id
  route_key = "POST /stream-destinations"
  target    = "integrations/${aws_apigatewayv2_integration.stream_restreaming.id}"
  authorization_type = "JWT"
  authorizer_id = var.authorizer_id
}

# PUT /stream-destinations/{id}
resource "aws_apigatewayv2_route" "update_destination" {
  api_id    = var.api_gateway_id
  route_key = "PUT /stream-destinations/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.stream_restreaming.id}"
  authorization_type = "JWT"
  authorizer_id = var.authorizer_id
}

# DELETE /stream-destinations/{id}
resource "aws_apigatewayv2_route" "delete_destination" {
  api_id    = var.api_gateway_id
  route_key = "DELETE /stream-destinations/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.stream_restreaming.id}"
  authorization_type = "JWT"
  authorizer_id = var.authorizer_id
}

# POST /stream-destinations/{id}/start
resource "aws_apigatewayv2_route" "start_restreaming" {
  api_id    = var.api_gateway_id
  route_key = "POST /stream-destinations/{id}/start"
  target    = "integrations/${aws_apigatewayv2_integration.stream_restreaming.id}"
  authorization_type = "JWT"
  authorizer_id = var.authorizer_id
}

# POST /stream-destinations/{id}/stop
resource "aws_apigatewayv2_route" "stop_restreaming" {
  api_id    = var.api_gateway_id
  route_key = "POST /stream-destinations/{id}/stop"
  target    = "integrations/${aws_apigatewayv2_integration.stream_restreaming.id}"
  authorization_type = "JWT"
  authorizer_id = var.authorizer_id
}
