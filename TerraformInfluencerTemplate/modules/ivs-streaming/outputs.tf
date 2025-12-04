output "channel_arn" {
  description = "IVS Channel ARN"
  value       = aws_ivs_channel.main.arn
}

output "channel_id" {
  description = "IVS Channel ID"
  value       = aws_ivs_channel.main.id
}

output "ingest_endpoint" {
  description = "IVS Ingest Endpoint"
  value       = aws_ivs_channel.main.ingest_endpoint
}

output "playback_url" {
  description = "IVS Playback URL"
  value       = aws_ivs_channel.main.playback_url
}

output "stream_key" {
  description = "IVS Stream Key (wird automatisch mit Channel erstellt)"
  value       = "Siehe AWS Console: IVS > Channels > ${aws_ivs_channel.main.name} > Stream key"
  sensitive   = false
}

output "recordings_bucket" {
  description = "S3 Bucket für Aufnahmen"
  value       = aws_s3_bucket.recordings.id
}

output "stream_status_lambda_arn" {
  description = "Stream Status Lambda Function ARN"
  value       = aws_lambda_function.stream_status.arn
}

output "stream_status_lambda_name" {
  description = "Stream Status Lambda Function Name"
  value       = aws_lambda_function.stream_status.function_name
}

output "stream_status_lambda_invoke_arn" {
  description = "Stream Status Lambda Invoke ARN"
  value       = aws_lambda_function.stream_status.invoke_arn
}
