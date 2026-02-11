# ============================================================
# TENANT MEMBERSHIP MODULE - OUTPUTS
# ============================================================

output "membership_settings_table_name" {
  description = "Name der Membership Settings Tabelle"
  value       = aws_dynamodb_table.membership_settings.name
}

output "membership_settings_table_arn" {
  description = "ARN der Membership Settings Tabelle"
  value       = aws_dynamodb_table.membership_settings.arn
}

output "memberships_table_name" {
  description = "Name der Memberships Tabelle"
  value       = aws_dynamodb_table.memberships.name
}

output "memberships_table_arn" {
  description = "ARN der Memberships Tabelle"
  value       = aws_dynamodb_table.memberships.arn
}

output "membership_payments_table_name" {
  description = "Name der Membership Payments Tabelle"
  value       = aws_dynamodb_table.membership_payments.name
}

output "membership_payments_table_arn" {
  description = "ARN der Membership Payments Tabelle"
  value       = aws_dynamodb_table.membership_payments.arn
}

output "membership_lambda_function_name" {
  description = "Name der Membership Lambda Funktion"
  value       = aws_lambda_function.membership_api.function_name
}

output "membership_lambda_function_arn" {
  description = "ARN der Membership Lambda Funktion"
  value       = aws_lambda_function.membership_api.arn
}
