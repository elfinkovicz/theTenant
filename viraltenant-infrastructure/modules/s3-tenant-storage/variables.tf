variable "platform_name" {
  description = "Name der Plattform"
  type        = string
}

variable "environment" {
  description = "Environment (prod, stage, dev)"
  type        = string
}

variable "platform_domain" {
  description = "Haupt-Domain der Plattform"
  type        = string
}

variable "enable_versioning" {
  description = "Enable S3 Versioning"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Standard Tags für alle Ressourcen"
  type        = map(string)
  default     = {}
}