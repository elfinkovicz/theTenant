# Mollie Connect Integration für ViralTenant

## Übersicht

Die Mollie Connect Integration ermöglicht zwei Abrechnungsszenarien:

### 1. Creator → ViralTenant (bereits implementiert)
- Creator zahlen 30€ Grundgebühr + AWS-Infrastrukturkosten an dich
- SEPA-Lastschrift über `MolliePaymentSetup.tsx`
- Monatliche automatische Abbuchung

### 2. Creator → Mitglieder (NEU - Mollie Connect)
- Creator verbinden ihr eigenes Mollie-Konto
- Mitglieder-Zahlungen gehen direkt an den Creator
- OAuth-basierte sichere Verbindung

## Einrichtung Mollie Connect

### 1. OAuth App bei Mollie erstellen

1. Gehe zu https://www.mollie.com/dashboard
2. Klicke auf "More" → "Developers"
3. Wähle "Your apps" Tab
4. Klicke "Create Application"
5. Fülle aus:
   - **App Name**: ViralTenant
   - **Description**: Multi-Tenant Creator Platform
   - **Redirect URL**: `https://api.viraltenant.com/production/billing/mollie/connect/callback`
6. Aktiviere optional "Co-Branded Onboarding"
7. Speichere und notiere:
   - **Client ID**: `app_...`
   - **Client Secret**: `...`

### 2. OAuth Scopes

Die App benötigt folgende Berechtigungen:
- `payments.read` / `payments.write` - Zahlungen verwalten
- `customers.read` / `customers.write` - Kunden verwalten
- `mandates.read` / `mandates.write` - SEPA-Mandate
- `subscriptions.read` / `subscriptions.write` - Abonnements
- `profiles.read` - Profil-Informationen
- `organizations.read` - Organisations-Informationen

### 3. Terraform Variablen konfigurieren

In `terraform.tfvars`:

```hcl
# Mollie Connect (OAuth)
mollie_client_id     = "app_..."
mollie_client_secret = "..."
mollie_redirect_uri  = "https://api.viraltenant.com/production/billing/mollie/connect/callback"
mollie_profile_id    = "pfl_Ag7i7PW7sH"

# Bestehende Mollie API Keys (für Creator → ViralTenant)
mollie_api_key       = "test_AFJDu3aGV4RbDmNgvhU85BQn4fznhA"
```

### 4. Lambda deployen

```bash
cd viraltenant-infrastructure
terraform apply
```

## API Endpoints

### Mollie Connect (OAuth)

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/billing/mollie/connect/authorize/{tenantId}` | POST | OAuth URL generieren |
| `/billing/mollie/connect/callback` | GET | OAuth Callback |
| `/billing/mollie/connect/status/{tenantId}` | GET | Verbindungsstatus prüfen |
| `/billing/mollie/connect/{tenantId}` | DELETE | Verbindung trennen |

### Mitglieder-Abrechnung

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/billing/mollie/connect/create-member-customer/{tenantId}` | POST | Mitglied als Kunde anlegen |
| `/billing/mollie/connect/create-member-mandate/{tenantId}` | POST | SEPA-Mandat für Mitglied |
| `/billing/mollie/connect/create-member-subscription/{tenantId}` | POST | Abo für Mitglied erstellen |
| `/billing/mollie/connect/member-subscriptions/{tenantId}` | GET | Alle Mitglieder-Abos |
| `/billing/mollie/connect/member-subscription/{tenantId}/{subscriptionId}` | DELETE | Abo kündigen |
| `/billing/mollie/connect/webhook` | POST | Webhook für Zahlungen |

## Frontend-Komponenten

### MollieConnectSetup.tsx

Zeigt den Verbindungsstatus und ermöglicht das Verbinden/Trennen:

```tsx
import { MollieConnectSetup } from '../components/MollieConnectSetup'

<MollieConnectSetup 
  tenantId={tenantId}
  onStatusChange={(connected) => console.log('Connected:', connected)}
/>
```

### MolliePaymentSetup.tsx (bestehend)

Für Creator → ViralTenant Zahlungen (30€ + AWS-Kosten).

## Flow: Creator verbindet Mollie

1. Creator klickt "Mit Mollie verbinden"
2. Redirect zu Mollie OAuth
3. Creator autorisiert die App
4. Callback speichert Access Token
5. Creator kann jetzt Mitglieder abrechnen

## Flow: Mitglied abonniert

1. Creator erstellt Mitglied als Mollie-Kunde
2. Mitglied richtet SEPA-Mandat ein (erste Zahlung)
3. Creator erstellt Subscription
4. Monatliche automatische Abbuchung

## Testen

### Test-Modus

Mit dem Test API Key (`test_...`) kannst du den Flow testen ohne echte Zahlungen.

### Test-Bankkonten

Mollie stellt Test-IBANs bereit:
- `NL91ABNA0417164300` - Erfolgreiche Zahlung
- `NL53INGB0654422370` - Fehlgeschlagene Zahlung

## Deine Mollie-Daten

- **Client ID**: `app_GYccPvztAbzr4FsyGXAnmt6A`
- **Client Secret**: `PEyPUKrUQKAvf8sE3Sj7ssQv4aEC4R4HW7QaMS3b`
- **Redirect URI**: `https://viraltenant.com/mollie-callback`
- **Profile ID**: `pfl_Ag7i7PW7sH`
- **Test API Key**: `test_AFJDu3aGV4RbDmNgvhU85BQn4fznhA`
- **Live API Key**: Wird nach Verifizierung freigeschaltet

## Nächste Schritte

1. ✅ OAuth App bei Mollie erstellt (Client ID: `app_GYccPvztAbzr4FsyGXAnmt6A`)
2. Lambda deployen: `cd viraltenant-infrastructure && terraform apply`
3. Frontend bauen und deployen: `cd viraltenant-react && npm run build`
4. Testen: Gehe zu `/tenant` → Tab "Monetarisierung" → "Zahlungsanbieter"
5. Klicke "Mit Mollie verbinden" und autorisiere die App
