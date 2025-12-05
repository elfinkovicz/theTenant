# 🚀 Setup-Guide

## Vollständige Anleitung für die Ersteinrichtung

### **Voraussetzungen**

- ✅ AWS Account (pro Creator)
- ✅ Terraform >= 1.5.0
- ✅ AWS CLI konfiguriert
- ✅ Domain registriert
- ✅ Git installiert
- ✅ Node.js >= 18.x (für Frontend-Build)

---

## 📋 **Schritt-für-Schritt Anleitung**

### **Phase 1: AWS Account Setup**

#### **1.1 AWS Account erstellen**

**Option A: Neuer Standalone Account**
```bash
# Über AWS Console
1. Gehe zu https://aws.amazon.com
2. Klicke "Create an AWS Account"
3. Folge dem Wizard
4. Verifiziere E-Mail und Telefon
5. Füge Zahlungsmethode hinzu
```

**Option B: AWS Organizations (Empfohlen für mehrere Creator)**
```bash
# Master Account erstellen
1. Erstelle Master Account
2. Aktiviere AWS Organizations
3. Erstelle Member Account pro Creator

# Via AWS CLI
aws organizations create-account \
  --email creator@example.com \
  --account-name "Creator Name" \
  --role-name OrganizationAccountAccessRole
```

#### **1.2 IAM User für Terraform erstellen**

```bash
# IAM User erstellen
aws iam create-user --user-name terraform-deployer

# Policy anhängen (AdministratorAccess für Setup)
aws iam attach-user-policy \
  --user-name terraform-deployer \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

# Access Keys erstellen
aws iam create-access-key --user-name terraform-deployer

# Output speichern:
# AccessKeyId: AKIA...
# SecretAccessKey: ...
```

#### **1.3 AWS CLI konfigurieren**

```bash
# AWS Profile erstellen
aws configure --profile creator-name

# Eingaben:
AWS Access Key ID: AKIA...
AWS Secret Access Key: ...
Default region name: eu-central-1
Default output format: json

# Testen
aws sts get-caller-identity --profile creator-name
```

---

### **Phase 2: Repository Setup**

#### **2.1 Template klonen**

```bash
# Repository klonen
git clone https://github.com/your-org/TerraformInfluencerTemplate.git
cd TerraformInfluencerTemplate

# Neues Projekt-Repository erstellen
git remote rename origin template
git remote add origin https://github.com/your-org/creator-project.git
```

#### **2.2 Client-Verzeichnis erstellen**

```bash
# Client-Ordner erstellen
mkdir -p clients/creator-name

# Config-Datei erstellen
cp config/project.tfvars.example clients/creator-name/terraform.tfvars
```

#### **2.3 Terraform Variables konfigurieren**

```bash
# clients/creator-name/terraform.tfvars
project_name = "creator-name"
environment  = "production"
aws_region   = "eu-central-1"

# Domain Configuration
domain_name    = "creator.com"
website_domain = "creator.com"

# Route53
create_route53_zone = true  # oder false wenn Zone existiert
route53_zone_id     = ""    # wenn create_route53_zone = false

# Contact Form
contact_email_recipient = "contact@creator.com"
contact_email_sender    = "noreply@creator.com"

# Features aktivieren/deaktivieren
enable_ivs_streaming   = true
enable_ivs_chat        = true
enable_user_auth       = true
enable_sponsor_system  = true
enable_shop            = true

# IVS Configuration
ivs_channel_name = "main-channel"
ivs_channel_type = "STANDARD"  # oder "BASIC" für günstigeres Streaming

# Cognito Configuration
cognito_callback_urls = [
  "https://creator.com/callback",
  "https://www.creator.com/callback"
]
cognito_logout_urls = [
  "https://creator.com/logout",
  "https://www.creator.com/logout"
]
allow_user_registration = true

# Stripe Configuration (optional)
stripe_secret_key      = "sk_live_..."
stripe_publishable_key = "pk_live_..."

# Tags
tags = {
  Creator     = "Creator Name"
  Environment = "production"
  CostCenter  = "creator-name"
}
```

