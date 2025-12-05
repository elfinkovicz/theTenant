output "user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.main.id
}

output "user_pool_arn" {
  description = "Cognito User Pool ARN"
  value       = aws_cognito_user_pool.main.arn
}

output "client_id" {
  description = "Cognito App Client ID"
  value       = aws_cognito_user_pool_client.main.id
}

output "cognito_domain" {
  description = "Cognito Domain"
  value       = aws_cognito_user_pool_domain.main.domain
}

output "user_table_name" {
  description = "DynamoDB User Table Name"
  value       = aws_dynamodb_table.users.name
}

output "api_endpoint" {
  description = "User API Endpoint"
  value       = aws_apigatewayv2_api.user_api.api_endpoint
}

output "api_gateway_id" {
  description = "API Gateway ID"
  value       = aws_apigatewayv2_api.user_api.id
}

output "api_gateway_execution_arn" {
  description = "API Gateway Execution ARN"
  value       = aws_apigatewayv2_api.user_api.execution_arn
}

output "authorizer_id" {
  description = "JWT Authorizer ID"
  value       = aws_apigatewayv2_authorizer.jwt.id
}
