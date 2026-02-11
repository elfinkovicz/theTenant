# ============================================================
# SNAPCHAT API GATEWAY ENDPOINTS
# ============================================================

resource "aws_api_gateway_resource" "snapchat" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.api_gateway_root_resource_id
  path_part   = "snapchat"
}

resource "aws_api_gateway_resource" "snapchat_settings" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.snapchat.id
  path_part   = "settings"
}

resource "aws_api_gateway_resource" "snapchat_test" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.snapchat.id
  path_part   = "test"
}

# GET /snapchat/settings
resource "aws_api_gateway_method" "get_snapchat_settings" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.snapchat_settings.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_snapchat_settings" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.snapchat_settings.id
  http_method             = aws_api_gateway_method.get_snapchat_settings.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

# PUT /snapchat/settings
resource "aws_api_gateway_method" "put_snapchat_settings" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.snapchat_settings.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_snapchat_settings" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.snapchat_settings.id
  http_method             = aws_api_gateway_method.put_snapchat_settings.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

# POST /snapchat/test
resource "aws_api_gateway_method" "post_snapchat_test" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.snapchat_test.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_snapchat_test" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.snapchat_test.id
  http_method             = aws_api_gateway_method.post_snapchat_test.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

# CORS for /snapchat/settings
resource "aws_api_gateway_method" "snapchat_settings_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.snapchat_settings.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "snapchat_settings_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.snapchat_settings.id
  http_method       = aws_api_gateway_method.snapchat_settings_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "snapchat_settings_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.snapchat_settings.id
  http_method = aws_api_gateway_method.snapchat_settings_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "snapchat_settings_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.snapchat_settings.id
  http_method = aws_api_gateway_method.snapchat_settings_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,PUT,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.snapchat_settings_cors, aws_api_gateway_integration.snapchat_settings_cors]
}

# CORS for /snapchat/test
resource "aws_api_gateway_method" "snapchat_test_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.snapchat_test.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "snapchat_test_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.snapchat_test.id
  http_method       = aws_api_gateway_method.snapchat_test_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "snapchat_test_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.snapchat_test.id
  http_method = aws_api_gateway_method.snapchat_test_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "snapchat_test_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.snapchat_test.id
  http_method = aws_api_gateway_method.snapchat_test_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.snapchat_test_cors, aws_api_gateway_integration.snapchat_test_cors]
}

# ============================================================
# SNAPCHAT OAUTH ENDPOINTS
# ============================================================

resource "aws_api_gateway_resource" "snapchat_oauth" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.snapchat.id
  path_part   = "oauth"
}

resource "aws_api_gateway_resource" "snapchat_oauth_callback" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.snapchat_oauth.id
  path_part   = "callback"
}

# POST /snapchat/oauth/callback
resource "aws_api_gateway_method" "post_snapchat_oauth_callback" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.snapchat_oauth_callback.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_snapchat_oauth_callback" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.snapchat_oauth_callback.id
  http_method             = aws_api_gateway_method.post_snapchat_oauth_callback.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.snapchat_oauth_callback.invoke_arn
}

# CORS for /snapchat/oauth/callback
resource "aws_api_gateway_method" "snapchat_oauth_callback_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.snapchat_oauth_callback.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "snapchat_oauth_callback_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.snapchat_oauth_callback.id
  http_method       = aws_api_gateway_method.snapchat_oauth_callback_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "snapchat_oauth_callback_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.snapchat_oauth_callback.id
  http_method = aws_api_gateway_method.snapchat_oauth_callback_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "snapchat_oauth_callback_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.snapchat_oauth_callback.id
  http_method = aws_api_gateway_method.snapchat_oauth_callback_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.snapchat_oauth_callback_cors, aws_api_gateway_integration.snapchat_oauth_callback_cors]
}

# GET /snapchat/oauth/config
resource "aws_api_gateway_resource" "snapchat_oauth_config" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.snapchat_oauth.id
  path_part   = "config"
}

