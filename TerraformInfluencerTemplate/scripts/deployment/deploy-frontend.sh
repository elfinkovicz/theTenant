#!/bin/bash

# Deploy Frontend Script
# Baut und deployed das Frontend für einen Creator

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if creator name is provided
if [ -z "$1" ]; then
    log_error "Usage: $0 <creator-name>"
    log_info "Example: $0 kasper"
    exit 1
fi

CREATOR_NAME=$1
CLIENT_DIR="clients/${CREATOR_NAME}"
CUSTOMIZATION_DIR="frontend/customizations/${CREATOR_NAME}"
TEMPLATE_DIR="frontend/template"

# Check if customization exists
if [ ! -d "$CUSTOMIZATION_DIR" ]; then
    log_error "Customization directory not found: $CUSTOMIZATION_DIR"
    log_info "Please create it first with customization files"
    exit 1
fi

log_info "Starting frontend deployment for creator: $CREATOR_NAME"

# Step 1: Install dependencies
log_info "Step 1/5: Installing dependencies..."
cd "$TEMPLATE_DIR"
npm install

# Step 2: Build frontend
log_info "Step 2/5: Building frontend..."
npm run build -- --creator="$CREATOR_NAME"

# Step 3: Get S3 bucket name
log_info "Step 3/5: Getting S3 bucket name..."
cd ../..
BUCKET_NAME=$(terraform output -raw s3_bucket_name 2>/dev/null)

if [ -z "$BUCKET_NAME" ]; then
    log_error "Could not get S3 bucket name from Terraform outputs"
    log_info "Make sure infrastructure is deployed first"
    exit 1
fi

log_info "S3 Bucket: $BUCKET_NAME"

# Step 4: Upload to S3
log_info "Step 4/5: Uploading to S3..."
aws s3 sync "${TEMPLATE_DIR}/dist/${CREATOR_NAME}/" "s3://${BUCKET_NAME}/" \
    --delete \
    --cache-control "public, max-age=31536000" \
    --exclude "*.html" \
    --exclude "*.json"

# Upload HTML files with shorter cache
aws s3 sync "${TEMPLATE_DIR}/dist/${CREATOR_NAME}/" "s3://${BUCKET_NAME}/" \
    --cache-control "public, max-age=300" \
    --exclude "*" \
    --include "*.html" \
    --include "*.json"

# Step 5: Invalidate CloudFront cache
log_info "Step 5/5: Invalidating CloudFront cache..."
DIST_ID=$(terraform output -raw cloudfront_distribution_id 2>/dev/null)

if [ -n "$DIST_ID" ]; then
    aws cloudfront create-invalidation \
        --distribution-id "$DIST_ID" \
        --paths "/*" \
        --output text
    log_info "CloudFront invalidation created"
else
    log_warn "Could not get CloudFront distribution ID, skipping invalidation"
fi

# Log deployment
echo "# Frontend Deployment $(date)" >> "${CLIENT_DIR}/deployment-history.log"
echo "Status: Success" >> "${CLIENT_DIR}/deployment-history.log"
echo "S3 Bucket: $BUCKET_NAME" >> "${CLIENT_DIR}/deployment-history.log"
echo "---" >> "${CLIENT_DIR}/deployment-history.log"

log_info "Frontend deployment completed successfully!"
log_info ""
log_info "Website URL: https://$(terraform output -raw website_url 2>/dev/null || echo 'your-domain.com')"
log_info "CloudFront may take 5-10 minutes to propagate changes"
