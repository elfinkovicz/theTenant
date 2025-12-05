#!/bin/bash
# Build Lambda ZIP files

echo "Building Lambda ZIP files..."

# Install dependencies
echo "Installing dependencies..."
npm install

# Create ZIP for each Lambda function
echo "Creating create-order-paypal.zip..."
zip -r create-order-paypal.zip create-order-paypal.js providers/ node_modules/ -x "*.zip"

echo "Creating verify-payment-paypal.zip..."
zip -r verify-payment-paypal.zip verify-payment-paypal.js providers/ node_modules/ -x "*.zip"

echo "Creating get-order.zip..."
zip -r get-order.zip get-order.js node_modules/ -x "*.zip"

echo "Creating shop-settings.zip..."
zip -r shop-settings.zip shop-settings.js node_modules/ -x "*.zip"

echo "Done! Lambda ZIP files created."
