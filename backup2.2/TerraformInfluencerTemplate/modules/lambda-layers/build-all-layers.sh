#!/bin/bash
# Bash script to build all Lambda Layers
# This prepares the layers before Terraform deployment

echo -e "\033[0;36mBuilding all Lambda Layers...\033[0m"
echo ""

layers=("aws-sdk-core" "aws-sdk-extended" "utilities")

for layer in "${layers[@]}"; do
    echo -e "\033[0;34mBuilding $layer layer...\033[0m"
    
    # Install dependencies
    cd "layers/$layer"
    npm install --production
    if [ $? -ne 0 ]; then
        echo -e "\033[0;31mFailed to install dependencies for $layer\033[0m"
        exit 1
    fi
    cd ../..
    
    # Prepare layer structure
    python3 build-layer.py "$layer"
    if [ $? -ne 0 ]; then
        echo -e "\033[0;31mFailed to prepare $layer layer\033[0m"
        exit 1
    fi
    
    echo -e "\033[0;32m✓ $layer layer built successfully\033[0m"
    echo ""
done

echo -e "\033[0;32mAll Lambda Layers built successfully!\033[0m"
echo ""
echo -e "\033[0;36mNext steps:\033[0m"
echo "1. cd ../.."
echo "2. terraform init"
echo "3. terraform apply -target=module.lambda_layers -var-file=project.tfvars"
