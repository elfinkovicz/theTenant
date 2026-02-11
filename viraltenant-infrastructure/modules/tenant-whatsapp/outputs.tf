# =============================================================================
# WhatsApp Module - Outputs
# =============================================================================

output "whatsapp_subscribers_table_name" {
  description = "WhatsApp subscribers DynamoDB table name"
  value       = aws_dynamodb_table.whatsapp_subscribers.name
}

output "whatsapp_subscribers_table_arn" {
  description = "WhatsApp subscribers DynamoDB table ARN"
  value       = aws_dynamodb_table.whatsapp_subscribers.arn
}

# NOTE: whatsapp_settings_table outputs removed - table is managed by tenant-newsfeed module
# Use module.tenant_newsfeed.whatsapp_settings_table_name/arn instead

output "whatsapp_crosspost_function_name" {
  description = "WhatsApp crosspost Lambda function name"
  value       = aws_lambda_function.whatsapp_crosspost.function_name
}

output "whatsapp_crosspost_function_arn" {
  description = "WhatsApp crosspost Lambda function ARN"
  value       = aws_lambda_function.whatsapp_crosspost.arn
}

output "whatsapp_inbound_topic_arn" {
  description = "SNS topic ARN for inbound WhatsApp messages"
  value       = aws_sns_topic.whatsapp_inbound.arn
}

output "whatsapp_messages_queue_url" {
  description = "SQS queue URL for WhatsApp messages"
  value       = aws_sqs_queue.whatsapp_messages.url
}

output "whatsapp_messages_queue_arn" {
  description = "SQS queue ARN for WhatsApp messages"
  value       = aws_sqs_queue.whatsapp_messages.arn
}
