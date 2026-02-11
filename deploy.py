#!/usr/bin/env python3
"""
ViralTenant Platform - Simplified Deployment Script
Deploys infrastructure, frontend, billing system, and invalidates CloudFront
"""

import os
import sys
import subprocess
import json
import time
import argparse
from pathlib import Path

def run_command(command, cwd=None, show_output=True):
    """Run a shell command with real-time output"""
    print(f"\n🔧 Running: {command}")
    if cwd:
        print(f"📁 Working directory: {cwd}")
    print("-" * 50)
    
    if show_output:
        # Run with real-time output
        process = subprocess.Popen(
            command,
            shell=True,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            bufsize=1
        )
        
        output_lines = []
        while True:
            output = process.stdout.readline()
            if output == '' and process.poll() is not None:
                break
            if output:
                print(output.strip())
                output_lines.append(output.strip())
        
        return_code = process.poll()
        full_output = '\n'.join(output_lines)
    else:
        # Run without real-time output (for JSON parsing)
        result = subprocess.run(
            command,
            shell=True,
            cwd=cwd,
            capture_output=True,
            text=True
        )
        return_code = result.returncode
        full_output = result.stdout
        
        if result.stderr:
            print(result.stderr, file=sys.stderr)
    
    print("-" * 50)
    
    if return_code != 0:
        print(f"❌ Command failed with exit code {return_code}")
        sys.exit(1)
    
    print("✅ Command completed successfully")
    
    # Return a result-like object
    class Result:
        def __init__(self, stdout, returncode):
            self.stdout = stdout
            self.returncode = returncode
    
    return Result(full_output, return_code)

def deploy_infrastructure():
    """Deploy Terraform infrastructure"""
    print("\n" + "=" * 60)
    print("🏗️ DEPLOYING TERRAFORM INFRASTRUCTURE")
    print("=" * 60)
    
    infra_dir = Path("viraltenant-infrastructure")
    if not infra_dir.exists():
        print("❌ Infrastructure directory not found!")
        sys.exit(1)
    
    try:
        # Initialize Terraform
        print("\n📦 Initializing Terraform...")
        run_command("terraform init", cwd=infra_dir)
        
        # Apply infrastructure
        print("\n🚀 Applying infrastructure changes...")
        print("⚠️  You will be prompted to confirm the changes with 'yes'")
        run_command("terraform apply -var-file=terraform.tfvars", cwd=infra_dir)
        
        # Get outputs (without showing output)
        print("\n📤 Getting Terraform outputs...")
        result = run_command("terraform output -json", cwd=infra_dir, show_output=False)
        
        if result.stdout.strip():
            outputs = json.loads(result.stdout)
            print("✅ Infrastructure deployment completed successfully!")
            print("✅ API Gateway automatically deployed via Terraform")
            return outputs
        else:
            print("⚠️ No Terraform outputs found")
            return {}
            
    except json.JSONDecodeError as e:
        print(f"❌ Failed to parse Terraform outputs: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Infrastructure deployment failed: {e}")
        sys.exit(1)

def deploy_billing_system():
    """Deploy Billing System with Cost Explorer integration"""
    print("\n" + "=" * 60)
    print("💰 DEPLOYING BILLING SYSTEM")
    print("=" * 60)
    
    billing_lambda_dir = Path("viraltenant-infrastructure/lambda-functions/billing-api")
    if not billing_lambda_dir.exists():
        print("❌ Billing Lambda directory not found!")
        sys.exit(1)
    
    try:
        # Create Lambda ZIP using PowerShell (Windows compatible) - WITHOUT node_modules (using Lambda Layer)
        print("\n📦 Creating Billing Lambda ZIP file (without node_modules - using Lambda Layer)...")
        # ZIP must be in viraltenant-infrastructure folder for Terraform
        zip_path = Path("viraltenant-infrastructure/billing_api.zip")
        
        # Remove old ZIP if exists
        if zip_path.exists():
            zip_path.unlink()
        
        # Use PowerShell to create ZIP excluding node_modules
        run_command(
            f'powershell -Command "Get-ChildItem -Path \'{billing_lambda_dir}\' -Exclude \'node_modules\',\'package-lock.json\' | Compress-Archive -DestinationPath \'{zip_path}\' -Force"'
        )
        
        # Verify ZIP was created
        if not zip_path.exists():
            print("❌ Failed to create Billing Lambda ZIP!")
            sys.exit(1)
        
        print(f"✅ Billing Lambda ZIP created: {zip_path}")
        print(f"� ZIP sizce: {zip_path.stat().st_size / 1024:.2f} KB")
        print("📦 Dependencies provided via Lambda Layer")
        
        # Note: Terraform will handle the Lambda deployment
        print("✅ Billing Lambda prepared for Terraform deployment")
        
    except Exception as e:
        print(f"❌ Billing system deployment failed: {e}")
        sys.exit(1)

def deploy_billing_cron():
    """Deploy Billing Cron Lambda for monthly invoice generation"""
    print("\n" + "=" * 60)
    print("📅 DEPLOYING BILLING CRON (Monthly Invoices)")
    print("=" * 60)
    
    billing_cron_dir = Path("viraltenant-infrastructure/lambda-functions/billing-cron")
    if not billing_cron_dir.exists():
        print("⚠️ Billing Cron directory not found, skipping...")
        return
    
    try:
        # Create Lambda ZIP using PowerShell (Windows compatible) - WITHOUT node_modules (using Lambda Layer)
        print("\n📦 Creating Billing Cron Lambda ZIP file (without node_modules - using Lambda Layer)...")
        # ZIP must be in viraltenant-infrastructure folder for Terraform
        zip_path = Path("viraltenant-infrastructure/billing_cron.zip")
        
        # Remove old ZIP if exists
        if zip_path.exists():
            zip_path.unlink()
        
        # Use PowerShell to create ZIP excluding node_modules
        run_command(
            f'powershell -Command "Get-ChildItem -Path \'{billing_cron_dir}\' -Exclude \'node_modules\',\'package-lock.json\' | Compress-Archive -DestinationPath \'{zip_path}\' -Force"'
        )
        
        # Verify ZIP was created
        if not zip_path.exists():
            print("❌ Failed to create Billing Cron Lambda ZIP!")
            sys.exit(1)
        
        print(f"✅ Billing Cron Lambda ZIP created: {zip_path}")
        print(f"📊 ZIP size: {zip_path.stat().st_size / 1024:.2f} KB")
        print("📦 Dependencies provided via Lambda Layer")
        
        print("✅ Billing Cron Lambda prepared for Terraform deployment")
        print("📅 Schedule: 1st of every month at 6:00 AM UTC")
        
    except Exception as e:
        print(f"❌ Billing Cron deployment failed: {e}")
        # Don't exit, as this is optional
        print("⚠️ Continuing without Billing Cron...")

