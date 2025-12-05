# Billing System Module

Monatliche AWS-Kostenabrechnung mit Stripe Integration für automatische Zahlungsabwicklung.

## Features

- ✅ **AWS Cost Explorer Integration** - Automatische Erfassung der monatlichen AWS-Kosten
- ✅ **Stripe Payment Element** - Sichere Zahlungsmethoden-Erfassung (Kreditkarte, SEPA)
- ✅ **Automatische Rechnungserstellung** - Monatliche Invoices mit AWS-Kosten + Grundgebühr
- ✅ **EventBridge Scheduler** - Automatische Abrechnung am 1. des Monats
- ✅ **Webhook Integration** - Echtzeit-Updates für Zahlungsstatus
- ✅ **DynamoDB Storage** - Persistente Speicherung von Rechnungen und Zahlungsmethoden

## Architektur

```
┌─────────────────┐
│  EventBridge    │  Monatlicher Trigger (1. des Monats)
│   Scheduler     │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Cost Calculator │  1. AWS Kosten abrufen (Cost Explorer)
│     Lambda      │  2. Stripe Invoice erstellen
└────────┬────────┘  3. Zahlung einziehen
         │
         v
┌─────────────────┐
│     Stripe      │  Invoice Items + Invoice
│                 │  Automatische Zahlung
└────────┬────────┘
         │
         v
┌─────────────────┐
│    Webhook      │  invoice.paid
│     Lambda      │  invoice.payment_failed
└────────┬────────┘  customer.updated
         │
         v
┌─────────────────┐
│    DynamoDB     │  Billing Records
│                 │  Payment Methods
└─────────────────┘
```

## Setup

### 1. Lambda-Funktionen bauen

```bash
cd TerraformInfluencerTemplate/modules/billing-system
./build-lambdas.sh
```

### 2. Stripe konfigurieren

1. **Stripe Dashboard** öffnen: https://dashboard.stripe.com
2. **API Keys** kopieren:
   - Publishable Key: `pk_test_...` oder `pk_live_...`
   - Secret Key: `sk_test_...` oder `sk_live_...`

3. **Webhook erstellen**:
   - Gehe zu: Developers → Webhooks → Add endpoint
   - URL: `https://your-api.com/billing/webhook` (nach Terraform Apply)
   - Events auswählen:
     - `invoice.paid`
     - `invoice.payment_failed`
     - `customer.updated`
     - `setup_intent.succeeded`
     - `payment_method.attached`
   - Webhook Secret kopieren: `whsec_...`

4. **Billing aktivieren**:
   - Gehe zu: Settings → Billing
   - "Enable Billing" aktivieren

### 3. Terraform Variablen setzen

In `project.tfvars`:

```hcl
# Billing System
enable_billing_system = true
billing_base_fee      = 20  # Euro

# Stripe Keys
stripe_secret_key         = "sk_test_..."
stripe_publishable_key    = "pk_test_..."
stripe_webhook_secret     = "whsec_..."
```

### 4. Frontend Environment Variables

In `honigwabe-react/.env`:

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### 5. Terraform Apply

```bash
cd TerraformInfluencerTemplate
terraform init
terraform plan -var-file=project.tfvars
terraform apply -var-file=project.tfvars
```

### 6. IAM Permissions für Cost Explorer

Das Billing-System benötigt Zugriff auf AWS Cost Explorer. Stelle sicher, dass:

1. **Cost Explorer aktiviert** ist:
   - AWS Console → Billing → Cost Explorer
   - "Enable Cost Explorer" klicken

2. **IAM Permissions** vorhanden sind (wird automatisch durch Terraform erstellt):
   - `ce:GetCostAndUsage`
   - `ce:GetCostForecast`

## Verwendung

### Admin-Bereich

1. Als Admin einloggen
2. "Exklusiver Bereich" → Tab "Rechnungen"
3. Zahlungsmethode hinzufügen (Stripe Payment Element)
4. Rechnungshistorie und aktuelle Kosten einsehen

### Monatliche Abrechnung

- **Automatisch**: Am 1. des Monats um 00:00 UTC
- **Manuell**: Lambda-Funktion direkt aufrufen (für Tests)

```bash
aws lambda invoke \
  --function-name your-project-cost-calculator \
  --payload '{"action":"calculate_and_invoice"}' \
  response.json
```

## Kostenberechnung

```
Monatliche Rechnung = Grundgebühr + AWS-Kosten

Beispiel:
- Grundgebühr: 20,00 €
- AWS Lambda: 5,23 €
- AWS S3: 2,15 €
- AWS CloudFront: 8,47 €
- AWS DynamoDB: 1,89 €
─────────────────────
Gesamt: 37,74 €
```

## API Endpoints

### GET /billing
Rechnungen und aktuelle Kosten abrufen

**Headers:**
```
Authorization: Bearer <cognito-token>
```

**Response:**
```json
{
  "invoices": [...],
  "currentMonth": {
    "baseFee": 20,
    "awsCosts": 17.74,
    "awsBreakdown": {
      "AWS Lambda": 5.23,
      "Amazon Simple Storage Service": 2.15,
      ...
    },
    "estimatedTotal": 37.74,
    "period": {
      "start": "2024-12-01",
      "end": "2025-01-01"
    }
  }
}
```

### POST /billing/setup-intent
SetupIntent für Payment Element erstellen

**Headers:**
```
Authorization: Bearer <cognito-token>
```

**Response:**
```json
{
  "clientSecret": "seti_...",
  "customerId": "cus_..."
}
```

### POST /billing/webhook
Stripe Webhook Handler (keine Auth erforderlich)

## Troubleshooting

### Keine AWS-Kosten sichtbar

1. Cost Explorer aktiviert?
2. IAM Permissions korrekt?
3. Mindestens 1 Tag Daten vorhanden?

### Zahlung schlägt fehl

1. Zahlungsmethode korrekt hinterlegt?
2. Stripe Dashboard → Payments prüfen
3. Lambda Logs prüfen: CloudWatch → `/aws/lambda/your-project-stripe-webhook`

### Webhook funktioniert nicht

1. Webhook URL korrekt in Stripe Dashboard?
2. Webhook Secret korrekt in Secrets Manager?
3. Lambda Logs prüfen

## Sicherheit

- ✅ Stripe Keys in AWS Secrets Manager
- ✅ Webhook Signature Verification
- ✅ Cognito Authentication für API
- ✅ Encrypted DynamoDB Tables
- ✅ IAM Least Privilege Policies

## Kosten

Geschätzte monatliche Kosten für das Billing-System selbst:

- Lambda Executions: ~$0.20
- DynamoDB: ~$0.50
- EventBridge Scheduler: $0.00 (1 Regel kostenlos)
- Secrets Manager: $0.40
- **Gesamt: ~$1.10/Monat**

## Support

Bei Fragen oder Problemen:
1. Lambda Logs prüfen (CloudWatch)
2. Stripe Dashboard → Events prüfen
3. DynamoDB Tables prüfen
