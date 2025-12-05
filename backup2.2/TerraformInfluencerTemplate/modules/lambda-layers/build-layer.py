#!/usr/bin/env python3
"""
Cross-platform script to prepare Lambda Layer structure
"""
import os
import sys
import shutil
from pathlib import Path

def main():
    if len(sys.argv) != 2:
        print("Usage: python build-layer.py <layer-name>")
        sys.exit(1)
    
    layer_name = sys.argv[1]
    script_dir = Path(__file__).parent
    layer_dir = script_dir / "layers" / layer_name
    
    if not layer_dir.exists():
        print(f"Error: Layer directory not found: {layer_dir}")
        sys.exit(1)
    
    # Create nodejs directory
    nodejs_dir = layer_dir / "nodejs"
    nodejs_dir.mkdir(exist_ok=True)
    
    # Copy node_modules to nodejs/
    node_modules_src = layer_dir / "node_modules"
    node_modules_dst = nodejs_dir / "node_modules"
    
    if node_modules_src.exists():
        # Remove existing destination
        if node_modules_dst.exists():
            shutil.rmtree(node_modules_dst)
        
        # Copy node_modules
        shutil.copytree(node_modules_src, node_modules_dst)
        print(f"OK: Copied node_modules to {nodejs_dir}")
    else:
        print(f"Warning: node_modules not found in {layer_dir}")
        sys.exit(1)

if __name__ == "__main__":
    main()
