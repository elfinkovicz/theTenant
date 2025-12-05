# Dual Banner Update - Oberes & Unteres Werbebanner

## Änderungen

### Backend (Lambda)
**Datei:** `TerraformInfluencerTemplate/modules/ad-management/lambda/index.js`

- ✅ Zwei separate Banner-IDs: `live-page-ad-top` und `live-page-ad-bottom`
- ✅ GET `/advertisement` gibt beide Banner zurück
- ✅ PUT `/advertisement` unterstützt `position` Parameter ('top' oder 'bottom')
- ✅ POST `/advertisement/upload-url` unterstützt `position` Parameter
- ✅ DELETE `/advertisement/image` unterstützt `position` Parameter
- ✅ Backward compatibility für alten Code

### Frontend Service
**Datei:** `honigwabe-react/src/services/advertisement.service.ts`

- ✅ Neue Methode: `getAdvertisements()` - Lädt beide Banner
- ✅ `uploadImage()` unterstützt `position` Parameter
- ✅ `deleteImage()` unterstützt `position` Parameter
- ✅ `updateAdvertisement()` unterstützt `position` Parameter
- ✅ Backward compatibility mit `getAdvertisement()`

### Frontend Component
**Datei:** `honigwabe-react/src/components/AdManagement.tsx`

- ✅ Lädt beide Banner beim Start
- ✅ Speichert beide Banner separat
- ✅ Separate Upload-Funktionalität für jedes Banner
- ✅ Separate Aktivierungs-Checkboxen

## API Struktur

### GET /advertisement
```json
{
  "topBanner": {
    "adId": "live-page-ad-top",
    "position": "top",
    "imageKey": "advertisements/top/123_image.jpg",
    "imageUrl": "https://cdn.example.com/advertisements/top/123_image.jpg",
    "linkUrl": "https://example.com",
    "enabled": true,
    "updatedAt": "2025-01-01T12:00:00Z"
  },
  "bottomBanner": {
    "adId": "live-page-ad-bottom",
    "position": "bottom",
    "imageKey": "advertisements/bottom/456_image.jpg",
    "imageUrl": "https://cdn.example.com/advertisements/bottom/456_image.jpg",
    "linkUrl": "https://example.com",
    "enabled": true,
    "updatedAt": "2025-01-01T12:00:00Z"
  },
  "advertisement": { /* topBanner für Backward Compatibility */ }
}
```

### PUT /advertisement
```json
{
  "position": "top",  // oder "bottom"
  "imageKey": "advertisements/top/123_image.jpg",
  "linkUrl": "https://example.com",
  "enabled": true
}
```

### POST /advertisement/upload-url
```json
{
  "fileName": "banner.jpg",
  "fileType": "image/jpeg",
  "position": "top"  // oder "bottom"
}
```

### DELETE /advertisement/image
```json
{
  "position": "top"  // oder "bottom"
}
```

## Deployment

### 1. Backend deployen
```bash
cd TerraformInfluencerTemplate
terraform apply -var-file="clients/honigwabe/terraform.tfvars"
```

### 2. Frontend deployen
```bash
cd honigwabe-react
npm run build
# Deploy dist/ zu S3
```

## Testing

### 1. Oberes Banner hochladen
1. Als Admin einloggen
2. Zu "Werbebanner verwalten" gehen
3. Oberes Banner: Bild hochladen, Link setzen, aktivieren
4. Speichern

### 2. Unteres Banner hochladen
1. Unteres Banner: Bild hochladen, Link setzen, aktivieren
2. Speichern

### 3. Prüfen
- Beide Banner sollten auf der Live-Seite angezeigt werden
- Jedes Banner kann separat aktiviert/deaktiviert werden
- Jedes Banner hat eigenen Link

## Backward Compatibility

✅ Alter Code der nur `getAdvertisement()` verwendet funktioniert weiterhin
✅ API gibt `advertisement` Feld zurück (= topBanner)
✅ Keine Breaking Changes

## Datenbankstruktur

DynamoDB Table: `honigwabe-advertisements`

**Top Banner:**
```
adId: "live-page-ad-top"
position: "top"
imageKey: "advertisements/top/..."
linkUrl: "..."
enabled: true
updatedAt: "..."
```

**Bottom Banner:**
```
adId: "live-page-ad-bottom"
position: "bottom"
imageKey: "advertisements/bottom/..."
linkUrl: "..."
enabled: true
updatedAt: "..."
```

## Vorteile

✅ **Separate Konfiguration** - Jedes Banner unabhängig
✅ **Separate Aktivierung** - Nur eines oder beide anzeigen
✅ **Separate Links** - Verschiedene Ziele möglich
✅ **Organisierte S3 Struktur** - `/advertisements/top/` und `/advertisements/bottom/`
✅ **Backward Compatible** - Kein Breaking Change

## Zusammenfassung

Das untere Banner wird jetzt vollständig ins Backend hochgeladen und gespeichert, genau wie das obere Banner. Beide Banner können unabhängig voneinander konfiguriert, aktiviert und deaktiviert werden.
