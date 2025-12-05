output "dynamodb_table" {
  description = "DynamoDB table for newsfeed"
  value       = aws_dynamodb_table.newsfeed.name
}

output "dynamodb_table_stream_arn" {
  description = "DynamoDB Stream ARN for newsfeed table"
  value       = aws_dynamodb_table.newsfeed.stream_arn
}

output "lambda_function_name" {
  description = "Newsfeed API Lambda function name"
  value       = aws_lambda_function.newsfeed_api.function_name
}
