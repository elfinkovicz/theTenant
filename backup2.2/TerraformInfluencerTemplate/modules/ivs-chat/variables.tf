variable "project_name" {
  description = "Name des Projekts"
  type        = string
}

variable "message_review_handler_uri" {
  description = "Lambda ARN für Message Review (optional)"
  type        = string
  default     = ""
}


variable "aws_sdk_extended_layer_arn" {
  description = "ARN of the AWS SDK Extended Lambda Layer (SES, KMS, IVS)"
  type        = string
}