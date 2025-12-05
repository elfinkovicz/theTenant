#!/usr/bin/env python3
"""
Update main.tf to pass Lambda Layer ARNs to all modules
"""

import re

MODULES = {
    "ad_management": ["aws_sdk_core"],
    "channel_management": ["aws_sdk_core"],
    "contact_info_management": ["aws_sdk_core"],
    "event_management": ["aws_sdk_core"],
    "ivs_chat": ["aws_sdk_extended"],
    "legal_management": ["aws_sdk_core"],
    "newsfeed_management": ["aws_sdk_core"],
    "product_management": ["aws_sdk_core"],
    "team_management": ["aws_sdk_core"],
    "telegram_integration": ["aws_sdk_core"],
    "video_management": ["aws_sdk_core", "utilities"],
    "shop": ["aws_sdk_core", "aws_sdk_extended", "utilities"],
}

def update_main_tf():
    """Update main.tf to add layer ARNs to module calls"""
    main_tf_path = "TerraformInfluencerTemplate/main.tf"
    
    with open(main_tf_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    for module_name, layers in MODULES.items():
        # Find the module block
        pattern = rf'(module "{module_name}" \{{[^}}]*?)(depends_on\s*=\s*\[[^\]]*?\])'
        
        def replace_func(match):
            module_block = match.group(1)
            depends_on = match.group(2)
            
            # Check if layers already added
            if '_layer_arn' in module_block:
                return match.group(0)
            
            # Build layer ARN lines
            layer_lines = '\n'.join([f'  {layer}_layer_arn = module.lambda_layers.{layer}_layer_arn' for layer in layers])
            
            # Add layers before depends_on
            new_block = f'{module_block}\n  # Lambda Layers\n{layer_lines}\n\n  {depends_on}'
            
            # Update depends_on to include lambda_layers
            if 'module.lambda_layers' not in new_block:
                new_block = new_block.replace('depends_on = [', 'depends_on = [module.lambda_layers, ')
            
            return new_block
        
        content = re.sub(pattern, replace_func, content, flags=re.DOTALL)
    
    with open(main_tf_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("✓ Updated main.tf with Lambda Layer ARNs")

if __name__ == "__main__":
    print("=== Updating main.tf ===\n")
    update_main_tf()
    print("\nDone! Review the changes and run:")
    print("  terraform init")
    print("  terraform apply")
