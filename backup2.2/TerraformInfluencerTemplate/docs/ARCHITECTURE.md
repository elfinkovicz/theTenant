# 🏗️ Architektur-Dokumentation

## White-Label IaaS+SaaS Plattform für Content Creator

### **Geschäftsmodell**

Dieses Template ermöglicht es, vollständig isolierte Plattformen für Content Creator auszurollen. Jeder Creator erhält:

- ✅ **100% isolierte Infrastruktur** (eigener AWS Account)
- ✅ **Eigenes Frontend** (S3 + CloudFront + Custom Domain)
- ✅ **Eigenes Backend** (Lambda, DynamoDB, Cognito, etc.)
- ✅ **Vollständige Datenhoheit** (keine geteilten Ressourcen)
- ✅ **Rechtliche Unabhängigkeit** (Creator hostet selbst)

**Du als Dienstleister:**
- 🔧 Entwickelst und wartest das Template
- 🚀 Rollst neue Creator-Instanzen aus
- 🔄 Führst Updates und Customizations durch
- 📊 Bietest Support und Monitoring

---

## 🎯 **Architektur-Prinzip**

```
┌─────────────────────────────────────────────────────────────┐
│                    DEIN UNTERNEHMEN                         │
│                  (Dienstleister/Agentur)                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  TERRAFORM TEMPLATE REPOSITORY (Private)            │   │
│  │  - Versioniert (Git)                                │   │
│  │  - Modular aufgebaut                                │   │
│  │  - Creator-agnostisch                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Deployment via Terraform
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ AWS Account 1 │   │ AWS Account 2 │   │ AWS Account N │
│  (Creator 1)  │   │  (Creator 2)  │   │  (Creator N)  │
├───────────────┤   ├───────────────┤   ├───────────────┤
│               │   │               │   │               │
│ Frontend (S3) │   │ Frontend (S3) │   │ Frontend (S3) │
│ CloudFront    │   │ CloudFront    │   │ CloudFront    │
│ Route53       │   │ Route53       │   │ Route53       │
│               │   │               │   │               │
│ Backend:      │   │ Backend:      │   │ Backend:      │
│ - Cognito     │   │ - Cognito     │   │ - Cognito     │
│ - AppSync     │   │ - AppSync     │   │ - AppSync     │
│ - DynamoDB    │   │ - DynamoDB    │   │ - DynamoDB    │
│ - Lambda      │   │ - Lambda      │   │ - Lambda      │
│ - IVS         │   │ - IVS         │   │ - IVS         │
│               │   │               │   │               │
│ Domain:       │   │ Domain:       │   │ Domain:       │
│ creator1.com  │   │ creator2.com  │   │ creatorN.com  │
│               │   │               │   │               │
└───────────────┘   └───────────────┘   └───────────────┘
     100%               100%               100%
   ISOLIERT           ISOLIERT           ISOLIERT
```

---

## 📦 **Module-Übersicht**

### **Core Infrastructure**

| Modul | Beschreibung | AWS Services |
|-------|--------------|--------------|
| `s3-website` | Static Website Hosting | S3, CloudFront, Route53, ACM |
| `user-auth` | User Authentication | Cognito, DynamoDB, Lambda, API Gateway |
| `monitoring` | Monitoring & Alerting | CloudWatch, SNS, CloudWatch Alarms |
| `backup` | Backup & Disaster Recovery | AWS Backup, S3 Lifecycle |

### **Content & Communication**

| Modul | Beschreibung | AWS Services |
|-------|--------------|--------------|
| `ivs-streaming` | Live-Streaming | IVS, S3 (Recordings) |
| `ivs-chat` | Live-Chat | IVS Chat, Lambda, API Gateway |
| `contact-form` | Kontaktformular | Lambda, SES, API Gateway |
| `newsletter` | Newsletter-System | SES, DynamoDB, Lambda |

### **E-Commerce & Monetization**

| Modul | Beschreibung | AWS Services |
|-------|--------------|--------------|
| `sponsor-system` | Sponsor-Buchungen | DynamoDB, Lambda, API Gateway, S3 |
| `shop` | E-Commerce Shop | DynamoDB, Lambda, API Gateway, Stripe |
| `membership` | Mitgliedschaften | Cognito, DynamoDB, Lambda, Stripe |
| `donations` | Spenden-System | Lambda, Stripe, DynamoDB |

### **Content Management**

| Modul | Beschreibung | AWS Services |
|-------|--------------|--------------|
| `events` | Event-Management | DynamoDB, Lambda, API Gateway |
| `polls` | Umfragen-System | DynamoDB, Lambda, API Gateway |
| `analytics` | Analytics & Tracking | CloudWatch, Kinesis, S3 |

---

## 🔐 **Sicherheits-Architektur**

### **Account-Isolation**

