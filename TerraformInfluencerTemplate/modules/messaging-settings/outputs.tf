output "settings_table_name" {
  description = "DynamoDB table name for messaging settings"
  value       = aws_dynamodb_table.messaging_settings.name
}

output "settings_table_arn" {
  description = "DynamoDB table ARN for messaging settings"
  value       = aws_dynamodb_table.messaging_settings.arn
}

output "lambda_function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.messaging_settings_api.function_name
}
