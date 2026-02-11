---
inclusion: manual
---
# Mollie Payment Integration

## Zwei Abrechnungsmodelle

| Modell | Flow | Verwendung |
|--------|------|------------|
| Platform Billing | Creator → ViralTenant | 30€ + AWS-Kosten, SEPA-Lastschrift |
| Mollie Connect | Mitglieder → Creator | OAuth, Split Payments für Memberships |

## Platform Billing Endpoints (`mollie-handlers.js`)
```
GET  /billing/mollie/customer/{tenantId}        # Status prüfen
POST /billing/mollie/create-customer/{tenantId} # Kunde erstellen
POST /billing/mollie/create-first-payment/{tenantId} # SEPA-Mandat
POST /billing/mollie/charge/{tenantId}          # Recurring Payment
POST /billing/mollie/process-monthly            # Cron: Monatlich
```

## Mollie Connect Endpoints (`mollie-connect-handlers.js`)
```
POST /billing/mollie/connect/authorize/{tenantId}  # OAuth URL
GET  /billing/mollie/connect/callback              # OAuth Callback
GET  /billing/mollie/connect/status/{tenantId}     # Verbindungsstatus
POST /billing/mollie/connect/create-member-subscription/{tenantId} # Abo erstellen
```

## Frontend-Komponenten
```tsx
<MolliePaymentSetup tenantId={id} />      // Platform Billing
<MollieConnectSetup tenantId={id} />      // Creator → Mitglieder
```

## DynamoDB Felder
```
tenants: mollie_connect_status, mollie_connect_access_token, mollie_profile_id
billing: mollie_customer_id, mollie_mandate_id, subscription_status
memberships: mollie_subscription_id, membership_status, subscription_amount
```

## Test-Modus
- API Key: `test_...`
- Test-IBAN Erfolg: `NL91ABNA0417164300`
- Test-IBAN Fehler: `NL53INGB0654422370`
