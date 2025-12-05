variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "telegram_bot_token" {
  description = "Telegram Bot Token from BotFather (deprecated, use settings table)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "telegram_chat_id" {
  description = "Telegram Chat/Channel ID (deprecated, use settings table)"
  type        = string
  default     = ""
}

variable "cdn_domain" {
  description = "CDN domain for media URLs"
  type        = string
}

variable "newsfeed_table_stream_arn" {
  description = "DynamoDB Stream ARN from Newsfeed table"
  type        = string
}

variable "settings_table_name" {
  description = "DynamoDB table name for messaging settings"
  type        = string
}

variable "settings_table_arn" {
  description = "DynamoDB table ARN for messaging settings"
  type        = string
}


variable "aws_sdk_core_layer_arn" {
  description = "ARN of the AWS SDK Core Lambda Layer (DynamoDB, S3)"
  type        = string
}