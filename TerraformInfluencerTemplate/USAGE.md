# Verwendungsanleitung

## Schnellstart

### 1. Konfiguration erstellen
```bash
cp config/project.tfvars.example config/project.tfvars
```

Passe die Werte in `config/project.tfvars` an:
- `project_name`: Eindeutiger Name für dein Projekt
- `domain_name`: Deine Domain (z.B. example.com)
- `website_domain`: Website-Domain (z.B. www.example.com)
- `contact_email_recipient`: E-Mail für Kontaktformular
- `contact_email_sender`: Absender-E-Mail (muss in SES verifiziert sein)

### 2. AWS Voraussetzungen

**SES E-Mail verifizieren:**
```bash
aws ses verify-email-identity --email-address deine@email.com
```

**Route53 Zone (falls nicht vorhanden):**
```bash
aws route53 create-hosted-zone --name example.com --caller-reference $(date +%s)
```

### 3. Deployment

**Mit Deployment-Script:**
```bash
chmod +x deploy.sh
./deploy.sh
```

**Oder manuell:**
```bash
terraform init
terraform plan -var-file="config/project.tfvars"
terraform apply -var-file="config/project.tfvars"
```

### 4. Website-Content hochladen

Kopiere deine Website-Dateien nach `website-content/`:
```bash
cp -r /pfad/zu/deiner/website/* website-content/
```

Upload zu S3:
```bash
BUCKET=$(terraform output -raw s3_bucket_name)
aws s3 sync website-content/ s3://$BUCKET/ --delete
```

CloudFront Cache invalidieren:
```bash
DIST_ID=$(terraform output -raw cloudfront_distribution_id)
aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"
```

## Backend-Integration

### Kontaktformular

```javascript
const response = await fetch('YOUR_CONTACT_API_ENDPOINT/contact', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Max Mustermann',
    email: 'max@example.com',
    message: 'Hallo!'
  })
});
```

### IVS Live-Streaming

**Stream-Key abrufen:**
```bash
terraform output -raw ivs_stream_key
```

**In OBS/Streaming-Software:**
- Server: `terraform output -raw ivs_ingest_endpoint`
- Stream Key: (siehe oben)

**Player einbinden:**
```html
<script src="https://player.live-video.net/1.x.x/amazon-ivs-player.min.js"></script>
<video id="player"></video>
<script>
  const player = IVSPlayer.create();
  player.attachHTMLVideoElement(document.getElementById('player'));
  player.load('YOUR_IVS_PLAYBACK_URL');
</script>
```

### IVS Chat

**Chat-Token anfordern:**
```javascript
const response = await fetch('YOUR_CHAT_API_ENDPOINT/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user123',
    username: 'MaxMustermann'
  })
});
const { token } = await response.json();
```

**Chat SDK verwenden:**
```javascript
import { ChatRoom } from 'amazon-ivs-chat-messaging';

const room = new ChatRoom({
  regionOrUrl: 'eu-central-1',
  tokenProvider: () => token
});

await room.connect();
room.addListener('message', (message) => {
  console.log(message.content);
});
```

### User Authentication (Cognito)

**Login-URL:**
```javascript
const loginUrl = `https://YOUR_COGNITO_DOMAIN.auth.eu-central-1.amazoncognito.com/login?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=${window.location.origin}/callback`;
```

**User-Daten abrufen:**
```javascript
const response = await fetch(`YOUR_USER_API_ENDPOINT/users/${userId}`, {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

## Wiederverwendung für neue Projekte

1. Kopiere das Template-Verzeichnis
2. Erstelle neue `config/project.tfvars`
3. Passe `project_name` und Domain an
4. Führe Deployment durch
5. Kopiere neuen Website-Content

## Nützliche Befehle

**Alle Outputs anzeigen:**
```bash
terraform output
```

**Sensitive Outputs (z.B. Stream Key):**
```bash
terraform output -raw ivs_stream_key
```

**Ressourcen löschen:**
```bash
terraform destroy -var-file="config/project.tfvars"
```

**Einzelne Module aktualisieren:**
```bash
terraform apply -target=module.website -var-file="config/project.tfvars"
```

## Kosten-Optimierung

- **IVS BASIC** statt STANDARD für günstigeres Streaming
- **CloudFront PriceClass_100** nur EU/US (bereits konfiguriert)
- **DynamoDB PAY_PER_REQUEST** für niedrige Nutzung (bereits konfiguriert)
- **S3 Lifecycle** löscht IVS-Aufnahmen nach 30 Tagen (bereits konfiguriert)

## Troubleshooting

**SES Sandbox-Modus:**
Wenn E-Mails nicht ankommen, bist du im SES Sandbox-Modus. Verifiziere Empfänger-E-Mails oder beantrage Production Access.

**Route53 Nameserver:**
Stelle sicher, dass deine Domain auf die Route53 Nameserver zeigt:
```bash
terraform output route53_nameservers
```

**CloudFront Propagierung:**
CloudFront-Änderungen können 15-20 Minuten dauern.
