variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "cdn_domain" {
  description = "CDN domain for media URLs"
  type        = string
}

variable "website_url" {
  description = "Website URL for links in emails"
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

variable "users_table_name" {
  description = "DynamoDB table name for users"
  type        = string
}

variable "users_table_arn" {
  description = "DynamoDB table ARN for users"
  type        = string
}

variable "aws_sdk_extended_layer_arn" {
  description = "ARN of the AWS SDK Extended Lambda Layer (SES)"
  type        = string
}

variable "aws_sdk_core_layer_arn" {
  description = "ARN of the AWS SDK Core Lambda Layer (DynamoDB)"
  type        = string
}
