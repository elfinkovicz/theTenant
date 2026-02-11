# YouTube OAuth Integration Setup

## Übersicht

Die YouTube OAuth-Integration ermöglicht es Tenants, ihre YouTube-Kanäle direkt zu verbinden und Stream-Metadaten (Titel, Beschreibung, Sichtbarkeit) automatisch zu setzen.

## Voraussetzungen

### 1. Google Cloud Console Projekt erstellen

1. Gehe zu [Google Cloud Console](https://console.cloud.google.com/)
2. Erstelle ein neues Projekt oder wähle ein bestehendes
3. Aktiviere die **YouTube Data API v3**

### 2. OAuth 2.0 Credentials erstellen

1. Gehe zu **APIs & Services** → **Credentials**
2. Klicke auf **Create Credentials** → **OAuth client ID**
3. Wähle **Web application**
4. Füge folgende Redirect URIs hinzu:
   ```
   https://{API_GATEWAY_ID}.execute-api.{REGION}.amazonaws.com/{STAGE}/tenants/{tenantId}/youtube/oauth/callback
   ```
   Beispiel:
   ```
   https://abc123xyz.execute-api.eu-central-1.amazonaws.com/prod/tenants/*/youtube/oauth/callback
   ```

### 3. AWS SSM Parameter Store konfigurieren

Speichere die Credentials im SSM Parameter Store:

```bash
# Client ID
aws ssm put-parameter \
  --name "/{PLATFORM_NAME}/youtube/client_id" \
  --value "YOUR_CLIENT_ID" \
  --type "SecureString"

# Client Secret
aws ssm put-parameter \
  --name "/{PLATFORM_NAME}/youtube/client_secret" \
  --value "YOUR_CLIENT_SECRET" \
  --type "SecureString"
```

### 4. Encryption Key setzen

Setze einen sicheren Encryption Key in `terraform.tfvars`:

```hcl
oauth_encryption_key = "your-32-character-secure-key-here"
```

## Architektur

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   API Gateway    │────▶│  tenant-live    │
│   (React)       │     │                  │     │    Lambda       │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                         │
                        ┌────────────────────────────────┼────────────────────────────────┐
                        │                                │                                │
                        ▼                                ▼                                ▼
               ┌─────────────────┐            ┌─────────────────┐            ┌─────────────────┐
               │  oauth-tokens   │            │youtube-broadcasts│            │   SSM Params    │
               │   (DynamoDB)    │            │   (DynamoDB)    │            │  (Credentials)  │
               └─────────────────┘            └─────────────────┘            └─────────────────┘
```

## API Endpoints

| Methode | Endpoint | Beschreibung |
|---------|----------|--------------|
| POST | `/tenants/{id}/youtube/oauth/initiate` | Startet OAuth-Flow |
| GET | `/tenants/{id}/youtube/oauth/callback` | OAuth Callback (public) |
| GET | `/tenants/{id}/youtube/oauth/status` | Prüft Verbindungsstatus |
| DELETE | `/tenants/{id}/youtube/oauth/disconnect` | Trennt Verbindung |
| POST | `/tenants/{id}/youtube/broadcast` | Erstellt Broadcast |
| PUT | `/tenants/{id}/youtube/broadcast/{broadcastId}` | Aktualisiert Broadcast |
| GET | `/tenants/{id}/youtube/broadcast/current` | Holt aktuellen Broadcast |
| GET | `/tenants/{id}/youtube/stream-credentials` | Holt RTMP Credentials |

## Frontend-Nutzung

```typescript
import { youtubeOAuthService } from '../services/youtube-oauth.service'

// OAuth-Popup öffnen
const connected = await youtubeOAuthService.openOAuthPopup()

// Status prüfen
const status = await youtubeOAuthService.getOAuthStatus()

// Broadcast erstellen
const broadcast = await youtubeOAuthService.createBroadcast({
  title: 'Mein Livestream',
  description: 'Beschreibung...',
  privacyStatus: 'public'
})
```

## Sicherheit

- OAuth Tokens werden mit AES-256-GCM verschlüsselt in DynamoDB gespeichert
- Refresh Tokens werden automatisch erneuert
- Nur Tenant-Admins können OAuth-Verbindungen verwalten
- Client Secret wird im SSM Parameter Store mit SecureString gespeichert
