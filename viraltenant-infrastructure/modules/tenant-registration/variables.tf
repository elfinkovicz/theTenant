variable "platform_name" {
  description = "Name der Plattform"
  type        = string
}

variable "environment" {
  description = "Umgebung (production, staging, development)"
  type        = string
}

variable "aws_region" {
  description = "AWS Region"
  type        = string
}

variable "platform_domain" {
  description = "Platform Domain (z.B. viraltenant.com)"
  type        = string
}

variable "api_gateway_id" {
  description = "API Gateway ID"
  type        = string
}

variable "api_gateway_root_resource_id" {
  description = "API Gateway Root Resource ID"
  type        = string
}

variable "api_gateway_execution_arn" {
  description = "API Gateway Execution ARN"
  type        = string
}

variable "lambda_authorizer_id" {
  description = "Lambda Authorizer ID"
  type        = string
}

variable "tenants_table_name" {
  description = "Name der Tenants DynamoDB Tabelle"
  type        = string
}

variable "tenants_table_arn" {
  description = "ARN der Tenants DynamoDB Tabelle"
  type        = string
}

variable "user_tenants_table_name" {
  description = "Name der User-Tenants DynamoDB Tabelle"
  type        = string
}

variable "user_tenants_table_arn" {
  description = "ARN der User-Tenants DynamoDB Tabelle"
  type        = string
}

variable "tenant_live_table_name" {
  description = "Name der Tenant-Live DynamoDB Tabelle"
  type        = string
}

variable "tenant_live_table_arn" {
  description = "ARN der Tenant-Live DynamoDB Tabelle"
  type        = string
}

variable "hosted_zone_id" {
  description = "Route53 Hosted Zone ID"
  type        = string
}

variable "cloudfront_domain_name" {
  description = "CloudFront Distribution Domain Name"
  type        = string
}

variable "creator_assets_bucket_name" {
  description = "Name des Creator Assets S3 Buckets"
  type        = string
}

variable "creator_assets_bucket_arn" {
  description = "ARN des Creator Assets S3 Buckets"
  type        = string
}

variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  type        = string
}

variable "cognito_user_pool_arn" {
  description = "Cognito User Pool ARN"
  type        = string
}

variable "tenant_registration_deps_layer_arn" {
  description = "ARN of the tenant registration dependencies Lambda layer"
  type        = string
}

variable "tags" {
  description = "Tags für alle Ressourcen"
  type        = map(string)
  default     = {}
}