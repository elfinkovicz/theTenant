#!/bin/bash
# Bash Build script for Billing System Lambda functions
# Dependencies werden via Terraform Lambda Layers verwaltet

echo -e "\033[0;36mBuilding Billing System Lambda functions...\033[0m"
echo ""
echo -e "\033[1;33mDependencies werden via Lambda Layers verwaltet - nur Code wird gepackt!\033[0m"
echo ""

build_lambda() {
    local name=$1
    local dir="lambda/$name"
    
    echo -e "\033[0;34mBuilding $name...\033[0m"
    
    cd "$dir"
    
    # Nur index.js packen (keine Dependencies!)
    zip -q "../$name.zip" index.js
    
    cd - > /dev/null
    
    echo -e "\033[0;32mBuilt $name successfully (Code only, ~5 KB)\033[0m"
}

# Build all Lambda functions
build_lambda "cost-calculator"
build_lambda "payment-setup"
build_lambda "webhook-handler"

echo ""
echo -e "\033[0;32mAll Lambda functions built successfully!\033[0m"
echo ""
echo -e "\033[0;36mLambda Layers (Stripe, AWS SDK) werden automatisch von Terraform deployed\033[0m"
echo ""
echo "Next steps:"
echo "1. Run: terraform init"
echo "2. Run: terraform plan -var-file=project.tfvars"
echo "3. Run: terraform apply -var-file=project.tfvars"
