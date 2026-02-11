output "tenant_channels_table_name" { value = aws_dynamodb_table.tenant_channels.name }
output "tenant_channels_table_arn" { value = aws_dynamodb_table.tenant_channels.arn }
output "tenant_channels_function_name" { value = aws_lambda_function.tenant_channels.function_name }
output "tenant_channels_function_arn" { value = aws_lambda_function.tenant_channels.arn }
