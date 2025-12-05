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
            print(f"Removing existing {node_modules_dst}...")
            shutil.rmtree(node_modules_dst, ignore_errors=True)
        
        # Copy node_modules with error handling for long paths on Windows
        try:
            print(f"Copying node_modules to {nodejs_dir}...")
            shutil.copytree(node_modules_src, node_modules_dst, dirs_exist_ok=True, 
                          ignore_dangling_symlinks=True)
            print(f"OK: Copied node_modules to {nodejs_dir}")
        except Exception as e:
            print(f"Error copying node_modules: {e}")
            print("Trying alternative method with robocopy (Windows)...")
            
            # Try robocopy on Windows for long path support
            import platform
            if platform.system() == "Windows":
                import subprocess
                result = subprocess.run([
                    "robocopy", 
                    str(node_modules_src), 
                    str(node_modules_dst),
                    "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/nc", "/ns", "/np"
                ], capture_output=True)
                
                # Robocopy exit codes: 0-7 are success, 8+ are errors
                if result.returncode < 8:
                    print(f"OK: Copied node_modules using robocopy")
                else:
                    print(f"Error: robocopy failed with code {result.returncode}")
                    sys.exit(1)
            else:
                raise
    else:
        print(f"Warning: node_modules not found in {layer_dir}")
        sys.exit(1)

if __name__ == "__main__":
    main()
