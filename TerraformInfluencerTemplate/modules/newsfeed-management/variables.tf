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
