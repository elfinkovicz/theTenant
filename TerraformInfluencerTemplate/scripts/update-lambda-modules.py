#!/usr/bin/env python3
"""
Update Lambda modules to use Lambda Layers
"""

import os
import re

# Module configuration: module_name -> list of required layers
MODULES = {
    "ad-management": ["aws_sdk_core"],
    "channel-management": ["aws_sdk_core"],
    "contact-info-management": ["aws_sdk_core"],
    "event-management": ["aws_sdk_core"],
    "ivs-chat": ["aws_sdk_extended"],
    "legal-management": ["aws_sdk_core"],
    "newsfeed-management": ["aws_sdk_core"],
    "product-management": ["aws_sdk_core"],
    "team-management": ["aws_sdk_core"],
    "telegram-integration": ["aws_sdk_core"],
    "video-management": ["aws_sdk_core", "utilities"],
    "shop": ["aws_sdk_core", "aws_sdk_extended", "utilities"],
}

MODULES_PATH = "TerraformInfluencerTemplate/modules"

def update_main_tf(module_name, layers):
    """Update main.tf to use source_file and add layers"""
    main_tf_path = f"{MODULES_PATH}/{module_name}/main.tf"
    
    if not os.path.exists(main_tf_path):
        print(f"  ⚠ main.tf not found for {module_name}")
        return
    
    with open(main_tf_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace source_dir with source_file
    content = re.sub(
        r'source_dir\s*=\s*"\$\{path\.module\}/lambda"',
        'source_file = "${path.module}/lambda/index.js"',
        content
    )
    
    # Add layers if not present
    if 'layers =' not in content:
        layer_arns = '\n'.join([f'    var.{layer}_layer_arn,' for layer in layers])
        layers_block = f'\n  # Use Lambda Layers for dependencies\n  layers = [\n{layer_arns}\n  ]\n'
        
        # Insert after runtime line
        content = re.sub(
            r'(runtime\s*=\s*"[^"]+"\s*\n)',
            r'\1' + layers_block,
            content
        )
    
    with open(main_tf_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"  ✓ Updated main.tf")

def update_variables_tf(module_name, layers):
    """Add layer ARN variables to variables.tf"""
    vars_tf_path = f"{MODULES_PATH}/{module_name}/variables.tf"
    
    if not os.path.exists(vars_tf_path):
        print(f"  ⚠ variables.tf not found for {module_name}")
        return
    
    with open(vars_tf_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    layer_descriptions = {
        "aws_sdk_core": "ARN of the AWS SDK Core Lambda Layer (DynamoDB, S3)",
        "aws_sdk_extended": "ARN of the AWS SDK Extended Lambda Layer (SES, KMS, IVS)",
        "utilities": "ARN of the Utilities Lambda Layer (uuid, etc.)"
    }
    
    for layer in layers:
        var_name = f"{layer}_layer_arn"
        if var_name not in content:
            var_block = f'\n\nvariable "{var_name}" {{\n  description = "{layer_descriptions[layer]}"\n  type        = string\n}}'
            content += var_block
    
    with open(vars_tf_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"  ✓ Updated variables.tf")

def main():
    print("=== Updating Lambda Modules for Lambda Layers ===\n")
    
    for module_name, layers in MODULES.items():
        print(f"Processing: {module_name}")
        update_main_tf(module_name, layers)
        update_variables_tf(module_name, layers)
        print()
    
    print("=== Migration Complete ===\n")
    print("Next steps:")
    print("1. Update TerraformInfluencerTemplate/main.tf to pass layer ARNs to modules")
    print("2. Run: terraform init")
    print("3. Run: terraform apply")

if __name__ == "__main__":
    main()
