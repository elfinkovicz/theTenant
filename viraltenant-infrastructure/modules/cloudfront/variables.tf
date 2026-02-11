# CloudFront Module Variables

variable "platform_name" {
  description = "Platform name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment (prod, stage, dev)"
  type        = string
  default     = "prod"
}

variable "platform_domain" {
  description = "Primary platform domain"
  type        = string
}

variable "cloudfront_domains" {
  description = "List of domains for CloudFront distribution"
  type        = list(string)
  default     = []
}

variable "enable_custom_domains" {
  description = "Enable custom domains for CloudFront"
  type        = bool
  default     = true
}

variable "ssl_certificate_mode" {
  description = "SSL certificate mode: auto, manual, or none"
  type        = string
  default     = "auto"
  validation {
    condition     = contains(["auto", "manual", "none"], var.ssl_certificate_mode)
    error_message = "SSL certificate mode must be 'auto', 'manual', or 'none'."
  }
}

variable "ssl_certificate_arn" {
  description = "Manual SSL certificate ARN (required if ssl_certificate_mode = manual)"
  type        = string
  default     = ""
}

variable "default_ttl" {
  description = "Default TTL for CloudFront caching"
  type        = number
  default     = 86400
}

variable "max_ttl" {
  description = "Maximum TTL for CloudFront caching"
  type        = number
  default     = 31536000
}

variable "website_ttl" {
  description = "TTL for HTML files"
  type        = number
  default     = 3600
}

variable "compression" {
  description = "Enable CloudFront compression"
  type        = bool
  default     = true
}

variable "enable_versioning" {
  description = "Enable S3 versioning"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

variable "creator_assets_bucket_domain_name" {
  description = "Domain Name des Creator Assets S3 Buckets"
  type        = string
}

variable "creator_assets_oac_id" {
  description = "Origin Access Control ID für Creator Assets"
  type        = string
}

variable "creator_assets_ttl" {
  description = "TTL für Creator Assets caching"
  type        = number
  default     = 86400
}

variable "creator_assets_max_ttl" {
  description = "Maximum TTL für Creator Assets caching"
  type        = number
  default     = 31536000
}

variable "additional_cloudfront_arns" {
  description = "Additional CloudFront distribution ARNs that need access to the S3 bucket"
  type        = list(string)
  default     = []
}
