variable "project_name" {
  description = "Name des Projekts"
  type        = string
}

variable "ivs_channel_arn" {
  description = "ARN des IVS Channels"
  type        = string
}

variable "ivs_playback_url" {
  description = "IVS Playback URL (HLS M3U8)"
  type        = string
}

variable "api_gateway_id" {
  description = "API Gateway ID"
  type        = string
}

variable "api_gateway_execution_arn" {
  description = "API Gateway Execution ARN für Lambda Permissions"
  type        = string
}

variable "authorizer_id" {
  description = "Cognito Authorizer ID"
  type        = string
}

variable "cognito_user_pool_arn" {
  description = "Cognito User Pool ARN für Authorizer"
  type        = string
}
