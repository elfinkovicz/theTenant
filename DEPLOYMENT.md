# 🚀 Deployment Guide

## Quick Start

### 1. Konfiguration anpassen
```bash
# Öffne deployment_config.py
notepad deployment_config.py

# Wichtigste Werte anpassen:
CREATOR_NAME = "kasper"
DOMAIN_NAME = "kasper.live"
CONTACT_EMAIL_SENDER = "noreply@kasper.live"
```

### 2. AWS CLI konfigurieren
```bash
aws configure --profile kasper
```

### 3. Deployment starten
```bash
python deploy.py
```

**Fertig!** 🎉

---

## Voraussetzungen

- Python 3.7+
- Terraform >= 1.5.0
- AWS CLI konfiguriert
- Node.js >= 18.x
- Domain registriert

---

## Konfiguration

Alle Einstellungen in `deployment_config.py`:

```python
class DeploymentConfig:
    # Projekt
    CREATOR_NAME = "creator-name"              # ← ANPASSEN!
    CREATOR_DISPLAY_NAME = "Creator Name"      # ← ANPASSEN!
    DOMAIN_NAME = "creator.com"                # ← ANPASSEN!
    
    # AWS
    AWS_REGION = "eu-central-1"
    
    # E-Mail
    CONTACT_EMAIL_SENDER = "noreply@creator.com"  # ← ANPASSEN!
    
    # Features
    ENABLE_IVS_STREAMING = True
    ENABLE_SHOP = True
    # ...
```

---

## Was wird deployed?

### AWS Infrastructure (Terraform)
- S3 + CloudFront (Website Hosting)
- Route53 (DNS) + ACM (SSL)
- Cognito (User Auth)
- IVS (Live-Streaming)
- DynamoDB (Datenbank)
- Lambda + API Gateway (Backend)

### React Frontend
- Whitelabel Creator Platform
- Live-Streaming
- Video-Bibliothek
- Shop/E-Commerce
- Events & Social Media Hub

---

## Deployment-Ablauf

```
1. Konfiguration validieren
   ↓
2. AWS CLI prüfen
   ↓
3. Terraform Backend erstellen (S3 + DynamoDB)
   ↓
4. SES E-Mail verifizieren
   ↓
5. Terraform Configs generieren
   ↓
6. Infrastructure deployen (15-30 Min)
   ↓
7. Frontend Configs generieren
   ↓
8. Frontend bauen & deployen
   ↓
9. Fertig! 🎉
```

---

## Nach dem Deployment

### DNS konfigurieren
```bash
# Nameservers abrufen
cd TerraformInfluencerTemplate
terraform output route53_nameservers

# Bei Domain-Registrar eintragen
```

### Website testen
```
https://deine-domain.com
```

### Streaming testen
```bash
# IVS Credentials
cd TerraformInfluencerTemplate
terraform output ivs_ingest_endpoint
terraform output ivs_stream_key
```

---

## Frontend Update

```bash
cd honigwabe-react
npm run build

# S3 Bucket & CloudFront ID aus Terraform
cd ../TerraformInfluencerTemplate
BUCKET=$(terraform output -raw s3_bucket_name)
DIST_ID=$(terraform output -raw cloudfront_distribution_id)

# Deploy
cd ../honigwabe-react
aws s3 sync dist/ s3://$BUCKET/ --delete --profile dein-profile
aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*" --profile dein-profile
```

---

## Mehrere Creator deployen

```bash
# Creator 1
# In deployment-config.py:
CREATOR_NAME = "kasper"
DOMAIN_NAME = "kasper.live"

python deploy.py

# Creator 2
# In deployment-config.py:
CREATOR_NAME = "max"
DOMAIN_NAME = "max.com"

python deploy.py
```

---

## Troubleshooting

### Konfiguration prüfen
```bash
python deployment_config.py
```

### AWS CLI testen
```bash
aws sts get-caller-identity --profile dein-profile
```

### Terraform State locked
```bash
# In deployment-config.py TF_LOCK_TABLE prüfen
aws dynamodb delete-item \
  --table-name creator-name-terraform-locks \
  --key '{"LockID":{"S":"creator-name-terraform-state/terraform.tfstate"}}' \
  --profile dein-profile
```

---

## Kosten

- **Erste 30 Tage:** ~$50-100
- **Danach:** ~$90-300/Monat
- **IVS STANDARD:** ~$2/Stunde
- **IVS BASIC:** ~$1/Stunde

---

## Dateien

```
deployment-config.py    # Konfiguration (ANPASSEN!)
deploy.py              # Deployment-Script (AUSFÜHREN!)
DEPLOYMENT.md          # Diese Datei

TerraformInfluencerTemplate/
└── clients/
    └── creator-name/
        ├── terraform.tfvars    # Generiert
        ├── backend.hcl         # Generiert
        ├── outputs.json        # Generiert
        └── stream-key.txt      # Generiert (GEHEIM!)

honigwabe-react/
└── src/config/
    ├── aws-config.ts          # Generiert
    └── brand.config.ts        # Generiert
```

---

## Support

Bei Problemen:
- Prüfe `deployment-config.py`
- Prüfe AWS CLI: `aws sts get-caller-identity`
- Prüfe Terraform: `terraform validate`

---

Made with 🍯 by Kiro AI
