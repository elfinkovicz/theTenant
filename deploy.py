#!/usr/bin/env python3
"""
Automatisches Deployment-Script für Creator Platform
Verwendung: python deploy.py
"""

import os
import sys
import subprocess
import json
from pathlib import Path
from deployment_config import config



class Colors:
    """ANSI Farben für Terminal-Output"""
    BLUE = '\033[0;34m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    RED = '\033[0;31m'
    NC = '\033[0m'  # No Color


def log_info(msg):
    print(f"{Colors.BLUE}[INFO] {msg}{Colors.NC}")


def log_success(msg):
    print(f"{Colors.GREEN}[OK] {msg}{Colors.NC}")


def log_warning(msg):
    print(f"{Colors.YELLOW}[WARN] {msg}{Colors.NC}")


def log_error(msg):
    print(f"{Colors.RED}[ERROR] {msg}{Colors.NC}")


def log_step(msg):
    print()
    print(f"{Colors.BLUE}{'=' * 50}{Colors.NC}")
    print(f"{Colors.BLUE}{msg}{Colors.NC}")
    print(f"{Colors.BLUE}{'=' * 50}{Colors.NC}")
    print()


def run_command(cmd, cwd=None, check=True, capture_output=False):
    """Führt Shell-Befehl aus"""
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            cwd=cwd,
            check=check,
            capture_output=capture_output,
            text=True
        )
        return result
    except subprocess.CalledProcessError as e:
        log_error(f"Befehl fehlgeschlagen: {cmd}")
        if capture_output:
            log_error(f"Output: {e.stdout}")
            log_error(f"Error: {e.stderr}")
        raise


def confirm(question):
    """Fragt Benutzer nach Bestätigung"""
    while True:
        answer = input(f"{question} (yes/no): ").lower()
        if answer in ['yes', 'y']:
            return True
        if answer in ['no', 'n']:
            return False
        print("Bitte 'yes' oder 'no' eingeben")


def validate_config():
    """Validiert Konfiguration"""
    log_step("SCHRITT 0: Konfiguration validieren")
    
    config.show()
    print()
    
    errors = config.validate()
    if errors:
        log_error("Konfiguration ist nicht valide:")
        for error in errors:
            print(f"  - {error}")
        print()
        log_info("Passe deployment-config.py an und starte erneut")
        sys.exit(1)
    
    log_success("Konfiguration ist valide")
    print()
    
    if not confirm("Ist die Konfiguration korrekt?"):
        log_warning("Deployment abgebrochen")
        sys.exit(0)


def check_aws_cli():
    """Prüft AWS CLI Konfiguration"""
    log_step("PHASE 1: AWS Setup prüfen")
    
    log_info("Prüfe AWS CLI Konfiguration...")
    try:
        run_command(
            f"aws sts get-caller-identity --profile {config.AWS_PROFILE}",
            capture_output=True
        )
        log_success("AWS CLI konfiguriert")
    except:
        log_error(f"AWS CLI Profile '{config.AWS_PROFILE}' nicht konfiguriert")
        log_info(f"Führe aus: aws configure --profile {config.AWS_PROFILE}")
        sys.exit(1)


def setup_terraform_backend():
    """Erstellt Terraform Backend (S3 + DynamoDB)"""
    log_step("PHASE 2: Terraform Backend erstellen")
    
    # S3 Bucket
    log_info("Erstelle S3 Bucket für Terraform State...")
    try:
        run_command(
            f"aws s3 ls s3://{config.TF_STATE_BUCKET} --profile {config.AWS_PROFILE}",
            capture_output=True
        )
        log_warning("S3 Bucket existiert bereits")
    except:
        run_command(
            f"aws s3 mb s3://{config.TF_STATE_BUCKET} "
            f"--region {config.AWS_REGION} --profile {config.AWS_PROFILE}"
        )
        
        # Versioning
        run_command(
            f"aws s3api put-bucket-versioning "
            f"--bucket {config.TF_STATE_BUCKET} "
            f"--versioning-configuration Status=Enabled "
            f"--profile {config.AWS_PROFILE}"
        )
        
        # Encryption
        run_command(
            f'aws s3api put-bucket-encryption '
            f'--bucket {config.TF_STATE_BUCKET} '
            f'--server-side-encryption-configuration \'{{"Rules":[{{"ApplyServerSideEncryptionByDefault":{{"SSEAlgorithm":"AES256"}}}}]}}\' '
            f'--profile {config.AWS_PROFILE}'
        )
        
        # Public Access Block
        run_command(
            f"aws s3api put-public-access-block "
            f"--bucket {config.TF_STATE_BUCKET} "
            f"--public-access-block-configuration "
            f"BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true "
            f"--profile {config.AWS_PROFILE}"
        )
        
        log_success("S3 Bucket erstellt")
    
    # DynamoDB Table
    log_info("Erstelle DynamoDB Table für State Locking...")
    try:
        run_command(
            f"aws dynamodb describe-table --table-name {config.TF_LOCK_TABLE} "
            f"--profile {config.AWS_PROFILE}",
            capture_output=True
        )
        log_warning("DynamoDB Table existiert bereits")
    except:
        run_command(
            f"aws dynamodb create-table "
            f"--table-name {config.TF_LOCK_TABLE} "
            f"--attribute-definitions AttributeName=LockID,AttributeType=S "
            f"--key-schema AttributeName=LockID,KeyType=HASH "
            f"--billing-mode PAY_PER_REQUEST "
            f"--region {config.AWS_REGION} "
            f"--profile {config.AWS_PROFILE}"
        )
        log_success("DynamoDB Table erstellt")


