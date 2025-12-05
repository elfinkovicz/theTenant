# 💰 Billing System Setup - Monatliche AWS-Kostenabrechnung

Komplette Anleitung zur Einrichtung des automatischen Abrechnungssystems für AWS-Infrastrukturkosten + Grundgebühr.

## 🎯 Was wird implementiert?

- **Monatliche AWS-Kostenerfassung** via Cost Explorer API
- **Stripe Payment Element** für sichere Zahlungsmethoden
- **Automatische Rechnungserstellung** am 1. des Monats
- **Webhook-Integration** für Zahlungsstatus-Updates
- **Admin-Dashboard** im "Exklusiver Bereich"

## 📋 Voraussetzungen

1. ✅ AWS Account mit aktiviertem Cost Explorer
2. ✅ Stripe Account (Test oder Live)
3. ✅ Node.js installiert (für Lambda-Builds)
4. ✅ Terraform installiert

## 🚀 Setup-Schritte

### Schritt 1: Stripe konfigurieren

1. **Stripe Dashboard öffnen**: https://dashboard.stripe.com

2. **API Keys kopieren**:
   - Gehe zu: Developers → API keys
   - Kopiere:
     - **Publishable key**: `pk_test_...` (für Frontend)
     - **Secret key**: `sk_test_...` (für Backend)

3. **Billing aktivieren**:
   - Gehe zu: Settings → Billing
   - Klicke "Enable Billing"

4. **Webhook erstellen** (NACH Terraform Apply):
   - Gehe zu: Developers → Webhooks
   - Klicke "Add endpoint"
   - URL: `https://your-api-gateway-url/billing/webhook`
   - Events auswählen:
     - ✅ `invoice.paid`
     - ✅ `invoice.payment_failed`
     - ✅ `customer.updated`
     - ✅ `setup_intent.succeeded`
     - ✅ `payment_method.attached`
   - Kopiere **Webhook Secret**: `whsec_...`

### Schritt 2: AWS Cost Explorer aktivieren

1. AWS Console → Billing → Cost Explorer
2. Klicke "Enable Cost Explorer"
3. Warte 24 Stunden für erste Daten

### Schritt 3: Lambda-Funktionen bauen

**Windows (PowerShell):**
```powershell
cd TerraformInfluencerTemplate\modules\billing-system
.\build-lambdas.ps1
```

**Linux/Mac:**
```bash
cd TerraformInfluencerTemplate/modules/billing-system
chmod +x build-lambdas.sh
./build-lambdas.sh
```

### Schritt 4: Terraform Variablen setzen

Bearbeite `TerraformInfluencerTemplate/project.tfvars`:

```hcl
# Billing System aktivieren
enable_billing_system = true
billing_base_fee      = 20  # Grundgebühr in Euro

# Stripe Configuration
stripe_secret_key         = "sk_test_..."  # Dein Secret Key
stripe_publishable_key    = "pk_test_..."  # Dein Publishable Key
stripe_webhook_secret     = "whsec_..."    # Webhook Secret (nach Webhook-Erstellung)
```

### Schritt 5: Frontend Environment Variables

Bearbeite `honigwabe-react/.env`:

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Schritt 6: Dependencies installieren

```bash
cd honigwabe-react
npm install
```

### Schritt 7: Terraform Apply

```bash
cd TerraformInfluencerTemplate
terraform init
terraform plan -var-file=project.tfvars
terraform apply -var-file=project.tfvars
```

**Wichtig**: Notiere die Webhook URL aus dem Output:
```
billing_webhook_url = "https://abc123.execute-api.eu-central-1.amazonaws.com/prod/billing/webhook"
```

### Schritt 8: Webhook URL in Stripe eintragen

1. Zurück zu Stripe Dashboard → Developers → Webhooks
2. Webhook bearbeiten
3. URL eintragen: `<billing_webhook_url aus Terraform Output>`
4. Speichern

### Schritt 9: Frontend deployen

```bash
cd honigwabe-react
npm run build
aws s3 sync dist/ s3://your-website-bucket/
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

## 🧪 Testen

### 1. Zahlungsmethode hinzufügen

1. Als Admin einloggen
2. "Exklusiver Bereich" → Tab "Rechnungen"
3. "Zahlungsmethode hinzufügen" klicken
4. Stripe Test-Karte verwenden:
   - Nummer: `4242 4242 4242 4242`
   - Datum: Beliebig in der Zukunft
   - CVC: Beliebig
   - PLZ: Beliebig

### 2. Aktuelle Kosten prüfen

Im "Rechnungen"-Tab siehst du:
- **Aktueller Monat (Vorschau)**:
  - Grundgebühr: 20,00 €
  - AWS Infrastruktur: X,XX €
  - Geschätzte Summe: XX,XX €
  - AWS Services Breakdown

### 3. Manuelle Rechnung erstellen (Test)

```bash
aws lambda invoke \
  --function-name your-project-cost-calculator \
  --payload '{"action":"calculate_and_invoice"}' \
  response.json

