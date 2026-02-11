# Tenant Live Module Variables
variable "platform_name" { type = string }
variable "environment" { type = string }
variable "aws_region" { type = string }
variable "tags" { type = map(string) }
variable "api_gateway_id" { type = string }
variable "api_gateway_execution_arn" { type = string }
variable "tenant_by_id_resource_id" { type = string }
variable "lambda_authorizer_id" { type = string }
variable "user_tenants_table_arn" { type = string }
variable "user_tenants_table_name" { type = string }
variable "tenants_table_arn" { type = string }
variable "tenants_table_name" { type = string }
variable "creator_assets_bucket_arn" { type = string }
variable "creator_assets_bucket_name" { type = string }
variable "cloudfront_domain_name" { type = string }
variable "tenant_id" {
  type        = string
  description = "Tenant ID for IVS channel creation"
  default     = "platform"
}
variable "create_ivs_channel" {
  type        = bool
  description = "Whether to create IVS channel for this tenant"
  default     = false
}

variable "common_deps_layer_arn" {
  description = "ARN of the common dependencies Lambda layer"
  type        = string
}


# YouTube OAuth Variables
variable "api_base_url" {
  description = "Base URL for API Gateway (for OAuth redirect)"
  type        = string
}

variable "encryption_key" {
  description = "Encryption key for OAuth tokens"
  type        = string
  sensitive   = true
  default     = "change-this-in-production-32chars"
}

variable "youtube_client_id" {
  description = "YouTube OAuth Client ID"
  type        = string
  sensitive   = true
  default     = ""
}

variable "youtube_client_secret" {
  description = "YouTube OAuth Client Secret"
  type        = string
  sensitive   = true
  default     = ""
}

# Auto-Publish to Newsfeed Variables
variable "tenant_newsfeed_table_name" {
  description = "Name of the tenant newsfeed DynamoDB table"
  type        = string
  default     = ""
}

variable "tenant_newsfeed_table_arn" {
  description = "ARN of the tenant newsfeed DynamoDB table"
  type        = string
  default     = ""
}

variable "crosspost_dispatcher_lambda_name" {
  description = "Name of the crosspost dispatcher Lambda function"
  type        = string
  default     = ""
}

variable "crosspost_dispatcher_lambda_arn" {
  description = "ARN of the crosspost dispatcher Lambda function"
  type        = string
  default     = ""
}
