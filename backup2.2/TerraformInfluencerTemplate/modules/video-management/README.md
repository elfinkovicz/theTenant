# Video Management Module

Admin Video Management System mit S3 Storage und DynamoDB Metadata.

## Features

- ✅ **Admin-Only Upload**: Nur Admins können Videos hochladen
- ✅ **S3 Storage**: Videos werden privat auf S3 gespeichert
- ✅ **Signed URLs**: Zeitlich begrenzte Video-URLs (1h)
- ✅ **CloudFront CDN**: Thumbnails über CloudFront
- ✅ **DynamoDB Metadata**: Video-Informationen in DynamoDB
- ✅ **CRUD Operations**: Erstellen, Lesen, Aktualisieren, Löschen
- ✅ **Categories & Search**: Kategorien und Suchfunktion
- ✅ **Draft/Published**: Status-Management
- ✅ **View Counter**: Automatische View-Zählung

## Architektur

```
Frontend (React)
    ↓
API Gateway (JWT Auth)
    ↓
Lambda (Video API)
    ↓
├─ DynamoDB (Metadata)
├─ S3 (Videos - Private)
└─ S3 (Thumbnails - Public via CloudFront)
```

## Admin-Rechte

### Admins hinzufügen

**Option 1: Über deployment_config.py**
```python
self.ADMIN_EMAILS = [
    "admin1@example.com",
    "admin2@example.com",
]
```

Dann `python deploy.py` ausführen.

**Option 2: Manuell via AWS CLI**
```bash
# Linux/Mac
./scripts/add-admin.sh admin@example.com

# Windows PowerShell
.\scripts\add-admin.ps1 -Email admin@example.com
```

**Option 3: AWS Console**
1. Cognito → User Pools → honigwabe-user-pool
2. Groups → admins
3. Add user to group

### Admin-Rechte prüfen

```bash
aws cognito-idp admin-list-groups-for-user \
  --user-pool-id <USER_POOL_ID> \
  --username admin@example.com \
  --region eu-central-1 \
  --profile honigwabe
```

## API Endpoints

### Public Endpoints

**GET /videos**
- Liste aller veröffentlichten Videos
- Keine Authentifizierung erforderlich
- Response: `{ videos: Video[] }`

**GET /videos/{videoId}**
- Einzelnes Video abrufen
- Keine Authentifizierung erforderlich
- Inkrementiert View Counter
- Response: `{ video: Video }`

### Admin Endpoints (JWT Required)

**POST /videos/upload-url**
- Generiert Presigned Upload URL
- Body: `{ fileName, contentType, fileType }`
- Response: `{ videoId, uploadUrl, s3Key, thumbnailUploadUrl?, thumbnailKey? }`

**POST /videos**
- Erstellt Video-Metadata
- Body: `{ videoId, title, description?, category?, s3Key, thumbnailKey?, duration?, fileSize?, status? }`
- Response: `{ video: Video }`

**PUT /videos/{videoId}**
- Aktualisiert Video-Metadata
- Body: `{ title?, description?, category?, thumbnailKey?, status? }`
- Response: `{ video: Video }`

**DELETE /videos/{videoId}**
- Löscht Video und Metadata
- Löscht auch S3 Files
- Response: `{ message: string }`

## Video Upload Flow

1. **Admin klickt "Upload"**
2. **Frontend → POST /videos/upload-url**
   - Lambda prüft Admin-Rechte
   - Lambda generiert Presigned URL (15 Min)
3. **Frontend → PUT S3 (Presigned URL)**
   - Direkter Upload zu S3
   - Kein Lambda-Durchlauf
4. **Frontend → POST /videos**
   - Speichert Metadata in DynamoDB
5. **Fertig!**

## DynamoDB Schema

```json
{
  "videoId": "uuid",
  "title": "Mein Gaming Video",
  "description": "Beschreibung...",
  "category": "Gaming",
  "s3Key": "videos/uuid.mp4",
  "thumbnailKey": "thumbnails/uuid.jpg",
  "duration": 1234,
  "fileSize": 52428800,
  "views": 0,
  "status": "published",
  "uploadedBy": "user-id",
  "uploadedAt": "2025-11-29T10:00:00Z",
  "updatedAt": "2025-11-29T10:00:00Z"
}
```

## Frontend Components

- **Videos.tsx**: Hauptseite mit Grid
- **VideoCard.tsx**: Video-Karte mit Admin-Buttons
- **VideoUploadModal.tsx**: Upload-Dialog
- **VideoEditModal.tsx**: Edit-Dialog
- **VideoPlayerModal.tsx**: Video-Player
- **useAdmin.ts**: Admin-Check Hook
- **video.service.ts**: API Service

## Security

- ✅ JWT Token Validation
- ✅ Cognito Groups Check (`admins`)
- ✅ S3 Private Buckets
- ✅ Presigned URLs (zeitlich begrenzt)
- ✅ CORS Configuration
- ✅ IAM Least Privilege

## Limits

- **Video Size**: 500MB (Frontend-Limit)
- **Thumbnail Size**: 5MB (Frontend-Limit)
- **Upload URL Expiry**: 15 Minuten
- **Video URL Expiry**: 1 Stunde
- **Supported Formats**: Alle Browser-kompatiblen Video-Formate

## Kosten (Schätzung)

- **DynamoDB**: ~$0.25/Monat (On-Demand)
- **S3 Storage**: ~$0.023/GB/Monat
- **S3 Requests**: ~$0.005/1000 Requests
- **CloudFront**: ~$0.085/GB Transfer
- **Lambda**: ~$0.20/1M Requests

**Beispiel**: 100 Videos (50GB), 10.000 Views/Monat
- Storage: $1.15
- Transfer: $8.50
- Requests: $0.05
- **Total**: ~$10/Monat

## Troubleshooting

### "Forbidden: Admin access required"
→ User ist nicht in der `admins` Gruppe

### "Video not found"
→ Video ist `draft` und User ist kein Admin

### "Upload fehlgeschlagen"
→ Presigned URL abgelaufen (15 Min)

### Videos werden nicht angezeigt
→ Status auf `published` setzen

### Thumbnail wird nicht angezeigt
→ CloudFront Distribution noch nicht deployed (kann 15-30 Min dauern)

## Monitoring

```bash
# Lambda Logs
aws logs tail /aws/lambda/honigwabe-video-api --follow --profile honigwabe

# DynamoDB Items
aws dynamodb scan --table-name honigwabe-videos --profile honigwabe

# S3 Objects
aws s3 ls s3://honigwabe-videos-prod/ --profile honigwabe
```

## Erweiterungen (Optional)

- [ ] Video Transcoding (AWS MediaConvert)
- [ ] Automatic Thumbnails (Lambda + FFmpeg)
- [ ] Video Analytics (Views, Watch-Time)
- [ ] Comments System
- [ ] Likes/Dislikes
- [ ] Playlists
- [ ] Video Recommendations
- [ ] Subtitles/Captions
