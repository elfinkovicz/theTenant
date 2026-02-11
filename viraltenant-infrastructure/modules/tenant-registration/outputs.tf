output "tenant_registration_function_name" {
  description = "Name der Tenant Registration Lambda Funktion"
  value       = aws_lambda_function.tenant_registration.function_name
}

output "tenant_registration_function_arn" {
  description = "ARN der Tenant Registration Lambda Funktion"
  value       = aws_lambda_function.tenant_registration.arn
}

output "admin_api_endpoint" {
  description = "Admin API Endpoint für Tenant Registration"
  value       = "/admin/tenants"
}