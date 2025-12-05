#!/bin/bash

# Deploy Infrastructure Script
# Deployed Terraform Infrastructure für einen Creator

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
TFVARS_FILE="${CLIENT_DIR}/terraform.tfvars"
BACKEND_FILE="${CLIENT_DIR}/backend.tf"

# Check if client directory exists
if [ ! -d "$CLIENT_DIR" ]; then
    log_error "Client directory not found: $CLIENT_DIR"
    log_info "Please create it first with: mkdir -p $CLIENT_DIR"
    exit 1
fi

# Check if tfvars file exists
if [ ! -f "$TFVARS_FILE" ]; then
    log_error "Terraform variables file not found: $TFVARS_FILE"
    log_info "Please create it from the example: cp config/project.tfvars.example $TFVARS_FILE"
    exit 1
fi

log_info "Starting deployment for creator: $CREATOR_NAME"

# Step 1: Terraform Init
log_info "Step 1/5: Initializing Terraform..."
if [ -f "$BACKEND_FILE" ]; then
    terraform init -backend-config="$BACKEND_FILE" -var-file="$TFVARS_FILE"
else
    log_warn "Backend file not found, using default backend"
    terraform init -var-file="$TFVARS_FILE"
fi

# Step 2: Terraform Validate
log_info "Step 2/5: Validating Terraform configuration..."
terraform validate

# Step 3: Terraform Plan
log_info "Step 3/5: Creating Terraform plan..."
terraform plan -var-file="$TFVARS_FILE" -out=tfplan

# Step 4: Ask for confirmation
log_warn "Review the plan above. Do you want to apply? (yes/no)"
read -r CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    log_info "Deployment cancelled"
    rm -f tfplan
    exit 0
fi

# Step 5: Terraform Apply
log_info "Step 4/5: Applying Terraform plan..."
terraform apply tfplan

# Clean up plan file
rm -f tfplan

# Step 6: Save outputs
log_info "Step 5/5: Saving outputs..."
terraform output -json > "${CLIENT_DIR}/outputs.json"
terraform output -raw ivs_stream_key > "${CLIENT_DIR}/stream-key.txt" 2>/dev/null || true
chmod 600 "${CLIENT_DIR}/stream-key.txt" 2>/dev/null || true

# Log deployment
echo "# Deployment $(date)" >> "${CLIENT_DIR}/deployment-history.log"
echo "Status: Success" >> "${CLIENT_DIR}/deployment-history.log"
echo "Terraform Version: $(terraform version | head -n1)" >> "${CLIENT_DIR}/deployment-history.log"
echo "---" >> "${CLIENT_DIR}/deployment-history.log"

log_info "Deployment completed successfully!"
log_info "Outputs saved to: ${CLIENT_DIR}/outputs.json"
log_info ""
log_info "Next steps:"
log_info "1. Deploy frontend: ./scripts/deployment/deploy-frontend.sh $CREATOR_NAME"
log_info "2. Configure DNS nameservers (if needed)"
log_info "3. Test website: https://$(terraform output -raw website_url 2>/dev/null || echo 'your-domain.com')"
