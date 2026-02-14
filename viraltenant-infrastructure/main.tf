terraform {
  required_version = ">= 1.0"

  backend "s3" {
    bucket         = "creator-platform-terraform-state-multitenant"
    key            = "terraform.tfstate"
    region         = "eu-central-1"
    encrypt        = true
    dynamodb_table = "creator-platform-terraform-locks-multitenant"
    profile        = "viraltenant"
  }

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

# Provider für us-east-1 (für CloudFront SSL Certificates)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

# Data source for current AWS account ID
data "aws_caller_identity" "current" {}

# Route 53 DNS Configuration (conditional)
module "route53" {
  count  = var.enable_route53_dns ? 1 : 0
  source = "./modules/route53"

  domain_name             = var.platform_domain
  create_hosted_zone      = var.create_hosted_zone
  existing_hosted_zone_id = var.existing_hosted_zone_id

  # CloudFront DNS Records - werden in einem separaten Schritt erstellt
  cloudfront_domain_name    = "" # Wird später über separate DNS Records konfiguriert
  cloudfront_hosted_zone_id = ""

  # Optional: API Gateway Domain (disabled for now - no custom domain configured)
  api_gateway_domain_name    = "" # Will be configured later when API Gateway custom domain is set up
  api_gateway_hosted_zone_id = ""

  # Optional: MX Records für E-Mail
  mx_records = var.enable_mx_records ? var.mx_records : []

  # Optional: TXT Records für Domain Verification
  txt_records = var.enable_txt_records ? var.txt_records : []

  # DNS TTL Settings
  dns_ttl_mx  = var.dns_ttl_mx
  dns_ttl_txt = var.dns_ttl_txt

  tags = merge(var.tags, {
    Component = "DNS"
    Domain    = var.platform_domain
  })

  providers = {
    aws.us_east_1 = aws.us_east_1
  }
}

# Tenant Management
module "tenant_management" {
  source = "./modules/tenant-management"

  platform_name                 = var.platform_name
  environment                   = var.environment
  enable_point_in_time_recovery = var.enable_point_in_time_recovery

  tags = var.tags
}

# S3 Tenant Storage
module "s3_tenant_storage" {
  source = "./modules/s3-tenant-storage"

  platform_name     = var.platform_name
  environment       = var.environment
  platform_domain   = var.platform_domain
  enable_versioning = var.enable_versioning

  tags = var.tags
}

# CloudFront Distribution
module "cloudfront" {
  source = "./modules/cloudfront"

  platform_name      = var.platform_name
  environment        = var.environment
  platform_domain    = var.platform_domain
  cloudfront_domains = var.cloudfront_domains

  enable_custom_domains = var.enable_cloudfront_custom_domains
  ssl_certificate_mode  = var.cloudfront_ssl_certificate
  # SSL-Zertifikat kommt immer vom Route53 Modul (falls Route53 aktiviert)
  ssl_certificate_arn = var.enable_route53_dns ? module.route53[0].ssl_certificate_arn : var.cloudfront_ssl_certificate_arn

  default_ttl = var.cloudfront_default_ttl
  max_ttl     = var.cloudfront_max_ttl
  website_ttl = var.cloudfront_website_ttl
  compression = var.cloudfront_compression

  enable_versioning = var.enable_versioning

  # Creator Assets Integration
  creator_assets_bucket_domain_name = module.s3_tenant_storage.creator_assets_bucket_domain_name
  creator_assets_oac_id             = module.s3_tenant_storage.creator_assets_oac_id
  creator_assets_ttl                = var.creator_assets_ttl
  creator_assets_max_ttl            = var.creator_assets_max_ttl

  # Additional CloudFront distributions that need bucket access (e.g., custom domain distributions)
  additional_cloudfront_arns = var.additional_cloudfront_arns

  tags = var.tags

  providers = {
    aws.us_east_1 = aws.us_east_1
  }

  depends_on = [module.route53]
}

# Central Authentication
module "central_auth" {
  source = "./modules/central-auth"

  platform_name   = var.platform_name
  environment     = var.environment
  aws_region      = var.aws_region
  platform_domain = var.platform_domain

  password_policy       = var.password_policy
  common_deps_layer_arn = module.lambda_layers.common_deps_layer_arn

  tags = var.tags

  depends_on = [module.lambda_layers]
}

# Lambda Layers - Must be defined before modules that use it
module "lambda_layers" {
  source = "./modules/lambda-layers"

  project_name = var.platform_name
}

# Lambda Authorizer
module "lambda_authorizer" {
  source = "./modules/lambda-authorizer"

  platform_name   = var.platform_name
  environment     = var.environment
  aws_region      = var.aws_region
  platform_domain = var.platform_domain

  cognito_user_pool_id    = module.central_auth.user_pool_id
  cognito_user_pool_arn   = module.central_auth.user_pool_arn
  cognito_client_id       = module.central_auth.client_id
  tenants_table_name      = module.tenant_management.tenants_table_name
  tenants_table_arn       = module.tenant_management.tenants_table_arn
  user_tenants_table_name = module.tenant_management.user_tenants_table_name
  user_tenants_table_arn  = module.tenant_management.user_tenants_table_arn
  api_gateway_id          = module.central_auth.api_gateway_id
  common_deps_layer_arn   = module.lambda_layers.common_deps_layer_arn

  tags = var.tags

  depends_on = [module.central_auth, module.tenant_management, module.lambda_layers]
}

# Tenant API
module "tenant_api" {
  source = "./modules/tenant-api"

  platform_name   = var.platform_name
  environment     = var.environment
  aws_region      = var.aws_region
  platform_domain = var.platform_domain

  tenants_table_name      = module.tenant_management.tenants_table_name
  tenants_table_arn       = module.tenant_management.tenants_table_arn
  user_tenants_table_name = module.tenant_management.user_tenants_table_name
  user_tenants_table_arn  = module.tenant_management.user_tenants_table_arn

  hosted_zone_id         = var.enable_route53_dns ? module.route53[0].hosted_zone_id : ""
  cloudfront_domain_name = module.cloudfront.cloudfront_domain_name

  api_gateway_id               = module.central_auth.api_gateway_id
  api_gateway_root_resource_id = module.central_auth.api_gateway_root_resource_id
  api_gateway_execution_arn    = module.central_auth.api_gateway_execution_arn
  lambda_authorizer_id         = module.lambda_authorizer.lambda_authorizer_id
  user_pool_id                 = module.central_auth.user_pool_id

  # S3 bucket for tenant assets deletion
  creator_assets_bucket_name = module.s3_tenant_storage.creator_assets_bucket_name
  creator_assets_bucket_arn  = module.s3_tenant_storage.creator_assets_bucket_arn

  # Tenant-specific tables for deletion functionality - use constructed names to avoid cycles
  tenant_live_table_name     = "${var.platform_name}-tenant-live-${var.environment}"
  tenant_live_table_arn      = "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.platform_name}-tenant-live-${var.environment}"
  tenant_newsfeed_table_name = "${var.platform_name}-tenant-newsfeed-${var.environment}"
  tenant_newsfeed_table_arn  = "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.platform_name}-tenant-newsfeed-${var.environment}"
  tenant_frontend_table_name = "${var.platform_name}-tenant-frontend-${var.environment}"
  tenant_frontend_table_arn  = "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.platform_name}-tenant-frontend-${var.environment}"
  tenant_events_table_name   = "${var.platform_name}-tenant-events-${var.environment}"
  tenant_events_table_arn    = "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.platform_name}-tenant-events-${var.environment}"
  tenant_contact_table_name  = "${var.platform_name}-tenant-contact-${var.environment}"
  tenant_contact_table_arn   = "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.platform_name}-tenant-contact-${var.environment}"
  tenant_team_table_name     = "${var.platform_name}-tenant-team-${var.environment}"
  tenant_team_table_arn      = "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.platform_name}-tenant-team-${var.environment}"
  tenant_shop_table_name     = "${var.platform_name}-tenant-shop-${var.environment}"
  tenant_shop_table_arn      = "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.platform_name}-tenant-shop-${var.environment}"
  tenant_videos_table_name   = "${var.platform_name}-tenant-videos-${var.environment}"
  tenant_videos_table_arn    = "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.platform_name}-tenant-videos-${var.environment}"
  tenant_channels_table_name = "${var.platform_name}-tenant-channels-${var.environment}"
  tenant_channels_table_arn  = "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.platform_name}-tenant-channels-${var.environment}"
  tenant_podcasts_table_name = "${var.platform_name}-tenant-podcasts-${var.environment}"
  tenant_podcasts_table_arn  = "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.platform_name}-tenant-podcasts-${var.environment}"

  common_deps_layer_arn = module.lambda_layers.common_deps_layer_arn

  tags = var.tags

  depends_on = [module.central_auth, module.tenant_management, module.lambda_authorizer, module.s3_tenant_storage, module.lambda_layers]
}

# Billing API
module "billing_api" {
  source = "./modules/billing-api"

  platform_name = var.platform_name
  environment   = var.environment
  aws_region    = var.aws_region

  api_gateway_id               = module.central_auth.api_gateway_id
  api_gateway_root_resource_id = module.central_auth.api_gateway_root_resource_id
  api_gateway_execution_arn    = module.central_auth.api_gateway_execution_arn
  lambda_authorizer_id         = module.lambda_authorizer.lambda_authorizer_id

  # Variables for Billing Cron
  tenants_table_name      = module.tenant_management.tenants_table_name
  user_tenants_table_name = module.tenant_management.user_tenants_table_name
  assets_bucket_name      = module.cloudfront.s3_bucket_name
  user_pool_id            = module.central_auth.user_pool_id
  domain                  = var.platform_domain
  common_deps_layer_arn   = module.lambda_layers.common_deps_layer_arn
  ai_usage_table_name     = "${var.platform_name}-ai-usage-${var.environment}"

  # Stripe Configuration
  stripe_secret_key      = var.stripe_secret_key
  stripe_publishable_key = var.stripe_publishable_key
  stripe_webhook_secret  = var.stripe_webhook_secret
  stripe_price_id        = var.stripe_price_id

  # Mollie Configuration
  mollie_api_key = var.mollie_api_key
  api_domain     = "api.${var.platform_domain}"

  tags = var.tags

  depends_on = [module.central_auth, module.lambda_authorizer, module.tenant_management, module.cloudfront, module.lambda_layers]
}

# Billing Dashboard (billing.viraltenant.com)
module "billing_dashboard" {
  source = "./modules/billing-dashboard"

  platform_name        = var.platform_name
  environment          = var.environment
  domain               = var.platform_domain
  enable_custom_domain = var.enable_route53_dns
  hosted_zone_id       = var.enable_route53_dns ? module.route53[0].hosted_zone_id : ""
  acm_certificate_arn  = var.enable_route53_dns ? module.route53[0].ssl_certificate_arn : ""

  tags = var.tags

  depends_on = [module.route53]
}

# Tenant Registration
module "tenant_registration" {
  source = "./modules/tenant-registration"

  platform_name   = var.platform_name
  environment     = var.environment
  aws_region      = var.aws_region
  platform_domain = var.platform_domain

  api_gateway_id               = module.central_auth.api_gateway_id
  api_gateway_root_resource_id = module.central_auth.api_gateway_root_resource_id
  api_gateway_execution_arn    = module.central_auth.api_gateway_execution_arn
  lambda_authorizer_id         = module.lambda_authorizer.lambda_authorizer_id

  tenants_table_name      = module.tenant_management.tenants_table_name
  tenants_table_arn       = module.tenant_management.tenants_table_arn
  user_tenants_table_name = module.tenant_management.user_tenants_table_name
  user_tenants_table_arn  = module.tenant_management.user_tenants_table_arn
  tenant_live_table_name  = module.tenant_live.tenant_live_table_name
  tenant_live_table_arn   = module.tenant_live.tenant_live_table_arn

  hosted_zone_id         = var.enable_route53_dns ? module.route53[0].hosted_zone_id : ""
  cloudfront_domain_name = module.cloudfront.cloudfront_domain_name

  creator_assets_bucket_name = module.s3_tenant_storage.creator_assets_bucket_name
  creator_assets_bucket_arn  = module.s3_tenant_storage.creator_assets_bucket_arn

  cognito_user_pool_id  = module.central_auth.user_pool_id
  cognito_user_pool_arn = module.central_auth.user_pool_arn

  # Lambda Layer ARN
  tenant_registration_deps_layer_arn = module.lambda_layers.tenant_registration_deps_layer_arn

  tags = var.tags

  depends_on = [module.central_auth, module.tenant_management, module.lambda_authorizer, module.s3_tenant_storage, module.lambda_layers, module.tenant_live]
}

# Tenant Frontend Configuration (Hero, Theme, Design)
module "tenant_frontend" {
  source = "./modules/tenant-frontend"

  platform_name   = var.platform_name
  environment     = var.environment
  aws_region      = var.aws_region
  platform_domain = var.platform_domain

  api_gateway_id               = module.central_auth.api_gateway_id
  api_gateway_root_resource_id = module.central_auth.api_gateway_root_resource_id
  api_gateway_execution_arn    = module.central_auth.api_gateway_execution_arn
  lambda_authorizer_id         = module.lambda_authorizer.lambda_authorizer_id

  tenants_resource_id      = module.tenant_api.tenants_resource_id
  tenant_by_id_resource_id = module.tenant_api.tenant_by_id_resource_id

  user_tenants_table_name = module.tenant_management.user_tenants_table_name
  user_tenants_table_arn  = module.tenant_management.user_tenants_table_arn
  tenants_table_name      = module.tenant_management.tenants_table_name
  tenants_table_arn       = module.tenant_management.tenants_table_arn

  creator_assets_bucket_name = module.s3_tenant_storage.creator_assets_bucket_name
  creator_assets_bucket_arn  = module.s3_tenant_storage.creator_assets_bucket_arn
  cloudfront_domain_name     = module.cloudfront.cloudfront_domain_name

  common_deps_layer_arn = module.lambda_layers.common_deps_layer_arn

  tags = var.tags

  depends_on = [module.central_auth, module.tenant_api, module.tenant_management, module.lambda_authorizer, module.s3_tenant_storage, module.lambda_layers]
}

# =============================================================================
# PAGE TAB MODULES - Separate modules for each webpage tab
# =============================================================================

# Tenant Live - Live Streaming Page
module "tenant_live" {
  source = "./modules/tenant-live"

  platform_name              = var.platform_name
  environment                = var.environment
  aws_region                 = var.aws_region
  tags                       = var.tags
  api_gateway_id             = module.central_auth.api_gateway_id
  api_gateway_execution_arn  = module.central_auth.api_gateway_execution_arn
  tenant_by_id_resource_id   = module.tenant_api.tenant_by_id_resource_id
  lambda_authorizer_id       = module.lambda_authorizer.lambda_authorizer_id
  user_tenants_table_arn     = module.tenant_management.user_tenants_table_arn
  user_tenants_table_name    = module.tenant_management.user_tenants_table_name
  tenants_table_arn          = module.tenant_management.tenants_table_arn
  tenants_table_name         = module.tenant_management.tenants_table_name
  creator_assets_bucket_arn  = module.s3_tenant_storage.creator_assets_bucket_arn
  creator_assets_bucket_name = module.s3_tenant_storage.creator_assets_bucket_name
  cloudfront_domain_name     = module.cloudfront.cloudfront_domain_name
  common_deps_layer_arn      = module.lambda_layers.common_deps_layer_arn
  # YouTube OAuth
  api_base_url          = "https://${module.central_auth.api_gateway_id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment}"
  encryption_key        = var.oauth_encryption_key
  youtube_client_id     = var.youtube_client_id
  youtube_client_secret = var.youtube_client_secret
  # Auto-Publish to Newsfeed
  tenant_newsfeed_table_name       = module.tenant_newsfeed.tenant_newsfeed_table_name
  tenant_newsfeed_table_arn        = module.tenant_newsfeed.tenant_newsfeed_table_arn
  crosspost_dispatcher_lambda_name = module.tenant_crosspost.crosspost_dispatcher_function_name
  crosspost_dispatcher_lambda_arn  = module.tenant_crosspost.crosspost_dispatcher_function_arn

  depends_on = [module.tenant_api, module.lambda_layers, module.tenant_newsfeed, module.tenant_crosspost]
}

# Tenant Videos - Video Content Page
module "tenant_videos" {
  source = "./modules/tenant-videos"

  platform_name              = var.platform_name
  environment                = var.environment
  aws_region                 = var.aws_region
  tags                       = var.tags
  api_gateway_id             = module.central_auth.api_gateway_id
  api_gateway_execution_arn  = module.central_auth.api_gateway_execution_arn
  tenant_by_id_resource_id   = module.tenant_api.tenant_by_id_resource_id
  lambda_authorizer_id       = module.lambda_authorizer.lambda_authorizer_id
  user_tenants_table_arn     = module.tenant_management.user_tenants_table_arn
  user_tenants_table_name    = module.tenant_management.user_tenants_table_name
  tenants_table_arn          = module.tenant_management.tenants_table_arn
  tenants_table_name         = module.tenant_management.tenants_table_name
  creator_assets_bucket_arn  = module.s3_tenant_storage.creator_assets_bucket_arn
  creator_assets_bucket_name = module.s3_tenant_storage.creator_assets_bucket_name
  cloudfront_domain_name     = module.cloudfront.cloudfront_domain_name
  common_deps_layer_arn      = module.lambda_layers.common_deps_layer_arn

  depends_on = [module.tenant_api, module.lambda_layers]
}

# Tenant Shop - E-Commerce Page
module "tenant_shop" {
  source = "./modules/tenant-shop"

  platform_name              = var.platform_name
  environment                = var.environment
  aws_region                 = var.aws_region
  tags                       = var.tags
  api_gateway_id             = module.central_auth.api_gateway_id
  api_gateway_execution_arn  = module.central_auth.api_gateway_execution_arn
  tenant_by_id_resource_id   = module.tenant_api.tenant_by_id_resource_id
  lambda_authorizer_id       = module.lambda_authorizer.lambda_authorizer_id
  user_tenants_table_arn     = module.tenant_management.user_tenants_table_arn
  user_tenants_table_name    = module.tenant_management.user_tenants_table_name
  tenants_table_arn          = module.tenant_management.tenants_table_arn
  tenants_table_name         = module.tenant_management.tenants_table_name
  creator_assets_bucket_arn  = module.s3_tenant_storage.creator_assets_bucket_arn
  creator_assets_bucket_name = module.s3_tenant_storage.creator_assets_bucket_name
  cloudfront_domain_name     = module.cloudfront.cloudfront_domain_name
  common_deps_layer_arn      = module.lambda_layers.common_deps_layer_arn

  depends_on = [module.tenant_api, module.lambda_layers]
}

# Tenant Events - Event Management Page
module "tenant_events" {
  source = "./modules/tenant-events"

  platform_name              = var.platform_name
  environment                = var.environment
  aws_region                 = var.aws_region
  tags                       = var.tags
  api_gateway_id             = module.central_auth.api_gateway_id
  api_gateway_execution_arn  = module.central_auth.api_gateway_execution_arn
  tenant_by_id_resource_id   = module.tenant_api.tenant_by_id_resource_id
  lambda_authorizer_id       = module.lambda_authorizer.lambda_authorizer_id
  user_tenants_table_arn     = module.tenant_management.user_tenants_table_arn
  user_tenants_table_name    = module.tenant_management.user_tenants_table_name
  tenants_table_arn          = module.tenant_management.tenants_table_arn
  tenants_table_name         = module.tenant_management.tenants_table_name
  creator_assets_bucket_arn  = module.s3_tenant_storage.creator_assets_bucket_arn
  creator_assets_bucket_name = module.s3_tenant_storage.creator_assets_bucket_name
  cloudfront_domain_name     = module.cloudfront.cloudfront_domain_name
  common_deps_layer_arn      = module.lambda_layers.common_deps_layer_arn

  depends_on = [module.tenant_api, module.lambda_layers]
}

# Tenant Newsfeed - News/Posts Page
module "tenant_newsfeed" {
  source = "./modules/tenant-newsfeed"

  platform_name                = var.platform_name
  environment                  = var.environment
  aws_region                   = var.aws_region
  tags                         = var.tags
  api_gateway_id               = module.central_auth.api_gateway_id
  api_gateway_execution_arn    = module.central_auth.api_gateway_execution_arn
  api_gateway_root_resource_id = module.central_auth.api_gateway_root_resource_id
  tenant_by_id_resource_id     = module.tenant_api.tenant_by_id_resource_id
  lambda_authorizer_id         = module.lambda_authorizer.lambda_authorizer_id
  user_tenants_table_arn       = module.tenant_management.user_tenants_table_arn
  user_tenants_table_name      = module.tenant_management.user_tenants_table_name
  tenants_table_arn            = module.tenant_management.tenants_table_arn
  tenants_table_name           = module.tenant_management.tenants_table_name
  creator_assets_bucket_arn    = module.s3_tenant_storage.creator_assets_bucket_arn
  creator_assets_bucket_name   = module.s3_tenant_storage.creator_assets_bucket_name
  cloudfront_domain_name       = module.cloudfront.cloudfront_domain_name
  platform_domain              = var.platform_domain
  user_pool_id                 = module.central_auth.user_pool_id
  user_pool_arn                = module.central_auth.user_pool_arn
  common_deps_layer_arn        = module.lambda_layers.common_deps_layer_arn
  # Crosspost Dispatcher Lambda name (constructed to avoid circular dependency)
  crosspost_dispatcher_lambda_name = "${var.platform_name}-crosspost-dispatcher-${var.environment}"
  
  # OAuth Credentials (zentral verwaltet)
  meta_app_id            = var.meta_app_id
  meta_app_secret        = var.meta_app_secret
  instagram_app_id       = var.instagram_app_id
  instagram_app_secret   = var.instagram_app_secret
  threads_app_id         = var.threads_app_id
  threads_app_secret     = var.threads_app_secret
  google_client_id       = var.google_client_id
  google_client_secret   = var.google_client_secret
  linkedin_client_id     = var.linkedin_client_id
  linkedin_client_secret = var.linkedin_client_secret
  twitter_client_id       = var.twitter_client_id
  twitter_client_secret   = var.twitter_client_secret
  twitter_consumer_key    = var.twitter_consumer_key
  twitter_consumer_secret = var.twitter_consumer_secret
  tiktok_client_key      = var.tiktok_client_key
  tiktok_client_secret   = var.tiktok_client_secret
  snapchat_client_id     = var.snapchat_client_id
  snapchat_client_secret = var.snapchat_client_secret

  depends_on = [module.tenant_api, module.lambda_layers]
}

# Tenant Channels - Channel Management Page
module "tenant_channels" {
  source = "./modules/tenant-channels"

  platform_name              = var.platform_name
  environment                = var.environment
  aws_region                 = var.aws_region
  tags                       = var.tags
  api_gateway_id             = module.central_auth.api_gateway_id
  api_gateway_execution_arn  = module.central_auth.api_gateway_execution_arn
  tenant_by_id_resource_id   = module.tenant_api.tenant_by_id_resource_id
  lambda_authorizer_id       = module.lambda_authorizer.lambda_authorizer_id
  user_tenants_table_arn     = module.tenant_management.user_tenants_table_arn
  user_tenants_table_name    = module.tenant_management.user_tenants_table_name
  tenants_table_arn          = module.tenant_management.tenants_table_arn
  tenants_table_name         = module.tenant_management.tenants_table_name
  creator_assets_bucket_arn  = module.s3_tenant_storage.creator_assets_bucket_arn
  creator_assets_bucket_name = module.s3_tenant_storage.creator_assets_bucket_name
  cloudfront_domain_name     = module.cloudfront.cloudfront_domain_name
  common_deps_layer_arn      = module.lambda_layers.common_deps_layer_arn

  depends_on = [module.tenant_api, module.lambda_layers]
}

# Tenant Team - Team Members Page
module "tenant_team" {
  source = "./modules/tenant-team"

  platform_name              = var.platform_name
  environment                = var.environment
  aws_region                 = var.aws_region
  tags                       = var.tags
  api_gateway_id             = module.central_auth.api_gateway_id
  api_gateway_execution_arn  = module.central_auth.api_gateway_execution_arn
  tenant_by_id_resource_id   = module.tenant_api.tenant_by_id_resource_id
  lambda_authorizer_id       = module.lambda_authorizer.lambda_authorizer_id
  user_tenants_table_arn     = module.tenant_management.user_tenants_table_arn
  user_tenants_table_name    = module.tenant_management.user_tenants_table_name
  tenants_table_arn          = module.tenant_management.tenants_table_arn
  tenants_table_name         = module.tenant_management.tenants_table_name
  creator_assets_bucket_arn  = module.s3_tenant_storage.creator_assets_bucket_arn
  creator_assets_bucket_name = module.s3_tenant_storage.creator_assets_bucket_name
  cloudfront_domain_name     = module.cloudfront.cloudfront_domain_name
  common_deps_layer_arn      = module.lambda_layers.common_deps_layer_arn

  depends_on = [module.tenant_api, module.lambda_layers]
}

# Tenant Contact - Contact Info Page
module "tenant_contact" {
  source = "./modules/tenant-contact"

  platform_name              = var.platform_name
  environment                = var.environment
  aws_region                 = var.aws_region
  platform_domain            = var.platform_domain
  tags                       = var.tags
  api_gateway_id             = module.central_auth.api_gateway_id
  api_gateway_execution_arn  = module.central_auth.api_gateway_execution_arn
  tenant_by_id_resource_id   = module.tenant_api.tenant_by_id_resource_id
  lambda_authorizer_id       = module.lambda_authorizer.lambda_authorizer_id
  user_tenants_table_arn     = module.tenant_management.user_tenants_table_arn
  user_tenants_table_name    = module.tenant_management.user_tenants_table_name
  tenants_table_arn          = module.tenant_management.tenants_table_arn
  tenants_table_name         = module.tenant_management.tenants_table_name
  creator_assets_bucket_arn  = module.s3_tenant_storage.creator_assets_bucket_arn
  creator_assets_bucket_name = module.s3_tenant_storage.creator_assets_bucket_name
  cloudfront_domain_name     = module.cloudfront.cloudfront_domain_name
  cognito_user_pool_id       = module.central_auth.user_pool_id
  cognito_user_pool_arn      = module.central_auth.user_pool_arn
  common_deps_layer_arn      = module.lambda_layers.common_deps_layer_arn

  depends_on = [module.tenant_api, module.lambda_layers]
}

# Tenant Podcasts - Podcast Content Page
module "tenant_podcasts" {
  source = "./modules/tenant-podcasts"

  platform_name              = var.platform_name
  environment                = var.environment
  aws_region                 = var.aws_region
  tags                       = var.tags
  api_gateway_id             = module.central_auth.api_gateway_id
  api_gateway_execution_arn  = module.central_auth.api_gateway_execution_arn
  tenant_by_id_resource_id   = module.tenant_api.tenant_by_id_resource_id
  lambda_authorizer_id       = module.lambda_authorizer.lambda_authorizer_id
  user_tenants_table_arn     = module.tenant_management.user_tenants_table_arn
  user_tenants_table_name    = module.tenant_management.user_tenants_table_name
  tenants_table_arn          = module.tenant_management.tenants_table_arn
  tenants_table_name         = module.tenant_management.tenants_table_name
  creator_assets_bucket_arn  = module.s3_tenant_storage.creator_assets_bucket_arn
  creator_assets_bucket_name = module.s3_tenant_storage.creator_assets_bucket_name
  cloudfront_domain_name     = module.cloudfront.cloudfront_domain_name
  common_deps_layer_arn      = module.lambda_layers.common_deps_layer_arn

  depends_on = [module.tenant_api, module.lambda_layers]
}

# =============================================================================
# MODULAR CROSSPOSTING SYSTEM
# =============================================================================

module "tenant_crosspost" {
  source = "./modules/tenant-crosspost"

  platform_name              = var.platform_name
  environment                = var.environment
  aws_region                 = var.aws_region
  tags                       = var.tags
  common_deps_layer_arn      = module.lambda_layers.common_deps_layer_arn
  user_tenants_table_arn     = module.tenant_management.user_tenants_table_arn
  user_tenants_table_name    = module.tenant_management.user_tenants_table_name
  tenants_table_arn          = module.tenant_management.tenants_table_arn
  tenants_table_name         = module.tenant_management.tenants_table_name
  creator_assets_bucket_arn  = module.s3_tenant_storage.creator_assets_bucket_arn
  creator_assets_bucket_name = module.s3_tenant_storage.creator_assets_bucket_name
  cloudfront_domain_name     = module.cloudfront.cloudfront_domain_name
  encryption_key             = var.oauth_encryption_key

  # Crossposting Settings Tables from tenant-newsfeed module
  whatsapp_settings_table_name  = module.tenant_newsfeed.whatsapp_settings_table_name
  whatsapp_settings_table_arn   = module.tenant_newsfeed.whatsapp_settings_table_arn
  telegram_settings_table_name  = module.tenant_newsfeed.telegram_settings_table_name
  telegram_settings_table_arn   = module.tenant_newsfeed.telegram_settings_table_arn
  email_settings_table_name     = module.tenant_newsfeed.email_settings_table_name
  email_settings_table_arn      = module.tenant_newsfeed.email_settings_table_arn
  discord_settings_table_name   = module.tenant_newsfeed.discord_settings_table_name
  discord_settings_table_arn    = module.tenant_newsfeed.discord_settings_table_arn
  slack_settings_table_name     = module.tenant_newsfeed.slack_settings_table_name
  slack_settings_table_arn      = module.tenant_newsfeed.slack_settings_table_arn
  facebook_settings_table_name  = module.tenant_newsfeed.facebook_settings_table_name
  facebook_settings_table_arn   = module.tenant_newsfeed.facebook_settings_table_arn
  instagram_settings_table_name = module.tenant_newsfeed.instagram_settings_table_name
  instagram_settings_table_arn  = module.tenant_newsfeed.instagram_settings_table_arn
  signal_settings_table_name    = module.tenant_newsfeed.signal_settings_table_name
  signal_settings_table_arn     = module.tenant_newsfeed.signal_settings_table_arn
  xtwitter_settings_table_name  = module.tenant_newsfeed.xtwitter_settings_table_name
  xtwitter_settings_table_arn   = module.tenant_newsfeed.xtwitter_settings_table_arn
  linkedin_settings_table_name  = module.tenant_newsfeed.linkedin_settings_table_name
  linkedin_settings_table_arn   = module.tenant_newsfeed.linkedin_settings_table_arn
  youtube_settings_table_name   = module.tenant_newsfeed.youtube_settings_table_name
  youtube_settings_table_arn    = module.tenant_newsfeed.youtube_settings_table_arn
  bluesky_settings_table_name   = module.tenant_newsfeed.bluesky_settings_table_name
  bluesky_settings_table_arn    = module.tenant_newsfeed.bluesky_settings_table_arn
  mastodon_settings_table_name  = module.tenant_newsfeed.mastodon_settings_table_name
  mastodon_settings_table_arn   = module.tenant_newsfeed.mastodon_settings_table_arn
  tiktok_settings_table_name    = module.tenant_newsfeed.tiktok_settings_table_name
  tiktok_settings_table_arn     = module.tenant_newsfeed.tiktok_settings_table_arn
  snapchat_settings_table_name  = module.tenant_newsfeed.snapchat_settings_table_name
  snapchat_settings_table_arn   = module.tenant_newsfeed.snapchat_settings_table_arn
  threads_settings_table_name   = module.tenant_newsfeed.threads_settings_table_name
  threads_settings_table_arn    = module.tenant_newsfeed.threads_settings_table_arn

  # TikTok OAuth Credentials
  tiktok_client_key    = var.tiktok_client_key
  tiktok_client_secret = var.tiktok_client_secret

  # Snapchat OAuth Credentials
  snapchat_client_id     = var.snapchat_client_id
  snapchat_client_secret = var.snapchat_client_secret

  # X (Twitter) OAuth 1.0a Consumer Keys
  twitter_consumer_key    = var.twitter_consumer_key
  twitter_consumer_secret = var.twitter_consumer_secret

  # X (Twitter) OAuth 2.0 Client Credentials
  twitter_client_id     = var.twitter_client_id
  twitter_client_secret = var.twitter_client_secret

  depends_on = [module.tenant_newsfeed, module.lambda_layers]
}

# =============================================================================
# WHATSAPP BROADCAST SYSTEM (AWS End User Messaging Social)
# =============================================================================

module "tenant_whatsapp" {
  source = "./modules/tenant-whatsapp"

  platform_name   = var.platform_name
  environment     = var.environment
  aws_region      = var.aws_region
  tags            = var.tags

  # API Gateway
  api_gateway_id            = module.central_auth.api_gateway_id
  api_gateway_execution_arn = module.central_auth.api_gateway_execution_arn
  tenant_by_id_resource_id  = module.tenant_api.tenant_by_id_resource_id
  lambda_authorizer_id      = module.lambda_authorizer.lambda_authorizer_id

  # DynamoDB Tables
  tenants_table_name      = module.tenant_management.tenants_table_name
  tenants_table_arn       = module.tenant_management.tenants_table_arn
  user_tenants_table_name = module.tenant_management.user_tenants_table_name
  user_tenants_table_arn  = module.tenant_management.user_tenants_table_arn
  
  # WhatsApp Settings Table (from tenant-newsfeed module)
  whatsapp_settings_table_name = module.tenant_newsfeed.whatsapp_settings_table_name
  whatsapp_settings_table_arn  = module.tenant_newsfeed.whatsapp_settings_table_arn

  # S3 & CloudFront
  creator_assets_bucket_name = module.s3_tenant_storage.creator_assets_bucket_name
  creator_assets_bucket_arn  = module.s3_tenant_storage.creator_assets_bucket_arn
  cloudfront_domain_name     = module.cloudfront.cloudfront_domain_name

  # Lambda Layer
  common_deps_layer_arn = module.lambda_layers.common_deps_layer_arn

  # AWS End User Messaging Social Configuration
  whatsapp_phone_number_id = var.whatsapp_phone_number_id
  whatsapp_waba_id         = var.whatsapp_waba_id
  whatsapp_phone_number    = var.whatsapp_phone_number
  whatsapp_display_name    = var.whatsapp_display_name

  depends_on = [module.tenant_api, module.lambda_layers, module.tenant_newsfeed]
}

# =============================================================================
# TENANT MEMBERSHIP - Mitgliedschaften mit Mollie Split Payments
# =============================================================================

module "tenant_membership" {
  source = "./modules/tenant-membership"

  platform_name   = var.platform_name
  environment     = var.environment
  aws_region      = var.aws_region
  platform_domain = var.platform_domain
  tags            = var.tags

  # API Gateway
  api_gateway_id               = module.central_auth.api_gateway_id
  api_gateway_execution_arn    = module.central_auth.api_gateway_execution_arn
  api_gateway_root_resource_id = module.central_auth.api_gateway_root_resource_id
  tenant_by_id_resource_id     = module.tenant_api.tenant_by_id_resource_id
  lambda_authorizer_id         = module.lambda_authorizer.lambda_authorizer_id

  # DynamoDB Tables
  tenants_table_name      = module.tenant_management.tenants_table_name
  tenants_table_arn       = module.tenant_management.tenants_table_arn
  user_tenants_table_name = module.tenant_management.user_tenants_table_name
  user_tenants_table_arn  = module.tenant_management.user_tenants_table_arn

  # Lambda Layer
  common_deps_layer_arn = module.lambda_layers.common_deps_layer_arn

  # Mollie Configuration
  mollie_api_key       = var.mollie_api_key
  mollie_client_id     = var.mollie_client_id
  mollie_client_secret = var.mollie_client_secret
  platform_fee_percent = 10  # 10% Plattform-Gebühr

  # Cognito
  user_pool_id  = module.central_auth.user_pool_id
  user_pool_arn = module.central_auth.user_pool_arn

  depends_on = [module.tenant_api, module.lambda_layers, module.central_auth]
}

# Separate DNS Records für CloudFront (nach beiden Modulen)
resource "aws_route53_record" "main_domain" {
  count   = var.enable_route53_dns ? 1 : 0
  zone_id = module.route53[0].hosted_zone_id
  name    = var.platform_domain
  type    = "A"

  alias {
    name                   = module.cloudfront.cloudfront_domain_name
    zone_id                = module.cloudfront.cloudfront_hosted_zone_id
    evaluate_target_health = false
  }

  depends_on = [module.route53, module.cloudfront]
}

resource "aws_route53_record" "www_domain" {
  count   = var.enable_route53_dns ? 1 : 0
  zone_id = module.route53[0].hosted_zone_id
  name    = "www.${var.platform_domain}"
  type    = "A"

  alias {
    name                   = module.cloudfront.cloudfront_domain_name
    zone_id                = module.cloudfront.cloudfront_hosted_zone_id
    evaluate_target_health = false
  }

  depends_on = [module.route53, module.cloudfront]
}

resource "aws_route53_record" "wildcard_domain" {
  count   = var.enable_route53_dns && var.enable_wildcard_subdomain ? 1 : 0
  zone_id = module.route53[0].hosted_zone_id
  name    = "*.${var.platform_domain}"
  type    = "A"

  alias {
    name                   = module.cloudfront.cloudfront_domain_name
    zone_id                = module.cloudfront.cloudfront_hosted_zone_id
    evaluate_target_health = false
  }

  depends_on = [module.route53, module.cloudfront]
}

# S3 Bucket Policies (nach CloudFront Erstellung)
module "s3_bucket_policies" {
  source = "./modules/s3-bucket-policies"

  creator_assets_bucket_name  = module.s3_tenant_storage.creator_assets_bucket_name
  creator_assets_bucket_arn   = module.s3_tenant_storage.creator_assets_bucket_arn
  cloudfront_distribution_arn = module.cloudfront.cloudfront_distribution_arn
  additional_cloudfront_arns  = var.additional_cloudfront_arns

  depends_on = [module.cloudfront, module.s3_tenant_storage]
}

# =============================================================================
# SES EMAIL CONFIGURATION
# =============================================================================

# SES Domain Identity
resource "aws_ses_domain_identity" "main" {
  domain = var.platform_domain
}

# SES Domain DKIM
resource "aws_ses_domain_dkim" "main" {
  domain = aws_ses_domain_identity.main.domain
}

# Route 53 Records for SES Domain Verification
resource "aws_route53_record" "ses_verification" {
  count   = var.enable_route53_dns ? 1 : 0
  zone_id = module.route53[0].hosted_zone_id
  name    = "_amazonses.${var.platform_domain}"
  type    = "TXT"
  ttl     = 600
  records = [aws_ses_domain_identity.main.verification_token]
}

# Route 53 Records for DKIM
resource "aws_route53_record" "ses_dkim" {
  count   = var.enable_route53_dns ? 3 : 0
  zone_id = module.route53[0].hosted_zone_id
  name    = "${aws_ses_domain_dkim.main.dkim_tokens[count.index]}._domainkey.${var.platform_domain}"
  type    = "CNAME"
  ttl     = 600
  records = ["${aws_ses_domain_dkim.main.dkim_tokens[count.index]}.dkim.amazonses.com"]
}

# SES Domain Mail From
resource "aws_ses_domain_mail_from" "main" {
  domain           = aws_ses_domain_identity.main.domain
  mail_from_domain = "mail.${var.platform_domain}"
}

# Route 53 MX Record for Mail From
resource "aws_route53_record" "ses_mail_from_mx" {
  count   = var.enable_route53_dns ? 1 : 0
  zone_id = module.route53[0].hosted_zone_id
  name    = "mail.${var.platform_domain}"
  type    = "MX"
  ttl     = 600
  records = ["10 feedback-smtp.${var.aws_region}.amazonses.com"]
}

# Route 53 SPF Record for Mail From
resource "aws_route53_record" "ses_mail_from_spf" {
  count   = var.enable_route53_dns ? 1 : 0
  zone_id = module.route53[0].hosted_zone_id
  name    = "mail.${var.platform_domain}"
  type    = "TXT"
  ttl     = 600
  records = ["v=spf1 include:amazonses.com ~all"]
}

# =============================================================================
# CENTRAL API GATEWAY DEPLOYMENT
# This must be at the end to ensure all modules have created their methods
# and integrations before the deployment is created
# =============================================================================

resource "aws_api_gateway_deployment" "main" {
  rest_api_id = module.central_auth.api_gateway_id

  # Explicit dependencies on ALL modules that add methods to the API Gateway
  depends_on = [
    module.central_auth,
    module.tenant_api,
    module.billing_api,
    module.tenant_registration,
    module.tenant_frontend,
    module.tenant_live,
    module.tenant_videos,
    module.tenant_shop,
    module.tenant_events,
    module.tenant_newsfeed,
    module.tenant_channels,
    module.tenant_team,
    module.tenant_contact,
    module.tenant_podcasts,
    module.tenant_whatsapp,
    module.tenant_membership
  ]

  lifecycle {
    create_before_destroy = true
  }

  # Force redeployment when any API module changes
  # Using timestamp to always redeploy - this ensures new endpoints are always active
  triggers = {
    redeployment = sha1(jsonencode([
      module.central_auth.api_gateway_id,
      # Include a hash of all module outputs to detect changes
      module.tenant_registration.tenant_registration_function_arn,
      module.tenant_api.tenant_management_function_arn,
      module.billing_api.billing_api_function_arn,
      module.tenant_frontend.tenant_frontend_function_arn,
      module.tenant_live.tenant_live_function_arn,
      module.tenant_videos.tenant_videos_function_arn,
      module.tenant_shop.tenant_shop_function_arn,
      module.tenant_events.tenant_events_function_arn,
      module.tenant_newsfeed.tenant_newsfeed_function_arn,
      module.tenant_channels.tenant_channels_function_arn,
      module.tenant_team.tenant_team_function_arn,
      module.tenant_contact.tenant_contact_function_arn,
      module.tenant_podcasts.tenant_podcasts_lambda_arn,
      # Force redeploy on every apply to ensure all API changes are deployed
      timestamp()
    ]))
  }
}

resource "aws_api_gateway_stage" "main" {
  deployment_id = aws_api_gateway_deployment.main.id
  rest_api_id   = module.central_auth.api_gateway_id
  stage_name    = var.environment

  tags = merge(var.tags, {
    Name = "${var.platform_name}-api-stage"
  })

  depends_on = [aws_api_gateway_deployment.main]
}

# =============================================================================
# MOBILE APP DISTRIBUTION
# =============================================================================

module "mobile_app_distribution" {
  source = "./modules/mobile-app-distribution"

  platform_name = var.platform_name
  environment   = var.environment
  tags          = var.tags
}