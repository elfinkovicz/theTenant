# Deployment Automation - Vollautomatisches Template

## 🎯 Übersicht

Das gesamte Deployment ist vollautomatisch! Ein einziger Befehl deployt die komplette Infrastructure und das Frontend.

## 🚀 Deployment

### Vollständiges Deployment

```bash
python deploy.py
```

Das Script führt automatisch aus:

1. **Phase 1: AWS Setup prüfen**
   - Validiert AWS CLI Konfiguration
   - Prüft Credentials

2. **Phase 2: Terraform Backend erstellen**
   - Erstellt S3 Bucket für State
   - Erstellt DynamoDB Table für Locking
   - Konfiguriert Encryption & Versioning

3. **Phase 3: AWS Services vorbereiten**
   - Verifiziert SES E-Mail-Adresse

4. **Phase 4: Lambda-Funktionen vorbereiten** ✨ NEU
   - Installiert automatisch npm Dependencies für:
     - IVS Chat Lambda (@aws-sdk/client-ivschat)
     - Shop Lambda (stripe)
   - Erstellt package.json wenn nicht vorhanden

5. **Phase 5: Terraform Konfiguration erstellen**
   - Generiert terraform.tfvars
   - Generiert backend.hcl

6. **Phase 6: Infrastructure deployen**
   - Terraform init, plan, apply
   - Speichert Outputs

7. **Phase 7: Frontend konfigurieren** ✨ AUTOMATISCH
   - Generiert .env mit allen API-Endpoints
   - Generiert aws-config.ts mit:
     - Cognito Config
     - IVS Playback & Chat URLs
     - Alle API-Endpoints (inkl. Chat API) ✨
     - S3 Bucket Namen
   - Generiert brand.config.ts

8. **Phase 8: Admin-Rechte konfigurieren**
   - Fügt Admin-User zu Cognito-Gruppe hinzu

9. **Phase 9: Frontend bauen & deployen**
   - npm install
   - npm run build
   - Upload zu S3
   - CloudFront Cache Invalidierung

### Teilweises Deployment

```bash
# Nur Infrastructure
python deploy.py --infrastructure

# Nur Frontend
python deploy.py --frontend
```

## 📋 Was wird automatisch konfiguriert

### Lambda-Funktionen
- ✅ IVS Chat Token Lambda
  - Automatische Installation von @aws-sdk/client-ivschat
  - package.json wird erstellt falls nicht vorhanden
- ✅ Shop Lambda
  - Automatische Installation von stripe SDK
- ✅ Alle anderen Lambdas (keine Dependencies nötig)

### Frontend-Konfiguration
Alle Dateien werden automatisch generiert:

#### `.env`
```env
VITE_API_ENDPOINT=...
VITE_USER_POOL_ID=...
VITE_CLIENT_ID=...
VITE_COGNITO_DOMAIN=...
VITE_IVS_PLAYBACK_URL=...
VITE_IVS_CHAT_ROOM_ARN=...
VITE_CHAT_API_URL=...  # ✨ NEU - Chat Token API
VITE_VIDEO_API_URL=...
VITE_TEAM_API_URL=...
VITE_EVENT_API_URL=...
```

#### `src/config/aws-config.ts`
```typescript
export const awsConfig = {
  region: 'eu-central-1',
  cognito: { ... },
  ivs: {
    playbackUrl: '...',
    chatRoomArn: '...'
  },
  api: {
    contactForm: '...',
    sponsor: '...',
    shop: '...',
    user: '...',
    video: '...',
    team: '...',
    chat: '...'  // ✨ NEU - Automatisch konfiguriert
  },
  s3: { ... }
}
```

#### `src/config/brand.config.ts`
```typescript
export const brandConfig = {
  name: '...',
  colors: { ... },
  social: { ... },
  features: { ... }
}
```

## 🔧 Konfiguration

Alle Einstellungen in `deployment_config.py`:

```python
class DeploymentConfig:
    # Projekt
    CREATOR_NAME = "honigwabe"
    CREATOR_DISPLAY_NAME = "Honigwabe"
    
    # AWS
    AWS_REGION = "eu-central-1"
    AWS_PROFILE = "default"
    
    # Features
    ENABLE_IVS_STREAMING = True
    ENABLE_IVS_CHAT = True  # ✨ Chat aktivieren
    ENABLE_USER_AUTH = True
    ENABLE_VIDEO_MANAGEMENT = True
    ENABLE_TEAM_MANAGEMENT = True
    ENABLE_EVENT_MANAGEMENT = True
    
    # ... weitere Einstellungen
```

## 📦 Neue Features

### IVS Chat Integration
- ✅ Lambda Dependencies werden automatisch installiert
- ✅ Chat API URL wird automatisch konfiguriert
- ✅ Frontend erhält korrekte Endpoints
- ✅ Keine manuellen Schritte erforderlich

### Lambda Preparation Script
`TerraformInfluencerTemplate/scripts/prepare_lambdas.py`:
- Installiert npm Dependencies für alle Lambdas
- Erstellt package.json wenn nicht vorhanden
- Kann auch standalone ausgeführt werden

## 🎨 Template-Struktur

```
TerraformInfluencerTemplate/
├── modules/
│   ├── ivs-chat/
│   │   ├── lambda/
│   │   │   ├── index.js
│   │   │   └── package.json  # ✨ Wird automatisch erstellt
│   │   └── main.tf
│   └── ...
├── scripts/
│   └── prepare_lambdas.py  # ✨ NEU - Lambda Vorbereitung
├── clients/
│   └── {creator-name}/
│       ├── terraform.tfvars  # Generiert
│       ├── backend.hcl       # Generiert
│       ├── outputs.json      # Generiert
│       └── stream-key.txt    # Generiert
└── ...

honigwabe-react/
├── src/
│   └── config/
│       ├── aws-config.ts     # ✨ Automatisch generiert
│       └── brand.config.ts   # ✨ Automatisch generiert
├── .env                      # ✨ Automatisch generiert
└── ...
```

## ✅ Vorteile

1. **Keine manuellen Schritte**
   - Alles wird automatisch konfiguriert
   - Keine Endpoints manuell eintragen
   - Keine Dependencies manuell installieren

2. **Fehlerresistent**
   - Validierung vor Deployment
   - Automatische Fehlerbehandlung
   - Klare Fehlermeldungen

3. **Wiederholbar**
   - Gleicher Prozess für jeden Creator
   - Konsistente Konfiguration
   - Versionskontrolle möglich

4. **Wartbar**
   - Zentrale Konfiguration
   - Einfache Updates
   - Dokumentierter Prozess

## 🔄 Updates

### Frontend Update
```bash
python deploy.py --frontend
```

### Infrastructure Update
```bash
python deploy.py --infrastructure
```

### Komplettes Re-Deployment
```bash
python deploy.py
```

## 📝 Logs & Debugging

- Terraform State: `clients/{creator}/outputs.json`
- Stream Key: `clients/{creator}/stream-key.txt`
- Frontend Config: `honigwabe-react/.env`
- Lambda Logs: CloudWatch (automatisch erstellt)

## 🎉 Zusammenfassung

Das Template ist jetzt **vollständig automatisiert**:
- ✅ Lambda Dependencies
- ✅ Terraform Konfiguration
- ✅ Frontend Konfiguration
- ✅ API Endpoints
- ✅ Chat Integration
- ✅ Deployment

**Ein Befehl deployt alles!** 🚀
