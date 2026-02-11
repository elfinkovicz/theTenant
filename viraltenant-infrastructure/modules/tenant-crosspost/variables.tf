# Tenant Crosspost Module Variables
variable "platform_name" { type = string }
variable "environment" { type = string }
variable "aws_region" { type = string }
variable "tags" { type = map(string) }
variable "common_deps_layer_arn" { type = string }

# DynamoDB Tables
variable "user_tenants_table_arn" { type = string }
variable "user_tenants_table_name" { type = string }
variable "tenants_table_arn" { type = string }
variable "tenants_table_name" { type = string }

# S3
variable "creator_assets_bucket_arn" { type = string }
variable "creator_assets_bucket_name" { type = string }
variable "cloudfront_domain_name" { type = string }

# Crossposting Settings Tables (from tenant-newsfeed module)
variable "whatsapp_settings_table_name" { type = string }
variable "whatsapp_settings_table_arn" { type = string }
variable "telegram_settings_table_name" { type = string }
variable "telegram_settings_table_arn" { type = string }
variable "email_settings_table_name" { type = string }
variable "email_settings_table_arn" { type = string }
variable "discord_settings_table_name" { type = string }
variable "discord_settings_table_arn" { type = string }
variable "slack_settings_table_name" { type = string }
variable "slack_settings_table_arn" { type = string }
variable "facebook_settings_table_name" { type = string }
variable "facebook_settings_table_arn" { type = string }
variable "instagram_settings_table_name" { type = string }
variable "instagram_settings_table_arn" { type = string }
variable "signal_settings_table_name" { type = string }
variable "signal_settings_table_arn" { type = string }
variable "xtwitter_settings_table_name" { type = string }
variable "xtwitter_settings_table_arn" { type = string }
variable "linkedin_settings_table_name" { type = string }
variable "linkedin_settings_table_arn" { type = string }
variable "youtube_settings_table_name" { type = string }
variable "youtube_settings_table_arn" { type = string }
variable "bluesky_settings_table_name" { type = string }
variable "bluesky_settings_table_arn" { type = string }
variable "mastodon_settings_table_name" { type = string }
variable "mastodon_settings_table_arn" { type = string }
variable "tiktok_settings_table_name" { type = string }
variable "tiktok_settings_table_arn" { type = string }

# OAuth Encryption
variable "encryption_key" {
  type        = string
  description = "Encryption key for OAuth tokens"
  sensitive   = true
}

# TikTok OAuth
variable "tiktok_client_key" {
  type        = string
  description = "TikTok Client Key for OAuth"
  default     = ""
}

variable "tiktok_client_secret" {
  type        = string
  description = "TikTok Client Secret for OAuth"
  sensitive   = true
  default     = ""
}

# Snapchat Settings
variable "snapchat_settings_table_name" { type = string }
variable "snapchat_settings_table_arn" { type = string }

# Snapchat OAuth
variable "snapchat_client_id" {
  type        = string
  description = "Snapchat Client ID for OAuth"
  default     = ""
}

variable "snapchat_client_secret" {
  type        = string
  description = "Snapchat Client Secret for OAuth"
  sensitive   = true
  default     = ""
}

# Threads Settings
variable "threads_settings_table_name" { type = string }
variable "threads_settings_table_arn" { type = string }
