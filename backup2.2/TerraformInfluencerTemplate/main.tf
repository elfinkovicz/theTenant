terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Provider für us-east-1 (für CloudFront Zertifikate)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

# Route53 Zone (optional erstellen oder existierende verwenden)
resource "aws_route53_zone" "main" {
  count = var.create_route53_zone ? 1 : 0
  name  = var.domain_name
}

locals {
  zone_id = var.create_route53_zone ? aws_route53_zone.main[0].zone_id : var.route53_zone_id
}

# Lambda Layers - Shared dependencies for all Lambda functions
module "lambda_layers" {
  source = "./modules/lambda-layers"

  project_name = var.project_name
}

# S3 Website Hosting mit CloudFront
module "website" {
  source = "./modules/s3-website"

  project_name              = var.project_name
  domain_name               = var.domain_name
  website_domain            = var.website_domain
  route53_zone_id           = local.zone_id
  media_bucket_domain_name  = var.enable_video_management ? module.video_management[0].thumbnails_bucket_domain : ""

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  depends_on = [module.video_management]
}

# Kontaktformular Backend
module "contact_form" {
  source = "./modules/contact-form"

  project_name    = var.project_name
  sender_email    = var.contact_email_sender
  recipient_email = var.contact_email_recipient
  allowed_origins = ["https://${var.domain_name}", "https://${var.website_domain}"]

  # SES Domain Verification
  verify_domain   = true
  domain_name     = var.domain_name
  route53_zone_id = local.zone_id
}

# IVS Streaming
module "ivs_streaming" {
  count  = var.enable_ivs_streaming ? 1 : 0
  source = "./modules/ivs-streaming"

  project_name              = var.project_name
  channel_name              = var.ivs_channel_name
  channel_type              = var.ivs_channel_type
  api_gateway_id            = var.enable_user_auth ? module.user_auth[0].api_gateway_id : ""
  api_gateway_execution_arn = var.enable_user_auth ? module.user_auth[0].api_gateway_execution_arn : ""
  
  depends_on = [module.user_auth]
}

# IVS Chat
module "ivs_chat" {
  count  = var.enable_ivs_chat ? 1 : 0
  source = "./modules/ivs-chat"

  project_name = var.project_name
  
  # Lambda Layers
  aws_sdk_extended_layer_arn = module.lambda_layers.aws_sdk_extended_layer_arn
  
  depends_on = [module.lambda_layers]
}

# User Authentication
module "user_auth" {
  count  = var.enable_user_auth ? 1 : 0
  source = "./modules/user-auth"

  project_name            = var.project_name
  callback_urls           = var.cognito_callback_urls
  logout_urls             = var.cognito_logout_urls
  allow_user_registration = var.allow_user_registration
  website_domain          = var.website_domain
}

# Sponsor System
module "sponsor_system" {
  count  = var.enable_sponsor_system ? 1 : 0
  source = "./modules/sponsor-system"

  project_name    = var.project_name
  allowed_origins = ["https://${var.domain_name}", "https://${var.website_domain}"]
}

# Shop / E-Commerce
module "shop" {
  count  = var.enable_shop ? 1 : 0
  source = "./modules/shop"

  project_name           = var.project_name
  allowed_origins        = ["https://${var.domain_name}", "https://${var.website_domain}"]
  stripe_secret_key      = var.stripe_secret_key
  stripe_publishable_key = var.stripe_publishable_key
  
  # New variables for extended shop module
  frontend_url           = "https://${var.domain_name}"
  sender_email           = var.contact_email_sender
  shop_name              = var.project_name
  cognito_authorizer_id  = ""  # Shop API uses its own authorizer
  cognito_user_pool_id   = var.enable_user_auth ? module.user_auth[0].user_pool_id : ""
  cognito_client_id      = var.enable_user_auth ? module.user_auth[0].client_id : ""
  
  # Shop Owner Email
  shop_owner_email       = var.contact_email_recipient
  
  # Lambda Layers
  aws_sdk_core_layer_arn     = module.lambda_layers.aws_sdk_core_layer_arn
  aws_sdk_extended_layer_arn = module.lambda_layers.aws_sdk_extended_layer_arn
  utilities_layer_arn        = module.lambda_layers.utilities_layer_arn

