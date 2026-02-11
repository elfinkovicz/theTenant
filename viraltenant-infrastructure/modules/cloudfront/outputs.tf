# CloudFront Module Outputs

output "s3_bucket_name" {
  description = "Name of the S3 bucket for website content"
  value       = aws_s3_bucket.website.bucket
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = aws_s3_bucket.website.arn
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.website.id
}

output "cloudfront_distribution_arn" {
  description = "CloudFront distribution ARN"
  value       = aws_cloudfront_distribution.website.arn
}

output "cloudfront_arn" {
  description = "CloudFront distribution ARN (alias)"
  value       = aws_cloudfront_distribution.website.arn
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.website.domain_name
}

output "cloudfront_hosted_zone_id" {
  description = "CloudFront distribution hosted zone ID"
  value       = aws_cloudfront_distribution.website.hosted_zone_id
}

output "website_url" {
  description = "Website URL"
  value       = var.enable_custom_domains && length(var.cloudfront_domains) > 0 ? "https://${var.cloudfront_domains[0]}" : "https://${aws_cloudfront_distribution.website.domain_name}"
}

output "ssl_certificate_arn" {
  description = "SSL certificate ARN (provided externally)"
  value       = var.ssl_certificate_arn
}