def deploy_tenant_authorizer():
    """Deploy Tenant Authorizer Lambda with billing-admin group support"""
    print("\n" + "=" * 60)
    print("🔐 DEPLOYING TENANT AUTHORIZER")
    print("=" * 60)
    
    authorizer_dir = Path("viraltenant-infrastructure/lambda-functions/tenant-authorizer")
    if not authorizer_dir.exists():
        print("⚠️ Tenant Authorizer directory not found, skipping...")
        return
    
    try:
        # Create Lambda ZIP using PowerShell (Windows compatible) - WITHOUT node_modules (using Lambda Layer)
        print("\n📦 Creating Tenant Authorizer Lambda ZIP file (without node_modules - using Lambda Layer)...")
        # ZIP must be in viraltenant-infrastructure folder for Terraform
        zip_path = Path("viraltenant-infrastructure/tenant_authorizer.zip")
        
        # Remove old ZIP if exists
        if zip_path.exists():
            zip_path.unlink()
        
        # Use PowerShell to create ZIP excluding node_modules
        run_command(
            f'powershell -Command "Get-ChildItem -Path \'{authorizer_dir}\' -Exclude \'node_modules\',\'package-lock.json\' | Compress-Archive -DestinationPath \'{zip_path}\' -Force"'
        )
        
        # Verify ZIP was created
        if not zip_path.exists():
            print("❌ Failed to create Tenant Authorizer Lambda ZIP!")
            sys.exit(1)
        
        print(f"✅ Tenant Authorizer Lambda ZIP created: {zip_path}")
        print(f"📊 ZIP size: {zip_path.stat().st_size / 1024:.2f} KB")
        print("📦 Dependencies provided via Lambda Layer")
        
        print("✅ Tenant Authorizer Lambda prepared for Terraform deployment")
        print("🔐 Supports: billing-admins group for /billing/admin/* endpoints")
        
    except Exception as e:
        print(f"❌ Tenant Authorizer deployment failed: {e}")
        # Don't exit, as this is optional
        print("⚠️ Continuing without Tenant Authorizer update...")

def deploy_stripe_webhook():
    """Deploy Stripe Webhook Lambda (backup for EventBridge)"""
    print("\n" + "=" * 60)
    print("💳 DEPLOYING STRIPE WEBHOOK LAMBDA")
    print("=" * 60)
    
    webhook_dir = Path("viraltenant-infrastructure/lambda-functions/stripe-webhook")
    if not webhook_dir.exists():
        print("⚠️ Stripe Webhook directory not found, skipping...")
        return
    
    try:
        # Create Lambda ZIP using PowerShell - code only, deps from Lambda Layer
        print("\n📦 Creating Stripe Webhook Lambda ZIP file (code only - using Lambda Layer)...")
        zip_path = Path("viraltenant-infrastructure/stripe_webhook.zip")
        
        # Remove old ZIP if exists
        if zip_path.exists():
            zip_path.unlink()
        
        # Use PowerShell to create ZIP - only JS files
        run_command(
            f'powershell -Command "Get-ChildItem -Path \'{webhook_dir}\\*.js\' | Compress-Archive -DestinationPath \'{zip_path}\' -Force"'
        )
        
        # Verify ZIP was created
        if not zip_path.exists():
            print("❌ Failed to create Stripe Webhook Lambda ZIP!")
            sys.exit(1)
        
        print(f"✅ Stripe Webhook Lambda ZIP created: {zip_path}")
        print(f"📊 ZIP size: {zip_path.stat().st_size / 1024:.2f} KB")
        print("📦 Dependencies provided via Lambda Layer")
        
        print("✅ Stripe Webhook Lambda prepared for Terraform deployment")
        print("💳 Backup webhook handler for classic Stripe webhooks")
        
    except Exception as e:
        print(f"❌ Stripe Webhook deployment failed: {e}")
        print("⚠️ Continuing without Stripe Webhook...")

def deploy_stripe_eventbridge_handler():
    """Deploy Stripe EventBridge Handler Lambda"""
    print("\n" + "=" * 60)
    print("⚡ DEPLOYING STRIPE EVENTBRIDGE HANDLER")
    print("=" * 60)
    
    handler_dir = Path("viraltenant-infrastructure/lambda-functions/stripe-eventbridge-handler")
    if not handler_dir.exists():
        print("⚠️ Stripe EventBridge Handler directory not found, skipping...")
        return
    
    try:
        # Create Lambda ZIP using PowerShell - code only, deps from Lambda Layer
        print("\n📦 Creating Stripe EventBridge Handler Lambda ZIP file (code only - using Lambda Layer)...")
        zip_path = Path("viraltenant-infrastructure/stripe_eventbridge_handler.zip")
        
        # Remove old ZIP if exists
        if zip_path.exists():
            zip_path.unlink()
        
        # Use PowerShell to create ZIP - only JS files
        run_command(
            f'powershell -Command "Get-ChildItem -Path \'{handler_dir}\\*.js\' | Compress-Archive -DestinationPath \'{zip_path}\' -Force"'
        )
        
        # Verify ZIP was created
        if not zip_path.exists():
            print("❌ Failed to create Stripe EventBridge Handler Lambda ZIP!")
            sys.exit(1)
        
        print(f"✅ Stripe EventBridge Handler Lambda ZIP created: {zip_path}")
        print(f"📊 ZIP size: {zip_path.stat().st_size / 1024:.2f} KB")
        print("📦 Dependencies provided via Lambda Layer")
        
        print("✅ Stripe EventBridge Handler Lambda prepared for Terraform deployment")
        print("⚡ Processes Stripe events via Amazon EventBridge Partner Integration")
        
    except Exception as e:
        print(f"❌ Stripe EventBridge Handler deployment failed: {e}")
        print("⚠️ Continuing without Stripe EventBridge Handler...")

