output "billing_table_name" {
  description = "DynamoDB Billing Table Name"
  value       = aws_dynamodb_table.billing.name
}

output "payment_methods_table_name" {
  description = "DynamoDB Payment Methods Table Name"
  value       = aws_dynamodb_table.payment_methods.name
}

output "cost_calculator_function_name" {
  description = "Cost Calculator Lambda Function Name"
  value       = aws_lambda_function.cost_calculator.function_name
}

output "webhook_url" {
  description = "Stripe Webhook URL"
  value       = "${var.api_gateway_id}/billing/webhook"
}

output "stripe_publishable_key" {
  description = "Stripe Publishable Key (für Frontend)"
  value       = var.stripe_publishable_key
}

output "invoices_bucket_name" {
  description = "S3 Bucket for Invoice PDFs"
  value       = aws_s3_bucket.invoices.id
}

output "pdf_generator_function_name" {
  description = "PDF Generator Lambda Function Name"
  value       = aws_lambda_function.pdf_generator.function_name
}
