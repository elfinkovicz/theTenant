output "videos_table_name" {
  description = "DynamoDB videos table name"
  value       = aws_dynamodb_table.videos.name
}

output "videos_bucket_name" {
  description = "S3 videos bucket name"
  value       = aws_s3_bucket.videos.id
}

output "thumbnails_bucket_name" {
  description = "S3 thumbnails bucket name"
  value       = aws_s3_bucket.thumbnails.id
}

output "thumbnails_cdn_url" {
  description = "CloudFront CDN URL for thumbnails"
  value       = "https://${aws_cloudfront_distribution.thumbnails.domain_name}"
}

output "video_api_lambda_arn" {
  description = "Video API Lambda ARN"
  value       = aws_lambda_function.video_api.arn
}

output "admin_group_name" {
  description = "Cognito admin group name"
  value       = aws_cognito_user_group.admins.name
}
