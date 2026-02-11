# ViralTenant Assets

Dieser Ordner enthält statische Assets für das Billing-System.

## Logo für Rechnungen

Bitte legen Sie Ihr Firmenlogo hier ab:

- **Dateiname:** `viraltenant-logo.png`
- **Empfohlene Größe:** 360x120 Pixel (3:1 Verhältnis)
- **Format:** PNG mit transparentem Hintergrund
- **Maximale Dateigröße:** 500KB

Das Logo erscheint oben links auf jeder generierten Rechnung.

## Deployment

Nach dem Hinzufügen des Logos, führen Sie das Deployment-Skript aus:

```bash
cd viraltenant-infrastructure
chmod +x scripts/deploy-billing-config.sh
./scripts/deploy-billing-config.sh
```

Oder manuell:

```bash
aws s3 cp assets/viraltenant-logo.png s3://viraltenant-assets-production/assets/viraltenant-logo.png
```

## Konfiguration

Die Rechnungsdaten werden in `config/billing-config.json` konfiguriert:

- Firmenname und Adresse
- Bankverbindung (IBAN, BIC)
- Steuernummer und USt-IdNr.
- Rechnungstexte

Bitte füllen Sie alle Felder aus bevor Sie das Billing-System aktivieren!
