output "hosted_zone_id" {
  description = "Route 53 Hosted Zone ID"
  value       = local.zone_id
}

output "hosted_zone_name_servers" {
  description = "Name Servers für die Hosted Zone"
  value       = var.create_hosted_zone ? aws_route53_zone.main[0].name_servers : data.aws_route53_zone.main[0].name_servers
}

output "ssl_certificate_arn" {
  description = "SSL Certificate ARN für CloudFront"
  value       = aws_acm_certificate_validation.main.certificate_arn
}

output "ssl_certificate_status" {
  description = "SSL Certificate Status"
  value       = aws_acm_certificate.main.status
}

output "domain_validation_options" {
  description = "Domain Validation Options"
  value       = aws_acm_certificate.main.domain_validation_options
}

output "dns_records" {
  description = "Erstellte DNS Records"
  value = {
    main_domain = length(aws_route53_record.main) > 0 ? aws_route53_record.main[0].fqdn : null
    www_domain  = length(aws_route53_record.www) > 0 ? aws_route53_record.www[0].fqdn : null
    wildcard    = length(aws_route53_record.wildcard) > 0 ? aws_route53_record.wildcard[0].fqdn : null
    api_domain  = var.api_gateway_domain_name != "" ? aws_route53_record.api[0].fqdn : null
  }
}