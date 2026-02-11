# AI Services Billing Tracking

# DynamoDB Table for AI Usage Tracking
resource "aws_dynamodb_table" "ai_usage" {
  name         = "${var.platform_name}-ai-usage-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenant_id"
  range_key    = "usage_id"

  attribute {
    name = "tenant_id"
    type = "S"
  }

  attribute {
    name = "usage_id"
    type = "S"
  }

  attribute {
    name = "billing_month"
    type = "S"
  }

  global_secondary_index {
    name            = "billing-month-index"
    hash_key        = "billing_month"
    range_key       = "tenant_id"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = merge(var.tags, { Name = "${var.platform_name}-ai-usage" })
}

# Add permissions to AI Lambdas for billing tracking
resource "aws_iam_role_policy" "ai_transcribe_billing" {
  name = "${var.platform_name}-ai-transcribe-billing-${var.environment}"
  role = aws_iam_role.ai_transcribe_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:PutItem", "dynamodb:UpdateItem"]
        Resource = [aws_dynamodb_table.ai_usage.arn]
      }
    ]
  })
}

resource "aws_iam_role_policy" "ai_describe_billing" {
  name = "${var.platform_name}-ai-describe-billing-${var.environment}"
  role = aws_iam_role.ai_describe_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:GetItem"]
        Resource = [aws_dynamodb_table.ai_usage.arn]
      }
    ]
  })
}

# Output for billing integration
output "ai_usage_table_name" {
  value = aws_dynamodb_table.ai_usage.name
}

output "ai_usage_table_arn" {
  value = aws_dynamodb_table.ai_usage.arn
}