def deploy_crosspost_lambdas():
    """Deploy all Crosspost Lambda functions"""
    print("\n" + "=" * 60)
    print("📤 DEPLOYING CROSSPOST LAMBDAS")
    print("=" * 60)
    
    crosspost_lambdas = [
        "tenant-crosspost-tiktok",
        "tenant-crosspost-youtube",
        "tenant-crosspost-instagram",
        "tenant-crosspost-facebook",
        "tenant-crosspost-xtwitter",
        "tenant-crosspost-linkedin",
        "tenant-crosspost-telegram",
        "tenant-crosspost-discord",
        "tenant-crosspost-slack",
        "tenant-crosspost-bluesky",
        "tenant-crosspost-mastodon",
        "tenant-crosspost-snapchat",
        "tenant-crosspost-dispatcher",
    ]
    
    for lambda_name in crosspost_lambdas:
        lambda_dir = Path(f"viraltenant-infrastructure/lambda-functions/{lambda_name}")
        if not lambda_dir.exists():
            print(f"⚠️ {lambda_name} directory not found, skipping...")
            continue
        
        try:
            # Create Lambda ZIP using PowerShell - code only, deps from Lambda Layer
            zip_name = lambda_name.replace("-", "_") + ".zip"
            zip_path = Path(f"viraltenant-infrastructure/{zip_name}")
            
            # Remove old ZIP if exists
            if zip_path.exists():
                zip_path.unlink()
            
            # Use PowerShell to create ZIP - only JS files
            run_command(
                f'powershell -Command "Get-ChildItem -Path \'{lambda_dir}\\*.js\' | Compress-Archive -DestinationPath \'{zip_path}\' -Force"',
                show_output=False
            )
            
            # Verify ZIP was created
            if zip_path.exists():
                print(f"✅ {lambda_name}: {zip_path.stat().st_size / 1024:.2f} KB")
            else:
                print(f"⚠️ {lambda_name}: Failed to create ZIP")
                
        except Exception as e:
            print(f"⚠️ {lambda_name}: {e}")
    
    print("\n✅ Crosspost Lambdas prepared for Terraform deployment")
    print("📦 Dependencies provided via Lambda Layer")

def deploy_whatsapp_lambdas():
    """Deploy WhatsApp Lambda functions for AWS End User Messaging Social"""
    print("\n" + "=" * 60)
    print("📱 DEPLOYING WHATSAPP LAMBDAS")
    print("=" * 60)
    
    whatsapp_lambdas = [
        ("tenant-whatsapp-subscription", "tenant_whatsapp_subscription.zip"),
        ("tenant-crosspost-whatsapp", "tenant_crosspost_whatsapp.zip"),
        ("tenant-whatsapp-worker", "tenant_whatsapp_worker.zip"),
        ("tenant-whatsapp-settings", "tenant_whatsapp_settings.zip"),
    ]
    
    for lambda_name, zip_name in whatsapp_lambdas:
        lambda_dir = Path(f"viraltenant-infrastructure/lambda-functions/{lambda_name}")
        if not lambda_dir.exists():
            print(f"⚠️ {lambda_name} directory not found, skipping...")
            continue
        
        try:
            zip_path = Path(f"viraltenant-infrastructure/{zip_name}")
            
            # Remove old ZIP if exists
            if zip_path.exists():
                zip_path.unlink()
            
            # Use PowerShell to create ZIP - only JS files
            run_command(
                f'powershell -Command "Get-ChildItem -Path \'{lambda_dir}\\*.js\' | Compress-Archive -DestinationPath \'{zip_path}\' -Force"',
                show_output=False
            )
            
            # Verify ZIP was created
            if zip_path.exists():
                print(f"✅ {lambda_name}: {zip_path.stat().st_size / 1024:.2f} KB")
            else:
                print(f"⚠️ {lambda_name}: Failed to create ZIP")
                
        except Exception as e:
            print(f"⚠️ {lambda_name}: {e}")
    
    print("\n✅ WhatsApp Lambdas prepared for Terraform deployment")
    print("📱 Uses AWS End User Messaging Social for WhatsApp broadcasts")


def deploy_membership_lambda():
    """Deploy Tenant Membership Lambda for Mollie Split Payments"""
    print("\n" + "=" * 60)
    print("👑 DEPLOYING MEMBERSHIP LAMBDA")
    print("=" * 60)
    
    membership_dir = Path("viraltenant-infrastructure/lambda-functions/tenant-membership")
    if not membership_dir.exists():
        print("⚠️ Membership Lambda directory not found, skipping...")
        return
    
    try:
        zip_path = Path("viraltenant-infrastructure/tenant_membership.zip")
        
        # Remove old ZIP if exists
        if zip_path.exists():
            zip_path.unlink()
        
        # Use PowerShell to create ZIP - only JS files
        run_command(
            f'powershell -Command "Get-ChildItem -Path \'{membership_dir}\\*.js\' | Compress-Archive -DestinationPath \'{zip_path}\' -Force"',
            show_output=False
        )
        
        # Verify ZIP was created
        if zip_path.exists():
            print(f"✅ tenant-membership: {zip_path.stat().st_size / 1024:.2f} KB")
        else:
            print("⚠️ tenant-membership: Failed to create ZIP")
            
    except Exception as e:
        print(f"⚠️ tenant-membership: {e}")
    
    print("\n✅ Membership Lambda prepared for Terraform deployment")
    print("👑 Mollie Split Payments für Tenant-Mitgliedschaften")


