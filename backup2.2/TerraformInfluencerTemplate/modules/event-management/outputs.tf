output "dynamodb_table" {
  description = "DynamoDB table for events"
  value       = aws_dynamodb_table.events.name
}

output "lambda_function_name" {
  description = "Event API Lambda function name"
  value       = aws_lambda_function.event_api.function_name
}
