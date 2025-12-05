# DynamoDB Table für Streaming-Ziele
resource "aws_dynamodb_table" "streaming_destinations" {
  name           = "${var.project_name}-streaming-destinations"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }

  tags = {
    Name = "${var.project_name}-streaming-destinations"
  }
}

# IAM Role für MediaLive
resource "aws_iam_role" "medialive" {
  name = "${var.project_name}-medialive-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "medialive.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "medialive" {
  name = "${var.project_name}-medialive-policy"
  role = aws_iam_role.medialive.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "ivs:GetChannel",
          "ivs:GetStream"
        ]
        Resource = var.ivs_channel_arn
      }
    ]
  })
}

# MediaLive Input Security Group
resource "aws_medialive_input_security_group" "main" {
  whitelist_rules {
    cidr = "0.0.0.0/0"
  }

  tags = {
    Name = "${var.project_name}-medialive-sg"
  }
}

# Lambda Execution Role
resource "aws_iam_role" "lambda" {
  name = "${var.project_name}-stream-restreaming-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  role       = aws_iam_role.lambda.name
}

resource "aws_iam_role_policy" "lambda_dynamodb" {
  name = "${var.project_name}-lambda-dynamodb-policy"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Scan",
          "dynamodb:Query"
        ]
        Resource = aws_dynamodb_table.streaming_destinations.arn
      },
      {
        Effect = "Allow"
        Action = [
          "medialive:CreateChannel",
          "medialive:DeleteChannel",
          "medialive:StartChannel",
          "medialive:StopChannel",
          "medialive:DescribeChannel",
          "medialive:CreateInput",
          "medialive:DeleteInput",
          "medialive:DescribeInput",
          "medialive:ListChannels",
          "medialive:ListInputs"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "iam:PassRole"
        ]
        Resource = aws_iam_role.medialive.arn
      }
    ]
  })
}

# Lambda Function
resource "aws_lambda_function" "stream_restreaming" {
  filename         = "${path.module}/lambda.zip"
  function_name    = "${var.project_name}-stream-restreaming"
  role            = aws_iam_role.lambda.arn
  handler         = "index.handler"
  source_code_hash = filebase64sha256("${path.module}/lambda.zip")
  runtime         = "python3.11"
  timeout         = 30

  environment {
    variables = {
      DESTINATIONS_TABLE = aws_dynamodb_table.streaming_destinations.name
      IVS_PLAYBACK_URL   = var.ivs_playback_url
      MEDIALIVE_ROLE_ARN = aws_iam_role.medialive.arn
      MEDIALIVE_SG_ID    = aws_medialive_input_security_group.main.id
      PROJECT_NAME       = var.project_name
    }
  }
}

# Lambda Permission für API Gateway v2
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.stream_restreaming.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*"
}
