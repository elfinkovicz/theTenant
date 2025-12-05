# Cognito zu DynamoDB User Synchronisation

## Übersicht

Dieses Skript synchronisiert alle existierenden Cognito User einmalig in die DynamoDB Users-Tabelle. Dies ist notwendig, wenn:

- Der Post-Confirmation Trigger nachträglich hinzugefügt wurde
- Bereits User im Cognito User Pool existieren
- Email-Benachrichtigungen an alle registrierten User gesendet werden sollen

## Voraussetzungen

### AWS CLI konfiguriert
```bash
aws configure
```

### Für PowerShell-Skript:
- PowerShell 5.1 oder höher
- AWS CLI installiert

### Für Python-Skript:
- Python 3.7 oder höher
- boto3 installiert: `pip install boto3`

## Verwendung

### Option 1: PowerShell-Skript

```powershell
# Standard (verwendet eu-central-1 und honigwabe)
.\sync-cognito-to-dynamodb.ps1

# Mit benutzerdefinierten Parametern
.\sync-cognito-to-dynamodb.ps1 -Region "eu-central-1" -ProjectName "honigwabe"
```

### Option 2: Python-Skript

```bash
# Standard (verwendet eu-central-1 und honigwabe)
python sync-cognito-to-dynamodb.py

# Oder mit Python 3
python3 sync-cognito-to-dynamodb.py
```

Um Region oder Projektnamen zu ändern, bearbeite die Variablen am Anfang des Skripts:
```python
REGION = 'eu-central-1'
PROJECT_NAME = 'honigwabe'
```

## Was macht das Skript?

1. **Findet den Cognito User Pool** anhand des Projektnamens
2. **Ruft alle User ab** aus dem Cognito User Pool (mit Pagination)
3. **Synchronisiert jeden User** in die DynamoDB Users-Tabelle mit:
   - `userId` (Cognito Username/Sub)
   - `email`
   - `name` (oder Email-Prefix als Fallback)
   - `emailVerified` (Boolean)
   - `status` (immer "active")
   - `createdAt` und `updatedAt` (aktueller Timestamp)

## Wichtige Hinweise

- **Nur bestätigte User** (UserStatus = CONFIRMED) werden synchronisiert
- **Unbestätigte User** werden übersprungen
- **Existierende Einträge** in DynamoDB werden überschrieben
- Das Skript ist **idempotent** - kann mehrfach ausgeführt werden

## Ausgabe

Das Skript zeigt:
- ✓ Erfolgreich synchronisierte User
- ⊘ Übersprungene User (unbestätigt)
- ✗ Fehler bei der Synchronisation

Am Ende wird eine Zusammenfassung angezeigt:
```
Summary:
  Total users in Cognito: 15
  Successfully synced: 12
  Skipped (unconfirmed): 2
  Errors: 1
```

## Nach der Synchronisation

Nach erfolgreicher Synchronisation:

1. **Neue User** werden automatisch durch den Post-Confirmation Trigger gespeichert
2. **Email-Benachrichtigungen** funktionieren für alle User
3. **Keine weitere manuelle Synchronisation** notwendig

## Troubleshooting

### "User Pool not found"
- Prüfe, ob der Projektname korrekt ist
- Prüfe, ob der User Pool existiert: `aws cognito-idp list-user-pools --max-results 60`

### "Access Denied"
- Prüfe AWS Credentials: `aws sts get-caller-identity`
- Stelle sicher, dass der IAM User/Role folgende Berechtigungen hat:
  - `cognito-idp:ListUserPools`
  - `cognito-idp:ListUsers`
  - `dynamodb:PutItem`

### "Table not found"
- Prüfe, ob die DynamoDB-Tabelle existiert: `aws dynamodb list-tables`
- Stelle sicher, dass Terraform bereits deployed wurde

## Beispiel-Ausgabe

```
=== Cognito to DynamoDB User Sync ===

Configuration:
  Region: eu-central-1
  User Pool: honigwabe-users
  DynamoDB Table: honigwabe-users

Step 1: Finding Cognito User Pool...
Found User Pool: eu-central-1_ABC123XYZ

Step 2: Fetching all Cognito users...
  Fetched 10 users...
Found 10 total users in Cognito

Step 3: Syncing users to DynamoDB...
  ✓ Synced: user1@example.com
  ✓ Synced: user2@example.com
  ⊘ Skipped (unconfirmed): user3@example.com
  ✓ Synced: user4@example.com
  ...

=== Sync Complete ===

Summary:
  Total users in Cognito: 10
  Successfully synced: 8
  Skipped (unconfirmed): 2
  Errors: 0

✓ All users successfully synced to DynamoDB!
```
