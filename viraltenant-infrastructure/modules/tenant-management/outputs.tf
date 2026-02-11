output "tenants_table_name" {
  description = "Name der Tenants DynamoDB Tabelle"
  value       = aws_dynamodb_table.tenants.name
}

output "tenants_table_arn" {
  description = "ARN der Tenants DynamoDB Tabelle"
  value       = aws_dynamodb_table.tenants.arn
}

output "user_tenants_table_name" {
  description = "Name der User-Tenants DynamoDB Tabelle"
  value       = aws_dynamodb_table.user_tenants.name
}

output "user_tenants_table_arn" {
  description = "ARN der User-Tenants DynamoDB Tabelle"
  value       = aws_dynamodb_table.user_tenants.arn
}

output "assets_table_name" {
  description = "Name der Assets DynamoDB Tabelle"
  value       = aws_dynamodb_table.assets.name
}

output "assets_table_arn" {
  description = "ARN der Assets DynamoDB Tabelle"
  value       = aws_dynamodb_table.assets.arn
}