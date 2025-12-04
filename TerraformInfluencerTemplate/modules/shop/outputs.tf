output "api_endpoint" {
  description = "Shop API Endpoint"
  value       = aws_apigatewayv2_stage.shop_api.invoke_url
}

output "products_table_name" {
  description = "DynamoDB Products Table Name"
  value       = aws_dynamodb_table.products.name
}

output "orders_table_name" {
  description = "DynamoDB Orders Table Name"
  value       = aws_dynamodb_table.orders.name
}

output "product_images_bucket" {
  description = "S3 Product Images Bucket Name"
  value       = aws_s3_bucket.product_images.id
}

output "product_images_bucket_name" {
  description = "S3 Product Images Bucket Name"
  value       = aws_s3_bucket.product_images.id
}

output "products_table_arn" {
  description = "DynamoDB Products Table ARN"
  value       = aws_dynamodb_table.products.arn
}

output "product_images_url" {
  description = "S3 Product Images URL"
  value       = "https://${aws_s3_bucket.product_images.bucket_regional_domain_name}"
}

output "api_gateway_id" {
  description = "Shop API Gateway ID"
  value       = aws_apigatewayv2_api.shop_api.id
}

output "api_gateway_execution_arn" {
  description = "Shop API Gateway Execution ARN"
  value       = aws_apigatewayv2_api.shop_api.execution_arn
}

output "settings_table_name" {
  description = "DynamoDB Shop Settings Table Name"
  value       = aws_dynamodb_table.shop_settings.name
}

output "kms_key_id" {
  description = "KMS Key ID for encryption"
  value       = aws_kms_key.shop_encryption.id
}

output "create_order_function_name" {
  description = "Create Order Lambda Function Name"
  value       = aws_lambda_function.create_order_multi.function_name
}

output "verify_payment_function_name" {
  description = "Verify Payment Lambda Function Name"
  value       = aws_lambda_function.verify_payment.function_name
}
