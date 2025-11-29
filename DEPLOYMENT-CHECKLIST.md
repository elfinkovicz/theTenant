# 🚀 Video Management Deployment Checklist

## Status: Bereit zum Deployment

### ✅ Was ist fertig?

#### Backend
- [x] Terraform Video Management Modul erstellt
- [x] Lambda Function (video-api) implementiert
- [x] DynamoDB Table konfiguriert
- [x] S3 Buckets (Videos + Thumbnails) konfiguriert
- [x] CloudFront Distribution für Thumbnails
- [x] API Gateway Routes definiert
- [x] JWT Authorizer hinzugefügt
- [x] Cognito Admin Group konfiguriert
- [x] CORS korrekt konfiguriert

#### Frontend
- [x] Video Service implementiert
- [x] Admin Hook (useAdmin) erstellt
- [x] Video Components erstellt
  - [x] VideoCard
  - [x] VideoUploadModal
  - [x] VideoEditModal
  - [x] VideoPlayerModal
- [x] Videos Page implementiert
- [x] Design an Plattform angepasst (Lila statt Gelb)
- [x] TypeScript Fehler behoben
- [x] Build erfolgreich

#### Dokumentation
- [x] Module README
- [x] Quick Start Guide
- [x] Implementation Summary
- [x] Admin Scripts (PowerShell + Bash)

### ❌ Was fehlt noch?

#### Deployment
- [ ] Terraform apply ausführen
- [ ] Lambda Dependencies installieren (uuid)
- [ ] Frontend neu deployen
- [ ] Admin-User zur Gruppe hinzufügen

## 📋 Deployment Schritte

### 1. Lambda Dependencies installieren

```powershell
cd TerraformInfluencerTemplate/modules/video-management/lambda
npm install
cd ../../..
```

### 2. Terraform Deployment

```powershell
cd TerraformInfluencerTemplate
terraform init -upgrade
terraform plan -var-file=clients/honigwabe/terraform.tfvars -out=tfplan
terraform apply tfplan
```

**Oder mit Deploy-Script:**

```powershell
python deploy.py
```

### 3. Admin-Rechte vergeben

Der User ist bereits registriert und eingeloggt. Jetzt Admin-Rechte vergeben:

```powershell
.\TerraformInfluencerTemplate\scripts\add-admin.ps1 -Email email@nielsfink.de
```

**Oder über AWS CLI:**

```powershell
aws cognito-idp admin-add-user-to-group `
  --user-pool-id eu-central-1_51DAT0n1j `
  --username email@nielsfink.de `
  --group-name admins `
  --region eu-central-1 `
  --profile honigwabe
```

### 4. Frontend neu deployen

```powershell
cd honigwabe-react
npm run build

# Upload zu S3
aws s3 sync dist/ s3://honigwabe-website-081033004511/ --delete --profile honigwabe

# CloudFront Cache invalidieren
aws cloudfront create-invalidation `
  --distribution-id <DISTRIBUTION_ID> `
  --paths "/*" `
  --profile honigwabe
```

## 🔍 Aktueller Fehler

### Problem
```
POST /videos/upload-url → 500 Internal Server Error
GET /videos → 500 Internal Server Error
```

### Ursache
Die Video-API Routes existieren noch nicht, weil das Terraform-Modul noch nicht deployed wurde.

### Lösung
Terraform apply ausführen (siehe Schritt 2 oben)

## ✅ Verifizierung nach Deployment

### 1. API Endpoints prüfen

```powershell
# Video API sollte verfügbar sein
curl https://1rhnpplzti.execute-api.eu-central-1.amazonaws.com/videos

# Sollte leere Liste zurückgeben: {"videos":[]}
```

### 2. Admin-Rechte prüfen

```powershell
aws cognito-idp admin-list-groups-for-user `
  --user-pool-id eu-central-1_51DAT0n1j `
  --username email@nielsfink.de `
  --region eu-central-1 `
  --profile honigwabe

# Sollte "admins" Gruppe anzeigen
```

### 3. Frontend testen

1. Öffne https://honigwabe.live/videos
2. Als Admin einloggen
3. "Video hochladen" Button sollte sichtbar sein
4. Video hochladen testen
5. Video sollte in der Liste erscheinen

## 📊 Erwartete AWS Resources nach Deployment

```
DynamoDB Tables:
  - honigwabe-videos

S3 Buckets:
  - honigwabe-videos-prod
  - honigwabe-thumbnails-prod

Lambda Functions:
  - honigwabe-video-api

CloudFront Distributions:
  - Thumbnails CDN

API Gateway Routes (auf User API):
  - GET    /videos
  - GET    /videos/{videoId}
  - POST   /videos/upload-url  (Admin)
  - POST   /videos             (Admin)
  - PUT    /videos/{videoId}   (Admin)
  - DELETE /videos/{videoId}   (Admin)

Cognito Groups:
  - admins
```

## 🐛 Troubleshooting

### Lambda Fehler
```powershell
# Lambda Logs anschauen
aws logs tail /aws/lambda/honigwabe-video-api --follow --profile honigwabe
```

### DynamoDB prüfen
```powershell
# Tabelle existiert?
aws dynamodb describe-table --table-name honigwabe-videos --profile honigwabe
```

### S3 Buckets prüfen
```powershell
# Buckets existieren?
aws s3 ls --profile honigwabe | grep honigwabe-videos
```

### API Gateway prüfen
```powershell
# Routes anzeigen
aws apigatewayv2 get-routes --api-id <API_ID> --profile honigwabe
```

## 📝 Notizen

- Der User ist bereits als Admin authentifiziert (Token enthält `cognito:groups: ["admins"]`)
- Das Frontend ist korrekt konfiguriert und sendet den Authorization Header
- Die CORS-Konfiguration ist korrekt
- Das Design wurde erfolgreich angepasst (Lila statt Gelb)

## 🎯 Nächster Schritt

**Führe das Terraform Deployment aus:**

```powershell
python deploy.py
```

Oder manuell:

```powershell
cd TerraformInfluencerTemplate
terraform apply -var-file=clients/honigwabe/terraform.tfvars
```

Nach erfolgreichem Deployment sollte das Video Management System vollständig funktionieren! 🚀
