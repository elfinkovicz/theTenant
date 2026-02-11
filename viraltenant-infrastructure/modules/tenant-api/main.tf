# Tenant API Module für Subdomain-Verwaltung
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# IAM Role für Tenant Management Lambda
resource "aws_iam_role" "tenant_management_role" {
  name = "${var.platform_name}-tenant-management-role-${var.environment}"

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

  tags = var.tags
}

# IAM Policy für Tenant Management
resource "aws_iam_role_policy" "tenant_management_policy" {
  name = "${var.platform_name}-tenant-management-policy-${var.environment}"
  role = aws_iam_role.tenant_management_role.id

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
          var.tenants_table_arn,
          "${var.tenants_table_arn}/index/*",
          var.user_tenants_table_arn,
          "${var.user_tenants_table_arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:DeleteItem"
        ]
        Resource = compact([
          var.tenant_live_table_arn,
          var.tenant_newsfeed_table_arn,
          var.tenant_frontend_table_arn,
          var.tenant_events_table_arn,
          var.tenant_contact_table_arn,
          var.tenant_team_table_arn,
          var.tenant_shop_table_arn,
          var.tenant_videos_table_arn,
          var.tenant_channels_table_arn,
          var.tenant_podcasts_table_arn
        ])
      },
      {
        Effect = "Allow"
        Action = [
          "route53:ChangeResourceRecordSets",
          "route53:ListResourceRecordSets"
        ]
        Resource = "arn:aws:route53:::hostedzone/${var.hosted_zone_id}"
      },
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:AdminGetUser",
          "cognito-idp:AdminDeleteUser",
          "cognito-idp:ListUsers"
        ]
        Resource = "arn:aws:cognito-idp:${var.aws_region}:*:userpool/${var.user_pool_id}"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = var.creator_assets_bucket_arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:DeleteObject"
        ]
        Resource = "${var.creator_assets_bucket_arn}/tenants/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject"
        ]
        Resource = "${var.creator_assets_bucket_arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "ivs:DeleteChannel"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ivschat:DeleteRoom"
        ]
        Resource = "*"
      }
    ]
  })
}

# Lambda Function für Tenant Management
resource "aws_lambda_function" "tenant_management" {
  filename      = "tenant_management.zip"
  function_name = "${var.platform_name}-tenant-management-${var.environment}"
  role          = aws_iam_role.tenant_management_role.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  timeout       = 60
  memory_size   = 512
  layers        = [var.common_deps_layer_arn]

  environment {
    variables = {
      TENANTS_TABLE          = var.tenants_table_name
      USER_TENANTS_TABLE     = var.user_tenants_table_name
      HOSTED_ZONE_ID         = var.hosted_zone_id
      PLATFORM_DOMAIN        = var.platform_domain
      CLOUDFRONT_DOMAIN_NAME = var.cloudfront_domain_name
      REGION                 = var.aws_region
      USER_POOL_ID           = var.user_pool_id
      ASSETS_BUCKET          = var.creator_assets_bucket_name
      # Tenant-specific tables for deletion
      TENANT_LIVE_TABLE     = var.tenant_live_table_name
      TENANT_NEWSFEED_TABLE = var.tenant_newsfeed_table_name
      TENANT_FRONTEND_TABLE = var.tenant_frontend_table_name
      TENANT_EVENTS_TABLE   = var.tenant_events_table_name
      TENANT_CONTACT_TABLE  = var.tenant_contact_table_name
      TENANT_TEAM_TABLE     = var.tenant_team_table_name
      TENANT_SHOP_TABLE     = var.tenant_shop_table_name
      TENANT_VIDEOS_TABLE   = var.tenant_videos_table_name
      TENANT_CHANNELS_TABLE = var.tenant_channels_table_name
      TENANT_PODCASTS_TABLE = var.tenant_podcasts_table_name
    }
  }

  tags = merge(var.tags, {
    Name = "${var.platform_name}-tenant-management"
    Type = "TenantAPI"
  })

  depends_on = [aws_iam_role_policy.tenant_management_policy]
}

