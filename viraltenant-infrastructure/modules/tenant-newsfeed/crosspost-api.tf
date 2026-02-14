# ============================================================
# CROSSPOSTING API GATEWAY ROUTES
# Discord, Slack, Facebook, Instagram, Signal, X (Twitter), LinkedIn
# ============================================================

# DISCORD
resource "aws_api_gateway_resource" "discord" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.api_gateway_root_resource_id
  path_part   = "discord"
}

resource "aws_api_gateway_resource" "discord_settings" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.discord.id
  path_part   = "settings"
}

resource "aws_api_gateway_resource" "discord_test" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.discord.id
  path_part   = "test"
}

resource "aws_api_gateway_method" "get_discord_settings" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.discord_settings.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_discord_settings" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.discord_settings.id
  http_method             = aws_api_gateway_method.get_discord_settings.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "put_discord_settings" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.discord_settings.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_discord_settings" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.discord_settings.id
  http_method             = aws_api_gateway_method.put_discord_settings.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "post_discord_test" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.discord_test.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_discord_test" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.discord_test.id
  http_method             = aws_api_gateway_method.post_discord_test.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "discord_settings_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.discord_settings.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "discord_settings_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.discord_settings.id
  http_method       = aws_api_gateway_method.discord_settings_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "discord_settings_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.discord_settings.id
  http_method = aws_api_gateway_method.discord_settings_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "discord_settings_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.discord_settings.id
  http_method = aws_api_gateway_method.discord_settings_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,PUT,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.discord_settings_cors, aws_api_gateway_integration.discord_settings_cors]
}

resource "aws_api_gateway_method" "discord_test_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.discord_test.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "discord_test_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.discord_test.id
  http_method       = aws_api_gateway_method.discord_test_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "discord_test_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.discord_test.id
  http_method = aws_api_gateway_method.discord_test_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "discord_test_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.discord_test.id
  http_method = aws_api_gateway_method.discord_test_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.discord_test_cors, aws_api_gateway_integration.discord_test_cors]
}


# SLACK
resource "aws_api_gateway_resource" "slack" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.api_gateway_root_resource_id
  path_part   = "slack"
}

resource "aws_api_gateway_resource" "slack_settings" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.slack.id
  path_part   = "settings"
}

resource "aws_api_gateway_resource" "slack_test" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.slack.id
  path_part   = "test"
}

resource "aws_api_gateway_method" "get_slack_settings" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.slack_settings.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_slack_settings" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.slack_settings.id
  http_method             = aws_api_gateway_method.get_slack_settings.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "put_slack_settings" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.slack_settings.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_slack_settings" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.slack_settings.id
  http_method             = aws_api_gateway_method.put_slack_settings.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "post_slack_test" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.slack_test.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_slack_test" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.slack_test.id
  http_method             = aws_api_gateway_method.post_slack_test.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "slack_settings_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.slack_settings.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "slack_settings_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.slack_settings.id
  http_method       = aws_api_gateway_method.slack_settings_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "slack_settings_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.slack_settings.id
  http_method = aws_api_gateway_method.slack_settings_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "slack_settings_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.slack_settings.id
  http_method = aws_api_gateway_method.slack_settings_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,PUT,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.slack_settings_cors, aws_api_gateway_integration.slack_settings_cors]
}

resource "aws_api_gateway_method" "slack_test_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.slack_test.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "slack_test_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.slack_test.id
  http_method       = aws_api_gateway_method.slack_test_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "slack_test_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.slack_test.id
  http_method = aws_api_gateway_method.slack_test_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "slack_test_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.slack_test.id
  http_method = aws_api_gateway_method.slack_test_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.slack_test_cors, aws_api_gateway_integration.slack_test_cors]
}


# FACEBOOK
resource "aws_api_gateway_resource" "facebook" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.api_gateway_root_resource_id
  path_part   = "facebook"
}

resource "aws_api_gateway_resource" "facebook_settings" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.facebook.id
  path_part   = "settings"
}

resource "aws_api_gateway_resource" "facebook_test" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.facebook.id
  path_part   = "test"
}

resource "aws_api_gateway_method" "get_facebook_settings" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.facebook_settings.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_facebook_settings" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.facebook_settings.id
  http_method             = aws_api_gateway_method.get_facebook_settings.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "put_facebook_settings" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.facebook_settings.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_facebook_settings" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.facebook_settings.id
  http_method             = aws_api_gateway_method.put_facebook_settings.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "post_facebook_test" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.facebook_test.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_facebook_test" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.facebook_test.id
  http_method             = aws_api_gateway_method.post_facebook_test.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "facebook_settings_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.facebook_settings.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "facebook_settings_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.facebook_settings.id
  http_method       = aws_api_gateway_method.facebook_settings_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "facebook_settings_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.facebook_settings.id
  http_method = aws_api_gateway_method.facebook_settings_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "facebook_settings_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.facebook_settings.id
  http_method = aws_api_gateway_method.facebook_settings_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,PUT,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.facebook_settings_cors, aws_api_gateway_integration.facebook_settings_cors]
}