cat response.json
```

### 4. Webhook testen

Stripe Dashboard → Developers → Webhooks → Dein Webhook → "Send test webhook"

Wähle Event: `invoice.paid`

## 📊 Wie funktioniert die monatliche Abrechnung?

```
1. Tag des Monats, 00:00 UTC
         ↓
EventBridge Scheduler triggert Lambda
         ↓
Lambda ruft AWS Cost Explorer API auf
         ↓
Berechnet: Grundgebühr (20€) + AWS-Kosten (letzter Monat)
         ↓
Erstellt Stripe Invoice Items:
  - Item 1: Grundgebühr (20,00 €)
  - Item 2: AWS Infrastruktur (X,XX €)
         ↓
Erstellt und finalisiert Stripe Invoice
         ↓
Stripe zieht Zahlung automatisch ein
         ↓
Webhook: invoice.paid
         ↓
Lambda aktualisiert DynamoDB Status
         ↓
Admin sieht Rechnung im Dashboard
```

## 🔍 Monitoring

### CloudWatch Logs

```bash
# Cost Calculator Logs
aws logs tail /aws/lambda/your-project-cost-calculator --follow

# Webhook Handler Logs
aws logs tail /aws/lambda/your-project-stripe-webhook --follow
```

### Stripe Dashboard

- **Payments**: Alle Zahlungen und Status
- **Invoices**: Alle erstellten Rechnungen
- **Events**: Webhook-Events und Delivery-Status

### DynamoDB Tables

```bash
# Billing Records
aws dynamodb scan --table-name your-project-billing

# Payment Methods
aws dynamodb scan --table-name your-project-payment-methods
```

## 💡 Wichtige Hinweise

### Kosten

Das Billing-System selbst kostet ca. **1-2 € pro Monat**:
- Lambda: ~0,20 €
- DynamoDB: ~0,50 €
- Secrets Manager: ~0,40 €
- EventBridge: kostenlos (1 Regel)

### Sicherheit

- ✅ Stripe Keys in AWS Secrets Manager (verschlüsselt)
- ✅ Webhook Signature Verification
- ✅ Cognito Authentication für API
- ✅ IAM Least Privilege Policies

### Stripe Test vs. Live

**Test Mode** (Entwicklung):
- Keys beginnen mit `pk_test_` und `sk_test_`
- Keine echten Zahlungen
- Test-Karten verwenden

**Live Mode** (Produktion):
- Keys beginnen mit `pk_live_` und `sk_live_`
- Echte Zahlungen
- Separate Webhook-Konfiguration erforderlich

## 🐛 Troubleshooting

### Problem: Keine AWS-Kosten sichtbar

**Lösung**:
1. Cost Explorer aktiviert? (AWS Console → Billing)
2. Mindestens 24h gewartet?
3. IAM Permissions korrekt? (automatisch durch Terraform)

### Problem: Zahlung schlägt fehl

**Lösung**:
1. Zahlungsmethode korrekt hinterlegt?
2. Stripe Dashboard → Payments prüfen
3. Lambda Logs prüfen (CloudWatch)

### Problem: Webhook funktioniert nicht

**Lösung**:
1. Webhook URL korrekt in Stripe?
2. Webhook Secret korrekt in `project.tfvars`?
3. Lambda Logs prüfen
4. Stripe Dashboard → Webhooks → Event Logs

### Problem: "Unauthorized" beim API-Aufruf

**Lösung**:
1. Als Admin eingeloggt?
2. Access Token gültig?
3. Cognito User Pool korrekt konfiguriert?

## 📚 Weitere Ressourcen

- [Stripe Billing Docs](https://stripe.com/docs/billing)
- [AWS Cost Explorer API](https://docs.aws.amazon.com/cost-management/latest/APIReference/API_GetCostAndUsage.html)
- [EventBridge Scheduler](https://docs.aws.amazon.com/scheduler/latest/UserGuide/what-is-scheduler.html)

## 🎉 Fertig!

Das Billing-System ist jetzt einsatzbereit. Am 1. des nächsten Monats wird automatisch die erste Rechnung erstellt und die Zahlung eingezogen.

**Tipp**: Teste vorher mit der manuellen Lambda-Invocation, um sicherzustellen, dass alles funktioniert!