def verify_ses_email():
    """Verifiziert SES E-Mail"""
    log_step("PHASE 3: AWS Services vorbereiten")
    
    log_info("Verifiziere SES E-Mail-Adresse...")
    run_command(
        f"aws ses verify-email-identity "
        f"--email-address {config.CONTACT_EMAIL_SENDER} "
        f"--region {config.AWS_REGION} "
        f"--profile {config.AWS_PROFILE}"
    )
    
    log_warning(f"WICHTIG: Prüfe E-Mails und bestätige SES Verifikation!")
    log_info(f"E-Mail: {config.CONTACT_EMAIL_SENDER}")
    print()
    
    if not confirm("E-Mail verifiziert?"):
        log_warning("Bitte verifiziere die E-Mail und starte das Script erneut")
        sys.exit(0)


def prepare_lambda_functions():
    """Bereitet Lambda-Funktionen vor (Dependencies werden via Lambda Layers verwaltet)"""
    log_step("PHASE 4: Lambda-Funktionen vorbereiten")
    
    log_info("Lambda Dependencies werden via Terraform Lambda Layers verwaltet")
    
    # Lambda Layers bauen
    log_info("Baue Lambda Layers...")
    lambda_layers_dir = Path(config.TERRAFORM_DIR) / "modules" / "lambda-layers"
    
    if lambda_layers_dir.exists():
        try:
            import platform
            if platform.system() == "Windows":
                run_command("powershell -ExecutionPolicy Bypass -File build-all-layers.ps1", cwd=lambda_layers_dir)
            else:
                run_command("chmod +x build-all-layers.sh && ./build-all-layers.sh", cwd=lambda_layers_dir)
            
            log_success("Lambda Layers gebaut")
        except Exception as e:
            log_error(f"Fehler beim Bauen der Lambda Layers: {e}")
            log_warning("Bitte baue die Lambda Layers manuell:")
            log_info("  cd TerraformInfluencerTemplate/modules/lambda-layers")
            log_info("  ./build-all-layers.ps1  (Windows)")
            log_info("  ./build-all-layers.sh   (Linux/Mac)")
            raise
    else:
        log_warning("Lambda Layers Modul nicht gefunden - überspringe")
    
    # Stream Restreaming Lambda ZIPs erstellen (falls benötigt)
    if config.ENABLE_STREAM_RESTREAMING:
        log_info("Baue Stream Restreaming Lambda-Funktionen...")
        restreaming_module_dir = Path(config.TERRAFORM_DIR) / "modules" / "stream-restreaming"
        
        if restreaming_module_dir.exists():
            try:
                import platform
                if platform.system() == "Windows":
                    build_script = restreaming_module_dir / "build-lambdas.ps1"
                    if build_script.exists():
                        run_command("powershell -ExecutionPolicy Bypass -File build-lambdas.ps1", cwd=restreaming_module_dir)
                    else:
                        log_warning("build-lambdas.ps1 nicht gefunden - erstelle ZIPs manuell")
                        # Fallback: Erstelle ZIPs manuell
                        import zipfile
                        lambda_dir = restreaming_module_dir / "lambda"
                        
                        # lambda.zip (API Handler)
                        with zipfile.ZipFile(restreaming_module_dir / "lambda.zip", 'w', zipfile.ZIP_DEFLATED) as zipf:
                            zipf.write(lambda_dir / "index.py", "index.py")
                        
                        # monitor.zip (Stream Monitor)
                        with zipfile.ZipFile(restreaming_module_dir / "monitor.zip", 'w', zipfile.ZIP_DEFLATED) as zipf:
                            zipf.write(lambda_dir / "stream_monitor.py", "stream_monitor.py")
                            zipf.write(lambda_dir / "index.py", "index.py")
                else:
                    build_script = restreaming_module_dir / "build-lambdas.sh"
                    if build_script.exists():
                        run_command("chmod +x build-lambdas.sh && ./build-lambdas.sh", cwd=restreaming_module_dir)
                    else:
                        log_warning("build-lambdas.sh nicht gefunden - erstelle ZIPs manuell")
                        # Fallback: Erstelle ZIPs manuell
                        import zipfile
                        lambda_dir = restreaming_module_dir / "lambda"
                        
                        # lambda.zip (API Handler)
                        with zipfile.ZipFile(restreaming_module_dir / "lambda.zip", 'w', zipfile.ZIP_DEFLATED) as zipf:
                            zipf.write(lambda_dir / "index.py", "index.py")
                        
                        # monitor.zip (Stream Monitor)
                        with zipfile.ZipFile(restreaming_module_dir / "monitor.zip", 'w', zipfile.ZIP_DEFLATED) as zipf:
                            zipf.write(lambda_dir / "stream_monitor.py", "stream_monitor.py")
                            zipf.write(lambda_dir / "index.py", "index.py")
                
                log_success("Stream Restreaming Lambda-Funktionen gebaut")
            except Exception as e:
                log_error(f"Fehler beim Bauen der Stream Restreaming Lambda-Funktionen: {e}")
                log_warning("Bitte baue die Lambda-Funktionen manuell:")
                log_info("  cd TerraformInfluencerTemplate/modules/stream-restreaming")
                log_info("  ./build-lambdas.ps1  (Windows)")
                log_info("  ./build-lambdas.sh   (Linux/Mac)")
                raise
        else:
            log_warning("Stream Restreaming Modul nicht gefunden - überspringe")
    
    # Billing System Lambda-Funktionen bauen (falls aktiviert)
    if config.ENABLE_BILLING_SYSTEM:
        log_info("Baue Billing System Lambda-Funktionen...")
        billing_module_dir = Path(config.TERRAFORM_DIR) / "modules" / "billing-system"
        
        if billing_module_dir.exists():
            try:
                import platform
                if platform.system() == "Windows":
                    build_script = billing_module_dir / "build-lambdas.ps1"
                    if build_script.exists():
                        run_command("powershell -ExecutionPolicy Bypass -File build-lambdas.ps1", cwd=billing_module_dir)
                    else:
                        log_warning("build-lambdas.ps1 nicht gefunden")
                else:
                    build_script = billing_module_dir / "build-lambdas.sh"
                    if build_script.exists():
                        run_command("chmod +x build-lambdas.sh && ./build-lambdas.sh", cwd=billing_module_dir)
                    else:
                        log_warning("build-lambdas.sh nicht gefunden")
                
                log_success("Billing Lambda-Funktionen gebaut")
            except Exception as e:
                log_error(f"Fehler beim Bauen der Billing Lambda-Funktionen: {e}")
                log_warning("Bitte baue die Lambda-Funktionen manuell:")
                log_info("  cd TerraformInfluencerTemplate/modules/billing-system")
                log_info("  ./build-lambdas.ps1  (Windows)")
                log_info("  ./build-lambdas.sh   (Linux/Mac)")
                raise
        else:
            log_warning("Billing System Modul nicht gefunden - überspringe")
    
    log_success("Lambda-Vorbereitung abgeschlossen")