resource "aws_api_gateway_method" "facebook_test_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.facebook_test.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "facebook_test_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.facebook_test.id
  http_method       = aws_api_gateway_method.facebook_test_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "facebook_test_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.facebook_test.id
  http_method = aws_api_gateway_method.facebook_test_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "facebook_test_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.facebook_test.id
  http_method = aws_api_gateway_method.facebook_test_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.facebook_test_cors, aws_api_gateway_integration.facebook_test_cors]
}


# INSTAGRAM
resource "aws_api_gateway_resource" "instagram" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.api_gateway_root_resource_id
  path_part   = "instagram"
}

resource "aws_api_gateway_resource" "instagram_settings" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.instagram.id
  path_part   = "settings"
}

resource "aws_api_gateway_resource" "instagram_test" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.instagram.id
  path_part   = "test"
}

resource "aws_api_gateway_method" "get_instagram_settings" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.instagram_settings.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_instagram_settings" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.instagram_settings.id
  http_method             = aws_api_gateway_method.get_instagram_settings.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "put_instagram_settings" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.instagram_settings.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_instagram_settings" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.instagram_settings.id
  http_method             = aws_api_gateway_method.put_instagram_settings.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "post_instagram_test" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.instagram_test.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_instagram_test" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.instagram_test.id
  http_method             = aws_api_gateway_method.post_instagram_test.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "instagram_settings_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.instagram_settings.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "instagram_settings_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.instagram_settings.id
  http_method       = aws_api_gateway_method.instagram_settings_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "instagram_settings_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.instagram_settings.id
  http_method = aws_api_gateway_method.instagram_settings_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "instagram_settings_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.instagram_settings.id
  http_method = aws_api_gateway_method.instagram_settings_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,PUT,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.instagram_settings_cors, aws_api_gateway_integration.instagram_settings_cors]
}

resource "aws_api_gateway_method" "instagram_test_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.instagram_test.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "instagram_test_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.instagram_test.id
  http_method       = aws_api_gateway_method.instagram_test_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "instagram_test_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.instagram_test.id
  http_method = aws_api_gateway_method.instagram_test_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "instagram_test_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.instagram_test.id
  http_method = aws_api_gateway_method.instagram_test_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.instagram_test_cors, aws_api_gateway_integration.instagram_test_cors]
}

# Instagram OAuth routes (for Instagram Login API - no Facebook required!)
resource "aws_api_gateway_resource" "instagram_oauth" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.instagram.id
  path_part   = "oauth"
}

resource "aws_api_gateway_resource" "instagram_oauth_config" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.instagram_oauth.id
  path_part   = "config"
}

resource "aws_api_gateway_resource" "instagram_oauth_callback" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.instagram_oauth.id
  path_part   = "callback"
}

# GET /instagram/oauth/config - Public endpoint (no auth required)
resource "aws_api_gateway_method" "get_instagram_oauth_config" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.instagram_oauth_config.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_instagram_oauth_config" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.instagram_oauth_config.id
  http_method             = aws_api_gateway_method.get_instagram_oauth_config.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "instagram_oauth_config_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.instagram_oauth_config.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "instagram_oauth_config_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.instagram_oauth_config.id
  http_method       = aws_api_gateway_method.instagram_oauth_config_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "instagram_oauth_config_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.instagram_oauth_config.id
  http_method = aws_api_gateway_method.instagram_oauth_config_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "instagram_oauth_config_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.instagram_oauth_config.id
  http_method = aws_api_gateway_method.instagram_oauth_config_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.instagram_oauth_config_cors, aws_api_gateway_integration.instagram_oauth_config_cors]
}

# POST /instagram/oauth/callback - Requires auth
resource "aws_api_gateway_method" "post_instagram_oauth_callback" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.instagram_oauth_callback.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_instagram_oauth_callback" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.instagram_oauth_callback.id
  http_method             = aws_api_gateway_method.post_instagram_oauth_callback.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "instagram_oauth_callback_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.instagram_oauth_callback.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "instagram_oauth_callback_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.instagram_oauth_callback.id
  http_method       = aws_api_gateway_method.instagram_oauth_callback_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "instagram_oauth_callback_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.instagram_oauth_callback.id
  http_method = aws_api_gateway_method.instagram_oauth_callback_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "instagram_oauth_callback_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.instagram_oauth_callback.id
  http_method = aws_api_gateway_method.instagram_oauth_callback_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.instagram_oauth_callback_cors, aws_api_gateway_integration.instagram_oauth_callback_cors]
}


# SIGNAL
resource "aws_api_gateway_resource" "signal" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.api_gateway_root_resource_id
  path_part   = "signal"
}

resource "aws_api_gateway_resource" "signal_settings" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.signal.id
  path_part   = "settings"
}

resource "aws_api_gateway_resource" "signal_test" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.signal.id
  path_part   = "test"
}

