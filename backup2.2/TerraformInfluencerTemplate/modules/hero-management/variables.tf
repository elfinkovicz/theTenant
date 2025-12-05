variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
}

variable "user_pool_id" {
  description = "Cognito User Pool ID"
  type        = string
}

variable "api_gateway_id" {
  description = "API Gateway ID"
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
  description = "S3 bucket name for storing hero images"
  type        = string
}

variable "cdn_domain" {
  description = "CloudFront CDN domain for serving images"
  type        = string
}

variable "aws_sdk_core_layer_arn" {
  description = "ARN of the AWS SDK Core Lambda Layer"
  type        = string
}
