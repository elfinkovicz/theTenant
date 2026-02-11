output "tenant_team_table_name" { value = aws_dynamodb_table.tenant_team.name }
output "tenant_team_table_arn" { value = aws_dynamodb_table.tenant_team.arn }
output "tenant_team_function_name" { value = aws_lambda_function.tenant_team.function_name }
output "tenant_team_function_arn" { value = aws_lambda_function.tenant_team.arn }
