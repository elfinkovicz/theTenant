# WhatsApp Integration für Newsfeed

Dieses Modul integriert AWS End User Messaging (Social Messaging), um Newsfeed-Posts automatisch in eine WhatsApp-Gruppe zu senden.

## Features

- ✅ Automatische Benachrichtigung bei neuen Newsfeed-Posts
- ✅ Unterstützung für Text, Bilder und Videos
- ✅ Formatierte Nachrichten mit Titel, Beschreibung, Standort und Links
- ✅ Nur veröffentlichte Posts werden gesendet (status = 'published')
- ✅ DynamoDB Streams für Echtzeit-Benachrichtigungen

## Voraussetzungen

### 1. AWS End User Messaging einrichten

1. **WhatsApp Business Account erstellen**
   - Gehe zu [Meta Business Suite](https://business.facebook.com/)
   - Erstelle einen WhatsApp Business Account
   - Verifiziere deine Telefonnummer

2. **AWS End User Messaging konfigurieren**
   ```bash
   # In der AWS Console:
   # 1. Gehe zu "End User Messaging" > "Social Messaging"
   # 2. Klicke auf "Create phone number"
   # 3. Verbinde deinen WhatsApp Business Account
   # 4. Notiere die Phone Number ID
   ```

3. **WhatsApp Gruppe erstellen**
   - Erstelle eine WhatsApp-Gruppe
   - Füge die Business-Nummer zur Gruppe hinzu
   - Notiere die Gruppen-ID (Format: `120363XXXXXXXXXX@g.us`)

### 2. Terraform-Variablen setzen

In `project.tfvars`:

```hcl
# WhatsApp Integration aktivieren
enable_whatsapp_integration = true

# WhatsApp Phone Number ID (aus AWS Console)
whatsapp_phone_number_id = "1234567890"

# WhatsApp Group ID (aus WhatsApp)
whatsapp_group_id = "120363XXXXXXXXXX@g.us"
```

### 3. Deployment

```bash
cd TerraformInfluencerTemplate
terraform init
terraform plan -var-file=project.tfvars
terraform apply -var-file=project.tfvars
```

## Funktionsweise

1. **Post erstellen**: Admin erstellt einen Post im Frontend
2. **DynamoDB**: Post wird in der Newsfeed-Tabelle gespeichert
3. **Stream**: DynamoDB Stream erkennt neuen Eintrag
4. **Lambda**: WhatsApp-Lambda wird getriggert
5. **WhatsApp**: Nachricht wird an die Gruppe gesendet

## Nachrichtenformat

```
*Post-Titel*

Post-Beschreibung

📍 Standort (falls vorhanden)
🔗 Link (falls vorhanden)
```

Bei Bildern oder Videos wird das Medium mit der Nachricht gesendet.

## Kosten

- **AWS End User Messaging**: ~$0.005 pro Nachricht
- **Lambda**: Sehr geringe Kosten (Free Tier verfügbar)
- **DynamoDB Streams**: Kostenlos

## Troubleshooting

### Nachrichten werden nicht gesendet

1. **Prüfe CloudWatch Logs**:
   ```bash
   aws logs tail /aws/lambda/[project-name]-whatsapp-notifier --follow
   ```

2. **Prüfe IAM-Berechtigungen**:
   - Lambda benötigt `social-messaging:SendWhatsAppMessage`
   - Lambda benötigt Zugriff auf DynamoDB Stream

3. **Prüfe WhatsApp-Konfiguration**:
   - Phone Number ID korrekt?
   - Group ID korrekt?
   - Business-Nummer in der Gruppe?

### Medien werden nicht gesendet

- Stelle sicher, dass die CDN-URLs öffentlich zugänglich sind
- Prüfe, dass die Dateiformate unterstützt werden (JPEG, PNG, MP4)
- Maximale Dateigröße: 16MB für Bilder, 16MB für Videos

## Deaktivierung

Um die WhatsApp-Integration zu deaktivieren:

```hcl
enable_whatsapp_integration = false
```

Dann:
```bash
terraform apply -var-file=project.tfvars
```
