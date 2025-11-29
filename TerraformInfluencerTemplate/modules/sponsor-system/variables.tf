variable "project_name" {
  description = "Name des Projekts"
  type        = string
}

variable "allowed_origins" {
  description = "Erlaubte Origins für CORS"
  type        = list(string)
  default     = ["*"]
}

variable "enable_email_notifications" {
  description = "E-Mail-Benachrichtigungen aktivieren"
  type        = bool
  default     = false
}

variable "notification_email" {
  description = "E-Mail für Benachrichtigungen"
  type        = string
  default     = ""
}
