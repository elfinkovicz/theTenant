output "lambda_function_name" {
  description = "Name der Lambda Function"
  value       = aws_lambda_function.stream_restreaming.function_name
}

output "lambda_function_arn" {
  description = "ARN der Lambda Function"
  value       = aws_lambda_function.stream_restreaming.arn
}

output "lambda_invoke_arn" {
  description = "Invoke ARN der Lambda Function"
  value       = aws_lambda_function.stream_restreaming.invoke_arn
}

output "destinations_table_name" {
  description = "Name der DynamoDB Tabelle"
  value       = aws_dynamodb_table.streaming_destinations.name
}

output "medialive_role_arn" {
  description = "ARN der MediaLive IAM Role"
  value       = aws_iam_role.medialive.arn
}
