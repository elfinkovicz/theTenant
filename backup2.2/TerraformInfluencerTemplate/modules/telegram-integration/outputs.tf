output "lambda_function_name" {
  description = "Telegram notifier Lambda function name"
  value       = aws_lambda_function.telegram_notifier.function_name
}

output "lambda_function_arn" {
  description = "Telegram notifier Lambda function ARN"
  value       = aws_lambda_function.telegram_notifier.arn
}