resource "aws_api_gateway_method" "get_snapchat_oauth_config" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.snapchat_oauth_config.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_snapchat_oauth_config" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.snapchat_oauth_config.id
  http_method             = aws_api_gateway_method.get_snapchat_oauth_config.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.snapchat_oauth_config.invoke_arn
}

# CORS for /snapchat/oauth/config
resource "aws_api_gateway_method" "snapchat_oauth_config_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.snapchat_oauth_config.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "snapchat_oauth_config_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.snapchat_oauth_config.id
  http_method       = aws_api_gateway_method.snapchat_oauth_config_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "snapchat_oauth_config_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.snapchat_oauth_config.id
  http_method = aws_api_gateway_method.snapchat_oauth_config_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "snapchat_oauth_config_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.snapchat_oauth_config.id
  http_method = aws_api_gateway_method.snapchat_oauth_config_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.snapchat_oauth_config_cors, aws_api_gateway_integration.snapchat_oauth_config_cors]
}

# ============================================================
# SNAPCHAT OAUTH LAMBDA FUNCTIONS
# ============================================================

# OAuth Config Lambda
data "archive_file" "snapchat_oauth_config_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/tenant-snapchat-oauth-config"
  output_path = "${path.module}/../../tenant_snapchat_oauth_config.zip"
}

resource "aws_iam_role" "snapchat_oauth_config_role" {
  name = "${var.platform_name}-snapchat-oauth-config-role-${var.environment}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "snapchat_oauth_config_policy" {
  role = aws_iam_role.snapchat_oauth_config_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"], Resource = "arn:aws:logs:*:*:*" }
    ]
  })
}

resource "aws_lambda_function" "snapchat_oauth_config" {
  filename         = data.archive_file.snapchat_oauth_config_zip.output_path
  source_code_hash = data.archive_file.snapchat_oauth_config_zip.output_base64sha256
  function_name    = "${var.platform_name}-snapchat-oauth-config-${var.environment}"
  role             = aws_iam_role.snapchat_oauth_config_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 10
  layers           = [var.common_deps_layer_arn]
  environment {
    variables = {
      SNAPCHAT_CLIENT_ID = var.snapchat_client_id
    }
  }
  tags = var.tags
}

resource "aws_lambda_permission" "snapchat_oauth_config_api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.snapchat_oauth_config.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}

# OAuth Callback Lambda
data "archive_file" "snapchat_oauth_callback_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/tenant-snapchat-oauth-callback"
  output_path = "${path.module}/../../tenant_snapchat_oauth_callback.zip"
}

resource "aws_iam_role" "snapchat_oauth_callback_role" {
  name = "${var.platform_name}-snapchat-oauth-callback-role-${var.environment}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "snapchat_oauth_callback_policy" {
  role = aws_iam_role.snapchat_oauth_callback_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"], Resource = "arn:aws:logs:*:*:*" },
      { Effect = "Allow", Action = ["dynamodb:PutItem"], Resource = [aws_dynamodb_table.snapchat_settings.arn] }
    ]
  })
}

resource "aws_lambda_function" "snapchat_oauth_callback" {
  filename         = data.archive_file.snapchat_oauth_callback_zip.output_path
  source_code_hash = data.archive_file.snapchat_oauth_callback_zip.output_base64sha256
  function_name    = "${var.platform_name}-snapchat-oauth-callback-${var.environment}"
  role             = aws_iam_role.snapchat_oauth_callback_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 30
  layers           = [var.common_deps_layer_arn]
  environment {
    variables = {
      SNAPCHAT_SETTINGS_TABLE = aws_dynamodb_table.snapchat_settings.name
      SNAPCHAT_CLIENT_ID      = var.snapchat_client_id
      SNAPCHAT_CLIENT_SECRET  = var.snapchat_client_secret
      REGION                  = var.aws_region
    }
  }
  tags = var.tags
}

resource "aws_lambda_permission" "snapchat_oauth_callback_api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.snapchat_oauth_callback.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}
