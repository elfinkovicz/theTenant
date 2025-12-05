# Messaging Integration Deployment

## Problem: 403 Fehler bei Telegram/WhatsApp Einstellungen

Der 403-Fehler tritt auf, weil das `messaging-settings` Modul noch nicht deployed wurde.

## Lösung 1: Temporär (LocalStorage)

Die Frontend-App nutzt jetzt automatisch LocalStorage als Fallback:
- ✅ Einstellungen werden lokal gespeichert
- ✅ Telegram-Test funktioniert direkt vom Browser
- ⚠️ Einstellungen sind nur auf diesem Gerät verfügbar
- ⚠️ Keine Synchronisation zwischen Geräten

## Lösung 2: Backend deployen (Empfohlen)

### Schritt 1: Terraform Apply

```bash
cd TerraformInfluencerTemplate
terraform init
terraform apply -var-file=project.tfvars
```

Dies deployed:
- `messaging-settings` Modul mit DynamoDB-Tabelle
- Lambda-Funktion für API-Endpunkte
- API Gateway Routen für WhatsApp/Telegram

### Schritt 2: Verifizieren

Nach dem Deployment sollten diese Endpunkte verfügbar sein:
- `GET /whatsapp/settings`
- `PUT /whatsapp/settings`
- `POST /whatsapp/test`
- `GET /telegram/settings`
- `PUT /telegram/settings`
- `POST /telegram/test`

### Schritt 3: Testen

1. Öffne die Newsfeed-Seite
2. Klicke auf "Optionen"
3. Wechsle zum Telegram-Tab
4. Trage Bot Token und Chat ID ein
5. Klicke "Test-Nachricht senden"

## Telegram Chat ID finden

### Methode 1: @userinfobot
1. Suche in Telegram nach `@userinfobot`
2. Starte den Bot
3. Für Gruppen: Füge den Bot zur Gruppe hinzu
4. Er zeigt die Chat ID an (Format: `-1001234567890`)

### Methode 2: @RawDataBot
1. Suche nach `@RawDataBot`
2. Füge ihn zu deiner Gruppe/Kanal hinzu
3. Er zeigt alle IDs an

### Methode 3: API
1. Sende eine Nachricht an deinen Bot
2. Öffne: `https://api.telegram.org/bot<BOT_TOKEN>/getUpdates`
3. Suche nach `"chat":{"id":-1001234567890}`

## Troubleshooting

### Fehler: "Admin access required"
- Stelle sicher, dass dein Benutzer in der Admin-Gruppe ist
- Gruppe heißt: `<project-name>-admins`
- Füge deinen Benutzer über AWS Cognito Console hinzu

### Fehler: "Settings not configured"
- Trage zuerst die Einstellungen ein
- Aktiviere die Integration
- Dann teste

### LocalStorage löschen
Falls du die lokalen Einstellungen löschen möchtest:
```javascript
localStorage.removeItem('telegram-settings')
localStorage.removeItem('whatsapp-settings')
```

## Status

- ✅ Frontend mit LocalStorage-Fallback funktioniert
- ✅ Telegram-Test funktioniert direkt
- ⏳ Backend-Deployment ausstehend
- ⏳ WhatsApp-Integration benötigt AWS End User Messaging Setup
