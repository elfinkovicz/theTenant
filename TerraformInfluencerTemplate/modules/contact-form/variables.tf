variable "project_name" {
  description = "Name des Projekts"
  type        = string
}

variable "sender_email" {
  description = "Absender E-Mail (muss in SES verifiziert sein)"
  type        = string
}

variable "recipient_email" {
  description = "Empfänger E-Mail"
  type        = string
}

variable "allowed_origins" {
  description = "Erlaubte CORS Origins"
  type        = list(string)
}

variable "verify_domain" {
  description = "Domain in SES verifizieren"
  type        = bool
  default     = true
}

variable "domain_name" {
  description = "Domain Name für SES Verifizierung"
  type        = string
  default     = ""
}

variable "route53_zone_id" {
  description = "Route53 Zone ID für DNS Records"
  type        = string
  default     = ""
}