resource "aws_api_gateway_method" "get_signal_settings" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.signal_settings.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_signal_settings" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.signal_settings.id
  http_method             = aws_api_gateway_method.get_signal_settings.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "put_signal_settings" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.signal_settings.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_signal_settings" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.signal_settings.id
  http_method             = aws_api_gateway_method.put_signal_settings.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "post_signal_test" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.signal_test.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_signal_test" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.signal_test.id
  http_method             = aws_api_gateway_method.post_signal_test.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "signal_settings_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.signal_settings.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "signal_settings_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.signal_settings.id
  http_method       = aws_api_gateway_method.signal_settings_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "signal_settings_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.signal_settings.id
  http_method = aws_api_gateway_method.signal_settings_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "signal_settings_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.signal_settings.id
  http_method = aws_api_gateway_method.signal_settings_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,PUT,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.signal_settings_cors, aws_api_gateway_integration.signal_settings_cors]
}

resource "aws_api_gateway_method" "signal_test_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.signal_test.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "signal_test_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.signal_test.id
  http_method       = aws_api_gateway_method.signal_test_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "signal_test_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.signal_test.id
  http_method = aws_api_gateway_method.signal_test_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "signal_test_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.signal_test.id
  http_method = aws_api_gateway_method.signal_test_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.signal_test_cors, aws_api_gateway_integration.signal_test_cors]
}


# X (TWITTER)
resource "aws_api_gateway_resource" "xtwitter" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.api_gateway_root_resource_id
  path_part   = "xtwitter"
}

resource "aws_api_gateway_resource" "xtwitter_settings" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.xtwitter.id
  path_part   = "settings"
}

resource "aws_api_gateway_resource" "xtwitter_test" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.xtwitter.id
  path_part   = "test"
}

resource "aws_api_gateway_method" "get_xtwitter_settings" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.xtwitter_settings.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_xtwitter_settings" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.xtwitter_settings.id
  http_method             = aws_api_gateway_method.get_xtwitter_settings.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "put_xtwitter_settings" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.xtwitter_settings.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_xtwitter_settings" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.xtwitter_settings.id
  http_method             = aws_api_gateway_method.put_xtwitter_settings.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "post_xtwitter_test" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.xtwitter_test.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_xtwitter_test" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.xtwitter_test.id
  http_method             = aws_api_gateway_method.post_xtwitter_test.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "xtwitter_settings_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.xtwitter_settings.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "xtwitter_settings_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.xtwitter_settings.id
  http_method       = aws_api_gateway_method.xtwitter_settings_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "xtwitter_settings_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.xtwitter_settings.id
  http_method = aws_api_gateway_method.xtwitter_settings_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "xtwitter_settings_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.xtwitter_settings.id
  http_method = aws_api_gateway_method.xtwitter_settings_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,PUT,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.xtwitter_settings_cors, aws_api_gateway_integration.xtwitter_settings_cors]
}

resource "aws_api_gateway_method" "xtwitter_test_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.xtwitter_test.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "xtwitter_test_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.xtwitter_test.id
  http_method       = aws_api_gateway_method.xtwitter_test_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "xtwitter_test_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.xtwitter_test.id
  http_method = aws_api_gateway_method.xtwitter_test_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "xtwitter_test_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.xtwitter_test.id
  http_method = aws_api_gateway_method.xtwitter_test_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.xtwitter_test_cors, aws_api_gateway_integration.xtwitter_test_cors]
}

# X Twitter OAuth
resource "aws_api_gateway_resource" "xtwitter_oauth" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.xtwitter.id
  path_part   = "oauth"
}

resource "aws_api_gateway_resource" "xtwitter_oauth_callback" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.xtwitter_oauth.id
  path_part   = "callback"
}

resource "aws_api_gateway_method" "post_xtwitter_oauth_callback" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.xtwitter_oauth_callback.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_xtwitter_oauth_callback" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.xtwitter_oauth_callback.id
  http_method             = aws_api_gateway_method.post_xtwitter_oauth_callback.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "xtwitter_oauth_callback_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.xtwitter_oauth_callback.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "xtwitter_oauth_callback_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.xtwitter_oauth_callback.id
  http_method       = aws_api_gateway_method.xtwitter_oauth_callback_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "xtwitter_oauth_callback_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.xtwitter_oauth_callback.id
  http_method = aws_api_gateway_method.xtwitter_oauth_callback_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "xtwitter_oauth_callback_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.xtwitter_oauth_callback.id
  http_method = aws_api_gateway_method.xtwitter_oauth_callback_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.xtwitter_oauth_callback_cors, aws_api_gateway_integration.xtwitter_oauth_callback_cors]
}

# LINKEDIN
resource "aws_api_gateway_resource" "linkedin" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.api_gateway_root_resource_id
  path_part   = "linkedin"
}

resource "aws_api_gateway_resource" "linkedin_settings" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.linkedin.id
  path_part   = "settings"
}

resource "aws_api_gateway_resource" "linkedin_test" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.linkedin.id
  path_part   = "test"
}

