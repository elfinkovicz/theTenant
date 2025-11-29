# 🚀 Quick Start Guide

## In 10 Minuten zum ersten Creator!

### **Voraussetzungen**
- ✅ AWS Account
- ✅ AWS CLI installiert & konfiguriert
- ✅ Terraform >= 1.5.0 installiert
- ✅ Domain registriert

---

## 📋 **Schritt-für-Schritt**

### **1. Repository klonen**
```bash
git clone https://github.com/your-org/TerraformInfluencerTemplate.git
cd TerraformInfluencerTemplate
```

### **2. Neuen Creator hinzufügen**
```bash
# Windows (PowerShell)
bash scripts/utils/add-creator.sh kasper "Kasper Kast" kasper.live

# Linux/Mac
./scripts/utils/add-creator.sh kasper "Kasper Kast" kasper.live
```

**Output:**
```
✅ Creator setup completed successfully!

Next steps:
1. Create AWS Account for Kasper Kast
2. Configure AWS CLI profile: aws configure --profile kasper
3. Edit configuration: clients/kasper/terraform.tfvars
...
```

### **3. AWS CLI konfigurieren**
```bash
aws configure --profile kasper

# Eingaben:
AWS Access Key ID: AKIA...
AWS Secret Access Key: ...
Default region name: eu-central-1
Default output format: json
```

### **4. Terraform Backend erstellen**
```bash
# S3 Bucket für Terraform State
aws s3 mb s3://kasper-terraform-state --region eu-central-1 --profile kasper

# DynamoDB für State Locking
aws dynamodb create-table \
  --table-name kasper-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region eu-central-1 \
  --profile kasper
```

### **5. SES E-Mail verifizieren**
```bash
aws ses verify-email-identity \
  --email-address noreply@kasper.live \
  --region eu-central-1 \
  --profile kasper

# Bestätigungs-E-Mail checken und Link klicken
```

### **6. Terraform Variables anpassen**
```bash
# Datei öffnen
notepad clients/kasper/terraform.tfvars

# Wichtige Werte prüfen/anpassen:
# - project_name
# - domain_name
# - contact_email_recipient
# - contact_email_sender
# - stripe_secret_key (optional)
```

### **7. Infrastructure deployen**
```bash
# Windows (PowerShell)
bash scripts/deployment/deploy-infrastructure.sh kasper

# Linux/Mac
./scripts/deployment/deploy-infrastructure.sh kasper
```

**Dauer: 15-30 Minuten** (CloudFront Distribution dauert am längsten)

### **8. DNS konfigurieren**
```bash
# Nameservers abrufen
terraform output route53_nameservers

# Output:
# [
#   "ns-123.awsdns-12.com",
#   "ns-456.awsdns-45.net",
#   "ns-789.awsdns-78.org",
#   "ns-012.awsdns-01.co.uk"
# ]

# Bei Domain-Registrar (z.B. Namecheap, GoDaddy):
# 1. Gehe zu Domain-Verwaltung
# 2. Ändere Nameservers auf AWS Route53 Nameservers
# 3. Warte auf Propagierung (bis zu 48h, meist < 1h)
```

### **9. Frontend Assets hinzufügen**
```bash
# Logo & Favicon kopieren
cp /path/to/logo.png frontend/customizations/kasper/assets/
cp /path/to/favicon.ico frontend/customizations/kasper/assets/

# Optional: Weitere Assets
cp /path/to/hero-image.jpg frontend/customizations/kasper/assets/
```

### **10. Frontend deployen**
```bash
# Windows (PowerShell)
bash scripts/deployment/deploy-frontend.sh kasper

# Linux/Mac
./scripts/deployment/deploy-frontend.sh kasper
```

---

## ✅ **Fertig!**

### **Website testen:**
```bash
# Website öffnen
open https://kasper.live

# Oder manuell:
# https://kasper.live
```

### **Wichtige URLs:**

| Service | URL |
|---------|-----|
| Website | https://kasper.live |
| CloudFront | https://d123456.cloudfront.net |
| Cognito | https://kasper-123456.auth.eu-central-1.amazoncognito.com |
| Sponsor API | https://abc123.execute-api.eu-central-1.amazonaws.com |
| Shop API | https://def456.execute-api.eu-central-1.amazonaws.com |

### **Streaming Setup:**

```bash
# IVS Ingest Endpoint
terraform output -raw ivs_ingest_endpoint

# Stream Key (GEHEIM!)
terraform output -raw ivs_stream_key

# In OBS/Streaming-Software:
# Server: rtmps://...ingest.ivs.amazonaws.com:443/app/
# Stream Key: sk_eu-central-1_...
```

---

## 🎯 **Nächste Schritte**

### **Content hinzufügen:**
1. ✅ Produkte im Shop anlegen (DynamoDB)
2. ✅ Events erstellen
3. ✅ Team-Mitglieder hinzufügen
4. ✅ Social Media Links aktualisieren

### **Customization:**
1. ✅ Farben anpassen (`frontend/customizations/kasper/branding.css`)
2. ✅ Texte anpassen (`frontend/customizations/kasper/content.json`)
3. ✅ Features aktivieren/deaktivieren (`clients/kasper/terraform.tfvars`)

### **Testing:**
1. ✅ Registrierung testen
2. ✅ Login testen
3. ✅ Chat testen
4. ✅ Shop testen
5. ✅ Streaming testen

### **Go-Live:**
1. ✅ SES Production Access beantragen
2. ✅ Monitoring einrichten
3. ✅ Backup-Strategie testen
4. ✅ Dokumentation für Creator erstellen

---

## 📚 **Weitere Dokumentation**

- 📖 [Vollständige Setup-Anleitung](docs/SETUP-GUIDE.md)
- 🏗️ [Architektur-Dokumentation](docs/ARCHITECTURE.md)
- 📁 [Projekt-Struktur](docs/PROJECT-STRUCTURE.md)
- 🔧 [Deployment-Guide](docs/DEPLOYMENT-GUIDE.md)
- 📋 [Implementierungs-Zusammenfassung](docs/IMPLEMENTATION-SUMMARY.md)

---

## 💰 **Kosten-Übersicht**

### **Erste 30 Tage (Free Tier):**
- S3: Free (5GB)
- Lambda: Free (1M Requests)
- DynamoDB: Free (25GB)
- CloudFront: Free (50GB)
- **Geschätzt: $50-100** (hauptsächlich IVS)

### **Nach Free Tier:**
- **$90-300/Monat** pro Creator
- Skaliert linear mit Anzahl Creator

---

## 🆘 **Probleme?**

### **Terraform Fehler:**
```bash
# State neu initialisieren
terraform init -reconfigure

# State prüfen
terraform state list

# Einzelne Ressource neu erstellen
terraform taint module.website.aws_s3_bucket.website
terraform apply
```

### **CloudFront dauert lange:**
- Normal! CloudFront Distribution kann 15-30 Minuten dauern
- Status prüfen: AWS Console → CloudFront

### **DNS funktioniert nicht:**
- Nameservers beim Registrar prüfen
- DNS-Propagierung kann bis zu 48h dauern
- Testen: `dig kasper.live NS`

### **SES E-Mails kommen nicht an:**
- E-Mail-Adresse verifiziert?
- SES Sandbox-Modus? (nur verifizierte E-Mails)
- Production Access beantragen

---

## 📞 **Support**

- 📧 E-Mail: support@your-company.com
- 📱 Telegram: @YourSupport
- 📚 Docs: https://docs.your-company.com
- 🐛 Issues: GitHub Issues

---

Made with 🍯 by Kiro AI
