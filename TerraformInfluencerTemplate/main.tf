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

  default_tags {
    tags = merge(
      var.tags,
      {
        Project     = var.project_name
        Environment = var.environment
        ManagedBy   = "Terraform"
      }
    )
  }
}

# Provider für us-east-1 (für CloudFront Zertifikate)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = merge(
      var.tags,
      {
        Project     = var.project_name
        Environment = var.environment
        ManagedBy   = "Terraform"
      }
    )
  }
}

# Route53 Zone (optional erstellen oder existierende verwenden)
resource "aws_route53_zone" "main" {
  count = var.create_route53_zone ? 1 : 0
  name  = var.domain_name
}

locals {
  zone_id = var.create_route53_zone ? aws_route53_zone.main[0].zone_id : var.route53_zone_id
}

# S3 Website Hosting mit CloudFront
module "website" {
  source = "./modules/s3-website"

  project_name    = var.project_name
  domain_name     = var.website_domain
  route53_zone_id = local.zone_id

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }
}

# Kontaktformular Backend
module "contact_form" {
  source = "./modules/contact-form"

  project_name    = var.project_name
  sender_email    = var.contact_email_sender
  recipient_email = var.contact_email_recipient
  allowed_origins = ["https://${var.website_domain}"]

  # SES Domain Verification
  verify_domain   = true
  domain_name     = var.domain_name
  route53_zone_id = local.zone_id
}

# IVS Streaming
module "ivs_streaming" {
  count  = var.enable_ivs_streaming ? 1 : 0
  source = "./modules/ivs-streaming"

  project_name = var.project_name
  channel_name = var.ivs_channel_name
  channel_type = var.ivs_channel_type
}

# IVS Chat
module "ivs_chat" {
  count  = var.enable_ivs_chat ? 1 : 0
  source = "./modules/ivs-chat"

  project_name = var.project_name
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
  allowed_origins = ["https://${var.website_domain}"]
}

# Shop / E-Commerce
module "shop" {
  count  = var.enable_shop ? 1 : 0
  source = "./modules/shop"

  project_name           = var.project_name
  allowed_origins        = ["https://${var.website_domain}"]
  stripe_secret_key      = var.stripe_secret_key
  stripe_publishable_key = var.stripe_publishable_key
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
  allowed_origins           = ["https://${var.website_domain}"]

  depends_on = [module.user_auth]
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

  depends_on = [module.user_auth, module.video_management]
}
