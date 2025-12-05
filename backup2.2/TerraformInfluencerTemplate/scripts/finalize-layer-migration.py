#!/usr/bin/env python3
"""
Finalize Lambda Layer migration by updating main.tf module calls
"""

import re

# Module to layers mapping
MODULE_LAYERS = {
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

def add_layers_to_module(content, module_name, layers):
    """Add layer ARNs to a module block"""
    
    # Pattern to find the module block
    pattern = rf'(module "{module_name}" \{{.*?)(depends_on\s*=\s*\[[^\]]*\])'
    
    def replacer(match):
        module_block = match.group(1)
        depends_on_line = match.group(2)
        
        # Skip if already has layers
        if '_layer_arn' in module_block:
            return match.group(0)
        
        # Build layer lines
        layer_lines = []
        for layer in layers:
            layer_lines.append(f'  {layer}_layer_arn = module.lambda_layers.{layer}_layer_arn')
        
        # Add module.lambda_layers to depends_on if not present
        if 'module.lambda_layers' not in depends_on_line:
            depends_on_line = depends_on_line.replace('depends_on = [', 'depends_on = [module.lambda_layers, ')
        
        # Combine
        result = module_block + '\n  # Lambda Layers\n' + '\n'.join(layer_lines) + '\n\n  ' + depends_on_line
        return result
    
    # Apply replacement
    new_content = re.sub(pattern, replacer, content, flags=re.DOTALL)
    return new_content

def main():
    main_tf_path = "TerraformInfluencerTemplate/main.tf"
    
    print("Reading main.tf...")
    with open(main_tf_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    print("\nUpdating module blocks...")
    for module_name, layers in MODULE_LAYERS.items():
        print(f"  - {module_name}: {', '.join(layers)}")
        content = add_layers_to_module(content, module_name, layers)
    
    print("\nWriting updated main.tf...")
    with open(main_tf_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("\n✓ Migration complete!")
    print("\nNext steps:")
    print("  1. terraform init")
    print("  2. terraform apply -target=module.lambda_layers -var-file=project.tfvars")
    print("  3. terraform apply -var-file=project.tfvars")

if __name__ == "__main__":
    main()