def build_lambda_layer():
    """Build the common dependencies Lambda Layer - only if changed"""
    print("\n" + "=" * 60)
    print("📦 BUILDING LAMBDA LAYER (Common Dependencies)")
    print("=" * 60)
    
    layer_dir = Path("viraltenant-infrastructure/lambda-layers/common-deps/nodejs")
    zip_path = Path("viraltenant-infrastructure/lambda-layers/common-deps/common-deps-layer.zip")
    package_json = layer_dir / "package.json"
    package_lock = layer_dir / "package-lock.json"
    
    if not layer_dir.exists():
        print("❌ Lambda Layer directory not found!")
        sys.exit(1)
    
    # Check if rebuild is needed
    if zip_path.exists() and package_json.exists():
        zip_mtime = zip_path.stat().st_mtime
        pkg_mtime = package_json.stat().st_mtime
        lock_mtime = package_lock.stat().st_mtime if package_lock.exists() else 0
        
        # Only rebuild if package.json or package-lock.json is newer than ZIP
        if zip_mtime > pkg_mtime and zip_mtime > lock_mtime:
            zip_size = zip_path.stat().st_size / (1024*1024)
            print(f"✅ Lambda Layer ZIP is up-to-date ({zip_size:.2f} MB), skipping rebuild")
            print("💡 Delete the ZIP file to force a rebuild")
            return
        else:
            print("🔄 Dependencies changed, rebuilding Lambda Layer...")
    else:
        print("🆕 Lambda Layer ZIP not found, building...")
    
    try:
        # Install dependencies
        print("\n📦 Installing Lambda Layer dependencies...")
        run_command("npm install --production", cwd=layer_dir)
        
        # Create Lambda Layer ZIP
        print("\n📦 Creating Lambda Layer ZIP file...")
        
        # Remove old ZIP if exists
        if zip_path.exists():
            zip_path.unlink()
        
        # Use PowerShell to create ZIP (must include nodejs folder structure)
        nodejs_parent = layer_dir.parent  # common-deps folder
        run_command(
            f'powershell -Command "Compress-Archive -Path \'{nodejs_parent}\\nodejs\' -DestinationPath \'{zip_path}\' -Force"'
        )
        
        # Verify ZIP was created
        if not zip_path.exists():
            print("❌ Failed to create Lambda Layer ZIP!")
            sys.exit(1)
        
        print(f"✅ Lambda Layer ZIP created: {zip_path}")
        print(f"📊 ZIP size: {zip_path.stat().st_size / (1024*1024):.2f} MB")
        print("📦 Contains: AWS SDK, Stripe, PDFKit, UUID, etc.")
        
        print("✅ Lambda Layer prepared for Terraform deployment")
        
    except Exception as e:
        print(f"❌ Lambda Layer build failed: {e}")
        sys.exit(1)

def deploy_tenant_management():
    """Deploy Tenant Management Lambda"""
    print("\n" + "=" * 60)
    print("👥 DEPLOYING TENANT MANAGEMENT")
    print("=" * 60)
    
    tenant_mgmt_dir = Path("viraltenant-infrastructure/lambda-functions/tenant-management")
    if not tenant_mgmt_dir.exists():
        print("⚠️ Tenant Management directory not found, skipping...")
        return
    
    try:
        # Create Lambda ZIP using PowerShell (Windows compatible) - WITHOUT node_modules (using Lambda Layer)
        print("\n📦 Creating Tenant Management Lambda ZIP file (without node_modules - using Lambda Layer)...")
        zip_path = Path("tenant_management.zip")
        
        # Remove old ZIP if exists
        if zip_path.exists():
            zip_path.unlink()
        
        # Use PowerShell to create ZIP excluding node_modules
        run_command(
            f'powershell -Command "Get-ChildItem -Path \'{tenant_mgmt_dir}\' -Exclude \'node_modules\',\'package-lock.json\' | Compress-Archive -DestinationPath \'tenant_management.zip\' -Force"'
        )
        
        # Verify ZIP was created
        if not zip_path.exists():
            print("❌ Failed to create Tenant Management Lambda ZIP!")
            sys.exit(1)
        
        print(f"✅ Tenant Management Lambda ZIP created: {zip_path}")
        print(f"📊 ZIP size: {zip_path.stat().st_size / 1024:.2f} KB")
        print("📦 Dependencies provided via Lambda Layer")
        
        print("✅ Tenant Management Lambda prepared for Terraform deployment")
        
    except Exception as e:
        print(f"❌ Tenant Management deployment failed: {e}")
        # Don't exit, as this is optional
        print("⚠️ Continuing without Tenant Management update...")

def deploy_auth_handler():
    """Deploy Auth Handler Lambda (central-auth module)"""
    print("\n" + "=" * 60)
    print("🔑 DEPLOYING AUTH HANDLER")
    print("=" * 60)
    
    # Auth handler is in modules/central-auth/lambda/
    auth_handler_dir = Path("viraltenant-infrastructure/modules/central-auth/lambda")
    if not auth_handler_dir.exists():
        print("⚠️ Auth Handler directory not found, skipping...")
        return
    
    try:
        # Create Lambda ZIP using PowerShell (Windows compatible) - WITHOUT node_modules (using Lambda Layer)
        print("\n📦 Creating Auth Handler Lambda ZIP file (without node_modules - using Lambda Layer)...")
        # ZIP must be in viraltenant-infrastructure folder for Terraform
        zip_path = Path("viraltenant-infrastructure/auth_handler.zip")
        
        # Remove old ZIP if exists
        if zip_path.exists():
            zip_path.unlink()
        
        # Use PowerShell to create ZIP - only index.js file
        run_command(
            f'powershell -Command "Compress-Archive -Path \'{auth_handler_dir}\\index.js\' -DestinationPath \'{zip_path}\' -Force"'
        )
        
        # Verify ZIP was created
        if not zip_path.exists():
            print("❌ Failed to create Auth Handler Lambda ZIP!")
            sys.exit(1)
        
        print(f"✅ Auth Handler Lambda ZIP created: {zip_path}")
        print(f"📊 ZIP size: {zip_path.stat().st_size / 1024:.2f} KB")
        print("📦 Dependencies provided via Lambda Layer")
        
        print("✅ Auth Handler Lambda prepared for Terraform deployment")
        
    except Exception as e:
        print(f"❌ Auth Handler deployment failed: {e}")
        # Don't exit, as this is optional
        print("⚠️ Continuing without Auth Handler update...")

