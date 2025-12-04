variable "project_name" {
  description = "Name des Projekts"
  type        = string
}

variable "channel_name" {
  description = "IVS Channel Name"
  type        = string
}

variable "channel_type" {
  description = "IVS Channel Type (STANDARD oder BASIC)"
  type        = string
  default     = "STANDARD"
}

variable "api_gateway_id" {
  description = "API Gateway ID for stream status endpoint"
  type        = string
  default     = ""
}

variable "api_gateway_execution_arn" {
  description = "API Gateway Execution ARN"
  type        = string
  default     = ""
}
