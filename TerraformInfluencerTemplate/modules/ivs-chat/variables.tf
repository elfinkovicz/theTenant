variable "project_name" {
  description = "Name des Projekts"
  type        = string
}

variable "message_review_handler_uri" {
  description = "Lambda ARN für Message Review (optional)"
  type        = string
  default     = ""
}