# API Gateway Resource für Tenant Management
resource "aws_api_gateway_resource" "tenants" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.api_gateway_root_resource_id
  path_part   = "tenants"
}

# User Resource für User-spezifische Endpoints
resource "aws_api_gateway_resource" "user" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.api_gateway_root_resource_id
  path_part   = "user"
}

# User Tenants Resource
resource "aws_api_gateway_resource" "user_tenants" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.user.id
  path_part   = "tenants"
}

# User Account Resource for DELETE /user/account
resource "aws_api_gateway_resource" "user_account" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.user.id
  path_part   = "account"
}

# Tenant by ID Resource
resource "aws_api_gateway_resource" "tenant_by_id" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.tenants.id
  path_part   = "{tenantId}"
}

# Subdomain Check Resource
resource "aws_api_gateway_resource" "subdomain_check" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.tenant_by_id.id
  path_part   = "subdomain"
}

resource "aws_api_gateway_resource" "subdomain_check_action" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.subdomain_check.id
  path_part   = "check"
}

# Tenant Admins Resource
resource "aws_api_gateway_resource" "tenant_admins" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.tenant_by_id.id
  path_part   = "admins"
}

# Tenant by Subdomain Resource
resource "aws_api_gateway_resource" "tenant_by_subdomain" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.tenants.id
  path_part   = "by-subdomain"
}

resource "aws_api_gateway_resource" "tenant_by_subdomain_name" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.tenant_by_subdomain.id
  path_part   = "{subdomain}"
}

# GET /user/tenants
resource "aws_api_gateway_method" "get_user_tenants" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.user_tenants.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_user_tenants" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_method.get_user_tenants.resource_id
  http_method             = aws_api_gateway_method.get_user_tenants.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_management.invoke_arn
}

# CORS for /user/tenants
resource "aws_api_gateway_method" "user_tenants_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.user_tenants.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "user_tenants_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_method.user_tenants_cors.resource_id
  http_method = aws_api_gateway_method.user_tenants_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_method_response" "user_tenants_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.user_tenants.id
  http_method = aws_api_gateway_method.user_tenants_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "user_tenants_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.user_tenants.id
  http_method = aws_api_gateway_method.user_tenants_cors.http_method
  status_code = aws_api_gateway_method_response.user_tenants_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# GET /tenants/{tenantId}
resource "aws_api_gateway_method" "get_tenant" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.tenant_by_id.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_tenant" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_method.get_tenant.resource_id
  http_method             = aws_api_gateway_method.get_tenant.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_management.invoke_arn
}

# PUT /tenants/{tenantId} - Update tenant profile data
resource "aws_api_gateway_method" "put_tenant" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.tenant_by_id.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_tenant" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_method.put_tenant.resource_id
  http_method             = aws_api_gateway_method.put_tenant.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_management.invoke_arn
}

# OPTIONS /tenants/{tenantId} - CORS preflight
resource "aws_api_gateway_method" "tenant_by_id_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.tenant_by_id.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "tenant_by_id_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.tenant_by_id.id
  http_method = aws_api_gateway_method.tenant_by_id_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "tenant_by_id_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.tenant_by_id.id
  http_method = aws_api_gateway_method.tenant_by_id_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "tenant_by_id_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.tenant_by_id.id
  http_method = aws_api_gateway_method.tenant_by_id_cors.http_method
  status_code = aws_api_gateway_method_response.tenant_by_id_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,PUT,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# GET /tenants/{tenantId}/subdomain/check
resource "aws_api_gateway_method" "check_subdomain" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.subdomain_check_action.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "check_subdomain" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_method.check_subdomain.resource_id
  http_method             = aws_api_gateway_method.check_subdomain.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_management.invoke_arn
}

