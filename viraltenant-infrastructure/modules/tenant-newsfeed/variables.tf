# Tenant Newsfeed Module Variables
variable "platform_name" { type = string }
variable "environment" { type = string }
variable "aws_region" { type = string }
variable "tags" { type = map(string) }
variable "api_gateway_id" { type = string }
variable "api_gateway_execution_arn" { type = string }
variable "api_gateway_root_resource_id" { type = string }
variable "tenant_by_id_resource_id" { type = string }
variable "lambda_authorizer_id" { type = string }
variable "user_tenants_table_arn" { type = string }
variable "user_tenants_table_name" { type = string }
variable "tenants_table_arn" { type = string }
variable "tenants_table_name" { type = string }
variable "creator_assets_bucket_arn" { type = string }
variable "creator_assets_bucket_name" { type = string }
variable "cloudfront_domain_name" { type = string }
variable "platform_domain" { type = string }
variable "user_pool_id" { type = string }
variable "user_pool_arn" { type = string }

variable "common_deps_layer_arn" {
  description = "ARN of the common dependencies Lambda layer"
  type        = string
}

variable "crosspost_dispatcher_lambda_name" {
  description = "Name of the crosspost dispatcher Lambda function"
  type        = string
  default     = ""
}

# OAuth Credentials (zentral verwaltet vom Plattform-Betreiber)
variable "meta_app_id" {
  description = "Meta (Facebook/Instagram) App ID - für Facebook Login"
  type        = string
  sensitive   = true
}

variable "meta_app_secret" {
  description = "Meta (Facebook/Instagram) App Secret - für Facebook Login"
  type        = string
  sensitive   = true
}

variable "instagram_app_id" {
  description = "Instagram App ID - für Instagram Login (ohne Facebook)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "instagram_app_secret" {
  description = "Instagram App Secret - für Instagram Login (ohne Facebook)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "threads_app_id" {
  description = "Threads App ID - für Threads API"
  type        = string
  default     = ""
  sensitive   = true
}

variable "threads_app_secret" {
  description = "Threads App Secret - für Threads API"
  type        = string
  default     = ""
  sensitive   = true
}

variable "google_client_id" {
  description = "Google OAuth Client ID (für YouTube)"
  type        = string
  sensitive   = true
}

variable "google_client_secret" {
  description = "Google OAuth Client Secret (für YouTube)"
  type        = string
  sensitive   = true
}

variable "linkedin_client_id" {
  description = "LinkedIn OAuth Client ID"
  type        = string
  sensitive   = true
}

variable "linkedin_client_secret" {
  description = "LinkedIn OAuth Client Secret"
  type        = string
  sensitive   = true
}

variable "twitter_client_id" {
  description = "X (Twitter) OAuth 2.0 Client ID"
  type        = string
  sensitive   = true
}

variable "twitter_client_secret" {
  description = "X (Twitter) OAuth 2.0 Client Secret"
  type        = string
  sensitive   = true
}

variable "twitter_consumer_key" {
  description = "X (Twitter) OAuth 1.0a Consumer Key (API Key) - für Posting + Media Upload"
  type        = string
  sensitive   = true
  default     = ""
}

variable "twitter_consumer_secret" {
  description = "X (Twitter) OAuth 1.0a Consumer Secret (API Key Secret) - für Posting + Media Upload"
  type        = string
  sensitive   = true
  default     = ""
}
variable "tiktok_client_key" {
  description = "TikTok Client Key for OAuth"
  type        = string
  default     = ""
}

variable "tiktok_client_secret" {
  description = "TikTok Client Secret for OAuth"
  type        = string
  sensitive   = true
  default     = ""
}

variable "snapchat_client_id" {
  description = "Snapchat Client ID for OAuth"
  type        = string
  default     = ""
}

variable "snapchat_client_secret" {
  description = "Snapchat Client Secret for OAuth"
  type        = string
  sensitive   = true
  default     = ""
}
