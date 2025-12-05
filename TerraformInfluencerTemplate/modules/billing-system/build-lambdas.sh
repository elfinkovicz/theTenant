#!/bin/bash
# Build script for Billing System Lambda functions

set -e

echo "Building Billing System Lambda functions..."

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LAMBDA_DIR="$SCRIPT_DIR/lambda"

# Function to build a Lambda
build_lambda() {
    local name=$1
    local path=$2
    
    echo ""
    echo "Building $name..."
    
    # Check if index.js exists
    if [ ! -f "$path/index.js" ]; then
        echo "  Skipping $name - no index.js found"
        return
    fi
    
    cd "$path"
    
    # Check if we need Stripe
    if grep -q "require('stripe')" index.js; then
        echo "  Installing Stripe..."
        
        if [ ! -f "package.json" ]; then
            cat > package.json <<EOF
{
  "name": "$name",
  "version": "1.0.0",
  "dependencies": {
    "stripe": "^14.0.0"
  }
}
EOF
        fi
        
        npm install --production --silent
    fi
    
    # Create ZIP
    local zip_path="$LAMBDA_DIR/$name.zip"
    rm -f "$zip_path"
    
    echo "  Creating ZIP..."
    zip -r -q "$zip_path" .
    
    local zip_size=$(du -h "$zip_path" | cut -f1)
    echo "  ✓ $name built ($zip_size)"
    
    cd - > /dev/null
}

# Build all Lambda functions
build_lambda "cost-calculator" "$LAMBDA_DIR/cost-calculator"
build_lambda "payment-setup" "$LAMBDA_DIR/payment-setup"
build_lambda "webhook-handler" "$LAMBDA_DIR/webhook-handler"

echo ""
echo "✅ All Billing Lambda functions built successfully!"
