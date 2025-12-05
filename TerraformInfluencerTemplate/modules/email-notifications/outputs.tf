output "lambda_function_arn" {
  description = "ARN of the email notifier Lambda function"
  value       = aws_lambda_function.email_notifier.arn
}

output "lambda_function_name" {
  description = "Name of the email notifier Lambda function"
  value       = aws_lambda_function.email_notifier.function_name
}
