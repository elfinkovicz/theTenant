output "creator_assets_bucket_name" {
  description = "Name des Creator Assets S3 Buckets"
  value       = aws_s3_bucket.creator_assets.bucket
}

output "creator_assets_bucket_arn" {
  description = "ARN des Creator Assets S3 Buckets"
  value       = aws_s3_bucket.creator_assets.arn
}

output "creator_assets_bucket_domain_name" {
  description = "Domain Name des Creator Assets S3 Buckets"
  value       = aws_s3_bucket.creator_assets.bucket_regional_domain_name
}

output "upload_temp_bucket_name" {
  description = "Name des Upload Temp S3 Buckets"
  value       = aws_s3_bucket.upload_temp.bucket
}

output "upload_temp_bucket_arn" {
  description = "ARN des Upload Temp S3 Buckets"
  value       = aws_s3_bucket.upload_temp.arn
}

output "creator_assets_oac_id" {
  description = "ID der CloudFront Origin Access Control für Creator Assets"
  value       = aws_cloudfront_origin_access_control.creator_assets.id
}

output "asset_management_role_arn" {
  description = "ARN der IAM Role für Asset Management"
  value       = aws_iam_role.asset_management_role.arn
}