# ============================================================
# TENANT MEMBERSHIP MODULE - MAIN
# DynamoDB Tabellen + Lambda für Mitgliedschafts-System
# ============================================================

# ============================================================
# DYNAMODB TABLES
# ============================================================

# Membership Settings - Einstellungen pro Tenant
resource "aws_dynamodb_table" "membership_settings" {
  name         = "${var.platform_name}-membership-settings-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenant_id"

  attribute {
    name = "tenant_id"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = merge(var.tags, {
    Name      = "${var.platform_name}-membership-settings-${var.environment}"
    Component = "Membership"
  })
}

# Memberships - Aktive Mitgliedschaften
resource "aws_dynamodb_table" "memberships" {
  name         = "${var.platform_name}-memberships-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "membership_id"

  attribute {
    name = "membership_id"
    type = "S"
  }

  attribute {
    name = "tenant_id"
    type = "S"
  }

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "mollie_subscription_id"
    type = "S"
  }

  # GSI: Alle Mitglieder eines Tenants
  global_secondary_index {
    name            = "tenant-index"
    hash_key        = "tenant_id"
    projection_type = "ALL"
  }

  # GSI: Alle Mitgliedschaften eines Users
  global_secondary_index {
    name            = "user-index"
    hash_key        = "user_id"
    projection_type = "ALL"
  }

  # GSI: Lookup by Mollie Subscription ID
  global_secondary_index {
    name            = "mollie-subscription-index"
    hash_key        = "mollie_subscription_id"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = merge(var.tags, {
    Name      = "${var.platform_name}-memberships-${var.environment}"
    Component = "Membership"
  })
}

# Membership Payments - Zahlungshistorie
resource "aws_dynamodb_table" "membership_payments" {
  name         = "${var.platform_name}-membership-payments-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "payment_id"

  attribute {
    name = "payment_id"
    type = "S"
  }

  attribute {
    name = "membership_id"
    type = "S"
  }

  attribute {
    name = "tenant_id"
    type = "S"
  }

  # GSI: Zahlungen pro Membership
  global_secondary_index {
    name            = "membership-index"
    hash_key        = "membership_id"
    projection_type = "ALL"
  }

  # GSI: Zahlungen pro Tenant (für Auszahlungsübersicht)
  global_secondary_index {
    name            = "tenant-index"
    hash_key        = "tenant_id"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = merge(var.tags, {
    Name      = "${var.platform_name}-membership-payments-${var.environment}"
    Component = "Membership"
  })
}

# ============================================================
# LAMBDA FUNCTION
# ============================================================

data "archive_file" "membership_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/tenant-membership"
  output_path = "${path.module}/../../tenant_membership.zip"
}

resource "aws_lambda_function" "membership_api" {
  filename         = data.archive_file.membership_lambda.output_path
  function_name    = "${var.platform_name}-membership-api-${var.environment}"
  role             = aws_iam_role.membership_lambda_role.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.membership_lambda.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = 30
  memory_size      = 256

  layers = [var.common_deps_layer_arn]

  environment {
    variables = {
      REGION                    = var.aws_region
      MEMBERSHIP_SETTINGS_TABLE = aws_dynamodb_table.membership_settings.name
      MEMBERSHIPS_TABLE         = aws_dynamodb_table.memberships.name
      MEMBERSHIP_PAYMENTS_TABLE = aws_dynamodb_table.membership_payments.name
      TENANTS_TABLE             = var.tenants_table_name
      USER_TENANTS_TABLE        = var.user_tenants_table_name
      MOLLIE_CLIENT_ID          = var.mollie_client_id
      MOLLIE_CLIENT_SECRET      = var.mollie_client_secret
      PLATFORM_FEE_PERCENT      = tostring(var.platform_fee_percent)
      API_BASE_URL              = "https://api.${var.platform_domain}"
      USER_POOL_ID              = var.user_pool_id
    }
  }

  tags = merge(var.tags, {
    Name      = "${var.platform_name}-membership-api-${var.environment}"
    Component = "Membership"
  })
}

# ============================================================
# IAM ROLE
# ============================================================

resource "aws_iam_role" "membership_lambda_role" {
  name = "${var.platform_name}-membership-lambda-role-${var.environment}"

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

  tags = var.tags
}

resource "aws_iam_role_policy" "membership_lambda_policy" {
  name = "${var.platform_name}-membership-lambda-policy-${var.environment}"
  role = aws_iam_role.membership_lambda_role.id

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
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.membership_settings.arn,
          "${aws_dynamodb_table.membership_settings.arn}/index/*",
          aws_dynamodb_table.memberships.arn,
          "${aws_dynamodb_table.memberships.arn}/index/*",
          aws_dynamodb_table.membership_payments.arn,
          "${aws_dynamodb_table.membership_payments.arn}/index/*",
          var.tenants_table_arn,
          var.user_tenants_table_arn,
          "${var.user_tenants_table_arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:AdminGetUser",
          "cognito-idp:ListUsers"
        ]
        Resource = var.user_pool_arn
      }
    ]
  })
}

# Lambda Permission for API Gateway
resource "aws_lambda_permission" "membership_api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.membership_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}
