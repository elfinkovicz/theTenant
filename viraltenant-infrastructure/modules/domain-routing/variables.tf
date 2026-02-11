# Domain Routing Module Variables

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "platform_name" {
  description = "Platform name"
  type        = string
}

variable "environment" {
  description = "Environment (prod, stage, dev)"
  type        = string
  default     = "prod"
}

variable "platform_domain" {
  description = "Main platform domain"
  type        = string
}

variable "dynamodb_table_name" {
  description = "Central DynamoDB table name"
  type        = string
}

variable "dynamodb_table_arn" {
  description = "Central DynamoDB table ARN"
  type        = string
}

variable "s3_bucket_name" {
  description = "Central S3 bucket name"
  type        = string
}

variable "s3_bucket_arn" {
  description = "Central S3 bucket ARN"
  type        = string
}

variable "s3_bucket_domain_name" {
  description = "S3 bucket domain name"
  type        = string
}

variable "cloudfront_distribution_id" {
  description = "Central CloudFront distribution ID"
  type        = string
}

variable "api_gateway_domain" {
  description = "API Gateway domain"
  type        = string
}

variable "ssl_certificate_arn" {
  description = "SSL certificate ARN"
  type        = string
}

variable "custom_domains" {
  description = "List of custom domains"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}