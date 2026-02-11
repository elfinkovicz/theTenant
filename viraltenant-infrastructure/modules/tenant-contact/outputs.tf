output "tenant_contact_table_name" { value = aws_dynamodb_table.tenant_contact.name }
output "tenant_contact_table_arn" { value = aws_dynamodb_table.tenant_contact.arn }
output "tenant_contact_function_name" { value = aws_lambda_function.tenant_contact.function_name }
output "tenant_contact_function_arn" { value = aws_lambda_function.tenant_contact.arn }
