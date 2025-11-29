variable "project_name" {
  description = "Name des Projekts"
  type        = string
}

variable "allowed_origins" {
  description = "Erlaubte Origins für CORS"
  type        = list(string)
  default     = ["*"]
}

variable "stripe_secret_key" {
  description = "Stripe Secret Key"
  type        = string
  sensitive   = true
}

variable "stripe_publishable_key" {
  description = "Stripe Publishable Key"
  type        = string
  default     = ""
}
