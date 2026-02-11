variable "creator_assets_bucket_name" {
  description = "Name des Creator Assets S3 Buckets"
  type        = string
}

variable "creator_assets_bucket_arn" {
  description = "ARN des Creator Assets S3 Buckets"
  type        = string
}

variable "cloudfront_distribution_arn" {
  description = "ARN der CloudFront Distribution"
  type        = string
}

variable "additional_cloudfront_arns" {
  description = "Additional CloudFront distribution ARNs that need access to the bucket"
  type        = list(string)
  default     = []
}