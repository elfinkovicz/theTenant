output "lambda_authorizer_function_name" {
  description = "Name der Lambda Authorizer Function"
  value       = aws_lambda_function.tenant_authorizer.function_name
}

output "lambda_authorizer_function_arn" {
  description = "ARN der Lambda Authorizer Function"
  value       = aws_lambda_function.tenant_authorizer.arn
}

output "lambda_authorizer_invoke_arn" {
  description = "Invoke ARN der Lambda Authorizer Function"
  value       = aws_lambda_function.tenant_authorizer.invoke_arn
}

output "lambda_authorizer_id" {
  description = "ID der Lambda Authorizer für API Gateway"
  value       = aws_api_gateway_authorizer.tenant_authorizer.id
}