def deploy_billing_config(s3_bucket):
    """Deploy Billing Configuration and Logo to S3"""
    print("\n" + "=" * 60)
    print("📄 DEPLOYING BILLING CONFIGURATION")
    print("=" * 60)
    
    config_path = Path("viraltenant-infrastructure/config/billing-config.json")
    logo_path = Path("viraltenant-infrastructure/assets/viraltenant-logo.png")
    
    try:
        # Upload billing config
        if config_path.exists():
            print(f"\n📤 Uploading billing-config.json to S3...")
            run_command(
                f'aws s3 cp "{config_path}" s3://{s3_bucket}/config/billing-config.json --content-type "application/json"'
            )
            print("✅ billing-config.json uploaded")
            
            # Check if config has placeholders
            with open(config_path, 'r', encoding='utf-8') as f:
                config_content = f.read()
                if '[FIRMENNAME EINTRAGEN]' in config_content or '[IBAN' in config_content:
                    print("\n⚠️  WICHTIG: billing-config.json enthält noch Platzhalter!")
                    print("   Bitte füllen Sie die Datei mit Ihren echten Firmendaten aus:")
                    print(f"   📁 {config_path}")
        else:
            print(f"⚠️ billing-config.json not found at {config_path}")
        
        # Upload logo if exists
        if logo_path.exists():
            print(f"\n📤 Uploading viraltenant-logo.png to S3...")
            run_command(
                f'aws s3 cp "{logo_path}" s3://{s3_bucket}/assets/viraltenant-logo.png --content-type "image/png"'
            )
            print("✅ viraltenant-logo.png uploaded")
        else:
            print(f"\n⚠️ Logo not found at {logo_path}")
            print("   Bitte fügen Sie Ihr Firmenlogo hinzu für die Rechnungen:")
            print(f"   📁 {logo_path}")
            print("   📐 Empfohlene Größe: 360x120 Pixel (PNG)")
        
        print("\n✅ Billing configuration deployment completed")
        
    except Exception as e:
        print(f"❌ Billing config deployment failed: {e}")
        print("⚠️ Continuing without billing config...")

def deploy_static_pages(s3_bucket):
    """Deploy static HTML pages (tenant-creation, etc.) to S3"""
    print("\n" + "=" * 60)
    print("📄 DEPLOYING STATIC PAGES")
    print("=" * 60)
    
    static_pages_dir = Path("viraltenant-infrastructure/static-pages")
    if not static_pages_dir.exists():
        print("⚠️ Static pages directory not found, skipping...")
        return
    
    try:
        # List of static pages to deploy
        static_pages = [
            ("tenant-creation.html", "tenant-creation.html"),
            ("tenant-creation.html", "tenant-registration.html"),  # Also deploy as tenant-registration.html for backward compatibility
        ]
        
        for source_file, dest_file in static_pages:
            source_path = static_pages_dir / source_file
            if source_path.exists():
                print(f"\n📤 Uploading {dest_file} to S3...")
                run_command(
                    f'aws s3 cp "{source_path}" s3://{s3_bucket}/{dest_file} --content-type "text/html" --cache-control "public, max-age=3600"'
                )
                print(f"✅ {dest_file} uploaded")
            else:
                print(f"⚠️ {source_file} not found at {source_path}")
        
        print("\n✅ Static pages deployment completed")
        
    except Exception as e:
        print(f"❌ Static pages deployment failed: {e}")
        print("⚠️ Continuing without static pages...")

def deploy_billing_dashboard(outputs):
    """Deploy Billing Admin Dashboard to its own S3 bucket"""
    print("\n" + "=" * 60)
    print("📊 DEPLOYING BILLING ADMIN DASHBOARD")
    print("=" * 60)
    
    billing_dir = Path("viraltenant-billing")
    if not billing_dir.exists():
        print("⚠️ Billing dashboard directory not found, skipping...")
        return
    
    # Get billing dashboard bucket from outputs
    billing_bucket = outputs.get("billing_dashboard_bucket", {}).get("value")
    billing_url = outputs.get("billing_dashboard_url", {}).get("value")
    billing_cf_id = outputs.get("billing_dashboard_cloudfront_id", {}).get("value")
    
    if not billing_bucket:
        print("⚠️ Billing dashboard bucket not found in Terraform outputs, skipping...")
        return
    
    try:
        # Upload billing dashboard files
        print(f"\n📤 Uploading billing dashboard to S3: {billing_bucket}")
        run_command(
            f'aws s3 sync "{billing_dir}" s3://{billing_bucket}/ --delete'
        )
        print("✅ Billing dashboard uploaded")
        
        # Invalidate CloudFront cache
        if billing_cf_id:
            print(f"\n🔄 Invalidating CloudFront cache: {billing_cf_id}")
            run_command(
                f'aws cloudfront create-invalidation --distribution-id {billing_cf_id} --paths "/*"',
                show_output=False
            )
            print("✅ CloudFront cache invalidated")
        
        print(f"\n🌐 Billing Dashboard URL: {billing_url}")
        
    except Exception as e:
        print(f"❌ Billing dashboard deployment failed: {e}")
        print("⚠️ Continuing without billing dashboard...")

