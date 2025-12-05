# Banner Display Fix - Separate Bilder für Top & Bottom

## Problem
Die Live-Seite hat beide Banner (oben und unten) vom gleichen Bild geladen. Beide Bereiche haben auf die gleiche Ressource im Bucket gezeigt.

## Lösung

### Änderungen in Live.tsx

**1. Separate State-Variablen:**
```typescript
// Vorher:
const [advertisement, setAdvertisement] = useState<Advertisement | null>(null)

// Nachher:
const [topBanner, setTopBanner] = useState<Advertisement | null>(null)
const [bottomBanner, setBottomBanner] = useState<Advertisement | null>(null)
```

**2. Laden beider Banner:**
```typescript
const loadAdvertisement = async () => {
  try {
    const data = await advertisementService.getAdvertisements()
    if (data) {
      setTopBanner(data.topBanner)      // ✅ Lädt oberes Banner
      setBottomBanner(data.bottomBanner) // ✅ Lädt unteres Banner
    }
  } catch (error) {
    console.error('Failed to load advertisement:', error)
  }
}
```

**3. Anzeige Top Banner:**
```typescript
{topBanner?.enabled && topBanner?.imageUrl ? (
  topBanner.linkUrl ? (
    <a href={topBanner.linkUrl}>
      <img src={topBanner.imageUrl} alt="Top Advertisement" />
    </a>
  ) : (
    <img src={topBanner.imageUrl} alt="Top Advertisement" />
  )
) : null}
```

**4. Anzeige Bottom Banner:**
```typescript
{bottomBanner?.enabled && bottomBanner?.imageUrl ? (
  bottomBanner.linkUrl ? (
    <a href={bottomBanner.linkUrl}>
      <img src={bottomBanner.imageUrl} alt="Bottom Advertisement" />
    </a>
  ) : (
    <img src={bottomBanner.imageUrl} alt="Bottom Advertisement" />
  )
) : null}
```

## Datenfluss

### Backend → Frontend

**API Response:**
```json
{
  "topBanner": {
    "adId": "live-page-ad-top",
    "imageKey": "advertisements/top/123_top.jpg",
    "imageUrl": "https://cdn.example.com/advertisements/top/123_top.jpg",
    "linkUrl": "https://top.com",
    "enabled": true
  },
  "bottomBanner": {
    "adId": "live-page-ad-bottom",
    "imageKey": "advertisements/bottom/456_bottom.jpg",
    "imageUrl": "https://cdn.example.com/advertisements/bottom/456_bottom.jpg",
    "linkUrl": "https://bottom.com",
    "enabled": true
  }
}
```

**Frontend State:**
```typescript
topBanner = {
  imageUrl: "https://cdn.example.com/advertisements/top/123_top.jpg"
  linkUrl: "https://top.com"
  enabled: true
}

bottomBanner = {
  imageUrl: "https://cdn.example.com/advertisements/bottom/456_bottom.jpg"
  linkUrl: "https://bottom.com"
  enabled: true
}
```

**Anzeige:**
```
┌─────────────────────────────────┐
│  Top Banner                     │
│  Bild: .../top/123_top.jpg     │ ← Eigenes Bild
│  Link: https://top.com          │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  Video Player & Chat            │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  Bottom Banner                  │
│  Bild: .../bottom/456_bottom.jpg│ ← Eigenes Bild
│  Link: https://bottom.com       │
└─────────────────────────────────┘
```

## S3 Bucket Struktur

```
honigwabe-ad-images-bucket/
├── advertisements/
│   ├── top/
│   │   ├── 1733456789_banner1.jpg
│   │   └── 1733456790_banner2.jpg
│   └── bottom/
│       ├── 1733456791_banner3.jpg
│       └── 1733456792_banner4.jpg
```

## Testing

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

### 3. Testen
1. Als Admin einloggen
2. Werbebanner verwalten öffnen
3. **Oberes Banner:**
   - Bild hochladen: `top-banner.jpg`
   - Link: `https://top-link.com`
   - Aktivieren ✓
4. **Unteres Banner:**
   - Bild hochladen: `bottom-banner.jpg`
   - Link: `https://bottom-link.com`
   - Aktivieren ✓
5. Speichern
6. Live-Seite aufrufen
7. **Prüfen:**
   - ✅ Oberes Banner zeigt `top-banner.jpg`
   - ✅ Unteres Banner zeigt `bottom-banner.jpg`
   - ✅ Beide Banner haben unterschiedliche Bilder
   - ✅ Beide Banner haben unterschiedliche Links

## Vorher vs. Nachher

### Vorher ❌
```typescript
// Beide Banner verwenden advertisement
<img src={advertisement.imageUrl} />  // Oben
<img src={advertisement.imageUrl} />  // Unten ← Gleiches Bild!
```

### Nachher ✅
```typescript
// Jedes Banner hat eigene Variable
<img src={topBanner.imageUrl} />     // Oben
<img src={bottomBanner.imageUrl} />  // Unten ← Eigenes Bild!
```

## Zusammenfassung

✅ **Top Banner** - Zeigt `topBanner.imageUrl` (z.B. `.../top/123.jpg`)
✅ **Bottom Banner** - Zeigt `bottomBanner.imageUrl` (z.B. `.../bottom/456.jpg`)
✅ **Separate Bilder** - Jedes Banner lädt sein eigenes Bild aus dem Bucket
✅ **Separate Links** - Jedes Banner hat seinen eigenen Link
✅ **Separate Aktivierung** - Jedes Banner kann einzeln aktiviert werden

Die Banner zeigen jetzt unterschiedliche Bilder aus unterschiedlichen Bucket-Pfaden! 🎉
