output "bucket_name" {
  description = "Name of the mobile app S3 bucket"
  value       = aws_s3_bucket.mobile_app.id
}

output "bucket_arn" {
  description = "ARN of the mobile app S3 bucket"
  value       = aws_s3_bucket.mobile_app.arn
}

output "bucket_regional_domain_name" {
  description = "Regional domain name of the bucket"
  value       = aws_s3_bucket.mobile_app.bucket_regional_domain_name
}

output "apk_base_url" {
  description = "Base URL for APK downloads"
  value       = "https://${aws_s3_bucket.mobile_app.bucket_regional_domain_name}"
}