resource "aws_api_gateway_method" "get_linkedin_settings" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.linkedin_settings.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_linkedin_settings" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.linkedin_settings.id
  http_method             = aws_api_gateway_method.get_linkedin_settings.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "put_linkedin_settings" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.linkedin_settings.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_linkedin_settings" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.linkedin_settings.id
  http_method             = aws_api_gateway_method.put_linkedin_settings.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "post_linkedin_test" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.linkedin_test.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_linkedin_test" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.linkedin_test.id
  http_method             = aws_api_gateway_method.post_linkedin_test.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "linkedin_settings_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.linkedin_settings.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "linkedin_settings_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.linkedin_settings.id
  http_method       = aws_api_gateway_method.linkedin_settings_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "linkedin_settings_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.linkedin_settings.id
  http_method = aws_api_gateway_method.linkedin_settings_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "linkedin_settings_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.linkedin_settings.id
  http_method = aws_api_gateway_method.linkedin_settings_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,PUT,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.linkedin_settings_cors, aws_api_gateway_integration.linkedin_settings_cors]
}

resource "aws_api_gateway_method" "linkedin_test_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.linkedin_test.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "linkedin_test_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.linkedin_test.id
  http_method       = aws_api_gateway_method.linkedin_test_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "linkedin_test_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.linkedin_test.id
  http_method = aws_api_gateway_method.linkedin_test_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "linkedin_test_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.linkedin_test.id
  http_method = aws_api_gateway_method.linkedin_test_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.linkedin_test_cors, aws_api_gateway_integration.linkedin_test_cors]
}


# LINKEDIN OAUTH CALLBACK
resource "aws_api_gateway_resource" "linkedin_oauth" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.linkedin.id
  path_part   = "oauth"
}

resource "aws_api_gateway_resource" "linkedin_oauth_callback" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.linkedin_oauth.id
  path_part   = "callback"
}

resource "aws_api_gateway_method" "post_linkedin_oauth_callback" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.linkedin_oauth_callback.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_linkedin_oauth_callback" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.linkedin_oauth_callback.id
  http_method             = aws_api_gateway_method.post_linkedin_oauth_callback.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "linkedin_oauth_callback_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.linkedin_oauth_callback.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "linkedin_oauth_callback_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.linkedin_oauth_callback.id
  http_method       = aws_api_gateway_method.linkedin_oauth_callback_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "linkedin_oauth_callback_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.linkedin_oauth_callback.id
  http_method = aws_api_gateway_method.linkedin_oauth_callback_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "linkedin_oauth_callback_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.linkedin_oauth_callback.id
  http_method = aws_api_gateway_method.linkedin_oauth_callback_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.linkedin_oauth_callback_cors, aws_api_gateway_integration.linkedin_oauth_callback_cors]
}


# ============================================================
# META OAUTH (for Instagram, Facebook, Threads)
# ============================================================
resource "aws_api_gateway_resource" "meta" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.api_gateway_root_resource_id
  path_part   = "meta"
}

resource "aws_api_gateway_resource" "meta_oauth" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.meta.id
  path_part   = "oauth"
}

resource "aws_api_gateway_resource" "meta_oauth_config" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.meta_oauth.id
  path_part   = "config"
}

resource "aws_api_gateway_resource" "meta_oauth_callback" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.meta_oauth.id
  path_part   = "callback"
}

# GET /meta/oauth/config - Public endpoint to get App ID
resource "aws_api_gateway_method" "get_meta_oauth_config" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.meta_oauth_config.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_meta_oauth_config" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.meta_oauth_config.id
  http_method             = aws_api_gateway_method.get_meta_oauth_config.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "meta_oauth_config_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.meta_oauth_config.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "meta_oauth_config_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.meta_oauth_config.id
  http_method       = aws_api_gateway_method.meta_oauth_config_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "meta_oauth_config_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.meta_oauth_config.id
  http_method = aws_api_gateway_method.meta_oauth_config_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "meta_oauth_config_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.meta_oauth_config.id
  http_method = aws_api_gateway_method.meta_oauth_config_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.meta_oauth_config_cors, aws_api_gateway_integration.meta_oauth_config_cors]
}

# POST /meta/oauth/callback - Token exchange
resource "aws_api_gateway_method" "post_meta_oauth_callback" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.meta_oauth_callback.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_meta_oauth_callback" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.meta_oauth_callback.id
  http_method             = aws_api_gateway_method.post_meta_oauth_callback.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "meta_oauth_callback_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.meta_oauth_callback.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "meta_oauth_callback_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.meta_oauth_callback.id
  http_method       = aws_api_gateway_method.meta_oauth_callback_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "meta_oauth_callback_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.meta_oauth_callback.id
  http_method = aws_api_gateway_method.meta_oauth_callback_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "meta_oauth_callback_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.meta_oauth_callback.id
  http_method = aws_api_gateway_method.meta_oauth_callback_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.meta_oauth_callback_cors, aws_api_gateway_integration.meta_oauth_callback_cors]
}

# META VERIFY PERMISSIONS (for App Review)
resource "aws_api_gateway_resource" "meta_verify_permissions" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.meta.id
  path_part   = "verify-permissions"
}

