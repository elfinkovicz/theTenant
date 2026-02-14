# Tenant Crosspost Module - Modular Crossposting System
# Each platform has its own Lambda for OAuth and Posting

terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

# ============================================================
# SHARED IAM ROLE FOR ALL CROSSPOST LAMBDAS
# ============================================================

resource "aws_iam_role" "crosspost_role" {
  name = "${var.platform_name}-crosspost-role-${var.environment}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
  tags = var.tags
}

resource "aws_iam_role_policy" "crosspost_policy" {
  name = "${var.platform_name}-crosspost-policy-${var.environment}"
  role = aws_iam_role.crosspost_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"], Resource = "arn:aws:logs:*:*:*" },
      # DynamoDB - All settings tables
      { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem"], Resource = [
        "arn:aws:dynamodb:${var.aws_region}:*:table/${var.platform_name}-whatsapp-settings-${var.environment}",
        var.telegram_settings_table_arn,
        var.email_settings_table_arn,
        var.discord_settings_table_arn,
        var.slack_settings_table_arn,
        var.facebook_settings_table_arn,
        var.instagram_settings_table_arn,
        var.signal_settings_table_arn,
        var.xtwitter_settings_table_arn,
        var.linkedin_settings_table_arn,
        var.youtube_settings_table_arn,
        var.bluesky_settings_table_arn,
        var.mastodon_settings_table_arn,
        var.tiktok_settings_table_arn,
        var.snapchat_settings_table_arn,
        var.threads_settings_table_arn
      ] },
      { Effect = "Allow", Action = ["dynamodb:GetItem"], Resource = [var.user_tenants_table_arn] },
      { Effect = "Allow", Action = ["dynamodb:Query"], Resource = [var.tenants_table_arn, "${var.tenants_table_arn}/index/*"] },
      # S3 - Read access for media files
      { Effect = "Allow", Action = ["s3:GetObject"], Resource = ["${var.creator_assets_bucket_arn}/tenants/*/newsfeed/*"] },
      # Lambda - Invoke other crosspost lambdas
      { Effect = "Allow", Action = ["lambda:InvokeFunction"], Resource = "arn:aws:lambda:${var.aws_region}:*:function:${var.platform_name}-crosspost-*" }
    ]
  })
}

# ============================================================
# CROSSPOST DISPATCHER LAMBDA
# ============================================================

data "archive_file" "crosspost_dispatcher_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/tenant-crosspost-dispatcher"
  output_path = "${path.module}/../../tenant_crosspost_dispatcher.zip"
  excludes    = ["node_modules", "package-lock.json"]
}

