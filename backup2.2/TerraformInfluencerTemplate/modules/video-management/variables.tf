variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "prod"
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

variable "allowed_origins" {
  description = "Allowed CORS origins"
  type        = list(string)
}


variable "aws_sdk_core_layer_arn" {
  description = "ARN of the AWS SDK Core Lambda Layer (DynamoDB, S3)"
  type        = string
}

variable "utilities_layer_arn" {
  description = "ARN of the Utilities Lambda Layer (uuid, etc.)"
  type        = string
}