# Tenant Management Module
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# DynamoDB Table: Tenants (Creator-Daten)
resource "aws_dynamodb_table" "tenants" {
  name         = "${var.platform_name}-tenants-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenant_id"

  attribute {
    name = "tenant_id"
    type = "S"
  }

  attribute {
    name = "subdomain"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "creator_email"
    type = "S"
  }

  global_secondary_index {
    name            = "subdomain-index"
    hash_key        = "subdomain"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "status-index"
    hash_key        = "status"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "creator-email-index"
    hash_key        = "creator_email"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = var.enable_point_in_time_recovery
  }

  tags = merge(var.tags, {
    Name = "${var.platform_name}-tenants"
    Type = "TenantManagement"
  })
}

# DynamoDB Table: User-Tenant Zuordnungen
resource "aws_dynamodb_table" "user_tenants" {
  name         = "${var.platform_name}-user-tenants-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"
  range_key    = "tenant_id"

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "tenant_id"
    type = "S"
  }

  attribute {
    name = "role"
    type = "S"
  }

  global_secondary_index {
    name            = "tenant-users-index"
    hash_key        = "tenant_id"
    range_key       = "user_id"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "user-role-index"
    hash_key        = "user_id"
    range_key       = "role"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = var.enable_point_in_time_recovery
  }

  tags = merge(var.tags, {
    Name = "${var.platform_name}-user-tenants"
    Type = "TenantManagement"
  })
}

# DynamoDB Table: Assets (Metadaten für S3-Objekte)
resource "aws_dynamodb_table" "assets" {
  name         = "${var.platform_name}-assets-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "asset_id"

  attribute {
    name = "asset_id"
    type = "S"
  }

  attribute {
    name = "tenant_id"
    type = "S"
  }

  attribute {
    name = "type"
    type = "S"
  }

  attribute {
    name = "visibility"
    type = "S"
  }

  attribute {
    name = "created_at"
    type = "S"
  }

  global_secondary_index {
    name            = "tenant-assets-index"
    hash_key        = "tenant_id"
    range_key       = "created_at"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "tenant-type-index"
    hash_key        = "tenant_id"
    range_key       = "type"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "tenant-visibility-index"
    hash_key        = "tenant_id"
    range_key       = "visibility"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = var.enable_point_in_time_recovery
  }

  tags = merge(var.tags, {
    Name = "${var.platform_name}-assets"
    Type = "AssetManagement"
  })
}