# Contact Info Management Module Outputs

output "dynamodb_table_name" {
  description = "Name of the DynamoDB table for contact info"
  value       = aws_dynamodb_table.contact_info.name
}

output "lambda_function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.contact_info_api.function_name
}

output "lambda_function_arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.contact_info_api.arn
}
