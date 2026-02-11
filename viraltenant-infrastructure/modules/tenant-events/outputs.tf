output "tenant_events_table_name" { value = aws_dynamodb_table.tenant_events.name }
output "tenant_events_table_arn" { value = aws_dynamodb_table.tenant_events.arn }
output "tenant_events_function_name" { value = aws_lambda_function.tenant_events.function_name }
output "tenant_events_function_arn" { value = aws_lambda_function.tenant_events.arn }
