output "advertisements_table_name" {
  description = "Name of the DynamoDB advertisements table"
  value       = aws_dynamodb_table.advertisements.name
}

output "advertisements_table_arn" {
  description = "ARN of the DynamoDB advertisements table"
  value       = aws_dynamodb_table.advertisements.arn
}

output "ad_lambda_function_name" {
  description = "Name of the advertisement Lambda function"
  value       = aws_lambda_function.ad_api.function_name
}

output "ad_lambda_function_arn" {
  description = "ARN of the advertisement Lambda function"
  value       = aws_lambda_function.ad_api.arn
}
