# Legal Management Module Outputs

output "dynamodb_table_name" {
  description = "Name of the DynamoDB table for legal documents"
  value       = aws_dynamodb_table.legal_docs.name
}

output "lambda_function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.legal_api.function_name
}

output "lambda_function_arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.legal_api.arn
}
