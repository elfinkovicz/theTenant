# Team Management Deployment - Schritt für Schritt

## Aktueller Status
❌ Team Management API ist noch nicht deployed
❌ CORS-Fehler weil API-URL auf Platzhalter zeigt

## Deployment-Schritte

### Schritt 1: Lambda Dependencies installieren

```bash
cd TerraformInfluencerTemplate/modules/team-management/lambda
npm install
cd ../../..
```

**Erwartete Ausgabe:**
```
added 15 packages
```

### Schritt 2: Terraform Plan prüfen

```bash
cd TerraformInfluencerTemplate
terraform plan
```

**Was du sehen solltest:**
- `module.team_management[0].aws_dynamodb_table.team_members` wird erstellt
- `module.team_management[0].aws_lambda_function.team_api` wird erstellt
- `module.team_management[0].aws_apigatewayv2_api.team_api` wird erstellt

**Wichtig:** Es sollte KEINE neue CloudFront Distribution erstellt werden!

### Schritt 3: Terraform Apply

```bash
terraform apply
```

Tippe `yes` wenn gefragt.

**Dauer:** ~2-3 Minuten

### Schritt 4: API-Endpoint kopieren

```bash
terraform output team_api_endpoint
```

**Beispiel-Ausgabe:**
```
"https://abc123xyz.execute-api.eu-central-1.amazonaws.com"
```

Kopiere diese URL (ohne Anführungszeichen).

### Schritt 5: .env Datei aktualisieren

```bash
cd ../honigwabe-react
```

Erstelle/bearbeite die `.env` Datei:

```bash
# Kopiere .env.example falls noch nicht vorhanden
cp .env.example .env

# Bearbeite .env und füge die echte API-URL ein
nano .env
```

Setze:
```
VITE_TEAM_API_URL=https://abc123xyz.execute-api.eu-central-1.amazonaws.com
```

(Ersetze mit deiner echten URL aus Schritt 4)

### Schritt 6: Frontend neu bauen

```bash
npm run build
```

**Dauer:** ~30 Sekunden

### Schritt 7: Zu S3 deployen

```bash
cd ..
python deploy.py
```

**Was passiert:**
- Frontend wird zu S3 hochgeladen
- CloudFront Cache wird invalidiert
- Nach 1-2 Minuten ist die neue Version live

### Schritt 8: Admin-Rechte setzen

Füge deinen User zur Admin-Gruppe hinzu:

```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id eu-central-1_XXXXXXXXX \
  --username email@nielsfink.de \
  --group-name admins \
  --profile honigwabe
```

(Ersetze User Pool ID und E-Mail mit deinen Werten)

### Schritt 9: Testen

1. Gehe zu https://honigwabe.live/team
2. Logge dich aus und wieder ein (damit neuer Token geladen wird)
3. Du solltest jetzt den "Team-Mitglied hinzufügen" Button sehen
4. Erstelle ein Test-Team-Mitglied

## Troubleshooting

### CORS-Fehler bleibt bestehen
- ✅ Prüfe: Ist die richtige API-URL in der .env?
- ✅ Prüfe: Wurde das Frontend neu gebaut? (`npm run build`)
- ✅ Prüfe: Wurde zu S3 deployed? (`python deploy.py`)
- ✅ Warte 2-3 Minuten für CloudFront Cache Invalidation
- ✅ Hard-Refresh im Browser (Ctrl+Shift+R)

### "Admin access required"
- ✅ Bist du in der "admins" Cognito-Gruppe?
- ✅ Hast du dich nach dem Hinzufügen zur Gruppe neu eingeloggt?
- ✅ Prüfe in AWS Console: Cognito → User Pools → Groups → admins

### Bilder werden nicht angezeigt
- ✅ Warte 10-15 Minuten nach erstem Deployment
- ✅ CloudFront Distribution muss "Deployed" Status haben
- ✅ Prüfe: `terraform output thumbnails_cdn_url`

### Lambda Fehler
Prüfe CloudWatch Logs:
```bash
aws logs tail /aws/lambda/honigwabe-team-api --follow --profile honigwabe
```

## Kosten-Übersicht

Nach dem Deployment:
- **DynamoDB**: ~$0.25/Monat (Pay-per-request)
- **S3**: ~$0.10/Monat (nur zusätzlicher Storage)
- **Lambda**: ~$0.20/Monat (erste 1M Requests kostenlos)
- **API Gateway**: ~$0.35/Monat
- **CloudFront**: $0 (nutzt bestehende Distribution)

**Total: ~$0.90/Monat**

## Nächste Schritte nach erfolgreichem Deployment

1. ✅ Erstes Team-Mitglied mit Profilbild erstellen
2. ✅ Social-Media-Links testen
3. ✅ Reihenfolge anpassen
4. ✅ Weitere Team-Mitglieder hinzufügen
5. ✅ Alte statische Team-Daten entfernen (falls vorhanden)

## Wichtige Hinweise

- Team-Bilder werden im gleichen S3 Bucket wie Video-Thumbnails gespeichert
- Unterordner: `/team/`
- Gleiche CloudFront Distribution wie Videos
- Keine zusätzlichen Infrastruktur-Kosten
- Bilder sind öffentlich über CDN verfügbar
- Admin-Operationen erfordern Cognito JWT Token

## Support

Bei Problemen:
1. Prüfe CloudWatch Logs
2. Prüfe Browser Console (F12)
3. Prüfe Network Tab für API-Calls
4. Prüfe Terraform State: `terraform show`
