output "website_url" {
  description = "Website URL"
  value       = "https://${var.website_domain}"
}

output "s3_bucket_name" {
  description = "S3 Bucket für Website Content"
  value       = module.website.s3_bucket_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront Distribution ID"
  value       = module.website.cloudfront_distribution_id
}

output "contact_form_api_endpoint" {
  description = "API Gateway Endpoint für Kontaktformular"
  value       = module.contact_form.api_endpoint
}

output "ivs_channel_arn" {
  description = "IVS Channel ARN"
  value       = var.enable_ivs_streaming ? module.ivs_streaming[0].channel_arn : null
}

output "ivs_stream_key" {
  description = "IVS Stream Key (SENSITIVE)"
  value       = var.enable_ivs_streaming ? module.ivs_streaming[0].stream_key : null
  sensitive   = true
}

output "ivs_ingest_endpoint" {
  description = "IVS Ingest Endpoint"
  value       = var.enable_ivs_streaming ? module.ivs_streaming[0].ingest_endpoint : null
}

output "ivs_playback_url" {
  description = "IVS Playback URL"
  value       = var.enable_ivs_streaming ? module.ivs_streaming[0].playback_url : null
}

output "ivs_chat_room_arn" {
  description = "IVS Chat Room ARN"
  value       = var.enable_ivs_chat ? module.ivs_chat[0].chat_room_arn : null
}

output "ivs_chat_api_endpoint" {
  description = "IVS Chat Token API Endpoint"
  value       = var.enable_ivs_chat ? module.ivs_chat[0].chat_api_endpoint : null
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = var.enable_user_auth ? module.user_auth[0].user_pool_id : null
}

output "cognito_client_id" {
  description = "Cognito App Client ID"
  value       = var.enable_user_auth ? module.user_auth[0].client_id : null
}

output "cognito_domain" {
  description = "Cognito Hosted UI Domain"
  value       = var.enable_user_auth ? module.user_auth[0].cognito_domain : null
}

output "user_api_endpoint" {
  description = "User Management API Endpoint"
  value       = var.enable_user_auth ? module.user_auth[0].api_endpoint : null
}


# Sponsor System Outputs
output "sponsor_api_endpoint" {
  description = "Sponsor API Endpoint"
  value       = var.enable_sponsor_system ? module.sponsor_system[0].api_endpoint : null
}

output "sponsor_assets_bucket" {
  description = "Sponsor Assets S3 Bucket"
  value       = var.enable_sponsor_system ? module.sponsor_system[0].assets_bucket_name : null
}

# Shop Outputs
output "shop_api_endpoint" {
  description = "Shop API Endpoint"
  value       = var.enable_shop ? module.shop[0].api_endpoint : null
}

output "shop_products_table" {
  description = "Shop Products DynamoDB Table"
  value       = var.enable_shop ? module.shop[0].products_table_name : null
}

output "shop_product_images_bucket" {
  description = "Shop Product Images S3 Bucket"
  value       = var.enable_shop ? module.shop[0].product_images_bucket : null
}

# Video Management Outputs
output "video_api_endpoint" {
  description = "Video Management API Endpoint"
  value       = var.enable_video_management ? "${module.user_auth[0].api_endpoint}/videos" : null
}

output "videos_bucket" {
  description = "Videos S3 Bucket"
  value       = var.enable_video_management ? module.video_management[0].videos_bucket_name : null
}

output "thumbnails_cdn_url" {
  description = "Thumbnails CloudFront CDN URL"
  value       = var.enable_video_management ? module.video_management[0].thumbnails_cdn_url : null
}

output "admin_group_name" {
  description = "Cognito Admin Group Name"
  value       = var.enable_video_management ? module.video_management[0].admin_group_name : null
}

# Team Management Outputs
output "team_members_table" {
  description = "Team Members DynamoDB Table"
  value       = var.enable_team_management ? module.team_management[0].dynamodb_table : null
}

output "team_images_info" {
  description = "Team images werden im Thumbnails-Bucket gespeichert (shared mit Video-Management)"
  value       = var.enable_team_management ? "Uses ${module.video_management[0].thumbnails_bucket_name} bucket and ${module.video_management[0].thumbnails_cdn_url} CDN" : null
}

# Event Management Outputs
output "events_table" {
  description = "Events DynamoDB Table"
  value       = var.enable_event_management ? module.event_management[0].dynamodb_table : null
}

output "event_images_info" {
  description = "Event images werden im Thumbnails-Bucket gespeichert (shared mit Video-Management)"
  value       = var.enable_event_management ? "Uses ${module.video_management[0].thumbnails_bucket_name} bucket and ${module.video_management[0].thumbnails_cdn_url} CDN" : null
}

output "team_api_endpoint" {
  description = "Team Management API Endpoint"
  value       = var.enable_team_management ? module.user_auth[0].api_endpoint : null
}

output "event_api_endpoint" {
  description = "Event Management API Endpoint"
  value       = var.enable_event_management ? module.user_auth[0].api_endpoint : null
}