resource "aws_lambda_function" "crosspost_dispatcher" {
  filename         = data.archive_file.crosspost_dispatcher_zip.output_path
  source_code_hash = data.archive_file.crosspost_dispatcher_zip.output_base64sha256
  function_name    = "${var.platform_name}-crosspost-dispatcher-${var.environment}"
  role             = aws_iam_role.crosspost_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 60
  memory_size      = 256
  layers           = [var.common_deps_layer_arn]
  environment {
    variables = {
      REGION                       = var.aws_region
      CLOUDFRONT_DOMAIN            = var.cloudfront_domain_name
      WHATSAPP_SETTINGS_TABLE      = "${var.platform_name}-whatsapp-settings-${var.environment}"
      TELEGRAM_SETTINGS_TABLE      = var.telegram_settings_table_name
      EMAIL_SETTINGS_TABLE         = var.email_settings_table_name
      DISCORD_SETTINGS_TABLE       = var.discord_settings_table_name
      SLACK_SETTINGS_TABLE         = var.slack_settings_table_name
      FACEBOOK_SETTINGS_TABLE      = var.facebook_settings_table_name
      INSTAGRAM_SETTINGS_TABLE     = var.instagram_settings_table_name
      SIGNAL_SETTINGS_TABLE        = var.signal_settings_table_name
      XTWITTER_SETTINGS_TABLE      = var.xtwitter_settings_table_name
      LINKEDIN_SETTINGS_TABLE      = var.linkedin_settings_table_name
      YOUTUBE_SETTINGS_TABLE       = var.youtube_settings_table_name
      BLUESKY_SETTINGS_TABLE       = var.bluesky_settings_table_name
      MASTODON_SETTINGS_TABLE      = var.mastodon_settings_table_name
      TIKTOK_SETTINGS_TABLE        = var.tiktok_settings_table_name
      SNAPCHAT_SETTINGS_TABLE      = var.snapchat_settings_table_name
      THREADS_SETTINGS_TABLE       = var.threads_settings_table_name
      # Lambda function names for each platform
      LAMBDA_XTWITTER              = aws_lambda_function.crosspost_xtwitter.function_name
      LAMBDA_YOUTUBE               = aws_lambda_function.crosspost_youtube.function_name
      LAMBDA_DISCORD               = aws_lambda_function.crosspost_discord.function_name
      LAMBDA_SLACK                 = aws_lambda_function.crosspost_slack.function_name
      LAMBDA_FACEBOOK              = aws_lambda_function.crosspost_facebook.function_name
      LAMBDA_INSTAGRAM             = aws_lambda_function.crosspost_instagram.function_name
      LAMBDA_LINKEDIN              = aws_lambda_function.crosspost_linkedin.function_name
      LAMBDA_TELEGRAM              = aws_lambda_function.crosspost_telegram.function_name
      LAMBDA_BLUESKY               = aws_lambda_function.crosspost_bluesky.function_name
      LAMBDA_MASTODON              = aws_lambda_function.crosspost_mastodon.function_name
      LAMBDA_TIKTOK                = aws_lambda_function.crosspost_tiktok.function_name
      LAMBDA_SNAPCHAT              = aws_lambda_function.crosspost_snapchat.function_name
      LAMBDA_THREADS               = aws_lambda_function.crosspost_threads.function_name
      # WhatsApp Lambda is in separate module - construct name
      LAMBDA_WHATSAPP              = "${var.platform_name}-crosspost-whatsapp-${var.environment}"
    }
  }
  tags = merge(var.tags, { BillingGroup = "crosspost" })
  depends_on = [aws_iam_role_policy.crosspost_policy, aws_lambda_function.crosspost_threads]
}

# ============================================================
# PLATFORM-SPECIFIC CROSSPOST LAMBDAS
# ============================================================

# X/Twitter Lambda
data "archive_file" "crosspost_xtwitter_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/tenant-crosspost-xtwitter"
  output_path = "${path.module}/../../tenant_crosspost_xtwitter.zip"
  excludes    = ["node_modules", "package-lock.json"]
}

resource "aws_lambda_function" "crosspost_xtwitter" {
  filename         = data.archive_file.crosspost_xtwitter_zip.output_path
  source_code_hash = data.archive_file.crosspost_xtwitter_zip.output_base64sha256
  function_name    = "${var.platform_name}-crosspost-xtwitter-${var.environment}"
  role             = aws_iam_role.crosspost_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 60
  memory_size      = 256
  layers           = [var.common_deps_layer_arn]
  environment {
    variables = {
      REGION                    = var.aws_region
      CLOUDFRONT_DOMAIN         = var.cloudfront_domain_name
      XTWITTER_SETTINGS_TABLE   = var.xtwitter_settings_table_name
      ENCRYPTION_KEY            = var.encryption_key
      ASSETS_BUCKET             = var.creator_assets_bucket_name
      TENANTS_TABLE             = var.tenants_table_name
      TWITTER_CONSUMER_KEY      = var.twitter_consumer_key
      TWITTER_CONSUMER_SECRET   = var.twitter_consumer_secret
      TWITTER_CLIENT_ID         = var.twitter_client_id
      TWITTER_CLIENT_SECRET     = var.twitter_client_secret
    }
  }
  tags = merge(var.tags, { BillingGroup = "crosspost" })
  depends_on = [aws_iam_role_policy.crosspost_policy]
}

# YouTube Lambda
data "archive_file" "crosspost_youtube_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/tenant-crosspost-youtube"
  output_path = "${path.module}/../../tenant_crosspost_youtube.zip"
  excludes    = ["node_modules", "package-lock.json"]
}

resource "aws_lambda_function" "crosspost_youtube" {
  filename         = data.archive_file.crosspost_youtube_zip.output_path
  source_code_hash = data.archive_file.crosspost_youtube_zip.output_base64sha256
  function_name    = "${var.platform_name}-crosspost-youtube-${var.environment}"
  role             = aws_iam_role.crosspost_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 120
  memory_size      = 512
  layers           = [var.common_deps_layer_arn]
  environment {
    variables = {
      REGION                 = var.aws_region
      CLOUDFRONT_DOMAIN      = var.cloudfront_domain_name
      YOUTUBE_SETTINGS_TABLE = var.youtube_settings_table_name
      ENCRYPTION_KEY         = var.encryption_key
      ASSETS_BUCKET          = var.creator_assets_bucket_name
    }
  }
  tags = merge(var.tags, { BillingGroup = "crosspost" })
  depends_on = [aws_iam_role_policy.crosspost_policy]
}