resource "aws_api_gateway_method" "post_meta_verify_permissions" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.meta_verify_permissions.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_meta_verify_permissions" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.meta_verify_permissions.id
  http_method             = aws_api_gateway_method.post_meta_verify_permissions.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "meta_verify_permissions_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.meta_verify_permissions.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "meta_verify_permissions_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.meta_verify_permissions.id
  http_method       = aws_api_gateway_method.meta_verify_permissions_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "meta_verify_permissions_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.meta_verify_permissions.id
  http_method = aws_api_gateway_method.meta_verify_permissions_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "meta_verify_permissions_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.meta_verify_permissions.id
  http_method = aws_api_gateway_method.meta_verify_permissions_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.meta_verify_permissions_cors, aws_api_gateway_integration.meta_verify_permissions_cors]
}


# ============================================================
# THREADS
# ============================================================
resource "aws_api_gateway_resource" "threads" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.api_gateway_root_resource_id
  path_part   = "threads"
}

resource "aws_api_gateway_resource" "threads_settings" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.threads.id
  path_part   = "settings"
}

resource "aws_api_gateway_resource" "threads_test" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.threads.id
  path_part   = "test"
}

resource "aws_api_gateway_method" "get_threads_settings" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.threads_settings.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_threads_settings" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.threads_settings.id
  http_method             = aws_api_gateway_method.get_threads_settings.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "put_threads_settings" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.threads_settings.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_threads_settings" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.threads_settings.id
  http_method             = aws_api_gateway_method.put_threads_settings.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "post_threads_test" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.threads_test.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_threads_test" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.threads_test.id
  http_method             = aws_api_gateway_method.post_threads_test.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "threads_settings_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.threads_settings.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "threads_settings_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.threads_settings.id
  http_method       = aws_api_gateway_method.threads_settings_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "threads_settings_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.threads_settings.id
  http_method = aws_api_gateway_method.threads_settings_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "threads_settings_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.threads_settings.id
  http_method = aws_api_gateway_method.threads_settings_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,PUT,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.threads_settings_cors, aws_api_gateway_integration.threads_settings_cors]
}

resource "aws_api_gateway_method" "threads_test_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.threads_test.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "threads_test_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.threads_test.id
  http_method       = aws_api_gateway_method.threads_test_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "threads_test_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.threads_test.id
  http_method = aws_api_gateway_method.threads_test_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "threads_test_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.threads_test.id
  http_method = aws_api_gateway_method.threads_test_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.threads_test_cors, aws_api_gateway_integration.threads_test_cors]
}

# Threads OAuth endpoints
resource "aws_api_gateway_resource" "threads_oauth" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.threads.id
  path_part   = "oauth"
}

resource "aws_api_gateway_resource" "threads_oauth_config" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.threads_oauth.id
  path_part   = "config"
}

resource "aws_api_gateway_resource" "threads_oauth_callback" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.threads_oauth.id
  path_part   = "callback"
}

# GET /threads/oauth/config - No auth required (returns app ID)
resource "aws_api_gateway_method" "get_threads_oauth_config" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.threads_oauth_config.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_threads_oauth_config" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.threads_oauth_config.id
  http_method             = aws_api_gateway_method.get_threads_oauth_config.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "threads_oauth_config_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.threads_oauth_config.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "threads_oauth_config_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.threads_oauth_config.id
  http_method       = aws_api_gateway_method.threads_oauth_config_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "threads_oauth_config_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.threads_oauth_config.id
  http_method = aws_api_gateway_method.threads_oauth_config_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "threads_oauth_config_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.threads_oauth_config.id
  http_method = aws_api_gateway_method.threads_oauth_config_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.threads_oauth_config_cors, aws_api_gateway_integration.threads_oauth_config_cors]
}

# POST /threads/oauth/callback - Auth required
resource "aws_api_gateway_method" "post_threads_oauth_callback" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.threads_oauth_callback.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_threads_oauth_callback" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.threads_oauth_callback.id
  http_method             = aws_api_gateway_method.post_threads_oauth_callback.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "threads_oauth_callback_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.threads_oauth_callback.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "threads_oauth_callback_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.threads_oauth_callback.id
  http_method       = aws_api_gateway_method.threads_oauth_callback_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "threads_oauth_callback_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.threads_oauth_callback.id
  http_method = aws_api_gateway_method.threads_oauth_callback_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "threads_oauth_callback_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.threads_oauth_callback.id
  http_method = aws_api_gateway_method.threads_oauth_callback_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.threads_oauth_callback_cors, aws_api_gateway_integration.threads_oauth_callback_cors]
}


# ============================================================
# YOUTUBE
# ============================================================
resource "aws_api_gateway_resource" "youtube" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.api_gateway_root_resource_id
  path_part   = "youtube"
}

resource "aws_api_gateway_resource" "youtube_settings" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.youtube.id
  path_part   = "settings"
}

resource "aws_api_gateway_resource" "youtube_test" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.youtube.id
  path_part   = "test"
}

resource "aws_api_gateway_resource" "youtube_oauth" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.youtube.id
  path_part   = "oauth"
}

resource "aws_api_gateway_resource" "youtube_oauth_callback" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.youtube_oauth.id
  path_part   = "callback"
}

