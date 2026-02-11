output "tenant_frontend_table_name" {
  description = "DynamoDB table name for tenant frontend configuration"
  value       = aws_dynamodb_table.tenant_frontend.name
}

output "tenant_frontend_table_arn" {
  description = "DynamoDB table ARN for tenant frontend configuration"
  value       = aws_dynamodb_table.tenant_frontend.arn
}

output "tenant_frontend_function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.tenant_frontend.function_name
}

output "tenant_frontend_function_arn" {
  description = "Lambda function ARN"
  value       = aws_lambda_function.tenant_frontend.arn
}

output "hero_resource_id" {
  description = "API Gateway resource ID for /tenants/{tenantId}/hero"
  value       = aws_api_gateway_resource.hero.id
}
