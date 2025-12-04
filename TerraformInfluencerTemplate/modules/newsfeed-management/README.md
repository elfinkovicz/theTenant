# Newsfeed Management Module

Dieses Modul stellt ein vollständiges Newsfeed-System bereit, das von Admins kuratiert werden kann.

## Features

- ✅ Admin-kuratierter Newsfeed
- ✅ Bild-Upload (bis 10MB)
- ✅ Video-Upload (bis 100MB)
- ✅ Externe Links zu Webseiten
- ✅ Ort mit Google Maps Integration
- ✅ Dedizierter S3 Bucket für Medien
- ✅ CloudFront CDN für schnelle Auslieferung
- ✅ DynamoDB für Post-Daten
- ✅ Vollständige CRUD-Operationen

## Architektur

### AWS Ressourcen

1. **S3 Bucket** (`{project_name}-newsfeed-media`)
   - Speichert hochgeladene Bilder und Videos
   - Öffentlich lesbar über CloudFront

2. **CloudFront Distribution**
   - CDN für schnelle Medien-Auslieferung
   - HTTPS-Verschlüsselung

3. **DynamoDB Table** (`{project_name}-newsfeed`)
   - Speichert Post-Metadaten
   - GSI für Status-basierte Abfragen

4. **Lambda Function** (`{project_name}-newsfeed-api`)
   - API-Handler für alle Newsfeed-Operationen
   - Node.js 20.x Runtime

5. **API Gateway Routes**
   - `GET /newsfeed` - Liste aller Posts (öffentlich)
   - `GET /newsfeed/{postId}` - Einzelner Post (öffentlich)
   - `POST /newsfeed` - Post erstellen (Admin)
   - `PUT /newsfeed/{postId}` - Post bearbeiten (Admin)
   - `DELETE /newsfeed/{postId}` - Post löschen (Admin)
   - `POST /newsfeed/upload-url` - Presigned URL für Upload (Admin)

## Post-Datenstruktur

```json
{
  "postId": "post_1234567890_abc123",
  "title": "Post-Titel",
  "description": "Post-Beschreibung",
  "imageKey": "newsfeed/images/1234567890_image.jpg",
  "imageUrl": "https://cdn.cloudfront.net/newsfeed/images/1234567890_image.jpg",
  "videoKey": "newsfeed/videos/1234567890_video.mp4",
  "videoUrl": "https://cdn.cloudfront.net/newsfeed/videos/1234567890_video.mp4",
  "externalLink": "https://example.com",
  "location": "Berlin, Deutschland",
  "locationUrl": "https://maps.google.com/?q=Berlin",
  "status": "published",
  "createdAt": "2024-01-01T12:00:00.000Z",
  "updatedAt": "2024-01-01T12:00:00.000Z"
}
```

## Verwendung

### Terraform Integration

```hcl
module "newsfeed_management" {
  source = "./modules/newsfeed-management"

  project_name              = var.project_name
  environment               = var.environment
  user_pool_id              = module.user_auth.user_pool_id
  api_gateway_id            = module.user_auth.api_gateway_id
  api_gateway_execution_arn = module.user_auth.api_gateway_execution_arn
  authorizer_id             = module.user_auth.authorizer_id
}
```

### Frontend Integration

1. **Environment Variable setzen:**
```bash
VITE_NEWSFEED_API_URL=https://your-api-gateway-url.execute-api.eu-central-1.amazonaws.com
```

2. **Service verwenden:**
```typescript
import { newsfeedService } from '@services/newsfeed.service';

// Posts laden
const posts = await newsfeedService.getPosts();

// Post erstellen (Admin)
const post = await newsfeedService.createPost({
  title: 'Neuer Post',
  description: 'Beschreibung',
  imageKey: 'newsfeed/images/...',
  location: 'Berlin',
  locationUrl: 'https://maps.google.com/?q=Berlin'
});
```

## Deployment

1. **Lambda Dependencies installieren:**
```bash
cd modules/newsfeed-management/lambda
npm install
```

2. **Terraform anwenden:**
```bash
terraform init
terraform plan
terraform apply
```

3. **API URL in Frontend konfigurieren:**
```bash
# In honigwabe-react/.env
VITE_NEWSFEED_API_URL=<api_endpoint_from_terraform_output>
```

## Kosten

- **S3**: ~$0.023 pro GB/Monat
- **CloudFront**: ~$0.085 pro GB Transfer
- **DynamoDB**: Pay-per-request (sehr günstig bei niedrigem Traffic)
- **Lambda**: Erste 1M Requests kostenlos, dann $0.20 pro 1M Requests
- **API Gateway**: $1.00 pro Million Requests

Geschätzte monatliche Kosten bei moderatem Traffic: **$5-15**

## Sicherheit

- ✅ Admin-Authentifizierung über Cognito JWT
- ✅ Presigned URLs für sichere Uploads
- ✅ CORS-Konfiguration
- ✅ Öffentlicher Lesezugriff nur auf veröffentlichte Posts
- ✅ Medien-Validierung (Dateityp, Größe)

## Limits

- **Bilder**: Max. 10MB
- **Videos**: Max. 100MB
- **Titel**: Max. 200 Zeichen
- **Beschreibung**: Max. 2000 Zeichen
- **Location**: Max. 200 Zeichen
