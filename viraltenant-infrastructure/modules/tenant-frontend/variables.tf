variable "platform_name" {
  description = "Name of the platform"
  type        = string
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "platform_domain" {
  description = "Platform domain"
  type        = string
}

variable "api_gateway_id" {
  description = "API Gateway ID"
  type        = string
}

variable "api_gateway_root_resource_id" {
  description = "API Gateway root resource ID"
  type        = string
}

variable "api_gateway_execution_arn" {
  description = "API Gateway execution ARN"
  type        = string
}

variable "lambda_authorizer_id" {
  description = "Lambda authorizer ID"
  type        = string
}

variable "tenants_resource_id" {
  description = "API Gateway resource ID for /tenants"
  type        = string
}

variable "tenant_by_id_resource_id" {
  description = "API Gateway resource ID for /tenants/{tenantId}"
  type        = string
}

variable "user_tenants_table_name" {
  description = "DynamoDB table name for user-tenant relationships"
  type        = string
}

variable "user_tenants_table_arn" {
  description = "DynamoDB table ARN for user-tenant relationships"
  type        = string
}

variable "creator_assets_bucket_name" {
  description = "S3 bucket name for creator assets"
  type        = string
}

variable "creator_assets_bucket_arn" {
  description = "S3 bucket ARN for creator assets"
  type        = string
}

variable "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  type        = string
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

variable "tenants_table_name" {
  description = "DynamoDB table name for tenants"
  type        = string
}

variable "tenants_table_arn" {
  description = "DynamoDB table ARN for tenants"
  type        = string
}

variable "common_deps_layer_arn" {
  description = "ARN of the common dependencies Lambda layer"
  type        = string
}
