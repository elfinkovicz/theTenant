# 📁 Projekt-Struktur

## Vollständige Verzeichnis-Übersicht

```
TerraformInfluencerTemplate/
│
├── README.md                           # Hauptdokumentation
├── USAGE.md                            # Verwendungsanleitung
├── LICENSE                             # Lizenz
├── .gitignore                          # Git Ignore
│
├── docs/                               # Dokumentation
│   ├── ARCHITECTURE.md                 # Architektur-Dokumentation
│   ├── PROJECT-STRUCTURE.md            # Diese Datei
│   ├── SETUP-GUIDE.md                  # Setup-Anleitung
│   ├── DEPLOYMENT-GUIDE.md             # Deployment-Anleitung
│   ├── CUSTOMIZATION-GUIDE.md          # Customization-Anleitung
│   ├── MAINTENANCE-GUIDE.md            # Wartungs-Anleitung
│   ├── TROUBLESHOOTING.md              # Troubleshooting
│   └── API-REFERENCE.md                # API-Dokumentation
│
├── terraform/                          # Terraform Infrastructure
│   │
│   ├── modules/                        # Wiederverwendbare Module
│   │   │
│   │   ├── s3-website/                 # Frontend Hosting
│   │   │   ├── main.tf
│   │   │   ├── s3.tf
│   │   │   ├── cloudfront.tf
│   │   │   ├── route53.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   │
│   │   ├── user-auth/                  # User Authentication
│   │   │   ├── main.tf
│   │   │   ├── cognito.tf
│   │   │   ├── dynamodb.tf
│   │   │   ├── lambda.tf
│   │   │   ├── api-gateway.tf
│   │   │   ├── variables.tf
│   │   │   ├── outputs.tf
│   │   │   └── lambda/
│   │   │       ├── index.js
│   │   │       └── package.json
│   │   │
│   │   ├── ivs-streaming/              # Live-Streaming
│   │   │   ├── main.tf
│   │   │   ├── ivs.tf
│   │   │   ├── s3-recordings.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   │
│   │   ├── ivs-chat/                   # Live-Chat
│   │   │   ├── main.tf
│   │   │   ├── ivs-chat.tf
│   │   │   ├── lambda.tf
│   │   │   ├── api-gateway.tf
│   │   │   ├── variables.tf
│   │   │   ├── outputs.tf
│   │   │   └── lambda/
│   │   │       ├── token-generator.js
│   │   │       └── message-handler.js
│   │   │
│   │   ├── contact-form/               # Kontaktformular
│   │   │   ├── main.tf
│   │   │   ├── lambda.tf
│   │   │   ├── ses.tf
│   │   │   ├── api-gateway.tf
│   │   │   ├── variables.tf
│   │   │   ├── outputs.tf
│   │   │   └── lambda/
│   │   │       └── contact-handler.js
│   │   │
│   │   ├── sponsor-system/             # Sponsor-Buchungen
│   │   │   ├── main.tf
│   │   │   ├── dynamodb.tf
│   │   │   ├── lambda.tf
│   │   │   ├── api-gateway.tf
│   │   │   ├── s3-assets.tf
│   │   │   ├── variables.tf
│   │   │   ├── outputs.tf
│   │   │   └── lambda/
│   │   │       ├── create-booking.js
│   │   │       ├── approve-booking.js
│   │   │       ├── get-active-sponsors.js
│   │   │       └── track-stats.js
│   │   │
│   │   ├── shop/                       # E-Commerce
│   │   │   ├── main.tf
│   │   │   ├── dynamodb.tf
│   │   │   ├── lambda.tf
│   │   │   ├── api-gateway.tf
│   │   │   ├── stripe-integration.tf
│   │   │   ├── variables.tf
│   │   │   ├── outputs.tf
│   │   │   └── lambda/
│   │   │       ├── create-order.js
│   │   │       ├── process-payment.js
│   │   │       ├── get-products.js
│   │   │       └── webhook-handler.js
│   │   │
│   │   ├── membership/                 # Mitgliedschaften
│   │   │   ├── main.tf
│   │   │   ├── dynamodb.tf
│   │   │   ├── lambda.tf
│   │   │   ├── api-gateway.tf
│   │   │   ├── stripe-integration.tf
│   │   │   ├── variables.tf
│   │   │   ├── outputs.tf
│   │   │   └── lambda/
│   │   │       ├── create-subscription.js
│   │   │       ├── cancel-subscription.js
│   │   │       └── webhook-handler.js
│   │   │
│   │   ├── events/                     # Event-Management
│   │   │   ├── main.tf
│   │   │   ├── dynamodb.tf
│   │   │   ├── lambda.tf
│   │   │   ├── api-gateway.tf
│   │   │   ├── variables.tf
│   │   │   ├── outputs.tf
│   │   │   └── lambda/
│   │   │       ├── create-event.js
│   │   │       ├── get-events.js
│   │   │       └── register-attendee.js
│   │   │
│   │   ├── polls/                      # Umfragen-System
│   │   │   ├── main.tf
│   │   │   ├── dynamodb.tf
│   │   │   ├── lambda.tf
│   │   │   ├── api-gateway.tf
│   │   │   ├── variables.tf
│   │   │   ├── outputs.tf
│   │   │   └── lambda/
│   │   │       ├── create-poll.js
│   │   │       ├── vote.js
│   │   │       └── get-results.js
│   │   │
│   │   ├── newsletter/                 # Newsletter-System
│   │   │   ├── main.tf
│   │   │   ├── dynamodb.tf
│   │   │   ├── lambda.tf
│   │   │   ├── ses.tf
│   │   │   ├── api-gateway.tf
│   │   │   ├── variables.tf
│   │   │   ├── outputs.tf
│   │   │   └── lambda/
│   │   │       ├── subscribe.js
│   │   │       ├── unsubscribe.js
│   │   │       └── send-newsletter.js
│   │   │
│   │   ├── analytics/                  # Analytics & Tracking
│   │   │   ├── main.tf
│   │   │   ├── kinesis.tf
│   │   │   ├── lambda.tf
│   │   │   ├── s3-data-lake.tf
│   │   │   ├── variables.tf
│   │   │   ├── outputs.tf
│   │   │   └── lambda/
│   │   │       └── process-events.js
│   │   │
│   │   ├── monitoring/                 # Monitoring & Alerting
│   │   │   ├── main.tf
│   │   │   ├── cloudwatch.tf
│   │   │   ├── sns.tf
│   │   │   ├── alarms.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   │
│   │   └── backup/                     # Backup & Disaster Recovery
│   │       ├── main.tf
│   │       ├── backup-plan.tf
│   │       ├── s3-lifecycle.tf
│   │       ├── variables.tf
│   │       └── outputs.tf
│   │
│   ├── main.tf                         # Haupt-Terraform-Datei
│   ├── variables.tf                    # Input Variables
│   ├── outputs.tf                      # Outputs
│   ├── backend.tf                      # Terraform State Backend
│   └── provider.tf                     # AWS Provider Config
│
├── frontend/                           # Frontend Template
│   │
│   ├── template/                       # Basis-Template (Creator-agnostisch)
│   │   ├── public/
│   │   │   ├── index.html
│   │   │   ├── live.html
│   │   │   ├── shop.html
│   │   │   ├── events.html
│   │   │   ├── team.html
│   │   │   ├── kontakt.html
│   │   │   ├── login.html
│   │   │   ├── register.html
│   │   │   ├── impressum.html
│   │   │   ├── datenschutz.html
│   │   │   └── error.html
│   │   │
│   │   ├── src/
│   │   │   ├── js/
│   │   │   │   ├── config.template.js  # Wird generiert
│   │   │   │   ├── main.js
│   │   │   │   ├── auth/
│   │   │   │   │   ├── auth.js
│   │   │   │   │   ├── login.js
│   │   │   │   │   └── register.js
│   │   │   │   ├── chat/
│   │   │   │   │   ├── chat.js
│   │   │   │   │   └── websocket.js
│   │   │   │   ├── sponsor/
│   │   │   │   │   ├── sponsor-loader.js
│   │   │   │   │   └── sponsor-booking.js
│   │   │   │   ├── shop/
│   │   │   │   │   ├── shop.js
│   │   │   │   │   ├── cart.js
│   │   │   │   │   └── checkout.js
│   │   │   │   ├── events/
│   │   │   │   │   └── events.js
│   │   │   │   ├── polls/
│   │   │   │   │   └── polls.js
│   │   │   │   └── live/
│   │   │   │       ├── video-player.js
│   │   │   │       ├── ad-manager.js
│   │   │   │       └── stream-manager.js
│   │   │   │
│   │   │   └── css/
│   │   │       ├── styles.css
│   │   │       ├── live.css
│   │   │       ├── shop.css
│   │   │       ├── events.css
│   │   │       ├── auth.css
│   │   │       └── admin.css
│   │   │
│   │   ├── assets/
│   │   │   ├── images/
│   │   │   ├── fonts/
│   │   │   └── icons/
│   │   │
│   │   ├── package.json
│   │   ├── build.js                    # Build-Script
│   │   └── webpack.config.js           # Webpack Config (optional)
│   │
│   └── customizations/                 # Creator-spezifische Anpassungen
│       ├── example-creator/
│       │   ├── config.json             # Creator-Config
│       │   ├── branding.css            # Custom Styles
│       │   ├── assets/
│       │   │   ├── logo.png
│       │   │   ├── favicon.ico
│       │   │   └── hero-image.jpg
│       │   └── content.json            # Custom Content
│       │
│       └── README.md                   # Customization-Anleitung
│
├── scripts/                            # Automation Scripts
│   │
│   ├── setup/
│   │   ├── create-aws-account.sh       # AWS Account Setup
│   │   ├── configure-terraform.sh      # Terraform Backend Setup
│   │   ├── verify-ses-email.sh         # SES E-Mail verifizieren
│   │   └── initial-deployment.sh       # Erste Deployment
│   │
│   ├── deployment/
│   │   ├── deploy-infrastructure.sh    # Terraform Apply
│   │   ├── deploy-frontend.sh          # Frontend Build + S3 Upload
│   │   ├── deploy-lambda.sh            # Lambda Functions deployen
│   │   ├── invalidate-cloudfront.sh    # CloudFront Cache invalidieren
│   │   └── rollback.sh                 # Rollback bei Fehler
│   │
│   ├── maintenance/
│   │   ├── update-creator.sh           # Creator-Updates
│   │   ├── backup-data.sh              # Daten-Backup
│   │   ├── restore-data.sh             # Daten-Restore
│   │   ├── rotate-secrets.sh           # Secrets rotieren
│   │   └── cleanup-old-resources.sh    # Alte Ressourcen löschen
│   │
│   ├── monitoring/
│   │   ├── health-check.sh             # System Health Check
│   │   ├── generate-report.sh          # Status-Report
│   │   └── check-costs.sh              # Kosten-Übersicht
│   │
│   └── utils/
│       ├── add-creator.sh              # Neuen Creator hinzufügen
│       ├── remove-creator.sh           # Creator entfernen
│       └── list-creators.sh            # Alle Creator auflisten
│
├── clients/                            # Client-spezifische Daten
│   ├── example-creator/
│   │   ├── terraform.tfvars            # Terraform Variables
│   │   ├── aws-credentials.enc         # Verschlüsselte Credentials
│   │   ├── deployment-history.log      # Deployment-Historie
│   │   ├── notes.md                    # Client-Notizen
│   │   └── backups/                    # Backup-Verzeichnis
│   │
│   └── README.md                       # Client-Management-Anleitung
│
├── config/                             # Globale Konfiguration
│   ├── project.tfvars.example          # Beispiel-Config
│   ├── terraform-backend.tf.example    # Backend-Config Beispiel
│   └── aws-organizations.json          # AWS Organizations Config
│
├── tests/                              # Tests
│   ├── terraform/
│   │   ├── validate-modules.sh
│   │   └── test-deployment.sh
│   ├── frontend/
│   │   ├── e2e-tests/
│   │   └── unit-tests/
│   └── integration/
│       ├── api-tests/
│       └── load-tests/
│
├── .github/                            # CI/CD (optional)
│   └── workflows/
│       ├── terraform-validate.yml
│       ├── deploy-creator.yml
│       └── run-tests.yml
│
└── website-content/                    # Legacy (wird durch frontend/ ersetzt)
    └── .gitkeep
```

