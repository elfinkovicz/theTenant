variable "platform_name" {
  description = "Name der Plattform"
  type        = string
}

variable "environment" {
  description = "Umgebung (production, staging, development)"
  type        = string
}

variable "aws_region" {
  description = "AWS Region"
  type        = string
}

variable "api_gateway_id" {
  description = "API Gateway ID"
  type        = string
}

variable "api_gateway_root_resource_id" {
  description = "API Gateway Root Resource ID"
  type        = string
}

variable "api_gateway_execution_arn" {
  description = "API Gateway Execution ARN"
  type        = string
}

variable "lambda_authorizer_id" {
  description = "Lambda Authorizer ID"
  type        = string
}

variable "tags" {
  description = "Tags für alle Ressourcen"
  type        = map(string)
  default     = {}
}


# Variables for Billing Cron Job
variable "tenants_table_name" {
  description = "Name of the tenants DynamoDB table"
  type        = string
  default     = ""
}

variable "user_tenants_table_name" {
  description = "Name of the user-tenants DynamoDB table"
  type        = string
  default     = ""
}

variable "assets_bucket_name" {
  description = "Name of the S3 bucket for assets"
  type        = string
  default     = ""
}

variable "user_pool_id" {
  description = "Cognito User Pool ID"
  type        = string
  default     = ""
}

variable "domain" {
  description = "Platform domain for email sender"
  type        = string
  default     = "viraltenant.com"
}

variable "common_deps_layer_arn" {
  description = "ARN of the common dependencies Lambda layer"
  type        = string
}

variable "ai_usage_table_name" {
  description = "Name of the AI usage tracking DynamoDB table"
  type        = string
  default     = ""
}

# ============================================================
# STRIPE CONFIGURATION VARIABLES
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
# MOLLIE CONFIGURATION VARIABLES
# ============================================================

variable "mollie_api_key" {
  description = "Mollie API Key (live_... or test_...)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "api_domain" {
  description = "API Domain for webhook URLs (e.g., api.viraltenant.com)"
  type        = string
  default     = "api.viraltenant.com"
}

# ============================================================
# MOLLIE CONNECT (OAuth) CONFIGURATION VARIABLES
# ============================================================

variable "mollie_client_id" {
  description = "Mollie OAuth Client ID (app_...)"
  type        = string
  default     = ""
}

variable "mollie_client_secret" {
  description = "Mollie OAuth Client Secret"
  type        = string
  sensitive   = true
  default     = ""
}

variable "mollie_redirect_uri" {
  description = "Mollie OAuth Redirect URI"
  type        = string
  default     = ""
}

variable "mollie_profile_id" {
  description = "Mollie Profile ID (pfl_...)"
  type        = string
  default     = ""
}