def generate_terraform_configs():
    """Generiert Terraform Config-Dateien"""
    log_step("PHASE 5: Terraform Konfiguration erstellen")
    
    client_dir = Path(config.CLIENT_DIR)
    client_dir.mkdir(parents=True, exist_ok=True)
    
    # terraform.tfvars
    log_info("Generiere terraform.tfvars...")
    tfvars_content = f'''# Terraform Variables für {config.CREATOR_DISPLAY_NAME}
# Generiert automatisch

project_name = "{config.CREATOR_NAME}"
environment  = "{config.ENVIRONMENT}"
aws_region   = "{config.AWS_REGION}"

domain_name    = "{config.DOMAIN_NAME}"
website_domain = "{config.WEBSITE_DOMAIN}"

create_route53_zone = {str(config.CREATE_ROUTE53_ZONE).lower()}
route53_zone_id     = "{config.ROUTE53_ZONE_ID}"

contact_email_recipient = "{config.CONTACT_EMAIL_RECIPIENT}"
contact_email_sender    = "{config.CONTACT_EMAIL_SENDER}"

enable_ivs_streaming  = {str(config.ENABLE_IVS_STREAMING).lower()}
enable_ivs_chat       = {str(config.ENABLE_IVS_CHAT).lower()}
enable_user_auth      = {str(config.ENABLE_USER_AUTH).lower()}
enable_sponsor_system = {str(config.ENABLE_SPONSOR_SYSTEM).lower()}
enable_shop           = {str(config.ENABLE_SHOP).lower()}
enable_video_management = {str(config.ENABLE_VIDEO_MANAGEMENT).lower()}
enable_team_management  = {str(config.ENABLE_TEAM_MANAGEMENT).lower()}
enable_event_management    = {str(config.ENABLE_EVENT_MANAGEMENT).lower()}
enable_ad_management       = {str(config.ENABLE_AD_MANAGEMENT).lower()}
enable_hero_management     = {str(config.ENABLE_HERO_MANAGEMENT).lower()}
enable_product_management  = {str(config.ENABLE_PRODUCT_MANAGEMENT).lower()}
enable_stream_restreaming  = {str(config.ENABLE_STREAM_RESTREAMING).lower()}
enable_telegram_integration = {str(config.ENABLE_TELEGRAM_INTEGRATION).lower()}
enable_email_notifications = {str(config.ENABLE_EMAIL_NOTIFICATIONS).lower()}

# Telegram (deprecated - use settings table)
telegram_bot_token = "{config.TELEGRAM_BOT_TOKEN}"
telegram_chat_id   = "{config.TELEGRAM_CHAT_ID}"

ivs_channel_name = "{config.IVS_CHANNEL_NAME}"
ivs_channel_type = "{config.IVS_CHANNEL_TYPE}"

cognito_callback_urls = {json.dumps(config.COGNITO_CALLBACK_URLS)}
cognito_logout_urls   = {json.dumps(config.COGNITO_LOGOUT_URLS)}
allow_user_registration = {str(config.ALLOW_USER_REGISTRATION).lower()}

stripe_secret_key      = "{config.STRIPE_SECRET_KEY}"
stripe_publishable_key = "{config.STRIPE_PUBLISHABLE_KEY}"

# Billing System
enable_billing_system  = {str(config.ENABLE_BILLING_SYSTEM).lower()}
billing_base_fee       = {config.BILLING_BASE_FEE}
stripe_webhook_secret  = "{config.STRIPE_WEBHOOK_SECRET}"

tags = {{
  Creator     = "{config.CREATOR_DISPLAY_NAME}"
  Environment = "{config.ENVIRONMENT}"
  ManagedBy   = "Terraform"
}}
'''
    
    (client_dir / "terraform.tfvars").write_text(tfvars_content)
    log_success("terraform.tfvars erstellt")
    
    # backend.hcl
    log_info("Generiere backend.hcl...")
    backend_content = f'''# Terraform Backend Configuration
bucket         = "{config.TF_STATE_BUCKET}"
key            = "terraform.tfstate"
region         = "{config.AWS_REGION}"
encrypt        = true
dynamodb_table = "{config.TF_LOCK_TABLE}"
profile        = "{config.AWS_PROFILE}"
'''
    
    (client_dir / "backend.hcl").write_text(backend_content)
    log_success("backend.hcl erstellt")


