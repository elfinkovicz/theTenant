---
inclusion: fileMatch
fileMatchPattern: "**/*.tf"
---
# Terraform Module-Architektur

## Modul-Übersicht
```
modules/
├── Core: central-auth, lambda-authorizer, lambda-layers, tenant-management, tenant-registration
├── Storage: s3-tenant-storage, s3-bucket-policies, cloudfront, route53
├── Pages: tenant-frontend, tenant-live, tenant-videos, tenant-podcasts, tenant-shop, tenant-events, tenant-newsfeed, tenant-channels, tenant-team, tenant-contact
├── Features: tenant-crosspost, tenant-membership
└── Billing: billing-api, billing-dashboard
```

## Neues Modul erstellen

### 1. Struktur
```
modules/tenant-{feature}/
├── main.tf
├── variables.tf
└── outputs.tf
```

### 2. Standard-Variables
```hcl
variable "platform_name" { type = string }
variable "environment" { type = string }
variable "aws_region" { type = string }
variable "tags" { type = map(string) }
variable "api_gateway_id" { type = string }
variable "api_gateway_execution_arn" { type = string }
variable "tenant_by_id_resource_id" { type = string }
variable "lambda_authorizer_id" { type = string }
variable "user_tenants_table_name" { type = string }
variable "tenants_table_name" { type = string }
variable "creator_assets_bucket_name" { type = string }
variable "cloudfront_domain_name" { type = string }
variable "common_deps_layer_arn" { type = string }
```

### 3. Lambda + DynamoDB Template
```hcl
resource "aws_dynamodb_table" "tenant_feature" {
  name         = "${var.platform_name}-tenant-{feature}-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenant_id"
  range_key    = "{item}_id"
  tags         = merge(var.tags, { Component = "{Feature}" })
}

resource "aws_lambda_function" "tenant_feature" {
  function_name    = "${var.platform_name}-tenant-{feature}-${var.environment}"
  runtime          = "nodejs18.x"
  handler          = "index.handler"
  timeout          = 30
  memory_size      = 256
  filename         = "${path.module}/../../tenant_{feature}.zip"
  source_code_hash = filebase64sha256("${path.module}/../../tenant_{feature}.zip")
  layers           = [var.common_deps_layer_arn]
  role             = aws_iam_role.lambda_role.arn
}
```

### 4. In main.tf einbinden
```hcl
module "tenant_{feature}" {
  source                     = "./modules/tenant-{feature}"
  platform_name              = var.platform_name
  environment                = var.environment
  api_gateway_id             = module.central_auth.api_gateway_id
  lambda_authorizer_id       = module.lambda_authorizer.lambda_authorizer_id
  common_deps_layer_arn      = module.lambda_layers.common_deps_layer_arn
  depends_on                 = [module.tenant_api, module.lambda_layers]
}
```

## Namenskonventionen
- Ressourcen: `${var.platform_name}-{feature}-${var.environment}`
- Variablen: `snake_case`
- Tags: Immer `Component` und `Module` setzen

## S3 Asset-Struktur
```
s3://viraltenant-creator-assets-production/tenants/{tenant_id}/
├── hero/, ads/, live/, videos/, podcasts/, shop/, events/, newsfeed/, channels/, team/, contact/
```

## API Endpoint-Pattern
```
/tenants/{id}/{feature}
├── GET     → NONE (öffentlich)
├── PUT/POST/DELETE → CUSTOM Authorizer
└── /upload-url → POST (Presigned S3 URL)
```
