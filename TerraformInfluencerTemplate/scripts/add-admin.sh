#!/bin/bash
# Script to add users to the admin group

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if email is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Email address required${NC}"
    echo "Usage: ./add-admin.sh <email> [profile] [region]"
    exit 1
fi

EMAIL=$1
PROFILE=${2:-honigwabe}
REGION=${3:-eu-central-1}

echo -e "${YELLOW}Adding admin user...${NC}"
echo "Email: $EMAIL"
echo "Profile: $PROFILE"
echo "Region: $REGION"
echo ""

# Get User Pool ID
echo -e "${YELLOW}Getting User Pool ID...${NC}"
USER_POOL_ID=$(aws cognito-idp list-user-pools --max-results 10 --region $REGION --profile $PROFILE --query "UserPools[?Name=='honigwabe-user-pool'].Id" --output text)

if [ -z "$USER_POOL_ID" ]; then
    echo -e "${RED}Error: User Pool not found${NC}"
    exit 1
fi

echo "User Pool ID: $USER_POOL_ID"
echo ""

# Check if user exists
echo -e "${YELLOW}Checking if user exists...${NC}"
if ! aws cognito-idp admin-get-user --user-pool-id $USER_POOL_ID --username "$EMAIL" --region $REGION --profile $PROFILE &> /dev/null; then
    echo -e "${RED}Error: User $EMAIL does not exist${NC}"
    echo "User must register first on the website"
    exit 1
fi

echo -e "${GREEN}✓ User exists${NC}"
echo ""

# Add to admin group
echo -e "${YELLOW}Adding user to admin group...${NC}"
aws cognito-idp admin-add-user-to-group \
    --user-pool-id $USER_POOL_ID \
    --username "$EMAIL" \
    --group-name admins \
    --region $REGION \
    --profile $PROFILE

echo ""
echo -e "${GREEN}✓ Successfully added $EMAIL to admin group!${NC}"
echo ""
echo "The user now has admin privileges and can:"
echo "  - Upload videos"
echo "  - Edit videos"
echo "  - Delete videos"
echo "  - Manage video metadata"
