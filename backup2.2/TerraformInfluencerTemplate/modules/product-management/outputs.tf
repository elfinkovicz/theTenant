output "product_lambda_function_name" {
  description = "Name of the product Lambda function"
  value       = aws_lambda_function.product_api.function_name
}

output "product_lambda_function_arn" {
  description = "ARN of the product Lambda function"
  value       = aws_lambda_function.product_api.arn
}
