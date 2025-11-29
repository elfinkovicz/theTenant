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

output "product_images_url" {
  description = "S3 Product Images URL"
  value       = "https://${aws_s3_bucket.product_images.bucket_regional_domain_name}"
}