---

## 📦 **Module-Details**

### **Core Infrastructure Modules**

#### **s3-website**
- **Zweck**: Static Website Hosting mit CDN
- **Services**: S3, CloudFront, Route53, ACM
- **Outputs**: bucket_name, cloudfront_distribution_id, website_url

#### **user-auth**
- **Zweck**: User Authentication & Management
- **Services**: Cognito, DynamoDB, Lambda, API Gateway
- **Outputs**: user_pool_id, client_id, api_endpoint

#### **monitoring**
- **Zweck**: Monitoring & Alerting
- **Services**: CloudWatch, SNS, CloudWatch Alarms
- **Outputs**: dashboard_url, alarm_topic_arn

#### **backup**
- **Zweck**: Backup & Disaster Recovery
- **Services**: AWS Backup, S3 Lifecycle
- **Outputs**: backup_vault_arn, recovery_point_arn

---

### **Content & Communication Modules**

#### **ivs-streaming**
- **Zweck**: Live-Streaming
- **Services**: IVS, S3 (Recordings)
- **Outputs**: channel_arn, ingest_endpoint, playback_url, stream_key

#### **ivs-chat**
- **Zweck**: Live-Chat
- **Services**: IVS Chat, Lambda, API Gateway
- **Outputs**: chat_room_arn, api_endpoint