```
Creator Account 1          Creator Account 2
├─ IAM Roles              ├─ IAM Roles
├─ VPC (optional)         ├─ VPC (optional)
├─ Security Groups        ├─ Security Groups
├─ KMS Keys               ├─ KMS Keys
└─ CloudTrail Logs        └─ CloudTrail Logs

❌ KEINE Cross-Account Zugriffe
❌ KEINE geteilten Ressourcen
❌ KEINE gemeinsamen Datenbanken
```

### **Daten-Isolation**

- **DynamoDB**: Separate Tables pro Creator
- **S3**: Separate Buckets pro Creator
- **Cognito**: Separate User Pools pro Creator
- **Lambda**: Separate Functions pro Creator

### **Zugriffskontrolle**

```
Dienstleister (Du)
├─ AWS Organizations (Master Account)
│  ├─ Creator Account 1 (Member)
│  ├─ Creator Account 2 (Member)
│  └─ Creator Account N (Member)
│
└─ IAM Role: OrganizationAccountAccessRole
   └─ Erlaubt Deployment via Terraform
```

---

## 🌐 **Netzwerk-Architektur**

### **Frontend (CDN)**

```
User Request
    │
    ▼
CloudFront (Global CDN)
    │
    ├─ Edge Location (Frankfurt)
    ├─ Edge Location (London)
    └─ Edge Location (New York)
    │
    ▼
S3 Bucket (Origin)
    │
    └─ Static Files (HTML, CSS, JS, Images)
```

### **Backend (API)**

```
User Request
    │
    ▼
API Gateway (HTTPS)
    │
    ├─ /auth/*      → Lambda (Cognito)
    ├─ /chat/*      → Lambda (IVS Chat)
    ├─ /sponsor/*   → Lambda (Sponsor System)
    ├─ /shop/*      → Lambda (E-Commerce)
    └─ /events/*    → Lambda (Events)
    │
    ▼
DynamoDB / Cognito / IVS
```

### **Streaming (IVS)**

```
Creator (OBS/Streaming Software)
    │
    ▼
IVS Ingest Endpoint (RTMPS)
    │
    ▼
IVS Channel (Transcoding)
    │
    ├─ 1080p
    ├─ 720p
    └─ 480p
    │
    ▼
IVS Playback URL (HLS)
    │
    ▼
CloudFront (CDN)
    │
    ▼
Viewer (Browser/App)
```

---

## 💾 **Datenbank-Schema**

### **DynamoDB Tables**

#### **Users Table**
```
PK: userId (String)
Attributes:
- email (String) - GSI
- username (String) - GSI
- role (String) - member|admin
- createdAt (String)
- lastLogin (String)
- subscription (String) - free|premium
```

#### **Messages Table (Chat)**
```
PK: streamId (String)
SK: timestamp (Number)
Attributes:
- messageId (String)
- userId (String)
- username (String)
- message (String)
- deleted (Boolean)
```

#### **Sponsors Table**
```
PK: sponsorId (String)
Attributes:
- creatorId (String) - GSI
- company (String)
- slot (String) - top|bottom|left|right
- startDate (String)
- endDate (String)
- imageUrl (String)
- targetUrl (String)
- views (Number)
- clicks (Number)
- status (String) - pending|active|expired
```

#### **Shop Orders Table**
```
PK: orderId (String)
SK: userId (String)
Attributes:
- items (List)
- totalAmount (Number)
- status (String) - pending|paid|shipped|completed
- createdAt (String)
- stripePaymentId (String)
```

#### **Events Table**
```
PK: eventId (String)
Attributes:
- title (String)
- description (String)
- date (String)
- location (String)
- ticketsAvailable (Number)
- ticketsSold (Number)
- price (Number)
```

---

## 🔄 **Deployment-Flow**

### **Initial Deployment (Neuer Creator)**

```bash
1. AWS Account erstellen
   └─ aws organizations create-account

2. Terraform Backend konfigurieren
   └─ scripts/setup/configure-terraform.sh

3. Creator-Config erstellen
   └─ clients/creator-name/terraform.tfvars

4. Infrastructure deployen
   └─ scripts/deployment/deploy-infrastructure.sh

5. Frontend customizen
   └─ frontend/customizations/creator-name/

6. Frontend bauen & deployen
   └─ scripts/deployment/deploy-frontend.sh

7. DNS konfigurieren
   └─ Route53 Nameservers beim Domain-Registrar eintragen

8. Testen & Go-Live
   └─ scripts/monitoring/health-check.sh
```

### **Update Deployment (Bestehender Creator)**

```bash
1. Template-Updates pullen
   └─ git pull origin main

2. Terraform Plan prüfen
   └─ terraform plan -var-file="clients/creator/terraform.tfvars"

3. Backup erstellen
   └─ scripts/maintenance/backup-data.sh

4. Updates deployen
   └─ terraform apply -var-file="clients/creator/terraform.tfvars"

5. Frontend neu bauen
   └─ scripts/deployment/deploy-frontend.sh

6. Smoke Tests
   └─ scripts/monitoring/health-check.sh
```