# GET /youtube/settings
resource "aws_api_gateway_method" "get_youtube_settings" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.youtube_settings.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_youtube_settings" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.youtube_settings.id
  http_method             = aws_api_gateway_method.get_youtube_settings.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

# PUT /youtube/settings
resource "aws_api_gateway_method" "put_youtube_settings" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.youtube_settings.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_youtube_settings" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.youtube_settings.id
  http_method             = aws_api_gateway_method.put_youtube_settings.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

# POST /youtube/test
resource "aws_api_gateway_method" "post_youtube_test" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.youtube_test.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_youtube_test" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.youtube_test.id
  http_method             = aws_api_gateway_method.post_youtube_test.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

# POST /youtube/oauth/callback - No auth required (state parameter validates tenant)
resource "aws_api_gateway_method" "post_youtube_oauth_callback" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.youtube_oauth_callback.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "post_youtube_oauth_callback" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.youtube_oauth_callback.id
  http_method             = aws_api_gateway_method.post_youtube_oauth_callback.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

# CORS for /youtube/settings
resource "aws_api_gateway_method" "youtube_settings_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.youtube_settings.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "youtube_settings_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.youtube_settings.id
  http_method       = aws_api_gateway_method.youtube_settings_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "youtube_settings_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.youtube_settings.id
  http_method = aws_api_gateway_method.youtube_settings_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "youtube_settings_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.youtube_settings.id
  http_method = aws_api_gateway_method.youtube_settings_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,PUT,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.youtube_settings_cors, aws_api_gateway_integration.youtube_settings_cors]
}

# CORS for /youtube/test
resource "aws_api_gateway_method" "youtube_test_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.youtube_test.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "youtube_test_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.youtube_test.id
  http_method       = aws_api_gateway_method.youtube_test_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "youtube_test_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.youtube_test.id
  http_method = aws_api_gateway_method.youtube_test_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "youtube_test_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.youtube_test.id
  http_method = aws_api_gateway_method.youtube_test_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.youtube_test_cors, aws_api_gateway_integration.youtube_test_cors]
}

# CORS for /youtube/oauth/callback
resource "aws_api_gateway_method" "youtube_oauth_callback_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.youtube_oauth_callback.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "youtube_oauth_callback_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.youtube_oauth_callback.id
  http_method       = aws_api_gateway_method.youtube_oauth_callback_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "youtube_oauth_callback_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.youtube_oauth_callback.id
  http_method = aws_api_gateway_method.youtube_oauth_callback_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "youtube_oauth_callback_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.youtube_oauth_callback.id
  http_method = aws_api_gateway_method.youtube_oauth_callback_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.youtube_oauth_callback_cors, aws_api_gateway_integration.youtube_oauth_callback_cors]
}

# ============================================================
# BLUESKY API ROUTES
# ============================================================

resource "aws_api_gateway_resource" "bluesky" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.api_gateway_root_resource_id
  path_part   = "bluesky"
}

resource "aws_api_gateway_resource" "bluesky_settings" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.bluesky.id
  path_part   = "settings"
}

resource "aws_api_gateway_resource" "bluesky_test" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.bluesky.id
  path_part   = "test"
}

resource "aws_api_gateway_method" "get_bluesky_settings" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.bluesky_settings.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_bluesky_settings" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.bluesky_settings.id
  http_method             = aws_api_gateway_method.get_bluesky_settings.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "put_bluesky_settings" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.bluesky_settings.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_bluesky_settings" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.bluesky_settings.id
  http_method             = aws_api_gateway_method.put_bluesky_settings.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "post_bluesky_test" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.bluesky_test.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_bluesky_test" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.bluesky_test.id
  http_method             = aws_api_gateway_method.post_bluesky_test.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

# CORS for Bluesky settings
resource "aws_api_gateway_method" "bluesky_settings_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.bluesky_settings.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "bluesky_settings_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.bluesky_settings.id
  http_method       = aws_api_gateway_method.bluesky_settings_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "bluesky_settings_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.bluesky_settings.id
  http_method = aws_api_gateway_method.bluesky_settings_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "bluesky_settings_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.bluesky_settings.id
  http_method = aws_api_gateway_method.bluesky_settings_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,PUT,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.bluesky_settings_cors, aws_api_gateway_integration.bluesky_settings_cors]
}

# CORS for Bluesky test
resource "aws_api_gateway_method" "bluesky_test_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.bluesky_test.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "bluesky_test_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.bluesky_test.id
  http_method       = aws_api_gateway_method.bluesky_test_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "bluesky_test_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.bluesky_test.id
  http_method = aws_api_gateway_method.bluesky_test_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "bluesky_test_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.bluesky_test.id
  http_method = aws_api_gateway_method.bluesky_test_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.bluesky_test_cors, aws_api_gateway_integration.bluesky_test_cors]
}

# ============================================================
# MASTODON API ROUTES
# ============================================================

resource "aws_api_gateway_resource" "mastodon" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.api_gateway_root_resource_id
  path_part   = "mastodon"
}

