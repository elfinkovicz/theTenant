# Variables für Domain Routing Edge Module

variable "environment" {
  description = "Environment name (production, staging, etc.)"
  type        = string
  default     = "production"
}

variable "tenants_table_name" {
  description = "Name der DynamoDB Tenants Tabelle"
  type        = string
  default     = "viraltenant-tenants-production"
}

variable "website_bucket_domain" {
  description = "Domain des S3 Buckets für Website"
  type        = string
  example     = "viraltenant-website-production.s3.eu-central-1.amazonaws.com"
}

variable "origin_access_identity" {
  description = "CloudFront Origin Access Identity"
  type        = string
}

variable "acm_certificate_arn" {
  description = "ARN des ACM Certificates für HTTPS"
  type        = string
}

variable "subdomain_aliases" {
  description = "Liste der viraltenant.com Subdomains"
  type        = list(string)
  default     = ["www.viraltenant.com"]
}

variable "custom_domain_aliases" {
  description = "Liste der Custom Domains für Kunden"
  type        = list(string)
  default     = ["standupnow.ch", "www.standupnow.ch"]
}

variable "dynamodb_read_capacity" {
  description = "DynamoDB Read Capacity für custom_domain-index"
  type        = number
  default     = 5
}

variable "dynamodb_write_capacity" {
  description = "DynamoDB Write Capacity für custom_domain-index"
  type        = number
  default     = 5
}
