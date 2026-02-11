# Central Auth Module Outputs

output "user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.main.id
}

output "user_pool_arn" {
  description = "Cognito User Pool ARN"
  value       = aws_cognito_user_pool.main.arn
}

output "client_id" {
  description = "Cognito User Pool Client ID"
  value       = aws_cognito_user_pool_client.main.id
}

output "api_gateway_url" {
  description = "API Gateway URL"
  value       = "https://${aws_api_gateway_rest_api.auth_api.id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment}"
}

output "api_gateway_id" {
  description = "API Gateway ID"
  value       = aws_api_gateway_rest_api.auth_api.id
}

output "lambda_function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.auth_handler.function_name
}

output "lambda_function_arn" {
  description = "Lambda function ARN"
  value       = aws_lambda_function.auth_handler.arn
}

output "user_groups" {
  description = "Created user groups"
  value = {
    user          = aws_cognito_user_group.user.name
    admin         = aws_cognito_user_group.admin.name
    billing_admin = aws_cognito_user_group.billing_admin.name
  }
}

output "api_gateway_execution_arn" {
  description = "API Gateway Execution ARN"
  value       = aws_api_gateway_rest_api.auth_api.execution_arn
}

output "api_gateway_root_resource_id" {
  description = "API Gateway Root Resource ID"
  value       = aws_api_gateway_rest_api.auth_api.root_resource_id
}