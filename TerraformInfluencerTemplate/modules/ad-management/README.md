# Advertisement Management Module

Dieses Modul verwaltet ein einzelnes Werbebanner für die Live-Seite.

## Features

- **Single Advertisement**: Verwaltet ein einzelnes Werbebanner
- **Image Upload**: Admins können Werbebilder hochladen (empfohlen: 1920x240px)
- **Optional Link**: Banner kann mit einer URL verlinkt werden
- **Enable/Disable**: Banner kann aktiviert/deaktiviert werden
- **CDN Delivery**: Bilder werden über CloudFront CDN ausgeliefert
- **Admin-Only**: Nur Admins können Banner verwalten

## Architektur

### DynamoDB Table
- **Name**: `{project_name}-advertisements`
- **Primary Key**: `adId` (String)
- **Attributes**:
  - `adId`: Feste ID "live-page-ad"
  - `imageKey`: S3 Key des Bildes
  - `linkUrl`: Optional - URL für Klick auf Banner
  - `enabled`: Boolean - Banner aktiviert/deaktiviert
  - `updatedAt`: Timestamp der letzten Änderung

### Lambda Function
- **Runtime**: Node.js 18.x
- **Handler**: index.handler
- **Timeout**: 30 Sekunden
- **Permissions**:
  - DynamoDB: GetItem, PutItem, UpdateItem, DeleteItem
  - S3: PutObject, GetObject, DeleteObject
  - CloudWatch Logs

### API Endpoints

#### Public Endpoints
- `GET /advertisement` - Aktuelles Banner abrufen

#### Admin Endpoints (JWT Auth erforderlich)
- `PUT /advertisement` - Banner aktualisieren
- `POST /advertisement/upload-url` - Presigned URL für Upload
- `DELETE /advertisement/image` - Banner-Bild löschen

## Frontend Integration

### Service
```typescript
import { advertisementService } from '../services/advertisement.service'

// Banner abrufen (public)
const ad = await advertisementService.getAdvertisement()

// Banner aktualisieren (admin)
await advertisementService.updateAdvertisement({
  imageKey: 'advertisements/123_banner.jpg',
  linkUrl: 'https://example.com',
  enabled: true
}, token)

// Bild hochladen (admin)
const { imageKey, imageUrl } = await advertisementService.uploadImage(file, token)
```

### Komponente
```typescript
import { AdManagement } from '../components/AdManagement'

// In Admin-Bereich
<AdManagement onClose={() => setShowModal(false)} />
```

## Verwendung

### Live-Seite
Das Banner wird automatisch auf der Live-Seite angezeigt:
- Oben und unten auf der Seite
- Admins sehen einen Edit-Button beim Hover
- Klick öffnet das Management-Modal
- Banner ist anklickbar wenn linkUrl gesetzt ist

### Banner hochladen
1. Als Admin auf der Live-Seite einloggen
2. Über Banner hovern und Edit-Button klicken
3. Bild hochladen (empfohlen: 1920x240px)
4. Optional: Link-URL eingeben
5. Banner aktivieren/deaktivieren
6. Speichern

## Terraform Variables

```hcl
variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
}

variable "user_pool_id" {
  description = "Cognito User Pool ID"
  type        = string
}

variable "api_gateway_id" {
  description = "API Gateway ID"
  type        = string
}

variable "api_gateway_execution_arn" {
  description = "API Gateway execution ARN"
  type        = string
}

variable "authorizer_id" {
  description = "API Gateway JWT Authorizer ID"
  type        = string
}

variable "assets_bucket_name" {
  description = "S3 bucket name for storing images"
  type        = string
}

variable "cdn_domain" {
  description = "CloudFront CDN domain"
  type        = string
}
```

## Outputs

```hcl
output "advertisements_table_name" {
  description = "Name of the DynamoDB advertisements table"
  value       = aws_dynamodb_table.advertisements.name
}

output "ad_lambda_function_name" {
  description = "Name of the advertisement Lambda function"
  value       = aws_lambda_function.ad_api.function_name
}
```

## Kosten

- **DynamoDB**: Pay-per-request (sehr gering bei einem einzelnen Banner)
- **Lambda**: Nur bei API-Aufrufen
- **S3**: Speicherung der Bilder (minimal)
- **CloudFront**: Auslieferung über CDN (bereits vorhanden)

Geschätzte monatliche Kosten: < $1

## Sicherheit

- Admin-Endpunkte sind durch JWT-Authentifizierung geschützt
- Nur Mitglieder der "admins" Cognito-Gruppe haben Zugriff
- Presigned URLs für S3-Upload (1 Stunde gültig)
- CORS-Header für Frontend-Zugriff

## Erweiterungsmöglichkeiten

- Mehrere Banner-Positionen (top, bottom, sidebar)
- Zeitgesteuerte Banner (Start-/Enddatum)
- A/B-Testing verschiedener Banner
- Click-Tracking und Analytics
- Banner-Rotation
