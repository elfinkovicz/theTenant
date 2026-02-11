# Tenant Crosspost Module Outputs

output "crosspost_dispatcher_function_name" {
  value = aws_lambda_function.crosspost_dispatcher.function_name
}

output "crosspost_dispatcher_function_arn" {
  value = aws_lambda_function.crosspost_dispatcher.arn
}

# All crosspost lambda ARNs
output "crosspost_xtwitter_arn" {
  value = aws_lambda_function.crosspost_xtwitter.arn
}

output "crosspost_youtube_arn" {
  value = aws_lambda_function.crosspost_youtube.arn
}

output "crosspost_discord_arn" {
  value = aws_lambda_function.crosspost_discord.arn
}

output "crosspost_slack_arn" {
  value = aws_lambda_function.crosspost_slack.arn
}

output "crosspost_facebook_arn" {
  value = aws_lambda_function.crosspost_facebook.arn
}

output "crosspost_instagram_arn" {
  value = aws_lambda_function.crosspost_instagram.arn
}

output "crosspost_linkedin_arn" {
  value = aws_lambda_function.crosspost_linkedin.arn
}

output "crosspost_telegram_arn" {
  value = aws_lambda_function.crosspost_telegram.arn
}

output "crosspost_bluesky_arn" {
  value = aws_lambda_function.crosspost_bluesky.arn
}

output "crosspost_mastodon_arn" {
  value = aws_lambda_function.crosspost_mastodon.arn
}
output "crosspost_tiktok_arn" {
  value = aws_lambda_function.crosspost_tiktok.arn
}