# POST /tenants/{tenantId}/subdomain
resource "aws_api_gateway_method" "create_subdomain" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.subdomain_check.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "create_subdomain" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_method.create_subdomain.resource_id
  http_method             = aws_api_gateway_method.create_subdomain.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_management.invoke_arn
}

# GET /tenants/by-subdomain/{subdomain}
resource "aws_api_gateway_method" "get_tenant_by_subdomain" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.tenant_by_subdomain_name.id
  http_method   = "GET"
  authorization = "NONE" # Public endpoint for tenant detection
}

resource "aws_api_gateway_integration" "get_tenant_by_subdomain" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_method.get_tenant_by_subdomain.resource_id
  http_method             = aws_api_gateway_method.get_tenant_by_subdomain.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_management.invoke_arn
}

# GET /tenants/{tenantId}/admins
resource "aws_api_gateway_method" "get_tenant_admins" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.tenant_admins.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_tenant_admins" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_method.get_tenant_admins.resource_id
  http_method             = aws_api_gateway_method.get_tenant_admins.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_management.invoke_arn
}

# POST /tenants/{tenantId}/admins
resource "aws_api_gateway_method" "post_tenant_admins" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.tenant_admins.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_tenant_admins" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_method.post_tenant_admins.resource_id
  http_method             = aws_api_gateway_method.post_tenant_admins.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_management.invoke_arn
}

# CORS for /tenants/{tenantId}/admins
resource "aws_api_gateway_method" "tenant_admins_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.tenant_admins.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "tenant_admins_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_method.tenant_admins_cors.resource_id
  http_method = aws_api_gateway_method.tenant_admins_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_method_response" "tenant_admins_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.tenant_admins.id
  http_method = aws_api_gateway_method.tenant_admins_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "tenant_admins_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.tenant_admins.id
  http_method = aws_api_gateway_method.tenant_admins_cors.http_method
  status_code = aws_api_gateway_method_response.tenant_admins_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# ============================================================
# TENANT MEMBERS ENDPOINTS
# ============================================================

# Tenant Members Resource
resource "aws_api_gateway_resource" "tenant_members" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.tenant_by_id.id
  path_part   = "members"
}

# GET /tenants/{tenantId}/members - Get all members for a tenant (admin only)
resource "aws_api_gateway_method" "get_tenant_members" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.tenant_members.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_tenant_members" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_method.get_tenant_members.resource_id
  http_method             = aws_api_gateway_method.get_tenant_members.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_management.invoke_arn
}

# CORS for /tenants/{tenantId}/members
resource "aws_api_gateway_method" "tenant_members_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.tenant_members.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "tenant_members_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_method.tenant_members_cors.resource_id
  http_method = aws_api_gateway_method.tenant_members_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_method_response" "tenant_members_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.tenant_members.id
  http_method = aws_api_gateway_method.tenant_members_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "tenant_members_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.tenant_members.id
  http_method = aws_api_gateway_method.tenant_members_cors.http_method
  status_code = aws_api_gateway_method_response.tenant_members_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# CORS for /tenants/{tenantId}/subdomain/check
resource "aws_api_gateway_method" "subdomain_check_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.subdomain_check_action.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "subdomain_check_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_method.subdomain_check_cors.resource_id
  http_method = aws_api_gateway_method.subdomain_check_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_method_response" "subdomain_check_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.subdomain_check_action.id
  http_method = aws_api_gateway_method.subdomain_check_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "subdomain_check_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.subdomain_check_action.id
  http_method = aws_api_gateway_method.subdomain_check_cors.http_method
  status_code = aws_api_gateway_method_response.subdomain_check_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# CORS for /tenants/{tenantId}/subdomain
resource "aws_api_gateway_method" "subdomain_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.subdomain_check.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "subdomain_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_method.subdomain_cors.resource_id
  http_method = aws_api_gateway_method.subdomain_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_method_response" "subdomain_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.subdomain_check.id
  http_method = aws_api_gateway_method.subdomain_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "subdomain_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.subdomain_check.id
  http_method = aws_api_gateway_method.subdomain_cors.http_method
  status_code = aws_api_gateway_method_response.subdomain_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# CORS for /tenants/by-subdomain/{subdomain}