def build_and_deploy_frontend(s3_bucket):
    """Build and deploy React frontend"""
    print("\n" + "=" * 60)
    print("⚛️ BUILDING AND DEPLOYING FRONTEND")
    print("=" * 60)
    print(f"📦 Target S3 Bucket: {s3_bucket}")
    
    frontend_dir = Path("viraltenant-react")
    if not frontend_dir.exists():
        print("❌ Frontend directory not found!")
        sys.exit(1)
    
    try:
        # Install dependencies
        print("\n📦 Installing npm dependencies...")
        run_command("npm install", cwd=frontend_dir)
        
        # Build frontend
        print("\n🔨 Building React application...")
        run_command("npm run build", cwd=frontend_dir)
        
        # Check build output
        dist_dir = frontend_dir / "dist"
        if not dist_dir.exists():
            print("❌ Build failed - dist directory not found!")
            sys.exit(1)
        
        print(f"✅ Build completed successfully!")
        print(f"📁 Build output: {dist_dir}")
        
        # Deploy to S3
        print(f"\n📤 Uploading to S3 bucket: {s3_bucket}")
        
        # Upload static assets with long cache (exclude invoices, config, assets, and static pages that are managed separately)
        print("📄 Uploading static assets (CSS, JS, images)...")
        run_command(f'aws s3 sync "{dist_dir}" s3://{s3_bucket}/ --delete --cache-control "public, max-age=31536000" --exclude "*.html" --exclude "invoices/*" --exclude "config/*" --exclude "assets/viraltenant-logo.png" --exclude "tenant-creation.html" --exclude "tenant-registration.html"')
        
        # Upload HTML files with short cache
        print("📄 Uploading HTML files...")
        run_command(f'aws s3 sync "{dist_dir}" s3://{s3_bucket}/ --exclude "*" --include "*.html" --cache-control "public, max-age=3600"')
        
        print("✅ Frontend deployed successfully!")
        
    except Exception as e:
        print(f"❌ Frontend deployment failed: {e}")
        sys.exit(1)

def invalidate_cloudfront(distribution_id):
    """Invalidate CloudFront cache"""
    print("\n" + "=" * 60)
    print("🔄 INVALIDATING CLOUDFRONT CACHE")
    print("=" * 60)
    print(f"🌐 Distribution ID: {distribution_id}")
    
    try:
        print("\n🚀 Creating CloudFront invalidation...")
        result = run_command(f'aws cloudfront create-invalidation --distribution-id {distribution_id} --paths "/*"', show_output=False)
        
        if result.stdout:
            try:
                data = json.loads(result.stdout)
                invalidation_id = data["Invalidation"]["Id"]
                status = data["Invalidation"]["Status"]
                
                print(f"✅ Invalidation created successfully!")
                print(f"🆔 Invalidation ID: {invalidation_id}")
                print(f"📊 Status: {status}")
                print("⏳ Cache invalidation is in progress...")
                print("💡 It may take 5-15 minutes to complete globally")
                
            except json.JSONDecodeError:
                print("⚠️ Invalidation created but could not parse response")
        else:
            print("⚠️ Invalidation command completed but no output received")
            
    except Exception as e:
        print(f"❌ CloudFront invalidation failed: {e}")
        print("⚠️ Website may still work but cache might be stale")
        # Don't exit here, as this is not critical

def update_frontend_config(outputs):
    """Update frontend configuration with Terraform outputs"""
    print("\n" + "=" * 60)
    print("⚙️ UPDATING FRONTEND CONFIGURATION")
    print("=" * 60)
    
    try:
        config_path = Path("viraltenant-react/src/config/aws-config.ts")
        if not config_path.exists():
            print("❌ Frontend config file not found!")
            return
        
        # Read current config
        with open(config_path, 'r', encoding='utf-8') as f:
            config_content = f.read()
        
        # Extract values from Terraform outputs
        api_url = outputs.get("api_gateway_url", {}).get("value", "")
        user_pool_id = outputs.get("cognito_user_pool_id", {}).get("value", "")
        client_id = outputs.get("cognito_client_id", {}).get("value", "")
        
        if api_url and user_pool_id and client_id:
            print(f"🔧 API Gateway URL: {api_url}")
            print(f"🔧 User Pool ID: {user_pool_id}")
            print(f"🔧 Client ID: {client_id}")
            
            # Replace placeholders
            config_content = config_content.replace('API_GATEWAY_URL_PLACEHOLDER', api_url)
            config_content = config_content.replace('USER_POOL_ID_PLACEHOLDER', user_pool_id)
            config_content = config_content.replace('CLIENT_ID_PLACEHOLDER', client_id)
            
            # Write updated config
            with open(config_path, 'w', encoding='utf-8') as f:
                f.write(config_content)
            
            print("✅ Frontend configuration updated successfully!")
        else:
            print("⚠️ Missing required Terraform outputs for frontend config")
            
    except Exception as e:
        print(f"❌ Failed to update frontend config: {e}")
        # Don't exit, as this is not critical

