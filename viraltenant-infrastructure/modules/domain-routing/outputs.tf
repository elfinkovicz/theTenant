output "cloudfront_distribution_id" {
  description = "Multi-domain CloudFront distribution ID"
  value       = aws_cloudfront_distribution.multi_domain.id
}

output "cloudfront_domain_name" {
  description = "Multi-domain CloudFront domain name"
  value       = aws_cloudfront_distribution.multi_domain.domain_name
}

output "origin_access_identity_path" {
  description = "CloudFront Origin Access Identity path"
  value       = aws_cloudfront_origin_access_identity.multi_domain.cloudfront_access_identity_path
}