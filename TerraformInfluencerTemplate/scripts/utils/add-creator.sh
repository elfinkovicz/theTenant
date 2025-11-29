#!/bin/bash

# Add Creator Script
# Erstellt alle notwendigen Dateien für einen neuen Creator

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if creator name is provided
if [ -z "$1" ]; then
    log_error "Usage: $0 <creator-slug> <creator-name> <domain>"
    log_info "Example: $0 kasper 'Kasper Kast' kasper.live"
    exit 1
fi

CREATOR_SLUG=$1
CREATOR_NAME=${2:-$CREATOR_SLUG}
CREATOR_DOMAIN=${3:-"${CREATOR_SLUG}.com"}

log_info "Adding new creator:"
log_info "  Slug: $CREATOR_SLUG"
log_info "  Name: $CREATOR_NAME"
log_info "  Domain: $CREATOR_DOMAIN"
echo ""

# Step 1: Create client directory
log_step "1/6: Creating client directory..."
CLIENT_DIR="clients/${CREATOR_SLUG}"
mkdir -p "$CLIENT_DIR"
mkdir -p "${CLIENT_DIR}/backups"
log_info "Created: $CLIENT_DIR"

# Step 2: Create terraform.tfvars
log_step "2/6: Creating terraform.tfvars..."
cat > "${CLIENT_DIR}/terraform.tfvars" << EOF
# Terraform Variables for ${CREATOR_NAME}
# Generated: $(date)

# Project Configuration
project_name = "${CREATOR_SLUG}"
environment  = "production"
aws_region   = "eu-central-1"

# Domain Configuration
domain_name    = "${CREATOR_DOMAIN}"
website_domain = "${CREATOR_DOMAIN}"

# Route53
create_route53_zone = true
route53_zone_id     = ""  # Leave empty if create_route53_zone = true

# Contact Form
contact_email_recipient = "contact@${CREATOR_DOMAIN}"
contact_email_sender    = "noreply@${CREATOR_DOMAIN}"

# Features
enable_ivs_streaming   = true
enable_ivs_chat        = true
enable_user_auth       = true
enable_sponsor_system  = true
enable_shop            = true

# IVS Configuration
ivs_channel_name = "main-channel"
ivs_channel_type = "STANDARD"  # or "BASIC" for cheaper streaming

# Cognito Configuration
cognito_callback_urls = [
  "https://${CREATOR_DOMAIN}/callback",
  "https://www.${CREATOR_DOMAIN}/callback"
]
cognito_logout_urls = [
  "https://${CREATOR_DOMAIN}/logout",
  "https://www.${CREATOR_DOMAIN}/logout"
]
allow_user_registration = true

# Stripe Configuration (optional)
stripe_secret_key      = ""  # Add your Stripe secret key
stripe_publishable_key = ""  # Add your Stripe publishable key

# Tags
tags = {
  Creator     = "${CREATOR_NAME}"
  Environment = "production"
  CostCenter  = "${CREATOR_SLUG}"
}
EOF
log_info "Created: ${CLIENT_DIR}/terraform.tfvars"

# Step 3: Create backend.tf
log_step "3/6: Creating backend.tf..."
cat > "${CLIENT_DIR}/backend.tf" << EOF
# Terraform Backend Configuration for ${CREATOR_NAME}
# Generated: $(date)

terraform {
  backend "s3" {
    bucket         = "${CREATOR_SLUG}-terraform-state"
    key            = "terraform.tfstate"
    region         = "eu-central-1"
    encrypt        = true
    dynamodb_table = "${CREATOR_SLUG}-terraform-locks"
  }
}
EOF
log_info "Created: ${CLIENT_DIR}/backend.tf"

# Step 4: Create notes.md
log_step "4/6: Creating notes.md..."
cat > "${CLIENT_DIR}/notes.md" << EOF
# ${CREATOR_NAME} - Notes

## Creator Information
- **Name**: ${CREATOR_NAME}
- **Slug**: ${CREATOR_SLUG}
- **Domain**: ${CREATOR_DOMAIN}
- **Created**: $(date)

## AWS Account
- **Account ID**: TBD
- **Region**: eu-central-1
- **Profile**: ${CREATOR_SLUG}

## Contacts
- **Primary Contact**: TBD
- **Email**: contact@${CREATOR_DOMAIN}
- **Phone**: TBD

## Deployment History
- **Initial Setup**: $(date)
- **Status**: Pending

