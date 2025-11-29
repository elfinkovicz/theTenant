variable "project_name" {
  description = "Name des Projekts"
  type        = string
}

variable "channel_name" {
  description = "IVS Channel Name"
  type        = string
}

variable "channel_type" {
  description = "IVS Channel Type (STANDARD oder BASIC)"
  type        = string
  default     = "STANDARD"
}
