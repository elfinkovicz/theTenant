# Lambda Layers Module - Shared Dependencies for all Lambda Functions
# ====================================================================

# Tenant Registration Dependencies Layer (legacy - for backward compatibility)
resource "aws_lambda_layer_version" "tenant_registration_deps" {
  filename            = "${path.module}/../../lambda-layers/tenant-registration-deps/tenant-registration-deps-layer.zip"
  layer_name          = "${var.project_name}-tenant-registration-deps"
  compatible_runtimes = ["nodejs18.x", "nodejs20.x"]
  source_code_hash    = filebase64sha256("${path.module}/../../lambda-layers/tenant-registration-deps/tenant-registration-deps-layer.zip")

  description = "Dependencies for tenant registration Lambda function"
}

# Common Dependencies Layer - NEW
# Contains: AWS SDK (DynamoDB, S3, Cognito, SES, Route53, IVS, MediaLive, Cost Explorer), Stripe, PDFKit, UUID
resource "aws_lambda_layer_version" "common_deps" {
  filename            = "${path.module}/../../lambda-layers/common-deps/common-deps-layer.zip"
  layer_name          = "${var.project_name}-common-deps"
  compatible_runtimes = ["nodejs18.x", "nodejs20.x"]
  source_code_hash    = filebase64sha256("${path.module}/../../lambda-layers/common-deps/common-deps-layer.zip")

  description = "Shared dependencies for all ViralTenant Lambda functions"
}

# Outputs
output "tenant_registration_deps_layer_arn" {
  value       = aws_lambda_layer_version.tenant_registration_deps.arn
  description = "ARN of the tenant registration dependencies layer"
}

output "common_deps_layer_arn" {
  value       = aws_lambda_layer_version.common_deps.arn
  description = "ARN of the common dependencies layer"
}

output "common_deps_layer_version" {
  value       = aws_lambda_layer_version.common_deps.version
  description = "Version of the common dependencies layer"
}
