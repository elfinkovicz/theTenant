# IVS Chat Room
resource "aws_ivschat_room" "main" {
  name = "${var.project_name}-chat"

  maximum_message_length          = 500
  maximum_message_rate_per_second = 10

  message_review_handler {
    uri = var.message_review_handler_uri != "" ? var.message_review_handler_uri : null
  }

  tags = {
    Name = "${var.project_name}-chat"
  }
}

# Lambda für Chat Token Generation
resource "aws_iam_role" "chat_token_lambda" {
  name = "${var.project_name}-chat-token-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "chat_token_lambda_basic" {
  role       = aws_iam_role.chat_token_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "chat_token_lambda_ivs" {
  name = "ivs-chat-token"
  role = aws_iam_role.chat_token_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ivschat:CreateChatToken"
      ]
      Resource = aws_ivschat_room.main.arn
    }]
  })
}

resource "aws_lambda_function" "chat_token" {
  filename         = data.archive_file.chat_token_lambda.output_path
  function_name    = "${var.project_name}-chat-token"
  role             = aws_iam_role.chat_token_lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.chat_token_lambda.output_base64sha256
  runtime          = "nodejs20.x"

  # Use Lambda Layers for dependencies
  layers = [
    var.aws_sdk_extended_layer_arn,
  ]
  timeout          = 10

  environment {
    variables = {
      CHAT_ROOM_ARN = aws_ivschat_room.main.arn
    }
  }
}

data "archive_file" "chat_token_lambda" {
  type        = "zip"
  output_path = "${path.module}/lambda.zip"

  source {
    content  = file("${path.module}/lambda/index.js")
    filename = "index.js"
  }
}

# API Gateway für Chat Token
resource "aws_apigatewayv2_api" "chat" {
  name          = "${var.project_name}-chat-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["POST", "OPTIONS"]
    allow_headers = ["content-type", "authorization"]
    max_age       = 300
  }
}

resource "aws_apigatewayv2_stage" "chat" {
  api_id      = aws_apigatewayv2_api.chat.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_apigatewayv2_integration" "chat_token" {
  api_id           = aws_apigatewayv2_api.chat.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.chat_token.invoke_arn
}

resource "aws_apigatewayv2_route" "chat_token" {
  api_id    = aws_apigatewayv2_api.chat.id
  route_key = "POST /token"
  target    = "integrations/${aws_apigatewayv2_integration.chat_token.id}"
}

resource "aws_lambda_permission" "api_gateway_chat" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.chat_token.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.chat.execution_arn}/*/*"
}
