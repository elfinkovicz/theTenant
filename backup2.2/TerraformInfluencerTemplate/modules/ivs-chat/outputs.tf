output "chat_room_arn" {
  description = "IVS Chat Room ARN"
  value       = aws_ivschat_room.main.arn
}

output "chat_room_id" {
  description = "IVS Chat Room ID"
  value       = aws_ivschat_room.main.id
}

output "chat_api_endpoint" {
  description = "Chat Token API Endpoint"
  value       = aws_apigatewayv2_api.chat.api_endpoint
}
