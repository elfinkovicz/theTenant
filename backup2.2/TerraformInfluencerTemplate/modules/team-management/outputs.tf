output "dynamodb_table" {
  description = "DynamoDB table for team members"
  value       = aws_dynamodb_table.team_members.name
}

output "lambda_function_name" {
  description = "Team API Lambda function name"
  value       = aws_lambda_function.team_api.function_name
}
