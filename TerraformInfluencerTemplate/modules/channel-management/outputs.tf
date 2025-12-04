# Channel Management Module Outputs

output "dynamodb_table_name" {
  description = "Name of the DynamoDB table for channels"
  value       = aws_dynamodb_table.channels.name
}

output "lambda_function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.channel_api.function_name
}

output "lambda_function_arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.channel_api.arn
}