  depends_on = [module.lambda_layers, module.user_auth]
}

# Video Management (Admin)
module "video_management" {
  count  = var.enable_video_management ? 1 : 0
  source = "./modules/video-management"

  project_name              = var.project_name
  environment               = var.environment
  user_pool_id              = module.user_auth[0].user_pool_id
  api_gateway_id            = module.user_auth[0].api_gateway_id
  api_gateway_execution_arn = module.user_auth[0].api_gateway_execution_arn
  authorizer_id             = module.user_auth[0].authorizer_id
  allowed_origins           = ["https://${var.domain_name}", "https://${var.website_domain}"]

  
  # Lambda Layers
  aws_sdk_core_layer_arn = module.lambda_layers.aws_sdk_core_layer_arn
  utilities_layer_arn = module.lambda_layers.utilities_layer_arn

  depends_on = [module.lambda_layers, module.user_auth]
}

# Team Management (Admin)
module "team_management" {
  count  = var.enable_team_management ? 1 : 0
  source = "./modules/team-management"

  project_name              = var.project_name
  environment               = var.environment
  user_pool_id              = module.user_auth[0].user_pool_id
  api_gateway_id            = module.user_auth[0].api_gateway_id
  api_gateway_execution_arn = module.user_auth[0].api_gateway_execution_arn
  authorizer_id             = module.user_auth[0].authorizer_id

  # Nutze den Thumbnails-Bucket und CDN vom Video-Management
  assets_bucket_name = module.video_management[0].thumbnails_bucket_name
  cdn_domain         = replace(module.video_management[0].thumbnails_cdn_url, "https://", "")

  
  # Lambda Layers
  aws_sdk_core_layer_arn = module.lambda_layers.aws_sdk_core_layer_arn

  depends_on = [module.user_auth, module.video_management]
}

# Event Management (Admin)
module "event_management" {
  count  = var.enable_event_management ? 1 : 0
  source = "./modules/event-management"

  project_name              = var.project_name
  environment               = var.environment
  user_pool_id              = module.user_auth[0].user_pool_id
  api_gateway_id            = module.user_auth[0].api_gateway_id
  api_gateway_execution_arn = module.user_auth[0].api_gateway_execution_arn
  authorizer_id             = module.user_auth[0].authorizer_id

  # Nutze den Thumbnails-Bucket und CDN vom Video-Management
  assets_bucket_name = module.video_management[0].thumbnails_bucket_name
  cdn_domain         = replace(module.video_management[0].thumbnails_cdn_url, "https://", "")

  
  # Lambda Layers
  aws_sdk_core_layer_arn = module.lambda_layers.aws_sdk_core_layer_arn

  depends_on = [module.user_auth, module.video_management]
}

# Advertisement Management (Admin)
module "ad_management" {
  count  = var.enable_ad_management ? 1 : 0
  source = "./modules/ad-management"

  project_name              = var.project_name
  environment               = var.environment
  user_pool_id              = module.user_auth[0].user_pool_id
  api_gateway_id            = module.user_auth[0].api_gateway_id
  api_gateway_execution_arn = module.user_auth[0].api_gateway_execution_arn
  authorizer_id             = module.user_auth[0].authorizer_id

  # Nutze den Thumbnails-Bucket und CDN vom Video-Management
  assets_bucket_name = module.video_management[0].thumbnails_bucket_name
  cdn_domain         = replace(module.video_management[0].thumbnails_cdn_url, "https://", "")

  
  # Lambda Layers
  aws_sdk_core_layer_arn = module.lambda_layers.aws_sdk_core_layer_arn

  depends_on = [module.user_auth, module.video_management]
}

# Hero Management (Admin)
module "hero_management" {
  count  = var.enable_hero_management ? 1 : 0
  source = "./modules/hero-management"

  project_name              = var.project_name
  environment               = var.environment
  user_pool_id              = module.user_auth[0].user_pool_id
  api_gateway_id            = module.user_auth[0].api_gateway_id
  api_gateway_execution_arn = module.user_auth[0].api_gateway_execution_arn
  authorizer_id             = module.user_auth[0].authorizer_id

