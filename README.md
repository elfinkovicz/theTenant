# 🚀 Creator Platform - Deployment System

Automatisiertes Deployment für die Creator Platform (React Frontend + AWS Infrastructure).

---

## Quick Start

```bash
# 1. Konfiguration anpassen
notepad deployment_config.py

# 2. AWS CLI konfigurieren
aws configure --profile dein-creator-name

# 3. Deployment starten
python deploy.py
```

**Fertig!** 🎉

---

## Dateien

| Datei | Beschreibung |
|-------|--------------|
| **deployment_config.py** | Konfiguration (ANPASSEN!) |
| **deploy.py** | Deployment-Script (AUSFÜHREN!) |
| **DEPLOYMENT.md** | Vollständige Dokumentation |
| **.gitignore.deployment** | Gitignore-Einträge für sensible Dateien |

---

## Projekt-Struktur

```
.
├── deployment_config.py          # Konfiguration
├── deploy.py                     # Deployment-Script
├── DEPLOYMENT.md                 # Dokumentation
│
├── TerraformInfluencerTemplate/  # AWS Infrastructure
│   ├── main.tf
│   ├── modules/
│   └── clients/
│       └── creator-name/         # Wird automatisch erstellt
│           ├── terraform.tfvars
│           ├── backend.hcl
│           ├── outputs.json
│           └── stream-key.txt    # GEHEIM!
│
└── honigwabe-react/              # React Frontend
    ├── src/
    │   └── config/
    │       ├── aws-config.ts     # Wird automatisch erstellt
    │       └── brand.config.ts   # Wird automatisch erstellt
    └── dist/                     # Nach Build
```

---

## Voraussetzungen

- Python 3.7+
- Terraform >= 1.5.0
- AWS CLI konfiguriert
- Node.js >= 18.x
- Domain registriert

---

## Konfiguration

Öffne `deployment_config.py` und passe die Werte an:

```python
class DeploymentConfig:
    # Projekt (ANPASSEN!)
    CREATOR_NAME = "kasper"
    CREATOR_DISPLAY_NAME = "Kasper Kast"
    DOMAIN_NAME = "kasper.live"
    WEBSITE_DOMAIN = "kasper.live"
    
    # AWS
    AWS_REGION = "eu-central-1"
    
    # E-Mail (ANPASSEN!)
    CONTACT_EMAIL_SENDER = "noreply@kasper.live"
    CONTACT_EMAIL_RECIPIENT = "contact@kasper.live"
    
    # Features
    ENABLE_IVS_STREAMING = True
    ENABLE_IVS_CHAT = True
    ENABLE_USER_AUTH = True
    ENABLE_SHOP = True
    
    # Social Media
    SOCIAL_YOUTUBE = "https://youtube.com/@kasper"
    SOCIAL_TWITCH = "https://twitch.tv/kasper"
    # ...
```

---

## Deployment

### Erstmaliges Deployment

```bash
# 1. Konfiguration anpassen
notepad deployment_config.py

# 2. AWS CLI konfigurieren
aws configure --profile kasper

# 3. Konfiguration prüfen
python deployment_config.py

# 4. Deployment starten
python deploy.py
```

**Dauer:** 30-45 Minuten

### Frontend Update

```bash
cd honigwabe-react
npm run build

cd ../TerraformInfluencerTemplate
BUCKET=$(terraform output -raw s3_bucket_name)
DIST_ID=$(terraform output -raw cloudfront_distribution_id)

cd ../honigwabe-react
aws s3 sync dist/ s3://$BUCKET/ --delete --profile kasper
aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*" --profile kasper
```

---

## Was wird deployed?

### AWS Infrastructure
- ✅ S3 + CloudFront (Website Hosting)
- ✅ Route53 (DNS) + ACM (SSL)
- ✅ Cognito (User Authentication)
- ✅ IVS (Live-Streaming)
- ✅ DynamoDB (Datenbank)
- ✅ Lambda + API Gateway (Backend)
- ✅ SES (E-Mail)

### React Frontend
- ✅ Whitelabel Creator Platform
- ✅ Live-Streaming Seite
- ✅ Video-Bibliothek
- ✅ Shop/E-Commerce
- ✅ Events
- ✅ Social Media Hub
- ✅ User Authentication

---

## Nach dem Deployment

### 1. DNS konfigurieren
```bash
cd TerraformInfluencerTemplate
terraform output route53_nameservers

# Nameservers bei Domain-Registrar eintragen
```

### 2. Website testen
```
https://deine-domain.com
```

### 3. Streaming testen
```bash
cd TerraformInfluencerTemplate
terraform output ivs_ingest_endpoint
terraform output ivs_stream_key
```

---

## Kosten

- **Erste 30 Tage:** ~$50-100 (hauptsächlich IVS)
- **Danach:** ~$90-300/Monat pro Creator
- **IVS STANDARD:** ~$2/Stunde Streaming
- **IVS BASIC:** ~$1/Stunde Streaming

---

## Sicherheit

### Sensible Dateien (NICHT committen!)

```bash
# Zu .gitignore hinzufügen:
cat .gitignore.deployment >> .gitignore
```

**Wichtig:**
- `deployment-config.py` - Enthält Domain, E-Mails
- `clients/*/terraform.tfvars` - Kann Stripe Keys enthalten
- `clients/*/stream-key.txt` - IVS Stream Key (GEHEIM!)
- `src/config/aws-config.ts` - AWS Endpoints

---

## Troubleshooting

### Konfiguration validieren
```bash
python deployment_config.py
```

### AWS CLI testen
```bash
aws sts get-caller-identity --profile dein-profile
```

### Terraform Fehler
```bash
cd TerraformInfluencerTemplate
terraform validate
terraform state list
```

---

## Dokumentation

- **DEPLOYMENT.md** - Vollständige Deployment-Anleitung
- **TerraformInfluencerTemplate/README.md** - Terraform Infrastructure
- **honigwabe-react/README.md** - React Frontend

---

## Support

Bei Problemen:
1. Prüfe `deployment_config.py`
2. Prüfe AWS CLI: `aws sts get-caller-identity`
3. Siehe **DEPLOYMENT.md** für Details

---

Made with 🍯 by Kiro AI
