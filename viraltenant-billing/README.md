# ViralTenant Billing Dashboard

Admin-only Dashboard für die Verwaltung aller Tenant-Rechnungen.

## Zugriff

Das Dashboard ist erreichbar unter:
- **https://viraltenant.com/billing/** (Hauptdomain)
- **https://billing.viraltenant.com** (Subdomain - erfordert DNS-Konfiguration)

## Features

- **Tenant-Übersicht**: Alle Tenants mit aktuellem Monatsumsatz
- **Rechnungshistorie**: Alle Rechnungen aller Tenants
- **Consumption-Tracking**: AWS-Kosten pro Tenant aufgeschlüsselt
- **Rechnungsgenerierung**: Manuelles Auslösen der monatlichen Rechnungserstellung

## Login

Verwenden Sie Ihre ViralTenant Admin-Credentials (Cognito).

## API-Endpoints

Das Dashboard nutzt folgende API-Endpoints:

- `GET /billing/admin/tenants` - Alle Tenants mit Billing-Übersicht
- `GET /billing/admin/invoices` - Alle Rechnungen
- `POST /billing/generate-invoices` - Monatliche Rechnungen generieren

## Deployment

Das Dashboard wird automatisch durch `deploy.py` deployed:

```bash
python deploy.py
```

Die Dateien werden nach `s3://viraltenant-assets-production/billing/` hochgeladen.

## Subdomain-Konfiguration (Optional)

Um `billing.viraltenant.com` zu aktivieren:

1. Route53 CNAME Record erstellen:
   - Name: `billing`
   - Value: `ds90mnbtfsuce.cloudfront.net`

2. CloudFront Alternate Domain hinzufügen:
   - Domain: `billing.viraltenant.com`
   - SSL-Zertifikat aktualisieren

3. CloudFront Function für Host-basiertes Routing hinzufügen
