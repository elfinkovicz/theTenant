# EventBridge Rule für IVS Stream State Changes
resource "aws_cloudwatch_event_rule" "ivs_stream_state" {
  name        = "${var.project_name}-ivs-stream-state"
  description = "Trigger when IVS stream starts or stops"

  event_pattern = jsonencode({
    source      = ["aws.ivs"]
    detail-type = ["IVS Stream State Change"]
    detail = {
      channel_arn = [var.ivs_channel_arn]
    }
  })
}

# EventBridge Target -> Lambda
resource "aws_cloudwatch_event_target" "lambda" {
  rule      = aws_cloudwatch_event_rule.ivs_stream_state.name
  target_id = "StreamRestreamingLambda"
  arn       = aws_lambda_function.stream_restreaming.arn
}

# Lambda Permission für EventBridge
resource "aws_lambda_permission" "eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.stream_restreaming.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.ivs_stream_state.arn
}
