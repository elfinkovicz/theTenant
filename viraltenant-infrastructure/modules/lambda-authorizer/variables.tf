variable "platform_name" {
  description = "Name der Plattform"
  type        = string
}

variable "environment" {
  description = "Environment (prod, stage, dev)"
  type        = string
}

variable "aws_region" {
  description = "AWS Region"
  type        = string
}

variable "platform_domain" {
  description = "Haupt-Domain der Plattform"
  type        = string
}

variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  type        = string
}

variable "cognito_user_pool_arn" {
  description = "Cognito User Pool ARN"
  type        = string
}

variable "cognito_client_id" {
  description = "Cognito Client ID"
  type        = string
}

variable "tenants_table_name" {
  description = "Name der Tenants DynamoDB Tabelle"
  type        = string
}

variable "tenants_table_arn" {
  description = "ARN der Tenants DynamoDB Tabelle"
  type        = string
}

variable "user_tenants_table_name" {
  description = "Name der User-Tenants DynamoDB Tabelle"
  type        = string
}

variable "user_tenants_table_arn" {
  description = "ARN der User-Tenants DynamoDB Tabelle"
  type        = string
}

variable "api_gateway_id" {
  description = "API Gateway REST API ID"
  type        = string
}

variable "tags" {
  description = "Standard Tags für alle Ressourcen"
  type        = map(string)
  default     = {}
}


variable "common_deps_layer_arn" {
  description = "ARN of the common dependencies Lambda layer"
  type        = string
}