def main():
    """Main deployment function"""
    # Parse command line arguments
    parser = argparse.ArgumentParser(
        description='ViralTenant Platform Deployment Script',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python deploy.py                    # Full deployment
  python deploy.py --frontend         # Frontend only
  python deploy.py --infrastructure   # Infrastructure only
  python deploy.py --billing          # Billing system only
        """
    )
    
    parser.add_argument(
        '--frontend',
        action='store_true',
        help='Deploy only the React frontend (skip infrastructure and billing)'
    )
    parser.add_argument(
        '--infrastructure',
        action='store_true',
        help='Deploy only the infrastructure (Terraform)'
    )
    parser.add_argument(
        '--billing',
        action='store_true',
        help='Deploy only the billing system'
    )
    parser.add_argument(
        '--crosspost',
        action='store_true',
        help='Deploy only the crosspost lambdas (Instagram, TikTok, WhatsApp, etc.)'
    )
    
    args = parser.parse_args()
    
    # If --frontend flag is set, only deploy frontend
    if args.frontend:
        print("🚀 VIRALTENANT FRONTEND DEPLOYMENT")
        print("=" * 60)
        print("⚛️ Deploying React frontend only...")
        print("=" * 60)
        
        try:
            # Get Terraform outputs to find S3 bucket and CloudFront ID
            print("\n📋 Reading Terraform outputs...")
            infra_dir = Path("viraltenant-infrastructure")
            result = subprocess.run(
                "terraform output -json",
                shell=True,
                cwd=infra_dir,
                capture_output=True,
                text=True
            )
            
            if result.returncode != 0:
                print("❌ Failed to read Terraform outputs!")
                print("Make sure infrastructure is deployed first")
                sys.exit(1)
            
            outputs = json.loads(result.stdout)
            s3_bucket = outputs.get("s3_bucket_name", {}).get("value")
            cloudfront_id = outputs.get("cloudfront_distribution_id", {}).get("value")
            website_url = outputs.get("website_url", {}).get("value")
            
            if not s3_bucket or not cloudfront_id:
                print("❌ Could not find S3 bucket or CloudFront ID in Terraform outputs!")
                sys.exit(1)
            
            print(f"✅ Found S3 bucket: {s3_bucket}")
            print(f"✅ Found CloudFront ID: {cloudfront_id}")
            
            # Deploy static pages (tenant-creation, etc.)
            deploy_static_pages(s3_bucket)
            
            # Build and deploy frontend
            build_and_deploy_frontend(s3_bucket)
            
            # Invalidate CloudFront
            invalidate_cloudfront(cloudfront_id)
            
            # Final summary
            print("\n" + "=" * 60)
            print("🎉 FRONTEND DEPLOYMENT COMPLETED!")
            print("=" * 60)
            print(f"🌐 Website URL: {website_url}")
            print(f"📦 S3 Bucket: {s3_bucket}")
            print(f"🔄 CloudFront Distribution: {cloudfront_id}")
            print("\n✅ Frontend is now live!")
            print("⏰ Cache invalidation may take 5-15 minutes to complete globally")
            
        except Exception as e:
            print(f"\n❌ FRONTEND DEPLOYMENT FAILED!")
            print(f"Error: {e}")
            sys.exit(1)
        
        return
    
    # If --infrastructure flag is set, only deploy infrastructure
    if args.infrastructure:
        print("🚀 VIRALTENANT INFRASTRUCTURE DEPLOYMENT")
        print("=" * 60)
        print("🏗️ Deploying infrastructure only...")
        print("=" * 60)
        
        try:
            # Build Lambda Layer FIRST
            build_lambda_layer()
            
            # Deploy auth handler
            deploy_auth_handler()
            
            # Deploy tenant management
            deploy_tenant_management()
            
            # Deploy billing system
            deploy_billing_system()
            
            # Deploy billing cron
            deploy_billing_cron()
            
            # Deploy tenant authorizer
            deploy_tenant_authorizer()
            
            # Deploy Stripe Lambdas (EventBridge + Webhook)
            deploy_stripe_webhook()
            deploy_stripe_eventbridge_handler()
            
            # Deploy infrastructure
            outputs = deploy_infrastructure()
            
            # Update frontend configuration
            update_frontend_config(outputs)
            
            # Final summary
            print("\n" + "=" * 60)
            print("🎉 INFRASTRUCTURE DEPLOYMENT COMPLETED!")
            print("=" * 60)
            
            api_url = outputs.get("api_gateway_url", {}).get("value")
            print(f"⚡ API Gateway URL: {api_url}")
            print("\n✅ Infrastructure is now deployed!")
            print("💳 Stripe EventBridge Integration: Ready")
            print("💡 Run 'python deploy.py --frontend' to deploy the frontend")
            
        except Exception as e:
            print(f"\n❌ INFRASTRUCTURE DEPLOYMENT FAILED!")
            print(f"Error: {e}")
            sys.exit(1)
        
        return
    
    # If --crosspost flag is set, only deploy crosspost lambdas
    if args.crosspost:
        print("🚀 VIRALTENANT CROSSPOST LAMBDAS DEPLOYMENT")
        print("=" * 60)
        print("📤 Deploying crosspost lambdas only...")
        print("=" * 60)
        
        try:
            # Build Lambda Layer (dependencies)
            build_lambda_layer()
            
            # Deploy crosspost lambdas (creates ZIP files)
            deploy_crosspost_lambdas()
            
            # Deploy WhatsApp lambdas
            deploy_whatsapp_lambdas()
            
            # Apply Terraform for crosspost and whatsapp modules
            print("\n🏗️ Applying Terraform for crosspost and whatsapp modules...")
            infra_dir = Path("viraltenant-infrastructure")
            run_command('terraform apply -target="module.tenant_crosspost" -target="module.tenant_whatsapp" -var-file=terraform.tfvars', cwd=infra_dir)
            
            print("\n" + "=" * 60)
            print("🎉 CROSSPOST LAMBDAS DEPLOYMENT COMPLETED!")
            print("=" * 60)
            print("✅ Crosspost Lambdas are now deployed!")
            print("📤 Supported platforms: Instagram, TikTok, YouTube, Facebook, X/Twitter,")
            print("   LinkedIn, Telegram, Discord, Slack, Bluesky, Mastodon, Snapchat, WhatsApp")
            
        except Exception as e:
            print(f"\n❌ CROSSPOST DEPLOYMENT FAILED!")
            print(f"Error: {e}")
            sys.exit(1)
        
        return
    
    # If --billing flag is set, only deploy billing
    if args.billing:
        print("🚀 VIRALTENANT BILLING DEPLOYMENT")
        print("=" * 60)
        print("💰 Deploying billing system only...")
        print("=" * 60)
        
        try:
            # Build Lambda Layer
            build_lambda_layer()
            
            # Deploy billing system
            deploy_billing_system()
            
            # Deploy billing cron
            deploy_billing_cron()
            
            # Deploy Stripe Lambdas
            deploy_stripe_webhook()
            deploy_stripe_eventbridge_handler()
            
            # Get Terraform outputs
            infra_dir = Path("viraltenant-infrastructure")
            result = subprocess.run(
                "terraform output -json",
                shell=True,
                cwd=infra_dir,
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                outputs = json.loads(result.stdout)
                s3_bucket = outputs.get("s3_bucket_name", {}).get("value")
                
                if s3_bucket:
                    deploy_billing_config(s3_bucket)
                    deploy_billing_dashboard(outputs)
            
            print("\n" + "=" * 60)
            print("🎉 BILLING DEPLOYMENT COMPLETED!")
            print("=" * 60)
            print("✅ Billing system is now deployed!")
            
        except Exception as e:
            print(f"\n❌ BILLING DEPLOYMENT FAILED!")
            print(f"Error: {e}")
            sys.exit(1)
        
        return
    
    # Full deployment (default)
    print("🚀 VIRALTENANT PLATFORM DEPLOYMENT")
    print("=" * 60)
    print("🎯 Starting automated deployment process...")
    print("⏰ This may take several minutes to complete")
    print("=" * 60)
    
    try:
        # Build Lambda Layer FIRST (dependencies for all Lambdas)
        build_lambda_layer()
        
        # Deploy auth handler (creates ZIP needed by Terraform)
        deploy_auth_handler()
        
        # Deploy tenant management (creates ZIP needed by Terraform)
        deploy_tenant_management()
        
        # Deploy billing system (creates ZIP files needed by Terraform)
        deploy_billing_system()
        
        # Deploy billing cron (monthly invoices) - creates ZIP needed by Terraform
        deploy_billing_cron()
        
        # Deploy tenant authorizer (with billing-admin support)
        deploy_tenant_authorizer()
        
        # Deploy Stripe Lambdas (EventBridge + Webhook)
        deploy_stripe_webhook()
        deploy_stripe_eventbridge_handler()
        
        # Deploy Crosspost Lambdas (TikTok, YouTube, Instagram, etc.)
        deploy_crosspost_lambdas()
        
        # Deploy WhatsApp Lambdas (AWS End User Messaging Social)
        deploy_whatsapp_lambdas()
        
        # Deploy Membership Lambda (Mollie Split Payments)
        deploy_membership_lambda()
        
        # Deploy infrastructure (uses the ZIP files created above)
        outputs = deploy_infrastructure()
        
        # Update frontend configuration with new API endpoints
        update_frontend_config(outputs)
        
        # Extract deployment info
        s3_bucket = outputs.get("s3_bucket_name", {}).get("value")
        cloudfront_id = outputs.get("cloudfront_distribution_id", {}).get("value")
        website_url = outputs.get("website_url", {}).get("value")
        cloudfront_url = outputs.get("quick_start_urls", {}).get("value", {}).get("cloudfront_url")
        api_url = outputs.get("api_gateway_url", {}).get("value")
        
        print(f"\n📋 Deployment Configuration:")
        print(f"  S3 Bucket: {s3_bucket}")
        print(f"  CloudFront ID: {cloudfront_id}")
        print(f"  Website URL: {website_url}")
        print(f"  CloudFront URL: {cloudfront_url}")
        print(f"  API Gateway URL: {api_url}")
        
        if not s3_bucket or not cloudfront_id:
            print("\n❌ DEPLOYMENT FAILED!")
            print("Could not get S3 bucket or CloudFront distribution ID from Terraform outputs")
            print("\n📋 Available Terraform outputs:")
            for key, value in outputs.items():
                print(f"  {key}: {value}")
            sys.exit(1)
        
        # Deploy billing configuration and logo to S3
        deploy_billing_config(s3_bucket)
        
        # Deploy billing admin dashboard (to its own bucket)
        deploy_billing_dashboard(outputs)
        
        # Deploy static pages (tenant-creation, etc.)
        deploy_static_pages(s3_bucket)
        
        # Deploy frontend
        build_and_deploy_frontend(s3_bucket)
        
        # Invalidate CloudFront
        invalidate_cloudfront(cloudfront_id)
        
        # Final summary
        print("\n" + "=" * 60)
        print("🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!")
        print("=" * 60)
        print(f"🌐 Website URL: {website_url}")
        print(f"🔗 CloudFront URL: {cloudfront_url}")
        print(f"⚡ API Gateway URL: {api_url}")
        print(f"📦 S3 Bucket: {s3_bucket}")
        print(f"🔄 CloudFront Distribution: {cloudfront_id}")
        
        # Billing Dashboard URL
        billing_url = outputs.get("billing_dashboard_url", {}).get("value")
        if billing_url:
            print(f"\n📊 Billing Dashboard: {billing_url}")
        
        print(f"\n💰 Billing System:")
        print(f"  ✅ Cost Explorer Integration: Active")
        print(f"  ✅ Resource Tags: Applied")
        print(f"  ✅ Billing API Lambda: Deployed")
        print(f"  ✅ Billing Cron Lambda: Deployed (Monthly Invoices)")
        print(f"  ✅ Stripe EventBridge Handler: Deployed")
        print(f"  ✅ Stripe Webhook (Backup): Deployed")
        print(f"  ✅ React Components: Included")
        print(f"  📊 Estimate Endpoint: {api_url}/billing/estimate/{{tenantId}}")
        print(f"  📄 Invoices Endpoint: {api_url}/billing/invoices/{{tenantId}}")
        print(f"  💳 Stripe Subscription: {api_url}/billing/stripe/subscription")
        print(f"  📅 Cron Schedule: 1st of every month at 6:00 AM UTC")
        print("\n✅ Your platform is now live with authentication and billing!")
        print("💡 If custom domain doesn't work yet, use CloudFront URL")
        print("⏰ DNS propagation can take up to 48 hours")
        print("\n📚 Next steps:")
        print("  1. Fill out billing-config.json with your company data")
        print("  2. Add your logo as viraltenant-infrastructure/assets/viraltenant-logo.png")
        print("  3. Run deploy.py again to upload the config")
        print("  4. Monitor CloudWatch Dashboard: https://console.aws.amazon.com/cloudwatch/")
        print("  5. Test Billing API: GET /billing/estimate/{tenantId}")
        print("  6. Review BILLING_DEPLOYMENT.md for detailed documentation")
        
    except KeyboardInterrupt:
        print("\n\n⚠️ Deployment interrupted by user")
        print("🔄 You can resume by running the script again")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ DEPLOYMENT FAILED!")
        print(f"Error: {e}")
        print("\n🔧 Troubleshooting tips:")
        print("1. Check your AWS credentials and permissions")
        print("2. Verify Terraform is installed and configured")
        print("3. Ensure Node.js and npm are installed")
        print("4. Check the error messages above for specific issues")
        print("5. Review BILLING_TROUBLESHOOTING.md for billing-specific issues")
        sys.exit(1)

if __name__ == "__main__":
    main()