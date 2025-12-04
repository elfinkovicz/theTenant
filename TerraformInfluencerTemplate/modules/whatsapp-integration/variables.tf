variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "whatsapp_phone_number_id" {
  description = "WhatsApp Phone Number ID from AWS End User Messaging"
  type        = string
}

variable "whatsapp_group_id" {
  description = "WhatsApp Group ID to send messages to"
  type        = string
}

variable "cdn_domain" {
  description = "CDN domain for media URLs"
  type        = string
}

variable "newsfeed_table_stream_arn" {
  description = "DynamoDB Stream ARN from Newsfeed table"
  type        = string
}
