output "tenant_shop_table_name" { value = aws_dynamodb_table.tenant_shop.name }
output "tenant_shop_table_arn" { value = aws_dynamodb_table.tenant_shop.arn }
output "tenant_shop_function_name" { value = aws_lambda_function.tenant_shop.function_name }
output "tenant_shop_function_arn" { value = aws_lambda_function.tenant_shop.arn }
