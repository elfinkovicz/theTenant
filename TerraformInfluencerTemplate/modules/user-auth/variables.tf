variable "project_name" {
  description = "Name des Projekts"
  type        = string
}

variable "callback_urls" {
  description = "Cognito Callback URLs"
  type        = list(string)
}

variable "logout_urls" {
  description = "Cognito Logout URLs"
  type        = list(string)
}

variable "allow_user_registration" {
  description = "Selbst-Registrierung erlauben"
  type        = bool
  default     = true
}

variable "website_domain" {
  description = "Website Domain"
  type        = string
}
