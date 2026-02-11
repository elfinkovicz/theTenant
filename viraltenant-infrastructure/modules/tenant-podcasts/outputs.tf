# Tenant Podcasts Module Outputs

output "tenant_podcasts_table_name" {
  value = aws_dynamodb_table.tenant_podcasts.name
}

output "tenant_podcasts_table_arn" {
  value = aws_dynamodb_table.tenant_podcasts.arn
}

output "tenant_podcasts_lambda_arn" {
  value = aws_lambda_function.tenant_podcasts.arn
}

output "tenant_podcasts_lambda_name" {
  value = aws_lambda_function.tenant_podcasts.function_name
}