---

### **Phase 3: AWS Services vorbereiten**

#### **3.1 SES E-Mail verifizieren**

```bash
# E-Mail-Adresse verifizieren
aws ses verify-email-identity \
  --email-address noreply@creator.com \
  --profile creator-name

# Bestätigungs-E-Mail checken und Link klicken

# Status prüfen
aws ses get-identity-verification-attributes \
  --identities noreply@creator.com \
  --profile creator-name

# Domain verifizieren (optional, für bessere Deliverability)
aws ses verify-domain-identity \
  --domain creator.com \
  --profile creator-name
```

#### **3.2 SES Sandbox verlassen (für Production)**

```bash
# SES Production Access beantragen
1. Gehe zu AWS Console → SES
2. Klicke "Request Production Access"
3. Fülle Formular aus:
   - Use Case: "Transactional emails for website"
   - Website URL: https://creator.com
   - Expected sending volume: 1000/day
4. Warte auf Approval (24-48h)
```

#### **3.3 Route53 Zone erstellen (falls nicht vorhanden)**

```bash
# Hosted Zone erstellen
aws route53 create-hosted-zone \
  --name creator.com \
  --caller-reference $(date +%s) \
  --profile creator-name

# Nameservers notieren
aws route53 list-hosted-zones --profile creator-name

# Output:
# ns-123.awsdns-12.com
# ns-456.awsdns-45.net
# ns-789.awsdns-78.org
# ns-012.awsdns-01.co.uk
```

#### **3.4 Domain-Nameservers aktualisieren**

```bash
# Bei Domain-Registrar (z.B. Namecheap, GoDaddy):
1. Gehe zu Domain-Verwaltung
2. Ändere Nameservers auf AWS Route53 Nameservers
3. Warte auf Propagierung (bis zu 48h)

# DNS-Propagierung prüfen
dig creator.com NS
nslookup creator.com
```

---

### **Phase 4: Terraform Backend Setup**

#### **4.1 S3 Bucket für Terraform State**

```bash
# S3 Bucket erstellen
aws s3 mb s3://creator-name-terraform-state \
  --region eu-central-1 \
  --profile creator-name

# Versioning aktivieren
aws s3api put-bucket-versioning \
  --bucket creator-name-terraform-state \
  --versioning-configuration Status=Enabled \
  --profile creator-name

# Encryption aktivieren
aws s3api put-bucket-encryption \
  --bucket creator-name-terraform-state \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }' \
  --profile creator-name

# Public Access blockieren
aws s3api put-public-access-block \
  --bucket creator-name-terraform-state \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
  --profile creator-name
```

#### **4.2 DynamoDB Table für State Locking**

```bash
# DynamoDB Table erstellen
aws dynamodb create-table \
  --table-name creator-name-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region eu-central-1 \
  --profile creator-name
```

#### **4.3 Backend-Konfiguration erstellen**

```bash
# clients/creator-name/backend.tf
terraform {
  backend "s3" {
    bucket         = "creator-name-terraform-state"
    key            = "terraform.tfstate"
    region         = "eu-central-1"
    encrypt        = true
    dynamodb_table = "creator-name-terraform-locks"
    profile        = "creator-name"
  }
}
```

---

### **Phase 5: Terraform Deployment**

#### **5.1 Terraform initialisieren**

```bash
# In Projekt-Root
cd TerraformInfluencerTemplate

# Terraform initialisieren
terraform init \
  -backend-config="clients/creator-name/backend.tf" \
  -var-file="clients/creator-name/terraform.tfvars"

# Output:
# Terraform has been successfully initialized!
```

#### **5.2 Terraform Plan prüfen**

