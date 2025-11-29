# Advertisement Management Setup

## Übersicht

Das Advertisement Management System ermöglicht es Admins, ein Werbebanner auf der Live-Seite zu verwalten. Das Banner wird oben und unten auf der Live-Seite angezeigt.

## Features

✅ **Single Banner Management** - Ein zentrales Werbebanner für die Live-Seite
✅ **Image Upload** - Admins können Werbebilder hochladen (empfohlen: 1920x240px)
✅ **Optional Link** - Banner kann mit einer URL verlinkt werden
✅ **Enable/Disable** - Banner kann aktiviert/deaktiviert werden
✅ **CDN Delivery** - Bilder werden über CloudFront ausgeliefert
✅ **Admin-Only** - Nur Admins können Banner verwalten

## Deployment

### 1. Konfiguration aktivieren

In `deployment_config.py`:

```python
self.ENABLE_AD_MANAGEMENT = True
```

### 2. Deployment ausführen

```bash
python deploy.py
```

Das Script wird automatisch:
- Das Advertisement Management Modul deployen
- DynamoDB Tabelle erstellen
- Lambda-Funktion deployen
- API-Endpunkte konfigurieren
- Berechtigungen einrichten

### 3. Frontend deployen

Nach dem Terraform-Deployment:

```bash
cd honigwabe-react
npm run build
# Upload zu S3 (wird vom deploy.py Script gemacht)
```

## Verwendung

### Als Admin

1. **Auf Live-Seite gehen**
   - Navigiere zu `https://www.honigwabe.live/live`

2. **Banner bearbeiten**
   - Hover über den Banner-Bereich
   - Klicke auf den Edit-Button (erscheint beim Hover)

3. **Bild hochladen**
   - Klicke auf den Upload-Bereich
   - Wähle ein Bild (empfohlen: 1920x240px, PNG oder JPG)
   - Das Bild wird automatisch hochgeladen

4. **Link hinzufügen (optional)**
   - Gib eine URL ein (z.B. `https://example.com`)
   - Das Banner wird anklickbar

5. **Banner aktivieren/deaktivieren**
   - Checkbox "Werbebanner aktiviert" an/aus
   - Deaktivierte Banner werden nicht angezeigt

6. **Speichern**
   - Klicke auf "Speichern"
   - Banner wird sofort aktualisiert

## Technische Details

### Architektur

```
┌─────────────────┐
│   Live Page     │
│  (React App)    │
└────────┬────────┘
         │
         ├─ GET /advertisement (public)
         ├─ PUT /advertisement (admin)
         ├─ POST /advertisement/upload-url (admin)
         └─ DELETE /advertisement/image (admin)
         │
┌────────▼────────┐
│  API Gateway    │
│  + JWT Auth     │
└────────┬────────┘
         │
┌────────▼────────┐
│ Lambda Function │
│   (Node.js)     │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼──┐  ┌──▼──┐
│ DDB  │  │ S3  │
│Table │  │+CDN │
└──────┘  └─────┘
```

### API Endpoints

#### Public
- `GET /advertisement` - Aktuelles Banner abrufen

#### Admin (JWT Auth)
- `PUT /advertisement` - Banner aktualisieren
- `POST /advertisement/upload-url` - Presigned URL für Upload
- `DELETE /advertisement/image` - Banner-Bild löschen

### DynamoDB Schema

```json
{
  "adId": "live-page-ad",
  "imageKey": "advertisements/1234567890_banner.jpg",
  "linkUrl": "https://example.com",
  "enabled": true,
  "updatedAt": "2025-11-29T22:00:00.000Z"
}
```

### S3 Struktur

```
{thumbnails-bucket}/
└── advertisements/
    └── {timestamp}_{filename}
```

## Empfohlene Banner-Größen

- **Desktop**: 1920x240px
- **Format**: PNG oder JPG
- **Dateigröße**: < 5MB
- **Aspect Ratio**: 8:1

## Kosten

Geschätzte monatliche Kosten:
- DynamoDB: < $0.10 (Pay-per-request, sehr wenige Requests)
- Lambda: < $0.10 (nur bei API-Aufrufen)
- S3: < $0.10 (Speicherung eines Bildes)
- CloudFront: Bereits vorhanden

**Total: < $1/Monat**

## Troubleshooting

### Banner wird nicht angezeigt

1. **Prüfe ob Banner aktiviert ist**
   - Im Admin-Modal: Checkbox "Werbebanner aktiviert"

2. **Prüfe ob Bild hochgeladen wurde**
   - Im Admin-Modal sollte Bild-Preview sichtbar sein

3. **Prüfe Browser-Konsole**
   - Öffne Developer Tools (F12)
   - Schaue nach Fehlermeldungen

4. **Prüfe API-Endpunkt**
   ```bash
   curl https://API_URL/advertisement
   ```

### Upload schlägt fehl

1. **Prüfe Dateigröße**
   - Max. 5MB

2. **Prüfe Dateiformat**
   - Nur PNG, JPG, JPEG

3. **Prüfe Admin-Rechte**
   - Nur Mitglieder der "admins" Cognito-Gruppe

### Banner nicht anklickbar

1. **Prüfe Link-URL**
   - Muss vollständige URL sein (mit https://)
   - Beispiel: `https://example.com`

## Erweiterungen

Mögliche zukünftige Features:
- Mehrere Banner-Positionen (top, bottom, sidebar)
- Zeitgesteuerte Banner (Start-/Enddatum)
- A/B-Testing verschiedener Banner
- Click-Tracking und Analytics
- Banner-Rotation

## Support

Bei Problemen:
1. Prüfe CloudWatch Logs der Lambda-Funktion
2. Prüfe Browser Developer Console
3. Prüfe DynamoDB Tabelle im AWS Console