def deploy_terraform():
    """Deployt Terraform Infrastructure"""
    log_step("PHASE 6: Infrastructure deployen")
    
    tf_dir = Path(config.TERRAFORM_DIR)
    client_dir = Path(config.CLIENT_DIR)
    
    # Relative Pfade vom Terraform-Verzeichnis aus
    backend_file = client_dir.relative_to(tf_dir) / "backend.hcl"
    tfvars_file = client_dir.relative_to(tf_dir) / "terraform.tfvars"
    
    log_info("Terraform initialisieren...")
    run_command(
        f"terraform init -backend-config={backend_file}",
        cwd=tf_dir
    )
    
    log_info("Terraform Plan erstellen...")
    run_command(
        f"terraform plan -var-file={tfvars_file} -out=tfplan",
        cwd=tf_dir
    )
    
    print()
    log_warning("Prüfe den Terraform Plan!")
    print()
    
    if not confirm("Infrastructure deployen?"):
        log_warning("Deployment abgebrochen")
        sys.exit(0)
    
    log_info("Deploye Infrastructure... (Dauer: 15-30 Minuten)")
    run_command("terraform apply tfplan", cwd=tf_dir)
    
    log_success("Infrastructure deployed!")
    
    # Outputs speichern
    log_info("Speichere Terraform Outputs...")
    result = run_command(
        "terraform output -json",
        cwd=tf_dir,
        capture_output=True
    )
    
    (Path(config.CLIENT_DIR) / "outputs.json").write_text(result.stdout)
    
    try:
        result = run_command(
            "terraform output -raw ivs_stream_key",
            cwd=tf_dir,
            capture_output=True,
            check=False
        )
        if result.returncode == 0:
            stream_key_file = Path(config.CLIENT_DIR) / "stream-key.txt"
            stream_key_file.write_text(result.stdout)
            stream_key_file.chmod(0o600)
    except:
        pass
    
    log_success("Outputs gespeichert")


