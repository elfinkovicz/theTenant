output "hero_table_name" {
  description = "Name of the DynamoDB hero table"
  value       = aws_dynamodb_table.hero.name
}

output "hero_table_arn" {
  description = "ARN of the DynamoDB hero table"
  value       = aws_dynamodb_table.hero.arn
}

output "hero_lambda_function_name" {
  description = "Name of the hero Lambda function"
  value       = aws_lambda_function.hero_api.function_name
}

output "hero_lambda_function_arn" {
  description = "ARN of the hero Lambda function"
  value       = aws_lambda_function.hero_api.arn
}
