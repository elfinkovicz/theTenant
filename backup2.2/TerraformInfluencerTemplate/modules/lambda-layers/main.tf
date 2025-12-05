# Lambda Layers for shared dependencies
# This reduces deployment size and speeds up Lambda updates

# Layer 1: AWS SDK Core (DynamoDB + S3)
# Used by most Lambda functions
resource "null_resource" "aws_sdk_core_layer" {
  triggers = {
    package_json = filemd5("${path.module}/layers/aws-sdk-core/package.json")
  }

  provisioner "local-exec" {
    command     = "npm install --production"
    working_dir = "${path.module}/layers/aws-sdk-core"
  }

  provisioner "local-exec" {
    command     = "python build-layer.py aws-sdk-core"
    working_dir = path.module
  }
}

data "archive_file" "aws_sdk_core_layer" {
  type        = "zip"
  source_dir  = "${path.module}/layers/aws-sdk-core/nodejs"
  output_path = "${path.module}/layers/aws-sdk-core-layer.zip"
  
  depends_on = [null_resource.aws_sdk_core_layer]
}

resource "aws_lambda_layer_version" "aws_sdk_core" {
  filename            = data.archive_file.aws_sdk_core_layer.output_path
  layer_name          = "${var.project_name}-aws-sdk-core"
  compatible_runtimes = ["nodejs18.x", "nodejs20.x"]
  source_code_hash    = data.archive_file.aws_sdk_core_layer.output_base64sha256

  description = "AWS SDK v3 - DynamoDB, S3, and S3 Presigner"
}

# Layer 2: AWS SDK Extended (SES, KMS, IVS Chat)
resource "null_resource" "aws_sdk_extended_layer" {
  triggers = {
    package_json = filemd5("${path.module}/layers/aws-sdk-extended/package.json")
  }

  provisioner "local-exec" {
    command     = "npm install --production"
    working_dir = "${path.module}/layers/aws-sdk-extended"
  }

  provisioner "local-exec" {
    command     = "python build-layer.py aws-sdk-extended"
    working_dir = path.module
  }
}

data "archive_file" "aws_sdk_extended_layer" {
  type        = "zip"
  source_dir  = "${path.module}/layers/aws-sdk-extended/nodejs"
  output_path = "${path.module}/layers/aws-sdk-extended-layer.zip"
  
  depends_on = [null_resource.aws_sdk_extended_layer]
}

resource "aws_lambda_layer_version" "aws_sdk_extended" {
  filename            = data.archive_file.aws_sdk_extended_layer.output_path
  layer_name          = "${var.project_name}-aws-sdk-extended"
  compatible_runtimes = ["nodejs18.x", "nodejs20.x"]
  source_code_hash    = data.archive_file.aws_sdk_extended_layer.output_base64sha256

  description = "AWS SDK v3 - SES, KMS, IVS Chat"
}

# Layer 3: Utilities (uuid, Stripe, etc.)
resource "null_resource" "utilities_layer" {
  triggers = {
    package_json = filemd5("${path.module}/layers/utilities/package.json")
  }

  provisioner "local-exec" {
    command     = "npm install --production"
    working_dir = "${path.module}/layers/utilities"
  }

  provisioner "local-exec" {
    command     = "python build-layer.py utilities"
    working_dir = path.module
  }
}

data "archive_file" "utilities_layer" {
  type        = "zip"
  source_dir  = "${path.module}/layers/utilities/nodejs"
  output_path = "${path.module}/layers/utilities-layer.zip"
  
  depends_on = [null_resource.utilities_layer]
}

resource "aws_lambda_layer_version" "utilities" {
  filename            = data.archive_file.utilities_layer.output_path
  layer_name          = "${var.project_name}-utilities"
  compatible_runtimes = ["nodejs18.x", "nodejs20.x"]
  source_code_hash    = data.archive_file.utilities_layer.output_base64sha256

  description = "Utility libraries - uuid, etc."
}
