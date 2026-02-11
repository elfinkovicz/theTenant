output "tenant_videos_table_name" { value = aws_dynamodb_table.tenant_videos.name }
output "tenant_videos_table_arn" { value = aws_dynamodb_table.tenant_videos.arn }
output "tenant_videos_function_name" { value = aws_lambda_function.tenant_videos.function_name }
output "tenant_videos_function_arn" { value = aws_lambda_function.tenant_videos.arn }