resource "aws_api_gateway_method" "tenant_by_subdomain_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.tenant_by_subdomain_name.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "tenant_by_subdomain_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_method.tenant_by_subdomain_cors.resource_id
  http_method = aws_api_gateway_method.tenant_by_subdomain_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_method_response" "tenant_by_subdomain_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.tenant_by_subdomain_name.id
  http_method = aws_api_gateway_method.tenant_by_subdomain_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "tenant_by_subdomain_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.tenant_by_subdomain_name.id
  http_method = aws_api_gateway_method.tenant_by_subdomain_cors.http_method
  status_code = aws_api_gateway_method_response.tenant_by_subdomain_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# Lambda Permission für API Gateway
resource "aws_lambda_permission" "tenant_api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.tenant_management.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}

# ============================================================
# DELETE /user/account - Delete own user account
# ============================================================

resource "aws_api_gateway_method" "delete_user_account" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.user_account.id
  http_method   = "DELETE"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "delete_user_account" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.user_account.id
  http_method             = aws_api_gateway_method.delete_user_account.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_management.invoke_arn
}

# CORS for /user/account
resource "aws_api_gateway_method" "user_account_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.user_account.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "user_account_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.user_account.id
  http_method = aws_api_gateway_method.user_account_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_method_response" "user_account_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.user_account.id
  http_method = aws_api_gateway_method.user_account_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "user_account_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.user_account.id
  http_method = aws_api_gateway_method.user_account_cors.http_method
  status_code = aws_api_gateway_method_response.user_account_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# ============================================================
# DELETE /tenants/{tenantId} - Delete entire tenant (admin only)
# ============================================================

resource "aws_api_gateway_method" "delete_tenant" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.tenant_by_id.id
  http_method   = "DELETE"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "delete_tenant" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.tenant_by_id.id
  http_method             = aws_api_gateway_method.delete_tenant.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_management.invoke_arn
}


# ============================================================
# User Notification Settings: /tenants/{tenantId}/user/notifications
# ============================================================

# Resource: /tenants/{tenantId}/user
resource "aws_api_gateway_resource" "tenant_user" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.tenant_by_id.id
  path_part   = "user"
}

# Resource: /tenants/{tenantId}/user/notifications
resource "aws_api_gateway_resource" "tenant_user_notifications" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.tenant_user.id
  path_part   = "notifications"
}

# GET /tenants/{tenantId}/user/notifications
resource "aws_api_gateway_method" "get_user_notifications" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.tenant_user_notifications.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_user_notifications" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.tenant_user_notifications.id
  http_method             = aws_api_gateway_method.get_user_notifications.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_management.invoke_arn
}

# PUT /tenants/{tenantId}/user/notifications
resource "aws_api_gateway_method" "put_user_notifications" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.tenant_user_notifications.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_user_notifications" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.tenant_user_notifications.id
  http_method             = aws_api_gateway_method.put_user_notifications.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_management.invoke_arn
}

# CORS for /tenants/{tenantId}/user/notifications
resource "aws_api_gateway_method" "user_notifications_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.tenant_user_notifications.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "user_notifications_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.tenant_user_notifications.id
  http_method = aws_api_gateway_method.user_notifications_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_method_response" "user_notifications_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.tenant_user_notifications.id
  http_method = aws_api_gateway_method.user_notifications_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "user_notifications_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.tenant_user_notifications.id
  http_method = aws_api_gateway_method.user_notifications_cors.http_method
  status_code = aws_api_gateway_method_response.user_notifications_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,PUT,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}


# ============================================================
# CUSTOM PAGES ENDPOINTS
# ============================================================

# Resource: /tenants/{tenantId}/custom-pages
resource "aws_api_gateway_resource" "custom_pages" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.tenant_by_id.id
  path_part   = "custom-pages"
}

