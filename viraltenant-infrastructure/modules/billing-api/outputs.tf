output "billing_table_name" {
  description = "Name der Billing DynamoDB Tabelle"
  value       = aws_dynamodb_table.billing.name
}

output "billing_table_arn" {
  description = "ARN der Billing DynamoDB Tabelle"
  value       = aws_dynamodb_table.billing.arn
}

output "invoices_table_name" {
  description = "Name der Invoices DynamoDB Tabelle"
  value       = aws_dynamodb_table.invoices.name
}

output "invoices_table_arn" {
  description = "ARN der Invoices DynamoDB Tabelle"
  value       = aws_dynamodb_table.invoices.arn
}

output "billing_api_function_name" {
  description = "Name der Billing API Lambda Funktion"
  value       = aws_lambda_function.billing_api.function_name
}

output "billing_api_function_arn" {
  description = "ARN der Billing API Lambda Funktion"
  value       = aws_lambda_function.billing_api.arn
}

# Stripe Webhook Outputs
output "stripe_webhook_function_name" {
  description = "Name der Stripe Webhook Lambda Funktion"
  value       = aws_lambda_function.stripe_webhook.function_name
}

output "stripe_webhook_function_arn" {
  description = "ARN der Stripe Webhook Lambda Funktion"
  value       = aws_lambda_function.stripe_webhook.arn
}

output "stripe_secrets_arn" {
  description = "ARN des Stripe Secrets in Secrets Manager"
  value       = aws_secretsmanager_secret.stripe_secrets.arn
}

output "stripe_webhook_endpoint" {
  description = "URL des Stripe Webhook Endpoints"
  value       = "https://${var.api_gateway_id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment}/billing/stripe/webhook"
}