```bash
# Plan erstellen
terraform plan \
  -var-file="clients/creator-name/terraform.tfvars" \
  -out=tfplan

# Plan prüfen
# Erwartete Ressourcen:
# - S3 Bucket (Website)
# - CloudFront Distribution
# - Route53 Records
# - ACM Certificate
# - Cognito User Pool
# - DynamoDB Tables
# - Lambda Functions
# - API Gateways
# - IVS Channel
# - etc.
```

#### **5.3 Terraform Apply**

```bash
# Infrastructure deployen
terraform apply tfplan

# Oder direkt:
terraform apply \
  -var-file="clients/creator-name/terraform.tfvars" \
  -auto-approve

# Dauer: 15-30 Minuten
# (CloudFront Distribution dauert am längsten)
```

#### **5.4 Outputs speichern**

```bash
# Alle Outputs anzeigen
terraform output

# Wichtige Outputs speichern
terraform output -json > clients/creator-name/outputs.json

# Sensitive Outputs (z.B. IVS Stream Key)
terraform output -raw ivs_stream_key > clients/creator-name/stream-key.txt
chmod 600 clients/creator-name/stream-key.txt
```

---

### **Phase 6: Frontend Setup**

#### **6.1 Frontend Customization erstellen**

```bash
# Customization-Ordner erstellen
mkdir -p frontend/customizations/creator-name

# Config erstellen
cat > frontend/customizations/creator-name/config.json << EOF
{
  "creator": {
    "name": "Creator Name",
    "slug": "creator-name",
    "domain": "creator.com"
  },
  "aws": {
    "region": "eu-central-1",
    "cognito": {
      "userPoolId": "$(terraform output -raw cognito_user_pool_id)",
      "clientId": "$(terraform output -raw cognito_client_id)",
      "authDomain": "$(terraform output -raw cognito_auth_domain)"
    },
    "appsync": {
      "endpoint": "$(terraform output -raw appsync_endpoint)"
    },
    "api": {
      "sponsorEndpoint": "$(terraform output -raw sponsor_api_endpoint)",
      "shopEndpoint": "$(terraform output -raw shop_api_endpoint)"
    }
  },
  "branding": {
    "colors": {
      "primary": "#FFC400",
      "secondary": "#FFB700",
      "accent": "#FF8A00"
    },
    "logo": "/assets/logo.png",
    "favicon": "/assets/favicon.ico"
  },
  "social": {
    "youtube": "https://youtube.com/@creator",
    "twitch": "https://twitch.tv/creator",
    "twitter": "https://twitter.com/creator",
    "telegram": "https://t.me/creator"
  },
  "features": {
    "chat": true,
    "sponsor": true,
    "shop": true,
    "events": true
  }
}
EOF
```

#### **6.2 Assets hinzufügen**

```bash
# Assets-Ordner erstellen
mkdir -p frontend/customizations/creator-name/assets

# Logo, Favicon, etc. kopieren
cp /path/to/logo.png frontend/customizations/creator-name/assets/
cp /path/to/favicon.ico frontend/customizations/creator-name/assets/
```

#### **6.3 Frontend bauen**

```bash
# In Frontend-Verzeichnis
cd frontend/template

# Dependencies installieren
npm install

# Frontend bauen
npm run build -- --creator=creator-name

# Output: dist/creator-name/
```

#### **6.4 Frontend deployen**

```bash
# S3 Bucket Name abrufen
BUCKET=$(terraform output -raw s3_bucket_name)

# Zu S3 hochladen
aws s3 sync dist/creator-name/ s3://$BUCKET/ \
  --delete \
  --profile creator-name

# CloudFront Cache invalidieren
DIST_ID=$(terraform output -raw cloudfront_distribution_id)
aws cloudfront create-invalidation \
  --distribution-id $DIST_ID \
  --paths "/*" \
  --profile creator-name
```

---

### **Phase 7: Testen & Verifizieren**

#### **7.1 Website testen**

