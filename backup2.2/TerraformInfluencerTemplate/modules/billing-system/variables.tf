variable "project_name" {
  description = "Name des Projekts"
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
  description = "API Gateway Execution ARN"
  type        = string
}

variable "authorizer_id" {
  description = "API Gateway Authorizer ID"
  type        = string
}

variable "stripe_secret_key" {
  description = "Stripe Secret Key"
  type        = string
  sensitive   = true
}

variable "stripe_publishable_key" {
  description = "Stripe Publishable Key"
  type        = string
}

variable "stripe_webhook_secret" {
  description = "Stripe Webhook Secret"
  type        = string
  sensitive   = true
  default     = ""
}

variable "base_fee" {
  description = "Monatliche Grundgebühr in Euro"
  type        = number
  default     = 20
}

# Lambda Layer ARNs
variable "aws_sdk_core_layer_arn" {
  description = "ARN of the AWS SDK Core Lambda Layer"
  type        = string
}

variable "utilities_layer_arn" {
  description = "ARN of the Utilities Lambda Layer (includes Stripe)"
  type        = string
}