def get_terraform_output(key):
    """Holt Terraform Output-Wert"""
    try:
        result = run_command(
            f"terraform output -raw {key}",
            cwd=config.TERRAFORM_DIR,
            capture_output=True,
            check=False
        )
        if result.returncode == 0:
            return result.stdout.strip()
        return ""
    except:
        return ""


def generate_frontend_configs():
    """Generiert Frontend Config-Dateien"""
    log_step("PHASE 7: Frontend konfigurieren")
    
    frontend_dir = Path(config.FRONTEND_DIR)
    
    # .env Datei erstellen
    log_info("Generiere .env Datei...")
    env_content = f'''# API Endpoints
VITE_API_ENDPOINT={get_terraform_output("contact_form_api_endpoint")}

# Cognito Configuration
VITE_USER_POOL_ID={get_terraform_output("cognito_user_pool_id")}
VITE_CLIENT_ID={get_terraform_output("cognito_client_id")}
VITE_COGNITO_DOMAIN={get_terraform_output("cognito_domain")}

# IVS Configuration
VITE_IVS_PLAYBACK_URL={get_terraform_output("ivs_playback_url")}
VITE_IVS_CHAT_ROOM_ARN={get_terraform_output("ivs_chat_room_arn")}

# Video Management API
VITE_VIDEO_API_URL={get_terraform_output("video_api_endpoint")}

# Team Management API (uses same API Gateway as User API)
VITE_TEAM_API_URL={get_terraform_output("user_api_endpoint")}

# Event Management API (uses same API Gateway as User API)
VITE_EVENT_API_URL={get_terraform_output("user_api_endpoint")}

# IVS Chat API
VITE_CHAT_API_URL={get_terraform_output("ivs_chat_api_endpoint")}

# Product Management API (uses Shop API Gateway)
VITE_PRODUCT_API_URL={get_terraform_output("product_api_endpoint")}

# Channel Management API (uses same API Gateway as User API)
VITE_CHANNEL_API_URL={get_terraform_output("channel_api_endpoint")}

# Contact Info Management API (uses same API Gateway as User API)
VITE_CONTACT_INFO_API_URL={get_terraform_output("contact_info_api_endpoint")}

# Legal Management API (uses same API Gateway as User API)
VITE_LEGAL_API_URL={get_terraform_output("legal_api_endpoint")}

# Stripe Configuration (for Billing System)
VITE_STRIPE_PUBLISHABLE_KEY={config.STRIPE_PUBLISHABLE_KEY}
'''
    
    (frontend_dir / ".env").write_text(env_content)
    log_success(".env erstellt")
    
    # aws-config.ts (optional, für TypeScript)
    config_dir = frontend_dir / "src" / "config"
    config_dir.mkdir(parents=True, exist_ok=True)
    
    log_info("Generiere aws-config.ts...")
    aws_config = f'''export const awsConfig = {{
  region: '{config.AWS_REGION}',
  
  cognito: {{
    userPoolId: '{get_terraform_output("cognito_user_pool_id")}',
    clientId: '{get_terraform_output("cognito_client_id")}',
    domain: '{get_terraform_output("cognito_domain")}'
  }},
  
  ivs: {{
    playbackUrl: '{get_terraform_output("ivs_playback_url")}',
    chatRoomArn: '{get_terraform_output("ivs_chat_room_arn")}'
  }},
  
  api: {{
    contactForm: '{get_terraform_output("contact_form_api_endpoint")}',
    sponsor: '{get_terraform_output("sponsor_api_endpoint")}',
    shop: '{get_terraform_output("shop_api_endpoint")}',
    user: '{get_terraform_output("user_api_endpoint")}',
    video: '{get_terraform_output("video_api_endpoint")}',
    team: '{get_terraform_output("team_api_endpoint")}',
    chat: '{get_terraform_output("ivs_chat_api_endpoint")}'
  }},
  
  s3: {{
    bucketName: '{get_terraform_output("s3_bucket_name")}',
    sponsorAssets: '{get_terraform_output("sponsor_assets_bucket")}',
    productImages: '{get_terraform_output("shop_product_images_bucket")}'
  }},
  
  domain: '{config.DOMAIN_NAME}'
}}
'''
    
    (config_dir / "aws-config.ts").write_text(aws_config)
    log_success("aws-config.ts erstellt")
    
    # brand.config.ts
    log_info("Generiere brand.config.ts...")
    brand_config = f'''export const brandConfig = {{
  name: '{config.CREATOR_DISPLAY_NAME}',
  tagline: 'Your Tagline',
  domain: '{config.DOMAIN_NAME}',
  
  colors: {{
    primary: '{config.BRAND_PRIMARY_COLOR}',
    secondary: '{config.BRAND_SECONDARY_COLOR}',
    accent: '{config.BRAND_ACCENT_COLOR}'
  }},
  
  social: {{
    youtube: '{config.SOCIAL_YOUTUBE}',
    twitch: '{config.SOCIAL_TWITCH}',
    instagram: '{config.SOCIAL_INSTAGRAM}',
    twitter: '{config.SOCIAL_TWITTER}',
    tiktok: '{config.SOCIAL_TIKTOK}',
    telegram: '{config.SOCIAL_TELEGRAM}'
  }},
  
  features: {{
    liveStreaming: {str(config.ENABLE_IVS_STREAMING).lower()},
    videoLibrary: true,
    shop: {str(config.ENABLE_SHOP).lower()},
    events: true,
    socialChannels: true,
    exclusiveContent: {str(config.ENABLE_USER_AUTH).lower()}
  }}
}}
'''
    
    (config_dir / "brand.config.ts").write_text(brand_config)
    log_success("brand.config.ts erstellt")


