# Route 53 DNS Configuration für ViralTenant Platform

terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "~> 5.0"
      configuration_aliases = [aws.us_east_1]
    }
  }
}

# Data source für bestehende Hosted Zone (falls vorhanden)
data "aws_route53_zone" "main" {
  count        = var.create_hosted_zone ? 0 : 1
  zone_id      = var.existing_hosted_zone_id != "" ? var.existing_hosted_zone_id : null
  name         = var.existing_hosted_zone_id == "" ? var.domain_name : null
  private_zone = false
}

# Hosted Zone erstellen (falls nicht vorhanden)
resource "aws_route53_zone" "main" {
  count = var.create_hosted_zone ? 1 : 0
  name  = var.domain_name

  tags = merge(var.tags, {
    Name = "ViralTenant Main Domain"
    Type = "Multi-Tenant"
  })
}

# SSL Certificate für CloudFront (muss in us-east-1 sein)
resource "aws_acm_certificate" "main" {
  provider          = aws.us_east_1
  domain_name       = var.domain_name
  validation_method = "DNS"

  subject_alternative_names = [
    "*.${var.domain_name}",
    "api.${var.domain_name}",
    "www.${var.domain_name}"
  ]

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(var.tags, {
    Name = "ViralTenant SSL Certificate"
  })
}

# DNS Validation Records für SSL Certificate
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = local.zone_id
}

# SSL Certificate Validation
resource "aws_acm_certificate_validation" "main" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]

  timeouts {
    create = "5m"
  }
}

# A Record für Hauptdomain -> CloudFront (nur wenn CloudFront Domain verfügbar)
resource "aws_route53_record" "main" {
  count   = var.cloudfront_domain_name != "" ? 1 : 0
  zone_id = local.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = var.cloudfront_domain_name
    zone_id                = var.cloudfront_hosted_zone_id
    evaluate_target_health = false
  }
}

# AAAA Record für IPv6 -> CloudFront (nur wenn CloudFront Domain verfügbar)
resource "aws_route53_record" "main_ipv6" {
  count   = var.cloudfront_domain_name != "" ? 1 : 0
  zone_id = local.zone_id
  name    = var.domain_name
  type    = "AAAA"

  alias {
    name                   = var.cloudfront_domain_name
    zone_id                = var.cloudfront_hosted_zone_id
    evaluate_target_health = false
  }
}

# WWW Subdomain -> Hauptdomain (nur wenn CloudFront Domain verfügbar)
resource "aws_route53_record" "www" {
  count   = var.cloudfront_domain_name != "" ? 1 : 0
  zone_id = local.zone_id
  name    = "www.${var.domain_name}"
  type    = "A"

  alias {
    name                   = var.cloudfront_domain_name
    zone_id                = var.cloudfront_hosted_zone_id
    evaluate_target_health = false
  }
}

# API Subdomain -> API Gateway (falls konfiguriert)
resource "aws_route53_record" "api" {
  count   = var.api_gateway_domain_name != "" && var.api_gateway_hosted_zone_id != "" ? 1 : 0
  zone_id = local.zone_id
  name    = "api.${var.domain_name}"
  type    = "A"

  alias {
    name                   = var.api_gateway_domain_name
    zone_id                = var.api_gateway_hosted_zone_id
    evaluate_target_health = false
  }
}

# Wildcard für Creator Subdomains -> CloudFront (nur wenn CloudFront Domain verfügbar)
resource "aws_route53_record" "wildcard" {
  count   = var.cloudfront_domain_name != "" ? 1 : 0
  zone_id = local.zone_id
  name    = "*.${var.domain_name}"
  type    = "A"

  alias {
    name                   = var.cloudfront_domain_name
    zone_id                = var.cloudfront_hosted_zone_id
    evaluate_target_health = false
  }
}

# MX Records für E-Mail (optional)
resource "aws_route53_record" "mx" {
  count   = length(var.mx_records) > 0 ? 1 : 0
  zone_id = local.zone_id
  name    = var.domain_name
  type    = "MX"
  ttl     = var.dns_ttl_mx
  records = var.mx_records
}

# TXT Records für Domain Verification (optional)
resource "aws_route53_record" "txt" {
  count   = length(var.txt_records) > 0 ? 1 : 0
  zone_id = local.zone_id
  name    = var.domain_name
  type    = "TXT"
  ttl     = var.dns_ttl_txt
  records = var.txt_records
}

# Locals
locals {
  zone_id = var.create_hosted_zone ? aws_route53_zone.main[0].zone_id : data.aws_route53_zone.main[0].zone_id
}