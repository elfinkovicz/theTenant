variable "project_name" {
  description = "Name des Projekts"
  type        = string
}

variable "environment" {
  description = "Umgebung (production, staging, development)"
  type        = string
  default     = "production"
}

variable "aws_region" {
  description = "AWS Region"
  type        = string
  default     = "eu-central-1"
}

variable "domain_name" {
  description = "Haupt-Domain"
  type        = string
}

variable "website_domain" {
  description = "Website Domain (z.B. www.example.com)"
  type        = string
}

variable "create_route53_zone" {
  description = "Route53 Zone erstellen"
  type        = bool
  default     = false
}

variable "route53_zone_id" {
  description = "Existierende Route53 Zone ID"
  type        = string
  default     = ""
}

variable "contact_email_recipient" {
  description = "E-Mail-Empfänger für Kontaktformular"
  type        = string
}

variable "contact_email_sender" {
  description = "E-Mail-Absender für Kontaktformular"
  type        = string
}

variable "enable_ivs_streaming" {
  description = "IVS Streaming aktivieren"
  type        = bool
  default     = true
}

variable "ivs_channel_name" {
  description = "IVS Channel Name"
  type        = string
  default     = "main-channel"
}

variable "ivs_channel_type" {
  description = "IVS Channel Type (STANDARD oder BASIC)"
  type        = string
  default     = "STANDARD"
}

variable "enable_ivs_chat" {
  description = "IVS Chat aktivieren"
  type        = bool
  default     = true
}

variable "enable_user_auth" {
  description = "User Authentication aktivieren"
  type        = bool
  default     = true
}

variable "cognito_callback_urls" {
  description = "Cognito Callback URLs"
  type        = list(string)
  default     = []
}

variable "cognito_logout_urls" {
  description = "Cognito Logout URLs"
  type        = list(string)
  default     = []
}

variable "allow_user_registration" {
  description = "Selbst-Registrierung erlauben"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags für alle Ressourcen"
  type        = map(string)
  default     = {}
}

# Sponsor System
variable "enable_sponsor_system" {
  description = "Sponsor-System aktivieren"
  type        = bool
  default     = true
}

# Shop / E-Commerce
variable "enable_shop" {
  description = "Shop aktivieren"
  type        = bool
  default     = true
}

variable "stripe_secret_key" {
  description = "Stripe Secret Key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_publishable_key" {
  description = "Stripe Publishable Key"
  type        = string
  default     = ""
}

# Video Management
variable "enable_video_management" {
  description = "Video Management System aktivieren"
  type        = bool
  default     = true
}

# Team Management
variable "enable_team_management" {
  description = "Team Management System aktivieren"
  type        = bool
  default     = true
}

# Event Management
variable "enable_event_management" {
  description = "Event Management System aktivieren"
  type        = bool
  default     = true
}

# Advertisement Management
variable "enable_ad_management" {
  description = "Advertisement Management System aktivieren"
  type        = bool
  default     = true
}

# Hero Management
variable "enable_hero_management" {
  description = "Hero Section Management System aktivieren"
  type        = bool
  default     = true
}

# Product Management
variable "enable_product_management" {
  description = "Product Management System aktivieren"
  type        = bool
  default     = true
}

# Channel Management
variable "enable_channel_management" {
  description = "Social Media Channel Management System aktivieren"
  type        = bool
  default     = true
}

# Contact Info Management
variable "enable_contact_info_management" {
  description = "Contact Information Management System aktivieren"
  type        = bool
  default     = true
}

# Legal Management
variable "enable_legal_management" {
  description = "Legal Documents Management System aktivieren"
  type        = bool
  default     = true
}

# Stream Restreaming
variable "enable_stream_restreaming" {
  description = "Stream Restreaming zu Social Media Plattformen aktivieren"
  type        = bool
  default     = true
}


# PayPal Configuration
variable "paypal_client_id" {
  description = "PayPal Client ID (Sandbox or Production)"
  type        = string
  default     = ""
}

variable "paypal_secret" {
  description = "PayPal Secret Key (Sandbox or Production)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "paypal_mode" {
  description = "PayPal Mode: sandbox or live"
  type        = string
  default     = "sandbox"
}

# Newsfeed Management
variable "enable_newsfeed_management" {
  description = "Newsfeed Management System aktivieren"
  type        = bool
  default     = true
}

# WhatsApp Integration
variable "enable_whatsapp_integration" {
  description = "WhatsApp Integration für Newsfeed aktivieren"
  type        = bool
  default     = false
}

variable "whatsapp_phone_number_id" {
  description = "WhatsApp Phone Number ID from AWS End User Messaging"
  type        = string
  default     = ""
}

variable "whatsapp_group_id" {
  description = "WhatsApp Group ID to send newsfeed posts to"
  type        = string
  default     = ""
}

# Telegram Integration
variable "enable_telegram_integration" {
  description = "Telegram Bot Integration für Newsfeed aktivieren"
  type        = bool
  default     = false
}

variable "telegram_bot_token" {
  description = "Telegram Bot Token from BotFather"
  type        = string
  default     = ""
  sensitive   = true
}

variable "telegram_chat_id" {
  description = "Telegram Chat/Channel ID to send newsfeed posts to"
  type        = string
  default     = ""
}