---

## 📊 **Kosten-Kalkulation**

### **Pro Creator/Monat (Durchschnitt)**

| Service | Kosten | Skalierung |
|---------|--------|-----------|
| **Frontend** |
| S3 (Website) | $1-3 | Linear mit Traffic |
| CloudFront | $5-20 | Linear mit Traffic |
| Route53 | $0.50 | Fixed |
| ACM (SSL) | $0 | Free |
| **Backend** |
| Lambda | $5-15 | Pay-per-request |
| API Gateway | $3-10 | Pay-per-request |
| DynamoDB | $10-50 | Pay-per-request |
| Cognito | $0-5 | 50k Users free |
| **Streaming** |
| IVS (BASIC) | $50-150 | Per Stream-Hour |
| IVS Chat | $5-20 | Pay-per-message |
| S3 (Recordings) | $5-15 | Linear mit Aufnahmen |
| **Monitoring** |
| CloudWatch | $5-10 | Linear mit Logs |
| SNS | $1-2 | Pay-per-notification |
| **TOTAL** | **$90-300** | |

**Mit 10 Creatorn: $900-3.000/Monat**

### **Kosten-Optimierung**

- ✅ IVS BASIC statt STANDARD (-60%)
- ✅ CloudFront PriceClass_100 (nur EU/US)
- ✅ DynamoDB On-Demand (keine Reserved Capacity)
- ✅ S3 Lifecycle (Auto-Delete alter Recordings)
- ✅ Lambda ARM64 (20% günstiger)

---

## 🚀 **Skalierungs-Strategie**

### **Horizontal Scaling**

```
1 Creator  → $100/Monat
10 Creator → $1.000/Monat (Linear)
100 Creator → $10.000/Monat (Linear)
```

**Keine Shared Resources = Perfekte lineare Skalierung**

### **Vertical Scaling (Pro Creator)**

```
Kleine Creator (< 1.000 Viewer)
├─ IVS BASIC
├─ DynamoDB On-Demand
└─ Lambda 128MB
Cost: ~$90/Monat

Mittlere Creator (1.000-10.000 Viewer)
├─ IVS STANDARD
├─ DynamoDB On-Demand
└─ Lambda 256MB
Cost: ~$200/Monat

Große Creator (> 10.000 Viewer)
├─ IVS STANDARD + Multi-Bitrate
├─ DynamoDB Provisioned
└─ Lambda 512MB + Reserved Concurrency
Cost: ~$500/Monat
```

---

## 🔧 **Wartung & Support**

### **Monitoring**

- ✅ CloudWatch Dashboards pro Creator
- ✅ Alarms für kritische Metriken
- ✅ SNS Notifications bei Problemen
- ✅ Automatische Health Checks

### **Backup-Strategie**

- ✅ DynamoDB Point-in-Time Recovery (35 Tage)
- ✅ S3 Versioning für Website-Content
- ✅ IVS Recordings in S3 (30 Tage Retention)
- ✅ Terraform State in S3 mit Versioning

### **Disaster Recovery**

- ✅ RTO (Recovery Time Objective): < 1 Stunde
- ✅ RPO (Recovery Point Objective): < 5 Minuten
- ✅ Multi-Region Backup (optional)
- ✅ Automated Restore Scripts

---

## 📝 **Compliance & Rechtliches**

### **DSGVO-Konformität**

- ✅ Daten-Residenz in EU (eu-central-1)
- ✅ Verschlüsselung at-rest (KMS)
- ✅ Verschlüsselung in-transit (TLS 1.2+)
- ✅ Recht auf Löschung (Lambda Functions)
- ✅ Datenexport (DynamoDB Export)

### **Verantwortlichkeiten**

**Creator (Kunde):**
- Inhaltliche Verantwortung
- Rechtliche Compliance
- Domain-Verwaltung
- AWS Account Owner

**Dienstleister (Du):**
- Technische Implementierung
- Wartung & Updates
- Support & Monitoring
- Template-Entwicklung

---

## 🎯 **Best Practices**

### **Terraform**

- ✅ Module für Wiederverwendbarkeit
- ✅ Remote State in S3 + DynamoDB Lock
- ✅ Separate Workspaces pro Creator
- ✅ Versionierte Module (Git Tags)

### **Security**

- ✅ Least Privilege IAM Policies
- ✅ MFA für AWS Console
- ✅ CloudTrail für Audit Logs
- ✅ Secrets in AWS Secrets Manager

### **Operations**

- ✅ Infrastructure as Code (Terraform)
- ✅ Automated Deployments (Scripts)
- ✅ Monitoring & Alerting (CloudWatch)
- ✅ Documentation (Markdown)

---

Made with 🍯 by Kiro AI