#### **contact-form**
- **Zweck**: Kontaktformular
- **Services**: Lambda, SES, API Gateway
- **Outputs**: api_endpoint

#### **newsletter**
- **Zweck**: Newsletter-System
- **Services**: SES, DynamoDB, Lambda
- **Outputs**: api_endpoint, subscriber_table_name

---

### **E-Commerce & Monetization Modules**

#### **sponsor-system**
- **Zweck**: Sponsor-Buchungen & Tracking
- **Services**: DynamoDB, Lambda, API Gateway, S3
- **Outputs**: api_endpoint, assets_bucket_name

#### **shop**
- **Zweck**: E-Commerce Shop
- **Services**: DynamoDB, Lambda, API Gateway, Stripe
- **Outputs**: api_endpoint, products_table_name

#### **membership**
- **Zweck**: Mitgliedschaften & Subscriptions
- **Services**: Cognito, DynamoDB, Lambda, Stripe
- **Outputs**: api_endpoint, subscription_table_name

#### **donations**
- **Zweck**: Spenden-System
- **Services**: Lambda, Stripe, DynamoDB
- **Outputs**: api_endpoint

---

### **Content Management Modules**

#### **events**
- **Zweck**: Event-Management & Ticketing
- **Services**: DynamoDB, Lambda, API Gateway
- **Outputs**: api_endpoint, events_table_name

