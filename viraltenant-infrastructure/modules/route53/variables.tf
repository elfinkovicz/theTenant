variable "domain_name" {
  description = "Hauptdomain (z.B. viraltenant.com)"
  type        = string
}

variable "create_hosted_zone" {
  description = "Ob eine neue Hosted Zone erstellt werden soll"
  type        = bool
  default     = true
}

variable "existing_hosted_zone_id" {
  description = "Bestehende Hosted Zone ID (falls create_hosted_zone = false)"
  type        = string
  default     = ""
}

variable "cloudfront_domain_name" {
  description = "CloudFront Distribution Domain Name"
  type        = string
}

variable "cloudfront_hosted_zone_id" {
  description = "CloudFront Hosted Zone ID (immer Z2FDTNDATAQYW2)"
  type        = string
  default     = "Z2FDTNDATAQYW2"
}

variable "api_gateway_domain_name" {
  description = "API Gateway Custom Domain Name (optional)"
  type        = string
  default     = ""
}

variable "api_gateway_hosted_zone_id" {
  description = "API Gateway Hosted Zone ID (optional)"
  type        = string
  default     = ""
}

variable "mx_records" {
  description = "MX Records für E-Mail (optional)"
  type        = list(string)
  default     = []
}

variable "txt_records" {
  description = "TXT Records für Domain Verification (optional)"
  type        = list(string)
  default     = []
}

variable "dns_ttl_mx" {
  description = "TTL für MX Records"
  type        = number
  default     = 300
}

variable "dns_ttl_txt" {
  description = "TTL für TXT Records"
  type        = number
  default     = 300
}

variable "tags" {
  description = "Tags für Ressourcen"
  type        = map(string)
  default     = {}
}