# Discord Lambda
data "archive_file" "crosspost_discord_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/tenant-crosspost-discord"
  output_path = "${path.module}/../../tenant_crosspost_discord.zip"
  excludes    = ["node_modules", "package-lock.json"]
}

resource "aws_lambda_function" "crosspost_discord" {
  filename         = data.archive_file.crosspost_discord_zip.output_path
  source_code_hash = data.archive_file.crosspost_discord_zip.output_base64sha256
  function_name    = "${var.platform_name}-crosspost-discord-${var.environment}"
  role             = aws_iam_role.crosspost_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 30
  memory_size      = 256
  layers           = [var.common_deps_layer_arn]
  environment {
    variables = {
      REGION                 = var.aws_region
      CLOUDFRONT_DOMAIN      = var.cloudfront_domain_name
      DISCORD_SETTINGS_TABLE = var.discord_settings_table_name
    }
  }
  tags = merge(var.tags, { BillingGroup = "crosspost" })
  depends_on = [aws_iam_role_policy.crosspost_policy]
}

# Slack Lambda
data "archive_file" "crosspost_slack_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/tenant-crosspost-slack"
  output_path = "${path.module}/../../tenant_crosspost_slack.zip"
  excludes    = ["node_modules", "package-lock.json"]
}

resource "aws_lambda_function" "crosspost_slack" {
  filename         = data.archive_file.crosspost_slack_zip.output_path
  source_code_hash = data.archive_file.crosspost_slack_zip.output_base64sha256
  function_name    = "${var.platform_name}-crosspost-slack-${var.environment}"
  role             = aws_iam_role.crosspost_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 30
  memory_size      = 256
  layers           = [var.common_deps_layer_arn]
  environment {
    variables = {
      REGION               = var.aws_region
      CLOUDFRONT_DOMAIN    = var.cloudfront_domain_name
      SLACK_SETTINGS_TABLE = var.slack_settings_table_name
    }
  }
  tags = merge(var.tags, { BillingGroup = "crosspost" })
  depends_on = [aws_iam_role_policy.crosspost_policy]
}

# Facebook Lambda
data "archive_file" "crosspost_facebook_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/tenant-crosspost-facebook"
  output_path = "${path.module}/../../tenant_crosspost_facebook.zip"
  excludes    = ["node_modules", "package-lock.json"]
}

resource "aws_lambda_function" "crosspost_facebook" {
  filename         = data.archive_file.crosspost_facebook_zip.output_path
  source_code_hash = data.archive_file.crosspost_facebook_zip.output_base64sha256
  function_name    = "${var.platform_name}-crosspost-facebook-${var.environment}"
  role             = aws_iam_role.crosspost_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 60
  memory_size      = 256
  layers           = [var.common_deps_layer_arn]
  environment {
    variables = {
      REGION                  = var.aws_region
      CLOUDFRONT_DOMAIN       = var.cloudfront_domain_name
      FACEBOOK_SETTINGS_TABLE = var.facebook_settings_table_name
      ENCRYPTION_KEY          = var.encryption_key
    }
  }
  tags = merge(var.tags, { BillingGroup = "crosspost" })
  depends_on = [aws_iam_role_policy.crosspost_policy]
}

# Instagram Lambda
data "archive_file" "crosspost_instagram_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/tenant-crosspost-instagram"
  output_path = "${path.module}/../../tenant_crosspost_instagram.zip"
  excludes    = ["node_modules", "package-lock.json"]
}

resource "aws_lambda_function" "crosspost_instagram" {
  filename         = data.archive_file.crosspost_instagram_zip.output_path
  source_code_hash = data.archive_file.crosspost_instagram_zip.output_base64sha256
  function_name    = "${var.platform_name}-crosspost-instagram-${var.environment}"
  role             = aws_iam_role.crosspost_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 90
  memory_size      = 256
  layers           = [var.common_deps_layer_arn]
  environment {
    variables = {
      REGION                   = var.aws_region
      CLOUDFRONT_DOMAIN        = var.cloudfront_domain_name
      INSTAGRAM_SETTINGS_TABLE = var.instagram_settings_table_name
      ENCRYPTION_KEY           = var.encryption_key
    }
  }
  tags = merge(var.tags, { BillingGroup = "crosspost" })
  depends_on = [aws_iam_role_policy.crosspost_policy]
}

