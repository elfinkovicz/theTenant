# Stream Monitor Fix - Automatisches Start/Stop

## Problem
AWS IVS sendet keine nativen EventBridge-Events für Stream State Changes. Die ursprüngliche Implementierung konnte daher nicht automatisch auf Stream-Start/Stop reagieren.

## Lösung
Implementierung eines **Polling-basierten Stream Monitors**, der alle 30 Sekunden den IVS-Stream-Status überprüft.

## Komponenten

### 1. Stream Monitor Lambda (`stream_monitor.py`)
- **Funktion**: Überprüft alle 30 Sekunden den IVS-Stream-Status
- **Trigger**: CloudWatch Events (Schedule: `rate(30 seconds)`)
- **Ablauf**:
  1. Ruft `ivs.get_stream()` auf, um aktuellen Status zu prüfen
  2. Vergleicht mit vorherigem Status (gespeichert in DynamoDB)
  3. Bei Statusänderung:
     - **OFFLINE → LIVE**: Startet alle aktivierten Destinations
     - **LIVE → OFFLINE**: Stoppt alle aktiven Destinations

### 2. Stream State Table (DynamoDB)
- **Name**: `{project_name}-stream-state`
- **Zweck**: Speichert den letzten bekannten Stream-Status
- **Struktur**:
  ```json
  {
    "id": "stream_state",
    "state": "LIVE" | "OFFLINE",
    "timestamp": "2024-01-01T12:00:00Z"
  }
  ```

### 3. Verbesserte Auto-Start/Stop Logik

#### Auto-Start (`auto_start_enabled_destinations`)
- Findet alle Destinations mit `enabled=true` und `status=inactive`
- Für jede Destination:
  1. Prüft ob MediaLive Channel existiert
  2. Wenn ja: Prüft Status und startet bei Bedarf
  3. Wenn nein: Erstellt neuen Channel und startet ihn
  4. Setzt Status auf `active`

#### Auto-Stop (`auto_stop_active_destinations`)
- Findet alle Destinations mit `status=active`
- Für jede Destination:
  1. Stoppt MediaLive Channel
  2. Setzt Status auf `inactive`

## Vorteile dieser Lösung

1. **Zuverlässig**: Polling alle 30 Sekunden stellt sicher, dass Statusänderungen erkannt werden
2. **Robust**: Behandelt Edge Cases (Channel existiert nicht mehr, falscher Status, etc.)
3. **Kosteneffizient**: 
   - 2 Lambda-Aufrufe pro Minute = ~86.400 Aufrufe/Monat
   - Kosten: ~$0.02/Monat (weit unter Free Tier)
4. **Detailliertes Logging**: Alle Aktionen werden geloggt für Debugging

## Deployment

### 1. Lambda-Pakete bauen
```powershell
cd TerraformInfluencerTemplate/modules/stream-restreaming
.\build-lambdas.ps1
```

Dies erstellt:
- `lambda.zip` - API Handler für manuelle Steuerung
- `monitor.zip` - Stream Monitor für automatisches Start/Stop

### 2. Terraform Apply
```bash
terraform apply
```

## Monitoring

### CloudWatch Logs
Beide Lambda-Funktionen loggen ausführlich:

**Stream Monitor Logs** (`/aws/lambda/{project_name}-stream-monitor`):
```
Checking IVS stream status for channel: arn:aws:ivs:...
Stream is LIVE
Previous state: OFFLINE, Current state: LIVE
State changed from OFFLINE to LIVE
Auto-starting enabled destinations...
Found 3 destinations to start
Starting destination: YouTube (ID: abc-123)
Starting existing channel ch-xyz
Successfully started YouTube
```

**API Handler Logs** (`/aws/lambda/{project_name}-stream-restreaming`):
```
Event: {"httpMethod": "POST", "path": "/stream-destinations"}
Creating new destination: Twitch
Destination created with ID: def-456
```

### DynamoDB Tables

**Destinations Table** (`{project_name}-streaming-destinations`):
```json
{
  "id": "abc-123",
  "platform": "youtube",
  "name": "YouTube",
  "enabled": true,
  "status": "active",
  "mediaLiveChannelId": "ch-xyz",
  "rtmpUrl": "rtmp://...",
  "streamKey": "****"
}
```

**State Table** (`{project_name}-stream-state`):
```json
{
  "id": "stream_state",
  "state": "LIVE",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Troubleshooting

### Destinations starten nicht automatisch

1. **Prüfe CloudWatch Logs**:
   ```bash
   aws logs tail /aws/lambda/{project_name}-stream-monitor --follow
   ```

2. **Prüfe Destination Status**:
   - `enabled` muss `true` sein
   - `status` sollte `inactive` sein vor dem Start

3. **Prüfe IVS Stream**:
   ```bash
   aws ivs get-stream --channel-arn arn:aws:ivs:...
   ```

### MediaLive Channel startet nicht

1. **Prüfe IAM Permissions**:
   - Lambda braucht `medialive:StartChannel`
   - MediaLive braucht `ivs:GetStream`

2. **Prüfe Channel Status**:
   ```bash
   aws medialive describe-channel --channel-id ch-xyz
   ```

3. **Prüfe Logs** für Fehlermeldungen

### Polling-Intervall anpassen

In `eventbridge.tf`:
```hcl
schedule_expression = "rate(1 minute)"  # Statt 30 Sekunden
```

## Kosten

- **Lambda Aufrufe**: ~86.400/Monat (2 pro Minute)
- **Lambda Laufzeit**: ~60s * 86.400 = 5.184.000 ms/Monat
- **DynamoDB**: Pay-per-request (minimal)
- **Geschätzte Kosten**: < $0.05/Monat (unter Free Tier)

## Alternative: Webhook-basierte Lösung

Falls du eine Webhook-URL von deinem Streaming-Setup hast, kannst du auch eine Webhook-basierte Lösung implementieren:

1. API Gateway Endpoint erstellen
2. Lambda bei Webhook-Aufruf triggern
3. Kein Polling nötig

Dies wäre noch kosteneffizienter, erfordert aber Integration in dein Streaming-Setup.