#### **polls**
- **Zweck**: Umfragen-System
- **Services**: DynamoDB, Lambda, API Gateway
- **Outputs**: api_endpoint, polls_table_name

#### **analytics**
- **Zweck**: Analytics & Tracking
- **Services**: CloudWatch, Kinesis, S3
- **Outputs**: kinesis_stream_arn, data_lake_bucket

---

## 🔧 **Script-Übersicht**

### **Setup Scripts**

| Script | Beschreibung | Verwendung |
|--------|--------------|------------|
| `create-aws-account.sh` | Erstellt neuen AWS Account | Einmalig pro Creator |
| `configure-terraform.sh` | Konfiguriert Terraform Backend | Einmalig pro Creator |
| `verify-ses-email.sh` | Verifiziert SES E-Mail | Einmalig pro Creator |
| `initial-deployment.sh` | Erste Deployment | Einmalig pro Creator |

### **Deployment Scripts**

| Script | Beschreibung | Verwendung |
|--------|--------------|------------|
| `deploy-infrastructure.sh` | Deployed Terraform | Bei jedem Update |
| `deploy-frontend.sh` | Baut & deployed Frontend | Bei Frontend-Änderungen |
| `deploy-lambda.sh` | Deployed Lambda Functions | Bei Backend-Änderungen |
| `invalidate-cloudfront.sh` | Invalidiert CloudFront Cache | Nach Frontend-Deployment |
| `rollback.sh` | Rollback bei Fehler | Bei Problemen |

### **Maintenance Scripts**

| Script | Beschreibung | Verwendung |
|--------|--------------|------------|
| `update-creator.sh` | Updated Creator-Instanz | Regelmäßig |
| `backup-data.sh` | Erstellt Backup | Täglich (automatisch) |
| `restore-data.sh` | Stellt Backup wieder her | Bei Datenverlust |
| `rotate-secrets.sh` | Rotiert Secrets | Monatlich |
| `cleanup-old-resources.sh` | Löscht alte Ressourcen | Wöchentlich |

### **Monitoring Scripts**

| Script | Beschreibung | Verwendung |
|--------|--------------|------------|
| `health-check.sh` | Prüft System-Health | Stündlich (automatisch) |
| `generate-report.sh` | Erstellt Status-Report | Wöchentlich |
| `check-costs.sh` | Zeigt Kosten-Übersicht | Täglich |

---

## 📝 **Datei-Konventionen**

### **Terraform Files**

- `main.tf` - Hauptressourcen
- `variables.tf` - Input Variables
- `outputs.tf` - Output Values
- `backend.tf` - State Backend Config
- `provider.tf` - Provider Config
- `locals.tf` - Local Values (optional)
- `data.tf` - Data Sources (optional)

### **Lambda Functions**

- `index.js` - Handler Function
- `package.json` - Dependencies
- `README.md` - Function Documentation

### **Frontend Files**

- `*.html` - HTML Templates
- `*.css` - Stylesheets
- `*.js` - JavaScript Files
- `config.json` - Creator Config
- `branding.css` - Custom Styles

---

## 🎯 **Best Practices**

### **Verzeichnis-Organisation**

- ✅ Module sind unabhängig und wiederverwendbar
- ✅ Scripts sind nach Funktion gruppiert
- ✅ Dokumentation ist zentral in `docs/`
- ✅ Client-Daten sind isoliert in `clients/`

### **Naming Conventions**

- ✅ Terraform: `kebab-case` (z.B. `s3-website`)
- ✅ Scripts: `kebab-case.sh` (z.B. `deploy-frontend.sh`)
- ✅ Lambda: `camelCase.js` (z.B. `createBooking.js`)
- ✅ Frontend: `kebab-case.html` (z.B. `sponsor-booking.html`)

### **Versionierung**

- ✅ Git Tags für Module (z.B. `v1.0.0`)
- ✅ Semantic Versioning (MAJOR.MINOR.PATCH)
- ✅ Changelog für jede Version
- ✅ Separate Branches für Features

---

Made with 🍯 by Kiro AI
