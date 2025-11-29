# Team Management Deployment Guide

## Schritt 1: Lambda Dependencies installieren

```bash
cd TerraformInfluencerTemplate/modules/team-management/lambda
npm install
cd ../../..
```

## Schritt 2: Terraform Deployment

```bash
cd TerraformInfluencerTemplate

# Initialisieren (falls noch nicht geschehen)
terraform init

# Plan prüfen
terraform plan

# Anwenden
terraform apply
```

## Schritt 3: API Endpoint in Frontend konfigurieren

Nach dem Terraform Apply wird die Team API URL ausgegeben:

```bash
terraform output team_api_endpoint
```

Kopiere diese URL und füge sie in deine `.env` Datei ein:

```bash
# In honigwabe-react/.env
VITE_TEAM_API_URL=https://xxxxx.execute-api.eu-central-1.amazonaws.com
```

## Schritt 4: Frontend neu bauen und deployen

```bash
cd honigwabe-react

# Dependencies installieren (falls noch nicht geschehen)
npm install

# Build
npm run build

# Deploy zu S3
cd ..
python deploy.py
```

## Schritt 5: Admin-User zur Cognito-Gruppe hinzufügen

Damit du Team-Mitglieder verwalten kannst, musst du deinen User zur "admins" Gruppe hinzufügen:

### Option A: AWS Console
1. Gehe zu AWS Cognito Console
2. Wähle deinen User Pool
3. Gehe zu "Groups" → "admins"
4. Klicke "Add users to group"
5. Wähle deinen User aus

### Option B: AWS CLI
```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id <USER_POOL_ID> \
  --username <DEINE_EMAIL> \
  --group-name admins \
  --profile honigwabe
```

## Schritt 6: Testen

1. Gehe zu https://honigwabe.live/team
2. Logge dich als Admin ein
3. Du solltest jetzt den "Team-Mitglied hinzufügen" Button sehen
4. Erstelle ein Test-Team-Mitglied mit Profilbild

## Troubleshooting

### CORS-Fehler
- Stelle sicher, dass die API deployed ist: `terraform apply`
- Prüfe, dass die richtige API-URL in der .env steht
- Warte 1-2 Minuten nach dem Deployment

### "Admin access required"
- Stelle sicher, dass dein User in der "admins" Cognito-Gruppe ist
- Logge dich aus und wieder ein, damit der neue Token geladen wird

### Bilder werden nicht angezeigt
- CloudFront Distribution braucht 10-15 Minuten zum Deployment
- Prüfe: `terraform output team_images_cdn`
- Warte und lade die Seite neu

### Lambda Fehler
- Prüfe CloudWatch Logs:
```bash
aws logs tail /aws/lambda/honigwabe-team-api --follow --profile honigwabe
```

## Kosten

Geschätzte monatliche Kosten bei 10 Team-Mitgliedern und 10.000 Seitenaufrufen:
- DynamoDB: ~$0.25
- S3: ~$0.50
- CloudFront: ~$1.00
- Lambda: ~$0.20
- API Gateway: ~$0.35

**Total: ~$2.30/Monat**

## Features

✅ Team-Mitglieder erstellen, bearbeiten, löschen (nur Admins)
✅ Profilbilder hochladen (max. 5MB)
✅ 8 Social-Media-Plattformen
✅ Reihenfolge festlegen
✅ Öffentliche Anzeige für alle Besucher
✅ Responsive Design
✅ CDN für schnelle Bildauslieferung

## Nächste Schritte

- [ ] Echte Team-Mitglieder hinzufügen
- [ ] Profilbilder hochladen
- [ ] Social-Media-Links aktualisieren
- [ ] Reihenfolge anpassen
- [ ] Alte statische Team-Daten entfernen
