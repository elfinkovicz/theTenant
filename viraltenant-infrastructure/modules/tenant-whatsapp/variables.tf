# =============================================================================
# WhatsApp Crosspost Module - Variables
# Uses AWS End User Messaging Social for centralized WhatsApp broadcasts
# =============================================================================

variable "platform_name" {
  description = "Platform name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment (prod, stage, dev)"
  type        = string
}

variable "aws_region" {
  description = "AWS Region"
  type        = string
}

variable "tags" {
  description = "Tags for resources"
  type        = map(string)
  default     = {}
}

# API Gateway
variable "api_gateway_id" {
  description = "API Gateway ID"
  type        = string
}

variable "api_gateway_execution_arn" {
  description = "API Gateway execution ARN"
  type        = string
}

variable "tenant_by_id_resource_id" {
  description = "API Gateway resource ID for /tenants/{tenantId}"
  type        = string
}

variable "lambda_authorizer_id" {
  description = "Lambda authorizer ID"
  type        = string
}

# DynamoDB Tables
variable "tenants_table_name" {
  description = "Tenants DynamoDB table name"
  type        = string
}

variable "tenants_table_arn" {
  description = "Tenants DynamoDB table ARN"
  type        = string
}

variable "user_tenants_table_name" {
  description = "User-Tenants DynamoDB table name"
  type        = string
}

variable "user_tenants_table_arn" {
  description = "User-Tenants DynamoDB table ARN"
  type        = string
}

# S3
variable "creator_assets_bucket_name" {
  description = "S3 bucket name for creator assets"
  type        = string
}

variable "creator_assets_bucket_arn" {
  description = "S3 bucket ARN for creator assets"
  type        = string
}

variable "cloudfront_domain_name" {
  description = "CloudFront domain name"
  type        = string
}

# Lambda Layer
variable "common_deps_layer_arn" {
  description = "Common dependencies Lambda layer ARN"
  type        = string
}

# AWS End User Messaging Social - WhatsApp Configuration
variable "whatsapp_phone_number_id" {
  description = "AWS End User Messaging Social Phone Number ID"
  type        = string
  default     = "phone-number-id-183d4d569aef4c6c979157f0e66a9562"
}

variable "whatsapp_waba_id" {
  description = "WhatsApp Business Account ID"
  type        = string
  default     = "waba-7a0c3dab27ff4058b619e62a50865a43"
}

variable "whatsapp_phone_number" {
  description = "WhatsApp phone number (display)"
  type        = string
  default     = "+41772356998"
}

variable "whatsapp_display_name" {
  description = "WhatsApp display name"
  type        = string
  default     = "Viral Tenant"
}

# WhatsApp Settings Table (managed by tenant-newsfeed module)
variable "whatsapp_settings_table_name" {
  description = "WhatsApp settings DynamoDB table name (from tenant-newsfeed module)"
  type        = string
}

variable "whatsapp_settings_table_arn" {
  description = "WhatsApp settings DynamoDB table ARN (from tenant-newsfeed module)"
  type        = string
}
