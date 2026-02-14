variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "viraltenant"
}

variable "platform_name" {
  description = "Name der zentralen Creator Platform"
  type        = string
  default     = "viraltenant"
}

variable "environment" {
  description = "Environment (prod, stage, dev)"
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "AWS Region"
  type        = string
  default     = "eu-central-1"
}

variable "platform_domain" {
  description = "Haupt-Domain der Plattform (z.B. creatorplatform.com)"
  type        = string
}

variable "api_domain" {
  description = "API Domain (z.B. api.creatorplatform.com)"
  type        = string
}

# Route 53 DNS Configuration
variable "enable_route53_dns" {
  description = "Enable Route 53 DNS management"
  type        = bool
  default     = true
}

variable "create_hosted_zone" {
  description = "Create new Route 53 hosted zone"
  type        = bool
  default     = true
}

variable "existing_hosted_zone_id" {
  description = "Existing Route 53 hosted zone ID (if create_hosted_zone = false)"
  type        = string
  default     = ""
}

# SSL Certificate Configuration
variable "enable_ssl_certificate" {
  description = "Enable SSL certificate creation via ACM"
  type        = bool
  default     = true
}

variable "ssl_validation_method" {
  description = "SSL certificate validation method (DNS or EMAIL)"
  type        = string
  default     = "DNS"
  validation {
    condition     = contains(["DNS", "EMAIL"], var.ssl_validation_method)
    error_message = "SSL validation method must be either DNS or EMAIL."
  }
}

# Domain Routing Configuration
variable "enable_wildcard_subdomain" {
  description = "Enable wildcard subdomain for creators (*.domain.com)"
  type        = bool
  default     = true
}

variable "enable_www_redirect" {
  description = "Enable www subdomain redirect"
  type        = bool
  default     = true
}

variable "enable_api_subdomain" {
  description = "Enable API subdomain (api.domain.com)"
  type        = bool
  default     = true
}

# E-Mail DNS Configuration
variable "enable_mx_records" {
  description = "Enable MX records for email"
  type        = bool
  default     = false
}

variable "mx_records" {
  description = "MX records for email configuration"
  type        = list(string)
  default     = []
}

# Domain Verification Configuration
variable "enable_txt_records" {
  description = "Enable TXT records for domain verification"
  type        = bool
  default     = false
}

variable "txt_records" {
  description = "TXT records for domain verification"
  type        = list(string)
  default     = []
}

# DNS TTL Settings
variable "dns_ttl_default" {
  description = "Default TTL for DNS records"
  type        = number
  default     = 300
}

variable "dns_ttl_mx" {
  description = "TTL for MX records"
  type        = number
  default     = 300
}

variable "dns_ttl_txt" {
  description = "TTL for TXT records"
  type        = number
  default     = 300
}

# CloudFront & CDN Configuration
variable "enable_cloudfront_custom_domains" {
  description = "Enable custom domains for CloudFront distribution"
  type        = bool
  default     = true
}

variable "cloudfront_domains" {
  description = "Custom domains for CloudFront distribution"
  type        = list(string)
  default     = []
}

variable "cloudfront_ssl_certificate" {
  description = "SSL certificate configuration for CloudFront (auto, manual, none)"
  type        = string
  default     = "auto"
  validation {
    condition     = contains(["auto", "manual", "none"], var.cloudfront_ssl_certificate)
    error_message = "CloudFront SSL certificate must be 'auto', 'manual', or 'none'."
  }
}

variable "cloudfront_ssl_certificate_arn" {
  description = "Manual SSL certificate ARN for CloudFront (if cloudfront_ssl_certificate = manual)"
  type        = string
  default     = ""
}

variable "cloudfront_default_ttl" {
  description = "Default TTL for CloudFront caching"
  type        = number
  default     = 86400
}

variable "cloudfront_max_ttl" {
  description = "Maximum TTL for CloudFront caching"
  type        = number
  default     = 31536000
}

variable "cloudfront_website_ttl" {
  description = "TTL for website content caching"
  type        = number
  default     = 3600
}

variable "cloudfront_api_ttl" {
  description = "TTL for API calls caching"
  type        = number
  default     = 0
}

variable "cloudfront_compression" {
  description = "Enable CloudFront compression"
  type        = bool
  default     = true
}

variable "cloudfront_http2" {
  description = "Enable CloudFront HTTP/2 support"
  type        = bool
  default     = true
}