resource "aws_api_gateway_resource" "mastodon_settings" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.mastodon.id
  path_part   = "settings"
}

resource "aws_api_gateway_resource" "mastodon_test" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.mastodon.id
  path_part   = "test"
}

resource "aws_api_gateway_method" "get_mastodon_settings" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.mastodon_settings.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_mastodon_settings" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.mastodon_settings.id
  http_method             = aws_api_gateway_method.get_mastodon_settings.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "put_mastodon_settings" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.mastodon_settings.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_mastodon_settings" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.mastodon_settings.id
  http_method             = aws_api_gateway_method.put_mastodon_settings.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "post_mastodon_test" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.mastodon_test.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_mastodon_test" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.mastodon_test.id
  http_method             = aws_api_gateway_method.post_mastodon_test.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

# CORS for Mastodon settings
resource "aws_api_gateway_method" "mastodon_settings_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.mastodon_settings.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "mastodon_settings_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.mastodon_settings.id
  http_method       = aws_api_gateway_method.mastodon_settings_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "mastodon_settings_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.mastodon_settings.id
  http_method = aws_api_gateway_method.mastodon_settings_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "mastodon_settings_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.mastodon_settings.id
  http_method = aws_api_gateway_method.mastodon_settings_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,PUT,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.mastodon_settings_cors, aws_api_gateway_integration.mastodon_settings_cors]
}

# CORS for Mastodon test
resource "aws_api_gateway_method" "mastodon_test_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.mastodon_test.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "mastodon_test_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.mastodon_test.id
  http_method       = aws_api_gateway_method.mastodon_test_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "mastodon_test_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.mastodon_test.id
  http_method = aws_api_gateway_method.mastodon_test_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "mastodon_test_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.mastodon_test.id
  http_method = aws_api_gateway_method.mastodon_test_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.mastodon_test_cors, aws_api_gateway_integration.mastodon_test_cors]
}


# ============================================================
# GOOGLE OAUTH CONFIG (für YouTube)
# ============================================================

resource "aws_api_gateway_resource" "google" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.api_gateway_root_resource_id
  path_part   = "google"
}

resource "aws_api_gateway_resource" "google_oauth" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.google.id
  path_part   = "oauth"
}

resource "aws_api_gateway_resource" "google_oauth_config" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.google_oauth.id
  path_part   = "config"
}

resource "aws_api_gateway_method" "get_google_oauth_config" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.google_oauth_config.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_google_oauth_config" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.google_oauth_config.id
  http_method             = aws_api_gateway_method.get_google_oauth_config.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "google_oauth_config_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.google_oauth_config.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "google_oauth_config_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.google_oauth_config.id
  http_method       = aws_api_gateway_method.google_oauth_config_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "google_oauth_config_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.google_oauth_config.id
  http_method = aws_api_gateway_method.google_oauth_config_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "google_oauth_config_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.google_oauth_config.id
  http_method = aws_api_gateway_method.google_oauth_config_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.google_oauth_config_cors, aws_api_gateway_integration.google_oauth_config_cors]
}


# ============================================================
# LINKEDIN OAUTH CONFIG
# ============================================================

resource "aws_api_gateway_resource" "linkedin_oauth_config" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.linkedin_oauth.id
  path_part   = "config"
}

resource "aws_api_gateway_method" "get_linkedin_oauth_config" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.linkedin_oauth_config.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_linkedin_oauth_config" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.linkedin_oauth_config.id
  http_method             = aws_api_gateway_method.get_linkedin_oauth_config.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "linkedin_oauth_config_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.linkedin_oauth_config.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "linkedin_oauth_config_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.linkedin_oauth_config.id
  http_method       = aws_api_gateway_method.linkedin_oauth_config_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "linkedin_oauth_config_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.linkedin_oauth_config.id
  http_method = aws_api_gateway_method.linkedin_oauth_config_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "linkedin_oauth_config_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.linkedin_oauth_config.id
  http_method = aws_api_gateway_method.linkedin_oauth_config_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.linkedin_oauth_config_cors, aws_api_gateway_integration.linkedin_oauth_config_cors]
}


# ============================================================
# TWITTER/X OAUTH CONFIG
# ============================================================

resource "aws_api_gateway_resource" "twitter" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.api_gateway_root_resource_id
  path_part   = "twitter"
}

resource "aws_api_gateway_resource" "twitter_oauth" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.twitter.id
  path_part   = "oauth"
}

resource "aws_api_gateway_resource" "twitter_oauth_config" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.twitter_oauth.id
  path_part   = "config"
}

resource "aws_api_gateway_method" "get_twitter_oauth_config" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.twitter_oauth_config.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_twitter_oauth_config" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.twitter_oauth_config.id
  http_method             = aws_api_gateway_method.get_twitter_oauth_config.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "twitter_oauth_config_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.twitter_oauth_config.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "twitter_oauth_config_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.twitter_oauth_config.id
  http_method       = aws_api_gateway_method.twitter_oauth_config_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "twitter_oauth_config_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.twitter_oauth_config.id
  http_method = aws_api_gateway_method.twitter_oauth_config_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "twitter_oauth_config_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.twitter_oauth_config.id
  http_method = aws_api_gateway_method.twitter_oauth_config_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.twitter_oauth_config_cors, aws_api_gateway_integration.twitter_oauth_config_cors]
}

