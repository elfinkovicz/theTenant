# Platform Information
output "platform_info" {
  description = "Platform Information"
  value = {
    name         = var.platform_name
    environment  = var.environment
    domain       = var.platform_domain
    region       = var.aws_region
    multi_tenant = true
  }
}

# Route 53 DNS Information (conditional)
output "dns_info" {
  description = "DNS Konfigurationsinformationen"
  value = var.enable_route53_dns ? {
    enabled               = true
    hosted_zone_id        = module.route53[0].hosted_zone_id
    name_servers          = module.route53[0].hosted_zone_name_servers
    ssl_certificate       = module.route53[0].ssl_certificate_arn
    dns_records           = module.route53[0].dns_records
    domain_name           = var.platform_domain
    create_hosted_zone    = var.create_hosted_zone
    message               = "Route 53 DNS management is enabled"
    manual_setup_required = false
    } : {
    enabled               = false
    hosted_zone_id        = ""
    name_servers          = []
    ssl_certificate       = ""
    dns_records           = {}
    domain_name           = var.platform_domain
    create_hosted_zone    = false
    message               = "Route 53 DNS management is disabled"
    manual_setup_required = true
  }
}

# CloudFront Distribution Outputs
output "s3_bucket_name" {
  description = "S3 bucket name for website content"
  value       = module.cloudfront.s3_bucket_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = module.cloudfront.cloudfront_distribution_id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = module.cloudfront.cloudfront_domain_name
}

output "website_url" {
  description = "Website URL"
  value       = module.cloudfront.website_url
}

output "ssl_certificate_arn" {
  description = "SSL certificate ARN"
  value       = module.cloudfront.ssl_certificate_arn
}

# Quick start URLs
output "quick_start_urls" {
  description = "Quick start URLs for the platform"
  value = {
    website_url    = module.cloudfront.website_url
    cloudfront_url = "https://${module.cloudfront.cloudfront_domain_name}"
    api_url        = module.central_auth.api_gateway_url
  }
}

# Central Auth Outputs
output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.central_auth.user_pool_id
}

output "cognito_client_id" {
  description = "Cognito Client ID"
  value       = module.central_auth.client_id
}

output "api_gateway_url" {
  description = "API Gateway URL for authentication"
  value       = module.central_auth.api_gateway_url
}

output "user_groups" {
  description = "Created user groups"
  value       = module.central_auth.user_groups
}

# Multi-Tenant Outputs
output "tenant_management" {
  description = "Tenant Management Information"
  value = {
    tenants_table_name      = module.tenant_management.tenants_table_name
    user_tenants_table_name = module.tenant_management.user_tenants_table_name
    assets_table_name       = module.tenant_management.assets_table_name
  }
}

output "s3_storage" {
  description = "S3 Storage Information"
  value = {
    creator_assets_bucket = module.s3_tenant_storage.creator_assets_bucket_name
    upload_temp_bucket    = module.s3_tenant_storage.upload_temp_bucket_name
  }
}

output "lambda_authorizer" {
  description = "Lambda Authorizer Information"
  value = {
    function_name = module.lambda_authorizer.lambda_authorizer_function_name
    function_arn  = module.lambda_authorizer.lambda_authorizer_function_arn
  }
}

# DNS Records Information
output "dns_records_created" {
  description = "DNS records created for CloudFront"
  value = var.enable_route53_dns ? {
    main_domain = length(aws_route53_record.main_domain) > 0 ? aws_route53_record.main_domain[0].fqdn : null
    www_domain  = length(aws_route53_record.www_domain) > 0 ? aws_route53_record.www_domain[0].fqdn : null
    wildcard    = length(aws_route53_record.wildcard_domain) > 0 ? aws_route53_record.wildcard_domain[0].fqdn : null
  } : null
}


# Tenant Frontend Configuration
output "tenant_frontend" {
  description = "Tenant Frontend Configuration Information"
  value = {
    table_name    = module.tenant_frontend.tenant_frontend_table_name
    function_name = module.tenant_frontend.tenant_frontend_function_name
    api_endpoints = {
      get_hero    = "GET /tenants/{tenantId}/hero"
      put_hero    = "PUT /tenants/{tenantId}/hero"
      upload_url  = "POST /tenants/{tenantId}/hero/upload-url"
      delete_logo = "DELETE /tenants/{tenantId}/hero/logo"
    }
  }
}


# Billing Dashboard Outputs
output "billing_dashboard_url" {
  description = "URL for the Billing Admin Dashboard"
  value       = module.billing_dashboard.billing_dashboard_url
}

output "billing_dashboard_bucket" {
  description = "S3 bucket for Billing Dashboard"
  value       = module.billing_dashboard.billing_dashboard_bucket_name
}

output "billing_dashboard_cloudfront_id" {
  description = "CloudFront Distribution ID for Billing Dashboard"
  value       = module.billing_dashboard.billing_dashboard_cloudfront_id
}

# WhatsApp Broadcast System Outputs
output "whatsapp_broadcast" {
  description = "WhatsApp Broadcast System Information"
  value = {
    subscribers_table = module.tenant_whatsapp.whatsapp_subscribers_table_name
    settings_table    = module.tenant_newsfeed.whatsapp_settings_table_name
    crosspost_lambda  = module.tenant_whatsapp.whatsapp_crosspost_function_name
    inbound_topic_arn = module.tenant_whatsapp.whatsapp_inbound_topic_arn
    messages_queue    = module.tenant_whatsapp.whatsapp_messages_queue_url
    phone_number      = var.whatsapp_phone_number
    display_name      = var.whatsapp_display_name
    subscribe_command = "START <tenant-subdomain>"
  }
}
