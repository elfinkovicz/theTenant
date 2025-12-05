# Banner Separation Fix

## Problem
Die beiden Werbebanner (oben und unten) waren nicht vollständig getrennt voneinander konfigurierbar. Das untere Banner hat die Einstellungen vom oberen Banner übernommen.

## Lösung

### Änderungen in AdManagement.tsx

**1. Separate State-Variablen für imageKeys:**
```typescript
// Top Banner
const [topImageKey, setTopImageKey] = useState<string | null>(null)

// Bottom Banner  
const [bottomImageKey, setBottomImageKey] = useState<string | null>(null)
```

**2. Laden der Banner:**
```typescript
// Load top banner
if (topBanner) {
  setTopLinkUrl(topBanner.linkUrl || '')
  setTopEnabled(topBanner.enabled)
  setTopImagePreview(topBanner.imageUrl || null)
  setTopImageKey(topBanner.imageKey || null)  // ✅ Speichert imageKey
}

// Load bottom banner
if (data.bottomBanner) {
  setBottomLinkUrl(data.bottomBanner.linkUrl || '')
  setBottomEnabled(data.bottomBanner.enabled)
  setBottomImagePreview(data.bottomBanner.imageUrl || null)
  setBottomImageKey(data.bottomBanner.imageKey || null)  // ✅ Speichert imageKey
}
```

**3. Speichern der Banner:**
```typescript
// Top Banner - verwendet topImageKey
let finalTopImageKey = topImageKey

if (topImageFile) {
  // Neues Bild hochgeladen
  const { imageKey: newImageKey } = await uploadImage(topImageFile, 'top')
  finalTopImageKey = newImageKey
} else if (!topImagePreview && topImageKey) {
  // Bild entfernt
  await deleteImage('top')
  finalTopImageKey = null
}

await updateAdvertisement({
  position: 'top',
  imageKey: finalTopImageKey,  // ✅ Verwendet eigenen imageKey
  linkUrl: topLinkUrl,
  enabled: topEnabled
})

// Bottom Banner - verwendet bottomImageKey
let finalBottomImageKey = bottomImageKey

if (bottomImageFile) {
  // Neues Bild hochgeladen
  const { imageKey: newImageKey } = await uploadImage(bottomImageFile, 'bottom')
  finalBottomImageKey = newImageKey
} else if (!bottomImagePreview && bottomImageKey) {
  // Bild entfernt
  await deleteImage('bottom')
  finalBottomImageKey = null
}

await updateAdvertisement({
  position: 'bottom',
  imageKey: finalBottomImageKey,  // ✅ Verwendet eigenen imageKey
  linkUrl: bottomLinkUrl,
  enabled: bottomEnabled
})
```

## Was ist jetzt anders?

### Vorher ❌
```
Top Banner:
- Bild: banner1.jpg
- Link: https://example.com
- Aktiviert: ✓

Bottom Banner:
- Bild: banner1.jpg  ← FALSCH! Verwendet gleiches Bild
- Link: https://other.com
- Aktiviert: ✓
```

### Nachher ✅
```
Top Banner:
- Bild: top-banner.jpg
- imageKey: advertisements/top/123_top-banner.jpg
- Link: https://example.com
- Aktiviert: ✓

Bottom Banner:
- Bild: bottom-banner.jpg
- imageKey: advertisements/bottom/456_bottom-banner.jpg
- Link: https://other.com
- Aktiviert: ✓
```

## Funktionalität

### Oberes Banner
- ✅ Eigenes Bild hochladen
- ✅ Eigene Link-URL
- ✅ Eigene Aktivierungs-Checkbox
- ✅ Unabhängig vom unteren Banner

### Unteres Banner
- ✅ Eigenes Bild hochladen
- ✅ Eigene Link-URL
- ✅ Eigene Aktivierungs-Checkbox
- ✅ Unabhängig vom oberen Banner

## Testing

### 1. Beide Banner hochladen
1. Als Admin einloggen
2. Werbebanner verwalten öffnen
3. **Oberes Banner:**
   - Bild hochladen (z.B. top-banner.jpg)
   - Link setzen (z.B. https://top.com)
   - Aktivieren
4. **Unteres Banner:**
   - Bild hochladen (z.B. bottom-banner.jpg)
   - Link setzen (z.B. https://bottom.com)
   - Aktivieren
5. Speichern

### 2. Prüfen
- Beide Banner sollten unterschiedliche Bilder zeigen
- Beide Banner sollten unterschiedliche Links haben
- Jedes Banner kann separat aktiviert/deaktiviert werden

### 3. Einzeln bearbeiten
- Nur oberes Banner ändern → Unteres bleibt unverändert ✅
- Nur unteres Banner ändern → Oberes bleibt unverändert ✅

## Deployment

Nach dem Terraform Apply:
```bash
cd honigwabe-react
npm run build
# Deploy dist/ zu S3
```

## Zusammenfassung

✅ **Oberes Banner** - Vollständig unabhängig
✅ **Unteres Banner** - Vollständig unabhängig
✅ **Separate Bilder** - Jedes Banner hat eigenes Bild
✅ **Separate Links** - Jedes Banner hat eigenen Link
✅ **Separate Aktivierung** - Jedes Banner kann einzeln aktiviert werden
✅ **Separate Speicherung** - Jedes Banner wird separat im Backend gespeichert

Die Banner sind jetzt vollständig getrennt voneinander konfigurierbar! 🎉