# ============================================================
# TIKTOK
# ============================================================

resource "aws_api_gateway_resource" "tiktok" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.api_gateway_root_resource_id
  path_part   = "tiktok"
}

resource "aws_api_gateway_resource" "tiktok_settings" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.tiktok.id
  path_part   = "settings"
}

resource "aws_api_gateway_resource" "tiktok_test" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.tiktok.id
  path_part   = "test"
}

resource "aws_api_gateway_method" "get_tiktok_settings" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.tiktok_settings.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "get_tiktok_settings" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.tiktok_settings.id
  http_method             = aws_api_gateway_method.get_tiktok_settings.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "put_tiktok_settings" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.tiktok_settings.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "put_tiktok_settings" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.tiktok_settings.id
  http_method             = aws_api_gateway_method.put_tiktok_settings.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "post_tiktok_test" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.tiktok_test.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_tiktok_test" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.tiktok_test.id
  http_method             = aws_api_gateway_method.post_tiktok_test.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "tiktok_settings_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.tiktok_settings.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "tiktok_settings_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.tiktok_settings.id
  http_method       = aws_api_gateway_method.tiktok_settings_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "tiktok_settings_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.tiktok_settings.id
  http_method = aws_api_gateway_method.tiktok_settings_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "tiktok_settings_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.tiktok_settings.id
  http_method = aws_api_gateway_method.tiktok_settings_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,PUT,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.tiktok_settings_cors, aws_api_gateway_integration.tiktok_settings_cors]
}

resource "aws_api_gateway_method" "tiktok_test_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.tiktok_test.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "tiktok_test_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.tiktok_test.id
  http_method       = aws_api_gateway_method.tiktok_test_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "tiktok_test_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.tiktok_test.id
  http_method = aws_api_gateway_method.tiktok_test_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "tiktok_test_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.tiktok_test.id
  http_method = aws_api_gateway_method.tiktok_test_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.tiktok_test_cors, aws_api_gateway_integration.tiktok_test_cors]
}


# TIKTOK OAUTH CALLBACK
resource "aws_api_gateway_resource" "tiktok_oauth" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.tiktok.id
  path_part   = "oauth"
}

resource "aws_api_gateway_resource" "tiktok_oauth_callback" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.tiktok_oauth.id
  path_part   = "callback"
}

resource "aws_api_gateway_method" "post_tiktok_oauth_callback" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.tiktok_oauth_callback.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.lambda_authorizer_id
}

resource "aws_api_gateway_integration" "post_tiktok_oauth_callback" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.tiktok_oauth_callback.id
  http_method             = aws_api_gateway_method.post_tiktok_oauth_callback.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "tiktok_oauth_callback_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.tiktok_oauth_callback.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "tiktok_oauth_callback_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.tiktok_oauth_callback.id
  http_method       = aws_api_gateway_method.tiktok_oauth_callback_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "tiktok_oauth_callback_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.tiktok_oauth_callback.id
  http_method = aws_api_gateway_method.tiktok_oauth_callback_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "tiktok_oauth_callback_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.tiktok_oauth_callback.id
  http_method = aws_api_gateway_method.tiktok_oauth_callback_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Creator-ID'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.tiktok_oauth_callback_cors, aws_api_gateway_integration.tiktok_oauth_callback_cors]
}


# TIKTOK OAUTH CONFIG
resource "aws_api_gateway_resource" "tiktok_oauth_config" {
  rest_api_id = var.api_gateway_id
  parent_id   = aws_api_gateway_resource.tiktok_oauth.id
  path_part   = "config"
}

resource "aws_api_gateway_method" "get_tiktok_oauth_config" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.tiktok_oauth_config.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_tiktok_oauth_config" {
  rest_api_id             = var.api_gateway_id
  resource_id             = aws_api_gateway_resource.tiktok_oauth_config.id
  http_method             = aws_api_gateway_method.get_tiktok_oauth_config.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.crosspost_settings.invoke_arn
}

resource "aws_api_gateway_method" "tiktok_oauth_config_cors" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.tiktok_oauth_config.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "tiktok_oauth_config_cors" {
  rest_api_id       = var.api_gateway_id
  resource_id       = aws_api_gateway_resource.tiktok_oauth_config.id
  http_method       = aws_api_gateway_method.tiktok_oauth_config_cors.http_method
  type              = "MOCK"
  request_templates = { "application/json" = jsonencode({ statusCode = 200 }) }
}

resource "aws_api_gateway_method_response" "tiktok_oauth_config_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.tiktok_oauth_config.id
  http_method = aws_api_gateway_method.tiktok_oauth_config_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "tiktok_oauth_config_cors" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.tiktok_oauth_config.id
  http_method = aws_api_gateway_method.tiktok_oauth_config_cors.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.tiktok_oauth_config_cors, aws_api_gateway_integration.tiktok_oauth_config_cors]
}
