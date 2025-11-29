output "api_endpoint" {
  description = "Sponsor API Endpoint"
  value       = aws_apigatewayv2_stage.sponsor_api.invoke_url
}

output "sponsors_table_name" {
  description = "DynamoDB Sponsors Table Name"
  value       = aws_dynamodb_table.sponsors.name
}

output "sponsors_table_arn" {
  description = "DynamoDB Sponsors Table ARN"
  value       = aws_dynamodb_table.sponsors.arn
}

output "stats_table_name" {
  description = "DynamoDB Stats Table Name"
  value       = aws_dynamodb_table.sponsor_stats.name
}

output "assets_bucket_name" {
  description = "S3 Assets Bucket Name"
  value       = aws_s3_bucket.sponsor_assets.id
}

output "assets_bucket_url" {
  description = "S3 Assets Bucket URL"
  value       = "https://${aws_s3_bucket.sponsor_assets.bucket_regional_domain_name}"
}
