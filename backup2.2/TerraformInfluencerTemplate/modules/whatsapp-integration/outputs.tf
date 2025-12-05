output "lambda_function_name" {
  description = "WhatsApp notifier Lambda function name"
  value       = aws_lambda_function.whatsapp_notifier.function_name
}

output "lambda_function_arn" {
  description = "WhatsApp notifier Lambda function ARN"
  value       = aws_lambda_function.whatsapp_notifier.arn
}