## Notes
- Add any important notes here
- Document any custom configurations
- Track issues and resolutions

## TODO
- [ ] Create AWS Account
- [ ] Configure AWS CLI profile
- [ ] Verify SES email
- [ ] Create Terraform backend (S3 + DynamoDB)
- [ ] Deploy infrastructure
- [ ] Create frontend customization
- [ ] Deploy frontend
- [ ] Configure DNS
- [ ] Test website
- [ ] Go live!
EOF
log_info "Created: ${CLIENT_DIR}/notes.md"

# Step 5: Create frontend customization
log_step "5/6: Creating frontend customization..."
CUSTOMIZATION_DIR="frontend/customizations/${CREATOR_SLUG}"
mkdir -p "${CUSTOMIZATION_DIR}/assets"

cat > "${CUSTOMIZATION_DIR}/config.json" << EOF
{
  "creator": {
    "name": "${CREATOR_NAME}",
    "slug": "${CREATOR_SLUG}",
    "domain": "${CREATOR_DOMAIN}"
  },
  "aws": {
    "region": "eu-central-1",
    "cognito": {
      "userPoolId": "TBD",
      "clientId": "TBD",
      "authDomain": "TBD"
    },
    "appsync": {
      "endpoint": "TBD"
    },
    "api": {
      "sponsorEndpoint": "TBD",
      "shopEndpoint": "TBD"
    }
  },
  "branding": {
    "colors": {
      "primary": "#FFC400",
      "secondary": "#FFB700",
      "accent": "#FF8A00"
    },
    "logo": "/assets/logo.png",
    "favicon": "/assets/favicon.ico"
  },
  "social": {
    "youtube": "https://youtube.com/@${CREATOR_SLUG}",
    "twitch": "https://twitch.tv/${CREATOR_SLUG}",
    "twitter": "https://twitter.com/${CREATOR_SLUG}",
    "telegram": "https://t.me/${CREATOR_SLUG}"
  },
  "features": {
    "chat": true,
    "sponsor": true,
    "shop": true,
    "events": true
  }
}
EOF
log_info "Created: ${CUSTOMIZATION_DIR}/config.json"

cat > "${CUSTOMIZATION_DIR}/branding.css" << EOF
/* Custom Branding for ${CREATOR_NAME} */

:root {
  --primary-color: #FFC400;
  --secondary-color: #FFB700;
  --accent-color: #FF8A00;
}

/* Add custom styles here */
EOF
log_info "Created: ${CUSTOMIZATION_DIR}/branding.css"

# Step 6: Create deployment history log
log_step "6/6: Creating deployment history log..."
cat > "${CLIENT_DIR}/deployment-history.log" << EOF
# Deployment History for ${CREATOR_NAME}

## Creator Setup
- Date: $(date)
- Creator: ${CREATOR_NAME}
- Slug: ${CREATOR_SLUG}
- Domain: ${CREATOR_DOMAIN}
- Status: Pending Initial Deployment

---
EOF
log_info "Created: ${CLIENT_DIR}/deployment-history.log"

# Summary
echo ""
log_info "✅ Creator setup completed successfully!"
echo ""
log_info "Next steps:"
log_info "1. Create AWS Account for ${CREATOR_NAME}"
log_info "2. Configure AWS CLI profile: aws configure --profile ${CREATOR_SLUG}"
log_info "3. Edit configuration: ${CLIENT_DIR}/terraform.tfvars"
log_info "4. Create Terraform backend:"
log_info "   aws s3 mb s3://${CREATOR_SLUG}-terraform-state --profile ${CREATOR_SLUG}"
log_info "   aws dynamodb create-table --table-name ${CREATOR_SLUG}-terraform-locks --profile ${CREATOR_SLUG} \\"
log_info "     --attribute-definitions AttributeName=LockID,AttributeType=S \\"
log_info "     --key-schema AttributeName=LockID,KeyType=HASH \\"
log_info "     --billing-mode PAY_PER_REQUEST"
log_info "5. Deploy infrastructure: ./scripts/deployment/deploy-infrastructure.sh ${CREATOR_SLUG}"
log_info "6. Add creator assets (logo, favicon) to: ${CUSTOMIZATION_DIR}/assets/"
log_info "7. Deploy frontend: ./scripts/deployment/deploy-frontend.sh ${CREATOR_SLUG}"
echo ""
log_info "Documentation: docs/SETUP-GUIDE.md"