# LinkedIn Lambda
data "archive_file" "crosspost_linkedin_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/tenant-crosspost-linkedin"
  output_path = "${path.module}/../../tenant_crosspost_linkedin.zip"
  excludes    = ["node_modules", "package-lock.json"]
}

resource "aws_lambda_function" "crosspost_linkedin" {
  filename         = data.archive_file.crosspost_linkedin_zip.output_path
  source_code_hash = data.archive_file.crosspost_linkedin_zip.output_base64sha256
  function_name    = "${var.platform_name}-crosspost-linkedin-${var.environment}"
  role             = aws_iam_role.crosspost_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 60
  memory_size      = 256
  layers           = [var.common_deps_layer_arn]
  environment {
    variables = {
      REGION                  = var.aws_region
      CLOUDFRONT_DOMAIN       = var.cloudfront_domain_name
      LINKEDIN_SETTINGS_TABLE = var.linkedin_settings_table_name
      ENCRYPTION_KEY          = var.encryption_key
    }
  }
  tags = merge(var.tags, { BillingGroup = "crosspost" })
  depends_on = [aws_iam_role_policy.crosspost_policy]
}

# Telegram Lambda
data "archive_file" "crosspost_telegram_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/tenant-crosspost-telegram"
  output_path = "${path.module}/../../tenant_crosspost_telegram.zip"
  excludes    = ["node_modules", "package-lock.json"]
}

resource "aws_lambda_function" "crosspost_telegram" {
  filename         = data.archive_file.crosspost_telegram_zip.output_path
  source_code_hash = data.archive_file.crosspost_telegram_zip.output_base64sha256
  function_name    = "${var.platform_name}-crosspost-telegram-${var.environment}"
  role             = aws_iam_role.crosspost_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 30
  memory_size      = 256
  layers           = [var.common_deps_layer_arn]
  environment {
    variables = {
      REGION                  = var.aws_region
      CLOUDFRONT_DOMAIN       = var.cloudfront_domain_name
      TELEGRAM_SETTINGS_TABLE = var.telegram_settings_table_name
    }
  }
  tags = merge(var.tags, { BillingGroup = "crosspost" })
  depends_on = [aws_iam_role_policy.crosspost_policy]
}

# Bluesky Lambda
data "archive_file" "crosspost_bluesky_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/tenant-crosspost-bluesky"
  output_path = "${path.module}/../../tenant_crosspost_bluesky.zip"
  excludes    = ["node_modules", "package-lock.json"]
}

resource "aws_lambda_function" "crosspost_bluesky" {
  filename         = data.archive_file.crosspost_bluesky_zip.output_path
  source_code_hash = data.archive_file.crosspost_bluesky_zip.output_base64sha256
  function_name    = "${var.platform_name}-crosspost-bluesky-${var.environment}"
  role             = aws_iam_role.crosspost_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 30
  memory_size      = 256
  layers           = [var.common_deps_layer_arn]
  environment {
    variables = {
      REGION                 = var.aws_region
      CLOUDFRONT_DOMAIN      = var.cloudfront_domain_name
      BLUESKY_SETTINGS_TABLE = var.bluesky_settings_table_name
      ENCRYPTION_KEY         = var.encryption_key
    }
  }
  tags = merge(var.tags, { BillingGroup = "crosspost" })
  depends_on = [aws_iam_role_policy.crosspost_policy]
}

# Mastodon Lambda
data "archive_file" "crosspost_mastodon_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/tenant-crosspost-mastodon"
  output_path = "${path.module}/../../tenant_crosspost_mastodon.zip"
  excludes    = ["node_modules", "package-lock.json"]
}