# Resource: /tenants/{tenantId}/custom-pages/{pageId}
resource "aws_api_gateway_resource" "custom_page_by_id" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.custom_pages.id
  path_part   = "{pageId}"
}

# Resource: /tenants/{tenantId}/custom-pages/by-slug
resource "aws_api_gateway_resource" "custom_pages_by_slug" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.custom_pages.id
  path_part   = "by-slug"
}

# Resource: /tenants/{tenantId}/custom-pages/by-slug/{slug}
resource "aws_api_gateway_resource" "custom_page_by_slug" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.custom_pages_by_slug.id
  path_part   = "{slug}"
}

# GET /tenants/{tenantId}/custom-pages - List all custom pages
resource "aws_api_gateway_method" "get_custom_pages" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.custom_pages.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_custom_pages" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.custom_pages.id
  http_method             = aws_api_gateway_method.get_custom_pages.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_management.invoke_arn
}

# POST /tenants/{tenantId}/custom-pages - Create custom page
resource "aws_api_gateway_method" "post_custom_pages" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.custom_pages.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_custom_pages" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.custom_pages.id
  http_method             = aws_api_gateway_method.post_custom_pages.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_management.invoke_arn
}

# CORS for /tenants/{tenantId}/custom-pages
resource "aws_api_gateway_method" "custom_pages_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.custom_pages.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "custom_pages_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.custom_pages.id
  http_method = aws_api_gateway_method.custom_pages_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_method_response" "custom_pages_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.custom_pages.id
  http_method = aws_api_gateway_method.custom_pages_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "custom_pages_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.custom_pages.id
  http_method = aws_api_gateway_method.custom_pages_cors.http_method
  status_code = aws_api_gateway_method_response.custom_pages_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# PUT /tenants/{tenantId}/custom-pages/{pageId} - Update custom page
resource "aws_api_gateway_method" "put_custom_page" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.custom_page_by_id.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_custom_page" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.custom_page_by_id.id
  http_method             = aws_api_gateway_method.put_custom_page.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_management.invoke_arn
}

# DELETE /tenants/{tenantId}/custom-pages/{pageId} - Delete custom page
resource "aws_api_gateway_method" "delete_custom_page" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.custom_page_by_id.id
  http_method   = "DELETE"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "delete_custom_page" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.custom_page_by_id.id
  http_method             = aws_api_gateway_method.delete_custom_page.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_management.invoke_arn
}

# CORS for /tenants/{tenantId}/custom-pages/{pageId}
resource "aws_api_gateway_method" "custom_page_by_id_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.custom_page_by_id.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "custom_page_by_id_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.custom_page_by_id.id
  http_method = aws_api_gateway_method.custom_page_by_id_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_method_response" "custom_page_by_id_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.custom_page_by_id.id
  http_method = aws_api_gateway_method.custom_page_by_id_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "custom_page_by_id_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.custom_page_by_id.id
  http_method = aws_api_gateway_method.custom_page_by_id_cors.http_method
  status_code = aws_api_gateway_method_response.custom_page_by_id_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'PUT,DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# Resource: /tenants/{tenantId}/custom-pages/upload-url
resource "aws_api_gateway_resource" "custom_pages_upload_url" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.custom_pages.id
  path_part   = "upload-url"
}

# POST /tenants/{tenantId}/custom-pages/upload-url - Generate presigned URL for media upload
resource "aws_api_gateway_method" "post_custom_pages_upload_url" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.custom_pages_upload_url.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "post_custom_pages_upload_url" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.custom_pages_upload_url.id
  http_method             = aws_api_gateway_method.post_custom_pages_upload_url.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_management.invoke_arn
}

