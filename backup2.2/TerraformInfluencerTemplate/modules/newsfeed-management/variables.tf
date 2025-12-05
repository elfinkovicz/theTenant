variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment (production, staging, etc.)"
  type        = string
  default     = "production"
}

variable "user_pool_id" {
  description = "Cognito User Pool ID for authentication"
  type        = string
}

variable "api_gateway_id" {
  description = "API Gateway ID (from User-Auth module)"
  type        = string
}

variable "api_gateway_execution_arn" {
  description = "API Gateway execution ARN"
  type        = string
}

variable "authorizer_id" {
  description = "API Gateway JWT Authorizer ID"
  type        = string
}

variable "assets_bucket_name" {
  description = "Existing S3 bucket for storing newsfeed media (shared with video/event management)"
  type        = string
}

variable "cdn_domain" {
  description = "Existing CloudFront CDN domain for serving media"
  type        = string
}

variable "settings_table_name" {
  description = "DynamoDB table name for messaging settings (Telegram/WhatsApp)"
  type        = string
  default     = ""
}

variable "settings_table_arn" {
  description = "DynamoDB table ARN for messaging settings"
  type        = string
  default     = ""
}


variable "aws_sdk_core_layer_arn" {
  description = "ARN of the AWS SDK Core Lambda Layer (DynamoDB, S3)"
  type        = string
}