# Database Configuration
variable "enable_point_in_time_recovery" {
  description = "Enable DynamoDB Point-in-Time Recovery"
  type        = bool
  default     = true
}

variable "enable_deletion_protection" {
  description = "Enable DynamoDB Deletion Protection"
  type        = bool
  default     = false
}

# Storage Configuration
variable "enable_versioning" {
  description = "Enable S3 Versioning"
  type        = bool
  default     = true
}

variable "enable_encryption" {
  description = "Enable S3 Encryption"
  type        = bool
  default     = true
}

# Auth Configuration
variable "enable_mfa" {
  description = "Enable MFA for Cognito"
  type        = bool
  default     = false
}

variable "password_policy" {
  description = "Cognito Password Policy"
  type = object({
    minimum_length    = number
    require_lowercase = bool
    require_numbers   = bool
    require_symbols   = bool
    require_uppercase = bool
  })
  default = {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }
}

# API Configuration
variable "api_throttle_rate" {
  description = "API Gateway throttle rate"
  type        = number
  default     = 1000
}

variable "api_throttle_burst" {
  description = "API Gateway throttle burst"
  type        = number
  default     = 2000
}

# Monitoring
variable "enable_cloudwatch_logs" {
  description = "Enable CloudWatch Logs"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "CloudWatch Log retention in days"
  type        = number
  default     = 30
}

variable "enable_multi_domain" {
  description = "Aktiviert Multi-Domain Support für Creator"
  type        = bool
  default     = true
}

variable "default_creator_features" {
  description = "Standard Features für neue Creator"
  type = object({
    ivs_streaming    = bool
    ivs_chat         = bool
    user_auth        = bool
    video_management = bool
    shop             = bool
    team_management  = bool
  })
  default = {
    ivs_streaming    = true
    ivs_chat         = true
    user_auth        = true
    video_management = true
    shop             = false
    team_management  = false
  }
}

variable "billing_config" {
  description = "Billing Konfiguration"
  type = object({
    base_fee_per_creator  = number
    storage_cost_per_gb   = number
    bandwidth_cost_per_gb = number
    api_calls_cost_per_1k = number
  })
  default = {
    base_fee_per_creator  = 20.00
    storage_cost_per_gb   = 0.023
    bandwidth_cost_per_gb = 0.085
    api_calls_cost_per_1k = 0.001
  }
}

variable "tags" {
  description = "Standard Tags für alle Ressourcen"
  type        = map(string)
  default = {
    Project      = "CreatorPlatform"
    ManagedBy    = "Terraform"
    Architecture = "MultiTenant"
  }
}

# Creator Assets TTL Configuration
variable "creator_assets_ttl" {
  description = "TTL für Creator Assets caching"
  type        = number
  default     = 86400
}

variable "creator_assets_max_ttl" {
  description = "Maximum TTL für Creator Assets caching"
  type        = number
  default     = 31536000
}

variable "additional_cloudfront_arns" {
  description = "Additional CloudFront distribution ARNs that need access to the S3 buckets (e.g., custom domain distributions)"
  type        = list(string)
  default     = []
}

# YouTube OAuth Configuration
variable "oauth_encryption_key" {
  description = "Encryption key for OAuth tokens (32 characters)"
  type        = string
  sensitive   = true
  default     = "change-this-in-production-32chars"
}

variable "youtube_client_id" {
  description = "YouTube OAuth Client ID from Google Cloud Console"
  type        = string
  sensitive   = true
  default     = ""
}

variable "youtube_client_secret" {
  description = "YouTube OAuth Client Secret from Google Cloud Console"
  type        = string
  sensitive   = true
  default     = ""
}


# ============================================================
# OAuth Credentials (zentral verwaltet vom Plattform-Betreiber)
# Diese Werte sollten in terraform.tfvars oder als Umgebungsvariablen gesetzt werden
# ============================================================

variable "meta_app_id" {
  description = "Meta (Facebook/Instagram) App ID - für Facebook Login"
  type        = string
  sensitive   = true
}

variable "meta_app_secret" {
  description = "Meta (Facebook/Instagram) App Secret - für Facebook Login"
  type        = string
  sensitive   = true
}

variable "instagram_app_id" {
  description = "Instagram App ID - für Instagram Login (ohne Facebook). Findest du unter: App Dashboard > Instagram > API setup with Instagram login > Business login settings"
  type        = string
  default     = ""
  sensitive   = true
}

