output "api_endpoint" {
  description = "API Gateway Endpoint"
  value       = aws_apigatewayv2_api.contact_form.api_endpoint
}

output "lambda_function_name" {
  description = "Lambda Function Name"
  value       = aws_lambda_function.contact_form.function_name
}

output "ses_domain_identity" {
  description = "SES Domain Identity"
  value       = var.verify_domain ? aws_ses_domain_identity.main[0].domain : null
}

output "ses_verification_token" {
  description = "SES Verification Token"
  value       = var.verify_domain ? aws_ses_domain_identity.main[0].verification_token : null
  sensitive   = true
}

output "dkim_tokens" {
  description = "DKIM Tokens"
  value       = var.verify_domain ? aws_ses_domain_dkim.main[0].dkim_tokens : []
}
