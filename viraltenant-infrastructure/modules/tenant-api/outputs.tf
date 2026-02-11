output "tenant_management_function_name" {
  description = "Name der Tenant Management Lambda Function"
  value       = aws_lambda_function.tenant_management.function_name
}

output "tenant_management_function_arn" {
  description = "ARN der Tenant Management Lambda Function"
  value       = aws_lambda_function.tenant_management.arn
}

output "tenants_resource_id" {
  description = "API Gateway resource ID for /tenants"
  value       = aws_api_gateway_resource.tenants.id
}

output "tenant_by_id_resource_id" {
  description = "API Gateway resource ID for /tenants/{tenantId}"
  value       = aws_api_gateway_resource.tenant_by_id.id
}