resource "aws_lambda_function" "crosspost_mastodon" {
  filename         = data.archive_file.crosspost_mastodon_zip.output_path
  source_code_hash = data.archive_file.crosspost_mastodon_zip.output_base64sha256
  function_name    = "${var.platform_name}-crosspost-mastodon-${var.environment}"
  role             = aws_iam_role.crosspost_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 30
  memory_size      = 256
  layers           = [var.common_deps_layer_arn]
  environment {
    variables = {
      REGION                  = var.aws_region
      CLOUDFRONT_DOMAIN       = var.cloudfront_domain_name
      MASTODON_SETTINGS_TABLE = var.mastodon_settings_table_name
      ENCRYPTION_KEY          = var.encryption_key
    }
  }
  tags = merge(var.tags, { BillingGroup = "crosspost" })
  depends_on = [aws_iam_role_policy.crosspost_policy]
}

# TikTok Lambda
data "archive_file" "crosspost_tiktok_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/tenant-crosspost-tiktok"
  output_path = "${path.module}/../../tenant_crosspost_tiktok.zip"
  excludes    = ["node_modules", "package-lock.json"]
}

resource "aws_lambda_function" "crosspost_tiktok" {
  filename         = data.archive_file.crosspost_tiktok_zip.output_path
  source_code_hash = data.archive_file.crosspost_tiktok_zip.output_base64sha256
  function_name    = "${var.platform_name}-crosspost-tiktok-${var.environment}"
  role             = aws_iam_role.crosspost_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 120
  memory_size      = 512
  layers           = [var.common_deps_layer_arn]
  environment {
    variables = {
      REGION                = var.aws_region
      CLOUDFRONT_DOMAIN     = var.cloudfront_domain_name
      TIKTOK_SETTINGS_TABLE = var.tiktok_settings_table_name
      TIKTOK_CLIENT_KEY     = var.tiktok_client_key
      TIKTOK_CLIENT_SECRET  = var.tiktok_client_secret
      ENCRYPTION_KEY        = var.encryption_key
    }
  }
  tags = merge(var.tags, { BillingGroup = "crosspost" })
  depends_on = [aws_iam_role_policy.crosspost_policy]
}

# ============================================================
# SNAPCHAT CROSSPOST LAMBDA
# ============================================================

data "archive_file" "crosspost_snapchat_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/tenant-crosspost-snapchat"
  output_path = "${path.module}/../../tenant_crosspost_snapchat.zip"
  excludes    = ["node_modules", "package-lock.json"]
}

resource "aws_lambda_function" "crosspost_snapchat" {
  filename         = data.archive_file.crosspost_snapchat_zip.output_path
  source_code_hash = data.archive_file.crosspost_snapchat_zip.output_base64sha256
  function_name    = "${var.platform_name}-crosspost-snapchat-${var.environment}"
  role             = aws_iam_role.crosspost_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 120
  memory_size      = 512
  layers           = [var.common_deps_layer_arn]
  environment {
    variables = {
      REGION                   = var.aws_region
      CLOUDFRONT_DOMAIN        = var.cloudfront_domain_name
      CREATOR_ASSETS_BUCKET    = var.creator_assets_bucket_name
      SNAPCHAT_SETTINGS_TABLE  = var.snapchat_settings_table_name
      SNAPCHAT_CLIENT_ID       = var.snapchat_client_id
      SNAPCHAT_CLIENT_SECRET   = var.snapchat_client_secret
      ENCRYPTION_KEY           = var.encryption_key
    }
  }
  tags = merge(var.tags, { BillingGroup = "crosspost" })
  depends_on = [aws_iam_role_policy.crosspost_policy]
}

# ============================================================
# THREADS CROSSPOST LAMBDA
# ============================================================

data "archive_file" "crosspost_threads_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/tenant-crosspost-threads"
  output_path = "${path.module}/../../tenant_crosspost_threads.zip"
  excludes    = ["node_modules", "package-lock.json"]
}

resource "aws_lambda_function" "crosspost_threads" {
  filename         = data.archive_file.crosspost_threads_zip.output_path
  source_code_hash = data.archive_file.crosspost_threads_zip.output_base64sha256
  function_name    = "${var.platform_name}-crosspost-threads-${var.environment}"
  role             = aws_iam_role.crosspost_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 120
  memory_size      = 256
  layers           = [var.common_deps_layer_arn]
  environment {
    variables = {
      REGION                = var.aws_region
      CLOUDFRONT_DOMAIN     = var.cloudfront_domain_name
      CREATOR_ASSETS_BUCKET = var.creator_assets_bucket_name
      THREADS_SETTINGS_TABLE = var.threads_settings_table_name
    }
  }
  tags = merge(var.tags, { BillingGroup = "crosspost" })
  depends_on = [aws_iam_role_policy.crosspost_policy]
}