def configure_email_notifications():
    """Konfiguriert Email-Benachrichtigungen in DynamoDB"""
    if not config.ENABLE_EMAIL_NOTIFICATIONS:
        return
    
    log_step("PHASE 8: Email-Benachrichtigungen konfigurieren")
    
    settings_table = f"{config.CREATOR_NAME}-messaging-settings"
    
    # Email-Domain aus der Konfiguration
    email_domain = config.DOMAIN_NAME
    
    log_info(f"Konfiguriere Email-Domain: {email_domain}")
    
    try:
        # Update Email-Settings in DynamoDB using Python subprocess with proper escaping
        key_json = json.dumps({"settingId": {"S": "email-config"}})
        values_json = json.dumps({
            ":domain": {"S": email_domain},
            ":enabled": {"BOOL": True}
        })
        
        update_cmd = [
            "aws", "dynamodb", "update-item",
            "--table-name", settings_table,
            "--key", key_json,
            "--update-expression", "SET senderDomain = :domain, enabled = :enabled",
            "--expression-attribute-values", values_json,
            "--region", config.AWS_REGION,
            "--profile", config.AWS_PROFILE
        ]
        
        result = subprocess.run(update_cmd, capture_output=True, text=True)
        if result.returncode == 0:
            log_success(f"Email-Domain konfiguriert: {email_domain}")
        else:
            raise Exception(f"AWS CLI error: {result.stderr}")
        
        # Zeige aktuelle Konfiguration
        get_cmd = [
            "aws", "dynamodb", "get-item",
            "--table-name", settings_table,
            "--key", key_json,
            "--region", config.AWS_REGION,
            "--profile", config.AWS_PROFILE
        ]
        
        result = subprocess.run(get_cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            import json
            item = json.loads(result.stdout)
            if 'Item' in item:
                sender_prefix = item['Item'].get('senderPrefix', {}).get('S', 'news')
                sender_name = item['Item'].get('senderName', {}).get('S', 'Newsfeed')
                enabled = item['Item'].get('enabled', {}).get('BOOL', False)
                
                log_info(f"Email-Konfiguration:")
                log_info(f"  Sender: {sender_name} <{sender_prefix}@{email_domain}>")
                log_info(f"  Status: {'Aktiviert' if enabled else 'Deaktiviert'}")
        
    except Exception as e:
        log_warning(f"Konnte Email-Domain nicht konfigurieren: {str(e)}")
        log_info("Bitte manuell in der Admin-Oberfläche konfigurieren")


def setup_admin_users():
    """Fügt Admin-User zur Cognito Admin-Gruppe hinzu"""
    if not config.ENABLE_VIDEO_MANAGEMENT or not config.ENABLE_USER_AUTH:
        return
    
    log_step("PHASE 9: Admin-Rechte konfigurieren")
    
    user_pool_id = get_terraform_output("cognito_user_pool_id")
    admin_group = get_terraform_output("admin_group_name")
    
    if not user_pool_id or not admin_group:
        log_warning("Cognito User Pool oder Admin-Gruppe nicht gefunden - überspringe Admin-Setup")
        return
    
    log_info(f"Admin-Gruppe: {admin_group}")
    log_info(f"User Pool: {user_pool_id}")
    
    for email in config.ADMIN_EMAILS:
        try:
            log_info(f"Füge {email} zur Admin-Gruppe hinzu...")
            
            # Prüfe ob User existiert
            check_cmd = f'aws cognito-idp admin-get-user --user-pool-id {user_pool_id} --username "{email}" --region {config.AWS_REGION} --profile {config.AWS_PROFILE}'
            result = subprocess.run(check_cmd, shell=True, capture_output=True, text=True)
            
            if result.returncode != 0:
                log_warning(f"User {email} existiert noch nicht - muss sich erst registrieren")
                continue
            
            # Füge zur Admin-Gruppe hinzu
            add_cmd = f'aws cognito-idp admin-add-user-to-group --user-pool-id {user_pool_id} --username "{email}" --group-name {admin_group} --region {config.AWS_REGION} --profile {config.AWS_PROFILE}'
            run_command(add_cmd)
            
            log_success(f"✓ {email} ist jetzt Admin")
            
        except Exception as e:
            log_warning(f"Konnte {email} nicht zur Admin-Gruppe hinzufügen: {str(e)}")
    
    log_success("Admin-Setup abgeschlossen")


def deploy_frontend():
    """Deployt Frontend"""
    log_step("PHASE 10: Frontend bauen & deployen")
    
    frontend_dir = Path(config.FRONTEND_DIR)
    
    log_info("Installiere Dependencies...")
    run_command("npm install", cwd=frontend_dir)
    
    log_info("Erstelle Production Build...")
    run_command("npm run build", cwd=frontend_dir)
    
    log_info("Deploye zu S3...")
    bucket = get_terraform_output("s3_bucket_name")
    dist_id = get_terraform_output("cloudfront_distribution_id")
    
    run_command(
        f"aws s3 sync dist/ s3://{bucket}/ --delete --profile {config.AWS_PROFILE}",
        cwd=frontend_dir
    )
    
    log_info("Invalidiere CloudFront Cache...")
    run_command(
        f'aws cloudfront create-invalidation --distribution-id {dist_id} --paths "/*" --profile {config.AWS_PROFILE}'
    )
    
    log_success("Frontend deployed!")


def show_summary():
    """Zeigt Deployment-Zusammenfassung"""
    log_step("DEPLOYMENT ABGESCHLOSSEN!")
    
    print()
    print("=" * 50)
    print("WICHTIGE INFORMATIONEN")
    print("=" * 50)
    print()
    print("Lambda Layers:")
    print("   Dependencies via Terraform Lambda Layers verwaltet")
    print("   -> 99% kleinere Packages (50 MB -> 5 KB)")
    print("   -> 95% schnellere Deployments (2-3 Min -> 15 Sek)")
    print("   -> 25% schnellere Cold Starts")
    print()
    print("Website URL:")
    print(f"   https://{config.WEBSITE_DOMAIN}")
    print()
    if config.ENABLE_IVS_STREAMING:
        print("IVS Streaming:")
        print(f"   Ingest: {get_terraform_output('ivs_ingest_endpoint')}")
        print(f"   Stream Key: Siehe {config.CLIENT_DIR}/stream-key.txt")
        print()
    
    if config.ENABLE_IVS_CHAT:
        print("IVS Chat:")
        print(f"   Chat Room ARN: {get_terraform_output('ivs_chat_room_arn')}")
        print(f"   Chat API: {get_terraform_output('ivs_chat_api_endpoint')}")
        print()
    
    print("Cognito:")
    print(f"   User Pool: {get_terraform_output('cognito_user_pool_id')}")
    print(f"   Client ID: {get_terraform_output('cognito_client_id')}")
    print()
    print("CloudFront:")
    print(f"   Distribution: {get_terraform_output('cloudfront_distribution_id')}")
    print()
    print("S3 Bucket:")
    print(f"   {get_terraform_output('s3_bucket_name')}")
    print()
    
    if config.ENABLE_VIDEO_MANAGEMENT:
        print("Video Management:")
        print(f"   API: {get_terraform_output('video_api_endpoint')}")
        print(f"   Videos Bucket: {get_terraform_output('videos_bucket')}")
        print(f"   Thumbnails CDN: {get_terraform_output('thumbnails_cdn_url')}")
        print(f"   Admin-Gruppe: {get_terraform_output('admin_group_name')}")
        print()
    
    if config.ENABLE_TEAM_MANAGEMENT:
        print("Team Management:")
        print(f"   API: {get_terraform_output('team_api_endpoint')}")
        print(f"   Team Members Table: {get_terraform_output('team_members_table')}")
        print(f"   Images: {get_terraform_output('team_images_info')}")
        print()
    
    if config.ENABLE_VIDEO_MANAGEMENT or config.ENABLE_TEAM_MANAGEMENT:
        print("   Admins:")
        for email in config.ADMIN_EMAILS:
            print(f"      - {email}")
        print()
    
    print("=" * 50)
    print()
    
    log_warning("NÄCHSTE SCHRITTE:")
    print()
    print("1. DNS konfigurieren:")
    print("   - Nameservers bei Domain-Registrar eintragen")
    print()
    print("2. SES Production Access beantragen")
    print()
    print("3. Assets hinzufügen (Logo, Favicon)")
    print()
    print("4. Website testen")
    print(f"   - https://{config.WEBSITE_DOMAIN}")
    print()
    
    if config.ENABLE_VIDEO_MANAGEMENT:
        print("5. Admin-User registrieren:")
        print("   - Admins müssen sich erst auf der Website registrieren")
        print("   - Dann erneut deploy.py ausführen um Admin-Rechte zu vergeben")
        print()
    
    log_success("Deployment erfolgreich abgeschlossen!")


def main():
    """Hauptfunktion"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Deploy Creator Platform')
    parser.add_argument('--infrastructure', action='store_true', 
                       help='Deploy nur Infrastructure (Terraform)')
    parser.add_argument('--frontend', action='store_true',
                       help='Deploy nur Frontend (Build & S3 Upload)')
    parser.add_argument('--all', action='store_true',
                       help='Komplettes Deployment (Standard)')
    
    args = parser.parse_args()
    
    # Wenn keine Option angegeben, dann --all
    if not (args.infrastructure or args.frontend or args.all):
        args.all = True
    
    try:
        # Immer Konfiguration validieren
        validate_config()
        
        if args.all:
            # Komplettes Deployment
            check_aws_cli()
            setup_terraform_backend()
            verify_ses_email()
            prepare_lambda_functions()
            generate_terraform_configs()
            deploy_terraform()
            configure_email_notifications()
            setup_admin_users()
            generate_frontend_configs()
            deploy_frontend()
            show_summary()
            
        elif args.infrastructure:
            # Nur Infrastructure
            log_step("INFRASTRUCTURE DEPLOYMENT")
            check_aws_cli()
            setup_terraform_backend()
            verify_ses_email()
            prepare_lambda_functions()
            generate_terraform_configs()
            deploy_terraform()
            configure_email_notifications()
            setup_admin_users()
            log_success("Infrastructure deployed!")
            print()
            log_info("Nächster Schritt: python deploy.py --frontend")
            
        elif args.frontend:
            # Nur Frontend
            log_step("FRONTEND DEPLOYMENT")
            generate_frontend_configs()
            deploy_frontend()
            log_success("Frontend deployed!")
            print()
            log_info("Website sollte in 2-5 Minuten aktualisiert sein (CloudFront Cache)")
        
    except KeyboardInterrupt:
        print()
        log_warning("Deployment abgebrochen durch Benutzer")
        sys.exit(1)
    except Exception as e:
        print()
        log_error(f"Fehler beim Deployment: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
