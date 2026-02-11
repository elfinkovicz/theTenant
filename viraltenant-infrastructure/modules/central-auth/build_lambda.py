#!/usr/bin/env python3
"""
Build script for Lambda function
Creates a deployment package for the auth handler
"""

import os
import zipfile
import shutil
from pathlib import Path

def build_lambda():
    """Build Lambda deployment package"""
    print("🔨 Building Lambda deployment package...")
    
    # Paths
    lambda_dir = Path(__file__).parent / "lambda"
    build_dir = Path(__file__).parent / "build"
    zip_path = Path(__file__).parent / "auth_handler.zip"
    
    # Clean build directory
    if build_dir.exists():
        shutil.rmtree(build_dir)
    build_dir.mkdir()
    
    # Copy Lambda code
    shutil.copy2(lambda_dir / "index.js", build_dir / "index.js")
    
    # Create package.json for dependencies
    package_json = {
        "name": "auth-handler",
        "version": "1.0.0",
        "dependencies": {
            "aws-sdk": "^2.1000.0"
        }
    }
    
    import json
    with open(build_dir / "package.json", "w") as f:
        json.dump(package_json, f, indent=2)
    
    # Install dependencies (aws-sdk is already available in Lambda runtime)
    print("📦 Installing dependencies...")
    os.system(f"cd {build_dir} && npm install --production")
    
    # Create ZIP file
    print("📦 Creating deployment package...")
    if zip_path.exists():
        zip_path.unlink()
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(build_dir):
            for file in files:
                file_path = Path(root) / file
                arc_path = file_path.relative_to(build_dir)
                zipf.write(file_path, arc_path)
    
    # Clean up build directory
    shutil.rmtree(build_dir)
    
    print(f"✅ Lambda package created: {zip_path}")
    print(f"📦 Package size: {zip_path.stat().st_size / 1024:.1f} KB")

if __name__ == "__main__":
    build_lambda()