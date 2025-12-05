output "aws_sdk_core_layer_arn" {
  description = "ARN of the AWS SDK Core Lambda Layer"
  value       = aws_lambda_layer_version.aws_sdk_core.arn
}

output "aws_sdk_extended_layer_arn" {
  description = "ARN of the AWS SDK Extended Lambda Layer"
  value       = aws_lambda_layer_version.aws_sdk_extended.arn
}

output "utilities_layer_arn" {
  description = "ARN of the Utilities Lambda Layer"
  value       = aws_lambda_layer_version.utilities.arn
}
