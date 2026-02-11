# Tenant Team Module Variables
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

variable "common_deps_layer_arn" {
  description = "ARN of the common dependencies Lambda layer"
  type        = string
}
