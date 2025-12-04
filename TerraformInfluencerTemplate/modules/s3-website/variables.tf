variable "project_name" {
  description = "Name des Projekts"
  type        = string
}

variable "domain_name" {
  description = "Domain Name"
  type        = string
}

variable "website_domain" {
  description = "Website Domain (www subdomain)"
  type        = string
}

variable "route53_zone_id" {
  description = "Route53 Zone ID"
  type        = string
}

variable "media_bucket_domain_name" {
  description = "Domain name of the media S3 bucket (thumbnails)"
  type        = string
}
