# Legal Management Module Variables

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "api_gateway_id" {
  description = "ID of the existing API Gateway"
  type        = string
}

variable "api_gateway_execution_arn" {
  description = "Execution ARN of the API Gateway"
  type        = string
}

variable "authorizer_id" {
  description = "ID of the Cognito authorizer"
  type        = string
}

variable "user_pool_id" {
  description = "Cognito User Pool ID"
  type        = string
}


variable "aws_sdk_core_layer_arn" {
  description = "ARN of the AWS SDK Core Lambda Layer (DynamoDB, S3)"
  type        = string
}