# SES Domain Verification
resource "aws_ses_domain_identity" "main" {
  count  = var.verify_domain ? 1 : 0
  domain = var.domain_name
}

# SES Domain Verification TXT Record
resource "aws_route53_record" "ses_verification" {
  count   = var.verify_domain ? 1 : 0
  zone_id = var.route53_zone_id
  name    = "_amazonses.${var.domain_name}"
  type    = "TXT"
  ttl     = 1800
  records = [aws_ses_domain_identity.main[0].verification_token]
}

# DKIM für bessere E-Mail-Zustellbarkeit
resource "aws_ses_domain_dkim" "main" {
  count  = var.verify_domain ? 1 : 0
  domain = aws_ses_domain_identity.main[0].domain
}

# DKIM CNAME Records
resource "aws_route53_record" "dkim" {
  count   = var.verify_domain ? 3 : 0
  zone_id = var.route53_zone_id
  name    = "${aws_ses_domain_dkim.main[0].dkim_tokens[count.index]}._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 1800
  records = ["${aws_ses_domain_dkim.main[0].dkim_tokens[count.index]}.dkim.amazonses.com"]

  allow_overwrite = true
}

# SPF Record (Sender Policy Framework)
resource "aws_route53_record" "spf" {
  count   = var.verify_domain ? 1 : 0
  zone_id = var.route53_zone_id
  name    = var.domain_name
  type    = "TXT"
  ttl     = 1800
  records = ["v=spf1 include:amazonses.com ~all"]

  allow_overwrite = true
}

# DMARC Record (Domain-based Message Authentication)
resource "aws_route53_record" "dmarc" {
  count   = var.verify_domain ? 1 : 0
  zone_id = var.route53_zone_id
  name    = "_dmarc.${var.domain_name}"
  type    = "TXT"
  ttl     = 1800
  records = ["v=DMARC1; p=none; rua=mailto:${var.sender_email}"]

  allow_overwrite = true
}

# Lambda Execution Role
resource "aws_iam_role" "lambda" {
  name = "${var.project_name}-contact-form-lambda"

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
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_ses" {
  name = "ses-send-email"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ]
      Resource = "*"
    }]
  })
}

# Lambda Function
resource "aws_lambda_function" "contact_form" {
  filename         = data.archive_file.lambda.output_path
  function_name    = "${var.project_name}-contact-form"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.lambda.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = 10

  environment {
    variables = {
      SENDER_EMAIL    = var.sender_email
      RECIPIENT_EMAIL = var.recipient_email
    }
  }
}

data "archive_file" "lambda" {
  type        = "zip"
  output_path = "${path.module}/lambda.zip"

  source {
    content  = file("${path.module}/lambda/index.js")
    filename = "index.js"
  }
}

# API Gateway
resource "aws_apigatewayv2_api" "contact_form" {
  name          = "${var.project_name}-contact-form"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins  = ["*"] # Erlaube alle Origins (oder spezifisch var.allowed_origins)
    allow_methods  = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers  = ["*"]
    expose_headers = ["*"]
    max_age        = 300
  }
}

resource "aws_apigatewayv2_stage" "contact_form" {
  api_id      = aws_apigatewayv2_api.contact_form.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_apigatewayv2_integration" "contact_form" {
  api_id           = aws_apigatewayv2_api.contact_form.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.contact_form.invoke_arn
}

resource "aws_apigatewayv2_route" "contact_form" {
  api_id    = aws_apigatewayv2_api.contact_form.id
  route_key = "POST /contact"
  target    = "integrations/${aws_apigatewayv2_integration.contact_form.id}"
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.contact_form.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.contact_form.execution_arn}/*/*"
}
