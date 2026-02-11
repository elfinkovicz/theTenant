variable "platform_name" {
  description = "Name der Plattform"
  type        = string
}

variable "environment" {
  description = "Umgebung (production, staging, development)"
  type        = string
}

variable "domain" {
  description = "Platform domain"
  type        = string
  default     = "viraltenant.com"
}

variable "enable_custom_domain" {
  description = "Enable custom domain (billing.domain)"
  type        = bool
  default     = true
}

variable "hosted_zone_id" {
  description = "Route53 Hosted Zone ID"
  type        = string
  default     = ""
}

variable "acm_certificate_arn" {
  description = "ACM Certificate ARN for custom domain"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags für alle Ressourcen"
  type        = map(string)
  default     = {}
}
