# Lambda Layers

This module creates Lambda Layers for shared dependencies across all Lambda functions.

## Benefits

- **Faster Deployments**: Lambda code changes don't require re-packaging dependencies
- **Smaller Packages**: Individual Lambda functions are much smaller
- **Consistency**: All Lambdas use the same dependency versions
- **Cost Savings**: Reduced storage and faster cold starts

## Layers

### 1. AWS SDK Core Layer
Contains the most commonly used AWS SDK packages:
- @aws-sdk/client-dynamodb
- @aws-sdk/lib-dynamodb
- @aws-sdk/client-s3
- @aws-sdk/s3-request-presigner

Used by: 13 Lambda functions

### 2. AWS SDK Extended Layer
Contains specialized AWS SDK packages:
- @aws-sdk/client-ses
- @aws-sdk/client-kms
- @aws-sdk/client-ivschat

Used by: 2 Lambda functions

### 3. Utilities Layer
Contains utility libraries:
- uuid

Used by: 2 Lambda functions

## Usage in Lambda Functions

When creating a Lambda function, attach the appropriate layers:

```hcl
resource "aws_lambda_function" "example" {
  # ... other configuration ...
  
  layers = [
    var.aws_sdk_core_layer_arn,
    var.utilities_layer_arn
  ]
}
```

## Updating Dependencies

To update dependencies:

1. Edit the appropriate `package.json` in `layers/*/package.json`
2. Run `terraform apply`
3. Terraform will detect the change and rebuild the layer

## Local Development

To install dependencies locally for testing:

```bash
cd layers/aws-sdk-core && npm install
cd layers/aws-sdk-extended && npm install
cd layers/utilities && npm install
```
