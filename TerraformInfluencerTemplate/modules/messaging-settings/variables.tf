variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment"
  type        = string
  default     = "production"
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
  description = "API Gateway authorizer ID"
  type        = string
}

variable "admin_group_name" {
  description = "Cognito admin group name"
  type        = string
}

variable "domain_name" {
  description = "Domain name for email sender"
  type        = string
}

variable "lambda_layer_arns" {
  description = "List of Lambda Layer ARNs"
  type        = list(string)
  default     = []
}