```bash
# Website öffnen
open https://creator.com

# Checklist:
# ✅ Website lädt
# ✅ SSL-Zertifikat gültig
# ✅ Alle Seiten erreichbar
# ✅ Login/Registrierung funktioniert
# ✅ Live-Stream-Seite lädt
# ✅ Chat funktioniert
# ✅ Shop lädt
```

#### **7.2 Backend-APIs testen**

```bash
# Sponsor API
curl https://$(terraform output -raw sponsor_api_endpoint)/sponsors/active

# Shop API
curl https://$(terraform output -raw shop_api_endpoint)/products

# User API
curl https://$(terraform output -raw user_api_endpoint)/health
```

#### **7.3 Streaming testen**

```bash
# IVS Ingest Endpoint
terraform output -raw ivs_ingest_endpoint

# Stream Key
terraform output -raw ivs_stream_key

# In OBS/Streaming-Software:
# Server: rtmps://...ingest.ivs.amazonaws.com:443/app/
# Stream Key: sk_eu-central-1_...
```

---

### **Phase 8: Monitoring Setup**

#### **8.1 CloudWatch Dashboard erstellen**

```bash
# Dashboard wird automatisch von Terraform erstellt
# URL: https://console.aws.amazon.com/cloudwatch/home?region=eu-central-1#dashboards:
```

#### **8.2 Alarms konfigurieren**

```bash
# SNS Topic für Alarms
aws sns create-topic \
  --name creator-name-alarms \
  --profile creator-name

# E-Mail-Subscription
aws sns subscribe \
  --topic-arn arn:aws:sns:eu-central-1:ACCOUNT_ID:creator-name-alarms \
  --protocol email \
  --notification-endpoint admin@creator.com \
  --profile creator-name

# Bestätigungs-E-Mail checken
```

---

### **Phase 9: Backup & Disaster Recovery**

#### **9.1 DynamoDB Backups aktivieren**

```bash
# Point-in-Time Recovery aktivieren
aws dynamodb update-continuous-backups \
  --table-name creator-name-users \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
  --profile creator-name

# Für alle Tables wiederholen
```

#### **9.2 S3 Versioning aktivieren**

```bash
# Bereits aktiviert für Terraform State
# Für Website-Bucket:
aws s3api put-bucket-versioning \
  --bucket $(terraform output -raw s3_bucket_name) \
  --versioning-configuration Status=Enabled \
  --profile creator-name
```

---

### **Phase 10: Dokumentation**

#### **10.1 Deployment-Historie**

```bash
# Deployment-Log erstellen
cat > clients/creator-name/deployment-history.log << EOF
# Deployment History

## Initial Deployment
- Date: $(date)
- Terraform Version: $(terraform version | head -n1)
- Deployed by: $(whoami)
- Status: Success

### Resources Created:
$(terraform state list | wc -l) resources

### Outputs:
- Website URL: https://creator.com
- CloudFront Distribution: $(terraform output -raw cloudfront_distribution_id)
- Cognito User Pool: $(terraform output -raw cognito_user_pool_id)
EOF
```

#### **10.2 Credentials sicher speichern**

```bash
# AWS Credentials verschlüsseln
gpg --encrypt --recipient admin@your-company.com \
  clients/creator-name/stream-key.txt

# Oder in AWS Secrets Manager
aws secretsmanager create-secret \
  --name creator-name/ivs-stream-key \
  --secret-string "$(terraform output -raw ivs_stream_key)" \
  --profile creator-name
```

---

## ✅ **Setup abgeschlossen!**

### **Nächste Schritte:**

1. ✅ Creator-Zugang einrichten
2. ✅ Content hochladen
3. ✅ Streaming testen
4. ✅ Go-Live!

### **Support:**

- 📧 E-Mail: support@your-company.com
- 📱 Telegram: @YourSupport
- 📚 Docs: https://docs.your-company.com

---

Made with 🍯 by Kiro AI
