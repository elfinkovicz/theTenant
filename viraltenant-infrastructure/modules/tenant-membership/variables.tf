# ============================================================
# TENANT MEMBERSHIP MODULE - VARIABLES
# Mollie Split Payments für Mitgliedschaften
# ============================================================

variable "platform_name" {
  description = "Name der Plattform"
  type        = string
}

variable "environment" {
  description = "Environment (production, staging, dev)"
  type        = string
}

variable "aws_region" {
  description = "AWS Region"
  type        = string
}

variable "tags" {
  description = "Tags für alle Ressourcen"
  type        = map(string)
  default     = {}
}

# API Gateway
variable "api_gateway_id" {
  description = "API Gateway ID"
  type        = string
}

variable "api_gateway_execution_arn" {
  description = "API Gateway Execution ARN"
  type        = string
}

variable "api_gateway_root_resource_id" {
  description = "API Gateway Root Resource ID"
  type        = string
}

variable "tenant_by_id_resource_id" {
  description = "Resource ID für /tenants/{tenantId}"
  type        = string
}

variable "lambda_authorizer_id" {
  description = "Lambda Authorizer ID"
  type        = string
}

# DynamoDB Tables
variable "tenants_table_name" {
  description = "Tenants Table Name"
  type        = string
}

variable "tenants_table_arn" {
  description = "Tenants Table ARN"
  type        = string
}

variable "user_tenants_table_name" {
  description = "User Tenants Table Name"
  type        = string
}

variable "user_tenants_table_arn" {
  description = "User Tenants Table ARN"
  type        = string
}

# Lambda Layer
variable "common_deps_layer_arn" {
  description = "Common Dependencies Lambda Layer ARN"
  type        = string
}

# Mollie Configuration
variable "mollie_api_key" {
  description = "Mollie API Key (deprecated - use OAuth)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "mollie_client_id" {
  description = "Mollie OAuth Client ID"
  type        = string
  default     = "app_GYccPvztAbzr4FsyGXAnmt6A"
}

variable "mollie_client_secret" {
  description = "Mollie OAuth Client Secret"
  type        = string
  sensitive   = true
}

variable "platform_domain" {
  description = "Platform Domain für Webhooks"
  type        = string
}

# Platform Fee Configuration
variable "platform_fee_percent" {
  description = "Plattform-Gebühr in Prozent (z.B. 10 für 10%)"
  type        = number
  default     = 10
}

# Cognito
variable "user_pool_id" {
  description = "Cognito User Pool ID"
  type        = string
}

variable "user_pool_arn" {
  description = "Cognito User Pool ARN"
  type        = string
}
