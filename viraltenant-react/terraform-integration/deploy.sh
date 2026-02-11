#!/bin/bash

# Creator Platform Template - Deployment Script
# Integrated with TerraformInfluencerTemplate

set -e

echo "� Crneator Platform Deployment"
echo "=============================="

# Variablen
CREATOR_NAME=${1:-"default"}
TERRAFORM_DIR="../TerraformInfluencerTemplate"
BUILD_DIR="./dist"

echo "📦 Creator: $CREATOR_NAME"

# 1. Terraform Outputs holen
echo "🔧 Hole Terraform Outputs..."
cd $TERRAFORM_DIR
BUCKET_NAME=$(terraform output -raw s3_bucket_name)
CLOUDFRONT_ID=$(terraform output -raw cloudfront_distribution_id)
API_URL=$(terraform output -raw api_gateway_url)
USER_POOL_ID=$(terraform output -raw cognito_user_pool_id)
CLIENT_ID=$(terraform output -raw cognito_client_id)
cd -

# 2. Config generieren
echo "⚙️  Generiere Config..."
cat > src/config/aws-config.ts << EOF
export const awsConfig = {
  region: 'eu-central-1',
  cognito: {
    userPoolId: '$USER_POOL_ID',
    clientId: '$CLIENT_ID'
  },
  api: {
    baseUrl: '$API_URL'
  }
}
EOF

# 3. Build
echo "🏗️  Baue Anwendung..."
npm run build

# 4. Upload zu S3
echo "☁️  Uploade zu S3..."
aws s3 sync $BUILD_DIR s3://$BUCKET_NAME/ --delete

# 5. CloudFront Invalidierung
echo "🔄 Invalidiere CloudFront Cache..."
aws cloudfront create-invalidation \
  --distribution-id $CLOUDFRONT_ID \
  --paths "/*"

echo "✅ Deployment erfolgreich!"
echo "🌐 URL: https://$BUCKET_NAME"