variable "instagram_app_secret" {
  description = "Instagram App Secret - für Instagram Login (ohne Facebook)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "threads_app_id" {
  description = "Threads App ID - für Threads API"
  type        = string
  default     = ""
  sensitive   = true
}

variable "threads_app_secret" {
  description = "Threads App Secret - für Threads API"
  type        = string
  default     = ""
  sensitive   = true
}

variable "google_client_id" {
  description = "Google OAuth Client ID (für YouTube)"
  type        = string
  sensitive   = true
}

variable "google_client_secret" {
  description = "Google OAuth Client Secret (für YouTube)"
  type        = string
  sensitive   = true
}

variable "linkedin_client_id" {
  description = "LinkedIn OAuth Client ID"
  type        = string
  sensitive   = true
}

variable "linkedin_client_secret" {
  description = "LinkedIn OAuth Client Secret"
  type        = string
  sensitive   = true
}

variable "twitter_client_id" {
  description = "X (Twitter) OAuth 2.0 Client ID"
  type        = string
  sensitive   = true
}

variable "twitter_client_secret" {
  description = "X (Twitter) OAuth 2.0 Client Secret"
  type        = string
  sensitive   = true
}

variable "twitter_consumer_key" {
  description = "X (Twitter) OAuth 1.0a Consumer Key (API Key) - für Posting + Media Upload"
  type        = string
  sensitive   = true
  default     = ""
}

variable "twitter_consumer_secret" {
  description = "X (Twitter) OAuth 1.0a Consumer Secret (API Key Secret) - für Posting + Media Upload"
  type        = string
  sensitive   = true
  default     = ""
}

variable "tiktok_client_key" {
  description = "TikTok Client Key for OAuth"
  type        = string
  default     = ""
}

variable "tiktok_client_secret" {
  description = "TikTok Client Secret for OAuth"
  type        = string
  sensitive   = true
  default     = ""
}

variable "snapchat_client_id" {
  description = "Snapchat Client ID for OAuth"
  type        = string
  default     = ""
}

variable "snapchat_client_secret" {
  description = "Snapchat Client Secret for OAuth"
  type        = string
  sensitive   = true
  default     = ""
}

# ============================================================
# STRIPE BILLING CONFIGURATION
# ============================================================

variable "stripe_secret_key" {
  description = "Stripe Secret API Key (sk_live_... or sk_test_...)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_publishable_key" {
  description = "Stripe Publishable API Key (pk_live_... or pk_test_...)"
  type        = string
  default     = ""
}

variable "stripe_webhook_secret" {
  description = "Stripe Webhook Signing Secret (whsec_...)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_price_id" {
  description = "Stripe Price ID for the monthly subscription (price_...)"
  type        = string
  default     = ""
}

# ============================================================
# MOLLIE BILLING CONFIGURATION
# ============================================================

variable "mollie_api_key" {
  description = "Mollie API Key (live_... or test_...) - deprecated, use OAuth"
  type        = string
  sensitive   = true
  default     = ""
}

variable "mollie_client_id" {
  description = "Mollie OAuth Client ID for Connect"
  type        = string
  default     = "app_GYccPvztAbzr4FsyGXAnmt6A"
}

variable "mollie_client_secret" {
  description = "Mollie OAuth Client Secret for Connect"
  type        = string
  sensitive   = true
  default     = "PEyPUKrUQKAvf8sE3Sj7ssQv4aEC4R4HW7QaMS3b"
}


# ============================================================
# AWS END USER MESSAGING SOCIAL - WHATSAPP CONFIGURATION
# ============================================================

variable "whatsapp_phone_number_id" {
  description = "AWS End User Messaging Social Phone Number ID"
  type        = string
  default     = "phone-number-id-e3c8a658d5fe4364818f07abb1835e5b"
}

variable "whatsapp_waba_id" {
  description = "WhatsApp Business Account ID"
  type        = string
  default     = "waba-7a0c3dab27ff4058b619e62a50865a43"
}

variable "whatsapp_phone_number" {
  description = "WhatsApp phone number (display format)"
  type        = string
  default     = "+41772356998"
}

variable "whatsapp_display_name" {
  description = "WhatsApp display name"
  type        = string
  default     = "Viral Tenant"
}
