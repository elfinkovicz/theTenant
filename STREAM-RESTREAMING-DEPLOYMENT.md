# Stream Restreaming Deployment Guide

## Automatisches Deployment mit deploy.py

Das Stream Restreaming Modul wird jetzt automatisch beim Deployment gebaut und deployed.

### Komplettes Deployment

```bash
python deploy.py
```

Dies führt automatisch aus:
1. ✅ Baut Lambda Layers
2. ✅ **Baut Stream Restreaming Lambda-Funktionen** (neu!)
   - `lambda.zip` - API Handler für manuelle Steuerung
   - `monitor.zip` - Stream Monitor für automatisches Start/Stop
3. ✅ Baut Billing System Lambda-Funktionen
4. ✅ Deployt Terraform Infrastructure
5. ✅ Deployt Frontend

### Nur Infrastructure Deployment

```bash
python deploy.py --infrastructure
```

### Nur Frontend Deployment

```bash
python deploy.py --frontend
```

## Manuelles Lambda-Build (falls nötig)

Falls du nur die Stream Restreaming Lambdas neu bauen möchtest:

### Windows
```powershell
cd TerraformInfluencerTemplate/modules/stream-restreaming
.\build-lambdas.ps1
```

### Linux/Mac
```bash
cd TerraformInfluencerTemplate/modules/stream-restreaming
chmod +x build-lambdas.sh
./build-lambdas.sh
```

## Was wurde geändert?

### 1. Neue Lambda-Funktion: Stream Monitor
- **Datei**: `lambda/stream_monitor.py`
- **Zweck**: Überwacht IVS Stream-Status alle 30 Sekunden
- **Trigger**: CloudWatch Events (Schedule)
- **Funktion**: Startet/Stoppt automatisch alle aktivierten Destinations

### 2. Neue DynamoDB Tabelle: Stream State
- **Name**: `{project_name}-stream-state`
- **Zweck**: Speichert letzten bekannten Stream-Status
- **Verhindert**: Doppelte Start/Stop-Aktionen

### 3. Verbesserte EventBridge Konfiguration
- **Polling**: Alle 30 Sekunden statt Event-basiert
- **Grund**: AWS IVS sendet keine nativen EventBridge-Events
- **Kosten**: < $0.05/Monat (unter Free Tier)

## Wie funktioniert das automatische Start/Stop?

### Stream startet (OFFLINE → LIVE)
1. Monitor erkennt Statusänderung
2. Findet alle Destinations mit `enabled=true`
3. Für jede Destination:
   - Prüft ob MediaLive Channel existiert
   - Erstellt Channel falls nötig
   - Startet Channel
   - Setzt Status auf `active`

### Stream endet (LIVE → OFFLINE)
1. Monitor erkennt Statusänderung
2. Findet alle Destinations mit `status=active`
3. Für jede Destination:
   - Stoppt MediaLive Channel
   - Setzt Status auf `inactive`

## Monitoring

### CloudWatch Logs prüfen

**Stream Monitor Logs:**
```bash
aws logs tail /aws/lambda/{project_name}-stream-monitor --follow
```

**API Handler Logs:**
```bash
aws logs tail /aws/lambda/{project_name}-stream-restreaming --follow
```

### DynamoDB Tabellen prüfen

**Destinations:**
```bash
aws dynamodb scan --table-name {project_name}-streaming-destinations
```

**Stream State:**
```bash
aws dynamodb get-item \
  --table-name {project_name}-stream-state \
  --key '{"id":{"S":"stream_state"}}'
```

## Troubleshooting

### Lambda-Build schlägt fehl

**Fehler**: `build-lambdas.ps1 nicht gefunden`

**Lösung**: Das Script erstellt die ZIPs automatisch als Fallback. Prüfe ob `lambda.zip` und `monitor.zip` erstellt wurden:

```bash
ls -la TerraformInfluencerTemplate/modules/stream-restreaming/*.zip
```

### Destinations starten nicht automatisch

1. **Prüfe ob Feature aktiviert ist:**
   ```python
   # In deployment_config.py
   ENABLE_STREAM_RESTREAMING = True
   ```

2. **Prüfe CloudWatch Logs:**
   ```bash
   aws logs tail /aws/lambda/{project_name}-stream-monitor --follow
   ```

3. **Prüfe Destination Status:**
   - `enabled` muss `true` sein
   - `status` sollte `inactive` sein vor dem Start

4. **Prüfe IVS Stream:**
   ```bash
   aws ivs get-stream --channel-arn {ivs_channel_arn}
   ```

### MediaLive Channel startet nicht

1. **Prüfe IAM Permissions:**
   - Lambda braucht `medialive:StartChannel`, `medialive:CreateChannel`
   - MediaLive braucht `ivs:GetStream`

2. **Prüfe Channel Status:**
   ```bash
   aws medialive describe-channel --channel-id {channel_id}
   ```

3. **Prüfe Logs für Fehlermeldungen**

## Kosten

- **Lambda Aufrufe**: ~86.400/Monat (2 pro Minute)
- **Lambda Laufzeit**: ~5.184.000 ms/Monat
- **DynamoDB**: Pay-per-request (minimal)
- **MediaLive**: Nur wenn Channels laufen
- **Geschätzte Kosten**: < $0.05/Monat (ohne MediaLive)

## Nächste Schritte nach Deployment

1. **Teste manuelles Start/Stop:**
   - Gehe zur Admin-Oberfläche
   - Erstelle eine Destination
   - Starte/Stoppe manuell

2. **Teste automatisches Start/Stop:**
   - Starte deinen IVS Stream
   - Warte 30-60 Sekunden
   - Prüfe ob Destinations automatisch starten
   - Stoppe deinen Stream
   - Prüfe ob Destinations automatisch stoppen

3. **Monitoring einrichten:**
   - CloudWatch Alarms für Lambda-Fehler
   - CloudWatch Dashboard für Stream-Status

## Weitere Informationen

Siehe auch:
- `TerraformInfluencerTemplate/modules/stream-restreaming/STREAM-MONITOR-FIX.md` - Detaillierte technische Dokumentation
- `deployment_config.py` - Konfigurationsoptionen
- `deploy.py` - Deployment-Script
