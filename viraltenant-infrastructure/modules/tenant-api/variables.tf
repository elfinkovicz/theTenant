variable "platform_name" {
  description = "Name der Plattform"
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

variable "platform_domain" {
  description = "Haupt-Domain der Plattform"
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

variable "hosted_zone_id" {
  description = "Route53 Hosted Zone ID"
  type        = string
}

variable "cloudfront_domain_name" {
  description = "CloudFront Distribution Domain Name"
  type        = string
}

variable "api_gateway_id" {
  description = "API Gateway REST API ID"
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

variable "tags" {
  description = "Standard Tags für alle Ressourcen"
  type        = map(string)
  default     = {}
}

variable "user_pool_id" {
  description = "Cognito User Pool ID"
  type        = string
}

# Additional tables for delete functionality
variable "tenant_live_table_name" {
  description = "Name der Tenant-Live DynamoDB Tabelle"
  type        = string
  default     = ""
}

variable "tenant_live_table_arn" {
  description = "ARN der Tenant-Live DynamoDB Tabelle"
  type        = string
  default     = ""
}

variable "tenant_newsfeed_table_name" {
  description = "Name der Tenant-Newsfeed DynamoDB Tabelle"
  type        = string
  default     = ""
}

variable "tenant_newsfeed_table_arn" {
  description = "ARN der Tenant-Newsfeed DynamoDB Tabelle"
  type        = string
  default     = ""
}

variable "tenant_frontend_table_name" {
  description = "Name der Tenant-Frontend DynamoDB Tabelle"
  type        = string
  default     = ""
}

variable "tenant_frontend_table_arn" {
  description = "ARN der Tenant-Frontend DynamoDB Tabelle"
  type        = string
  default     = ""
}

variable "tenant_events_table_name" {
  description = "Name der Tenant-Events DynamoDB Tabelle"
  type        = string
  default     = ""
}

variable "tenant_events_table_arn" {
  description = "ARN der Tenant-Events DynamoDB Tabelle"
  type        = string
  default     = ""
}

variable "tenant_contact_table_name" {
  description = "Name der Tenant-Contact DynamoDB Tabelle"
  type        = string
  default     = ""
}

variable "tenant_contact_table_arn" {
  description = "ARN der Tenant-Contact DynamoDB Tabelle"
  type        = string
  default     = ""
}

variable "tenant_team_table_name" {
  description = "Name der Tenant-Team DynamoDB Tabelle"
  type        = string
  default     = ""
}

variable "tenant_team_table_arn" {
  description = "ARN der Tenant-Team DynamoDB Tabelle"
  type        = string
  default     = ""
}

variable "tenant_shop_table_name" {
  description = "Name der Tenant-Shop DynamoDB Tabelle"
  type        = string
  default     = ""
}

variable "tenant_shop_table_arn" {
  description = "ARN der Tenant-Shop DynamoDB Tabelle"
  type        = string
  default     = ""
}

variable "tenant_videos_table_name" {
  description = "Name der Tenant-Videos DynamoDB Tabelle"
  type        = string
  default     = ""
}

variable "tenant_videos_table_arn" {
  description = "ARN der Tenant-Videos DynamoDB Tabelle"
  type        = string
  default     = ""
}

variable "tenant_channels_table_name" {
  description = "Name der Tenant-Channels DynamoDB Tabelle"
  type        = string
  default     = ""
}

variable "tenant_channels_table_arn" {
  description = "ARN der Tenant-Channels DynamoDB Tabelle"
  type        = string
  default     = ""
}

variable "tenant_podcasts_table_name" {
  description = "Name der Tenant-Podcasts DynamoDB Tabelle"
  type        = string
  default     = ""
}

variable "tenant_podcasts_table_arn" {
  description = "ARN der Tenant-Podcasts DynamoDB Tabelle"
  type        = string
  default     = ""
}

variable "creator_assets_bucket_name" {
  description = "Name des Creator Assets S3 Buckets"
  type        = string
}

variable "creator_assets_bucket_arn" {
  description = "ARN des Creator Assets S3 Buckets"
  type        = string
}


variable "common_deps_layer_arn" {
  description = "ARN of the common dependencies Lambda layer"
  type        = string
}