  # Nutze den Thumbnails-Bucket und CDN vom Video-Management
  assets_bucket_name = module.video_management[0].thumbnails_bucket_name
  cdn_domain         = replace(module.video_management[0].thumbnails_cdn_url, "https://", "")
  
  # Lambda Layers
  aws_sdk_core_layer_arn = module.lambda_layers.aws_sdk_core_layer_arn

  depends_on = [module.user_auth, module.video_management, module.lambda_layers]
}

# Product Management (Admin)
module "product_management" {
  count  = var.enable_product_management ? 1 : 0
  source = "./modules/product-management"

  project_name              = var.project_name
  environment               = var.environment
  user_pool_id              = module.user_auth[0].user_pool_id
  user_pool_client_id       = module.user_auth[0].client_id
  api_gateway_id            = module.shop[0].api_gateway_id
  api_gateway_execution_arn = module.shop[0].api_gateway_execution_arn
  authorizer_id             = module.user_auth[0].authorizer_id

  # Nutze Shop-Modul Ressourcen
  products_table_name = module.shop[0].products_table_name
  products_table_arn  = module.shop[0].products_table_arn
  images_bucket_name  = module.shop[0].product_images_bucket_name
  cdn_domain          = "${module.shop[0].product_images_bucket_name}.s3.${var.aws_region}.amazonaws.com"

  
  # Lambda Layers
  aws_sdk_core_layer_arn = module.lambda_layers.aws_sdk_core_layer_arn

  depends_on = [module.lambda_layers, module.user_auth, module.shop]
}

# Channel Management (Admin)
module "channel_management" {
  count  = var.enable_channel_management ? 1 : 0
  source = "./modules/channel-management"

  project_name              = var.project_name
  environment               = var.environment
  user_pool_id              = module.user_auth[0].user_pool_id
  api_gateway_id            = module.user_auth[0].api_gateway_id
  api_gateway_execution_arn = module.user_auth[0].api_gateway_execution_arn
  authorizer_id             = module.user_auth[0].authorizer_id

  
  # Lambda Layers
  aws_sdk_core_layer_arn = module.lambda_layers.aws_sdk_core_layer_arn

  depends_on = [module.user_auth]
}

# Contact Info Management (Admin)
module "contact_info_management" {
  count  = var.enable_contact_info_management ? 1 : 0
  source = "./modules/contact-info-management"

  project_name              = var.project_name
  environment               = var.environment
  user_pool_id              = module.user_auth[0].user_pool_id
  api_gateway_id            = module.user_auth[0].api_gateway_id
  api_gateway_execution_arn = module.user_auth[0].api_gateway_execution_arn
  authorizer_id             = module.user_auth[0].authorizer_id

  
  # Lambda Layers
  aws_sdk_core_layer_arn = module.lambda_layers.aws_sdk_core_layer_arn

  depends_on = [module.user_auth]
}

# Legal Management (Admin)
module "legal_management" {
  count  = var.enable_legal_management ? 1 : 0
  source = "./modules/legal-management"

  project_name              = var.project_name
  environment               = var.environment
  user_pool_id              = module.user_auth[0].user_pool_id
  api_gateway_id            = module.user_auth[0].api_gateway_id
  api_gateway_execution_arn = module.user_auth[0].api_gateway_execution_arn
  authorizer_id             = module.user_auth[0].authorizer_id

  
  # Lambda Layers
  aws_sdk_core_layer_arn = module.lambda_layers.aws_sdk_core_layer_arn

  depends_on = [module.user_auth]
}

# Stream Restreaming (Admin)
module "stream_restreaming" {
  count  = var.enable_stream_restreaming ? 1 : 0
  source = "./modules/stream-restreaming"

  project_name              = var.project_name
  ivs_channel_arn           = module.ivs_streaming[0].channel_arn
  ivs_playback_url          = module.ivs_streaming[0].playback_url
  api_gateway_id            = module.user_auth[0].api_gateway_id
  api_gateway_execution_arn = module.user_auth[0].api_gateway_execution_arn
  authorizer_id             = module.user_auth[0].authorizer_id
  cognito_user_pool_arn     = module.user_auth[0].user_pool_arn

  depends_on = [module.user_auth, module.ivs_streaming]
}

