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

variable "frontend_url" {
  description = "Frontend URL for redirects"
  type        = string
}

variable "sender_email" {
  description = "SES Sender Email for order confirmations"
  type        = string
}

variable "shop_name" {
  description = "Shop Name for branding"
  type        = string
  default     = "Shop"
}

variable "cognito_authorizer_id" {
  description = "Cognito Authorizer ID for API Gateway"
  type        = string
  default     = ""
}

variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  type        = string
  default     = ""
}

variable "cognito_client_id" {
  description = "Cognito Client ID"
  type        = string
  default     = ""
}

variable "paypal_client_id" {
  description = "PayPal Client ID (Sandbox or Live)"
  type        = string
  default     = ""
}

variable "paypal_secret" {
  description = "PayPal Secret (Sandbox or Live)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "paypal_mode" {
  description = "PayPal Mode: sandbox or live"
  type        = string
  default     = "sandbox"
}

variable "shop_owner_email" {
  description = "Shop Owner Email for order notifications"
  type        = string
}
