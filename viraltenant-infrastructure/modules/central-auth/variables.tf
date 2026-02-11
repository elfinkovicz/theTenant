# Central Auth Module Variables

variable "platform_name" {
  description = "Platform name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment (prod, stage, dev)"
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "AWS Region"
  type        = string
  default     = "eu-central-1"
}

variable "platform_domain" {
  description = "Platform domain for callback URLs"
  type        = string
}

variable "password_policy" {
  description = "Cognito Password Policy"
  type = object({
    minimum_length    = number
    require_lowercase = bool
    require_numbers   = bool
    require_symbols   = bool
    require_uppercase = bool
  })
  default = {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}


variable "common_deps_layer_arn" {
  description = "ARN of the common dependencies Lambda layer"
  type        = string
  default     = ""
}