# Newsfeed Management (Admin)
module "newsfeed_management" {
  count  = var.enable_newsfeed_management ? 1 : 0
  source = "./modules/newsfeed-management"

  project_name              = var.project_name
  environment               = var.environment
  user_pool_id              = module.user_auth[0].user_pool_id
  api_gateway_id            = module.user_auth[0].api_gateway_id
  api_gateway_execution_arn = module.user_auth[0].api_gateway_execution_arn
  authorizer_id             = module.user_auth[0].authorizer_id

  # Nutze den Thumbnails-Bucket und CDN vom Video-Management
  assets_bucket_name = module.video_management[0].thumbnails_bucket_name
  cdn_domain         = replace(module.video_management[0].thumbnails_cdn_url, "https://", "")

  # Messaging Settings für Telegram Integration
  settings_table_name = var.enable_telegram_integration && length(module.messaging_settings) > 0 ? module.messaging_settings[0].settings_table_name : ""
  settings_table_arn  = var.enable_telegram_integration && length(module.messaging_settings) > 0 ? module.messaging_settings[0].settings_table_arn : ""

  
  # Lambda Layers
  aws_sdk_core_layer_arn = module.lambda_layers.aws_sdk_core_layer_arn

  depends_on = [module.user_auth, module.video_management, module.messaging_settings]
}

# WhatsApp Integration
module "whatsapp_integration" {
  count  = var.enable_whatsapp_integration ? 1 : 0
  source = "./modules/whatsapp-integration"

  project_name               = var.project_name
  whatsapp_phone_number_id   = var.whatsapp_phone_number_id
  whatsapp_group_id          = var.whatsapp_group_id
  cdn_domain                 = replace(module.video_management[0].thumbnails_cdn_url, "https://", "")
  newsfeed_table_stream_arn  = module.newsfeed_management[0].dynamodb_table_stream_arn

  depends_on = [module.newsfeed_management, module.video_management]
}

# Telegram Integration
module "telegram_integration" {
  count  = var.enable_telegram_integration ? 1 : 0
  source = "./modules/telegram-integration"

  project_name               = var.project_name
  telegram_bot_token         = var.telegram_bot_token
  telegram_chat_id           = var.telegram_chat_id
  cdn_domain                 = replace(module.video_management[0].thumbnails_cdn_url, "https://", "")
  newsfeed_table_stream_arn  = module.newsfeed_management[0].dynamodb_table_stream_arn
  settings_table_name        = module.messaging_settings[0].settings_table_name
  settings_table_arn         = module.messaging_settings[0].settings_table_arn

  
  # Lambda Layers
  aws_sdk_core_layer_arn = module.lambda_layers.aws_sdk_core_layer_arn

  depends_on = [module.newsfeed_management, module.video_management, module.messaging_settings]
}

# Messaging Settings API
module "messaging_settings" {
  count  = var.enable_newsfeed_management ? 1 : 0
  source = "./modules/messaging-settings"

  project_name              = var.project_name
  environment               = var.environment
  api_gateway_id            = module.user_auth[0].api_gateway_id
  api_gateway_execution_arn = module.user_auth[0].api_gateway_execution_arn
  authorizer_id             = module.user_auth[0].authorizer_id
  admin_group_name          = "admins"

  depends_on = [module.user_auth]
}

# Billing System
module "billing_system" {
  count  = var.enable_billing_system ? 1 : 0
  source = "./modules/billing-system"

  project_name              = var.project_name
  user_pool_id              = module.user_auth[0].user_pool_id
  api_gateway_id            = module.user_auth[0].api_gateway_id
  api_gateway_execution_arn = module.user_auth[0].api_gateway_execution_arn
  authorizer_id             = module.user_auth[0].authorizer_id
  stripe_secret_key         = var.stripe_secret_key
  stripe_publishable_key    = var.stripe_publishable_key
  stripe_webhook_secret     = var.stripe_webhook_secret
  base_fee                  = var.billing_base_fee
  
  # Lambda Layers
  aws_sdk_core_layer_arn = module.lambda_layers.aws_sdk_core_layer_arn
  utilities_layer_arn    = module.lambda_layers.utilities_layer_arn

  depends_on = [module.user_auth, module.lambda_layers]
}