# CORS for /tenants/{tenantId}/custom-pages/upload-url
resource "aws_api_gateway_method" "custom_pages_upload_url_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.custom_pages_upload_url.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "custom_pages_upload_url_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.custom_pages_upload_url.id
  http_method = aws_api_gateway_method.custom_pages_upload_url_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_method_response" "custom_pages_upload_url_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.custom_pages_upload_url.id
  http_method = aws_api_gateway_method.custom_pages_upload_url_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "custom_pages_upload_url_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.custom_pages_upload_url.id
  http_method = aws_api_gateway_method.custom_pages_upload_url_cors.http_method
  status_code = aws_api_gateway_method_response.custom_pages_upload_url_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# GET /tenants/{tenantId}/custom-pages/by-slug/{slug} - Get page by slug (public)
resource "aws_api_gateway_method" "get_custom_page_by_slug" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.custom_page_by_slug.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_custom_page_by_slug" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.custom_page_by_slug.id
  http_method             = aws_api_gateway_method.get_custom_page_by_slug.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_management.invoke_arn
}

# CORS for /tenants/{tenantId}/custom-pages/by-slug/{slug}
resource "aws_api_gateway_method" "custom_page_by_slug_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.custom_page_by_slug.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "custom_page_by_slug_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.custom_page_by_slug.id
  http_method = aws_api_gateway_method.custom_page_by_slug_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_method_response" "custom_page_by_slug_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.custom_page_by_slug.id
  http_method = aws_api_gateway_method.custom_page_by_slug_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "custom_page_by_slug_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.custom_page_by_slug.id
  http_method = aws_api_gateway_method.custom_page_by_slug_cors.http_method
  status_code = aws_api_gateway_method_response.custom_page_by_slug_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# ============================================================
# DOMAIN ROUTING ENDPOINT (PUBLIC - for custom domain resolution)
# ============================================================

# /domain-routing Resource
resource "aws_api_gateway_resource" "domain_routing" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.api_gateway_root_resource_id
  path_part   = "domain-routing"
}

# /domain-routing/{domain} Resource
resource "aws_api_gateway_resource" "domain_routing_domain" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.domain_routing.id
  path_part   = "{domain}"
}

# GET /domain-routing/{domain} - Resolve tenant from custom domain (PUBLIC)
resource "aws_api_gateway_method" "get_domain_routing" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.domain_routing_domain.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_domain_routing" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.domain_routing_domain.id
  http_method             = aws_api_gateway_method.get_domain_routing.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_management.invoke_arn
}

# CORS for /domain-routing/{domain}
resource "aws_api_gateway_method" "domain_routing_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.domain_routing_domain.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "domain_routing_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.domain_routing_domain.id
  http_method = aws_api_gateway_method.domain_routing_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_method_response" "domain_routing_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.domain_routing_domain.id
  http_method = aws_api_gateway_method.domain_routing_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "domain_routing_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.domain_routing_domain.id
  http_method = aws_api_gateway_method.domain_routing_cors.http_method
  status_code = aws_api_gateway_method_response.domain_routing_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# ============================================================
# POST /tenants/{tenantId}/join - User joins a tenant
# ============================================================

# Tenant Join Resource
resource "aws_api_gateway_resource" "tenant_join" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.tenant_by_id.id
  path_part   = "join"
}

# POST /tenants/{tenantId}/join
resource "aws_api_gateway_method" "post_tenant_join" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.tenant_join.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_tenant_join" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_method.post_tenant_join.resource_id
  http_method             = aws_api_gateway_method.post_tenant_join.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tenant_management.invoke_arn
}

# CORS for /tenants/{tenantId}/join
resource "aws_api_gateway_method" "tenant_join_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.tenant_join.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "tenant_join_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_method.tenant_join_cors.resource_id
  http_method = aws_api_gateway_method.tenant_join_cors.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_method_response" "tenant_join_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.tenant_join.id
  http_method = aws_api_gateway_method.tenant_join_cors.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "tenant_join_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.tenant_join.id
  http_method = aws_api_gateway_method.tenant_join_cors.http_method
  status_code = aws_api_gateway_method_response.tenant_join_cors.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}
