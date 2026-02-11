# CloudWatch Alarm für Lambda Errors
resource "aws_cloudwatch_metric_alarm" "billing_api_errors" {
  alarm_name          = "${var.platform_name}-billing-api-errors"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = "1"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "Alert when Billing API Lambda has 5+ errors in 5 minutes"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.billing_api.function_name
  }

  tags = var.tags
}

# CloudWatch Alarm für Lambda Duration
resource "aws_cloudwatch_metric_alarm" "billing_api_duration" {
  alarm_name          = "${var.platform_name}-billing-api-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Average"
  threshold           = "30000"
  alarm_description   = "Alert when Billing API Lambda average duration exceeds 30 seconds"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.billing_api.function_name
  }

  tags = var.tags
}

# CloudWatch Alarm für Lambda Throttles
resource "aws_cloudwatch_metric_alarm" "billing_api_throttles" {
  alarm_name          = "${var.platform_name}-billing-api-throttles"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = "1"
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "1"
  alarm_description   = "Alert when Billing API Lambda is throttled"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.billing_api.function_name
  }

  tags = var.tags
}
