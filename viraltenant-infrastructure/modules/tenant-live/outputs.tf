output "tenant_live_table_name" {
  value = aws_dynamodb_table.tenant_live.name
}

output "tenant_live_table_arn" {
  value = aws_dynamodb_table.tenant_live.arn
}

output "tenant_live_function_name" {
  value = aws_lambda_function.tenant_live.function_name
}

output "tenant_live_function_arn" {
  value = aws_lambda_function.tenant_live.arn
}

output "ivs_channel_arn" {
  value = var.create_ivs_channel ? aws_ivs_channel.tenant_channel[0].arn : null
}

output "ivs_ingest_endpoint" {
  value = var.create_ivs_channel ? aws_ivs_channel.tenant_channel[0].ingest_endpoint : null
}

output "ivs_stream_key" {
  value     = var.create_ivs_channel ? data.aws_ivs_stream_key.tenant_stream_key[0].value : null
  sensitive = true
}

output "ivs_playback_url" {
  value = var.create_ivs_channel ? aws_ivs_channel.tenant_channel[0].playback_url : null
}

output "ivs_chat_room_arn" {
  value = var.create_ivs_channel ? aws_ivschat_room.tenant_chat[0].arn : null
}

output "ivs_recording_config_arn" {
  value = var.create_ivs_channel ? aws_ivs_recording_configuration.tenant_recording[0].arn : null
}

output "ivs_recordings_bucket" {
  value = var.create_ivs_channel ? aws_s3_bucket.ivs_recordings[0].id : null
}

# YouTube OAuth Outputs
output "oauth_tokens_table_name" {
  value = aws_dynamodb_table.oauth_tokens.name
}

output "oauth_tokens_table_arn" {
  value = aws_dynamodb_table.oauth_tokens.arn
}

output "youtube_broadcasts_table_name" {
  value = aws_dynamodb_table.youtube_broadcasts.name
}

output "youtube_broadcasts_table_arn" {
  value = aws_dynamodb_table.youtube_broadcasts.arn
}
