# Team Management Module

Dieses Modul ermöglicht die Verwaltung von Team-Mitgliedern mit Profilbildern und Social-Media-Links.

## Features

- ✅ Team-Mitglieder erstellen, bearbeiten und löschen (nur Admins)
- ✅ Profilbilder hochladen (S3 + CloudFront CDN)
- ✅ Social-Media-Links verwalten (Twitter, Instagram, YouTube, Twitch, TikTok, LinkedIn, Facebook, Discord)
- ✅ Reihenfolge der Team-Mitglieder festlegen
- ✅ Öffentliche API zum Abrufen der Team-Mitglieder
- ✅ Admin-Authentifizierung über Cognito

## Architektur

```
┌─────────────┐
│   React     │
│  Frontend   │
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌──────────────┐
│ API Gateway │────▶│   Lambda     │
│   (HTTP)    │     │  (Node.js)   │
└─────────────┘     └──────┬───────┘
                           │
                    ┌──────┴───────┐
                    ▼              ▼
              ┌──────────┐   ┌─────────┐
              │ DynamoDB │   │   S3    │
              │  Table   │   │ Bucket  │
              └──────────┘   └────┬────┘
                                  │
                                  ▼
                            ┌──────────┐
                            │CloudFront│
                            │   CDN    │
                            └──────────┘
```

## Ressourcen

### DynamoDB Table
- **Name**: `{project_name}-team-members`
- **Primary Key**: `memberId` (String)
- **GSI**: `OrderIndex` auf `order` (Number)
- **Attribute**:
  - `memberId`: Eindeutige ID
  - `name`: Name des Team-Mitglieds
  - `role`: Rolle/Position
  - `bio`: Beschreibung
  - `imageKey`: S3 Key für Profilbild
  - `socials`: Object mit Social-Media-Links
  - `order`: Sortierreihenfolge
  - `createdAt`: Erstellungsdatum
  - `updatedAt`: Aktualisierungsdatum

### S3 Bucket
- **Name**: `{project_name}-team-images`
- **Zweck**: Speicherung von Profilbildern
- **CDN**: CloudFront Distribution

### Lambda Function
- **Name**: `{project_name}-team-api`
- **Runtime**: Node.js 18.x
- **Timeout**: 30 Sekunden

### API Gateway
- **Type**: HTTP API
- **CORS**: Aktiviert für alle Origins
- **Routes**:
  - `GET /team` - Liste aller Team-Mitglieder (öffentlich)
  - `POST /team` - Neues Team-Mitglied erstellen (Admin)
  - `PUT /team/{memberId}` - Team-Mitglied aktualisieren (Admin)
  - `DELETE /team/{memberId}` - Team-Mitglied löschen (Admin)
  - `POST /team/upload-url` - Presigned URL für Bild-Upload (Admin)

## Verwendung

### Terraform

```hcl
module "team_management" {
  source = "./modules/team-management"

  project_name          = var.project_name
  environment           = var.environment
  cognito_user_pool_id  = module.auth.user_pool_id
}
```

### Frontend

1. **Environment Variable setzen**:
```bash
VITE_TEAM_API_URL=https://your-api.execute-api.region.amazonaws.com
```

2. **Team-Mitglieder abrufen**:
```typescript
import { teamService } from './services/team.service';

const members = await teamService.getTeamMembers();
```

3. **Team-Mitglied erstellen (Admin)**:
```typescript
await teamService.createTeamMember({
  name: 'Max Mustermann',
  role: 'Founder & Streamer',
  bio: 'Leidenschaftlicher Gamer',
  socials: {
    twitter: 'https://twitter.com/max',
    youtube: 'https://youtube.com/@max'
  },
  order: 1
});
```

## Lambda Dependencies

Die Lambda-Function benötigt folgende NPM-Pakete:

```bash
cd TerraformInfluencerTemplate/modules/team-management/lambda
npm install
```

Packages:
- `@aws-sdk/client-dynamodb`
- `@aws-sdk/lib-dynamodb`
- `@aws-sdk/client-s3`
- `@aws-sdk/s3-request-presigner`
- `aws-jwt-verify`

## Deployment

1. Lambda Dependencies installieren:
```bash
cd TerraformInfluencerTemplate/modules/team-management/lambda
npm install
cd ../../..
```

2. Terraform anwenden:
```bash
terraform init
terraform plan
terraform apply
```

3. API-Endpoint in Frontend konfigurieren:
```bash
# In honigwabe-react/.env
VITE_TEAM_API_URL=<api_endpoint aus terraform output>
```

## Kosten

- **DynamoDB**: Pay-per-request (sehr günstig bei wenigen Team-Mitgliedern)
- **S3**: ~$0.023 pro GB/Monat
- **CloudFront**: Erste 1 TB/Monat: $0.085 pro GB
- **Lambda**: Erste 1M Requests kostenlos
- **API Gateway**: Erste 1M Requests: $1.00

Geschätzte monatliche Kosten bei 10 Team-Mitgliedern und 10.000 Seitenaufrufen: **< $1**

## Sicherheit

- ✅ Admin-Operationen erfordern Cognito JWT Token
- ✅ Token-Validierung in Lambda
- ✅ Cognito Groups Check (nur "admins" Gruppe)
- ✅ S3 Bucket nicht öffentlich (nur über CloudFront)
- ✅ Presigned URLs für sichere Uploads
- ✅ CORS konfiguriert

## Limits

- **Profilbild**: Max. 5 MB
- **Name**: Max. 100 Zeichen
- **Rolle**: Max. 100 Zeichen
- **Bio**: Max. 300 Zeichen
- **Social Links**: Unbegrenzt

## Troubleshooting

### "Admin access required"
- Stelle sicher, dass der User in der "admins" Cognito-Gruppe ist
- Prüfe, ob der JWT Token korrekt im Authorization Header gesendet wird

### Bilder werden nicht angezeigt
- Prüfe CloudFront Distribution Status (muss "Deployed" sein)
- Warte bis zu 15 Minuten nach Deployment
- Prüfe S3 Bucket Policy und CloudFront OAI

### Lambda Timeout
- Erhöhe Timeout in `main.tf` (aktuell 30 Sekunden)
- Prüfe DynamoDB und S3 Permissions
