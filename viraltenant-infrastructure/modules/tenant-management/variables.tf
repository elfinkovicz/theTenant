variable "platform_name" {
  description = "Name der Plattform"
  type        = string
}

variable "environment" {
  description = "Environment (prod, stage, dev)"
  type        = string
}

variable "enable_point_in_time_recovery" {
  description = "Enable DynamoDB Point-in-Time Recovery"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Standard Tags für alle Ressourcen"
  type        = map(string)
  default     = {}
}