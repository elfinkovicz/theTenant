# 🎨 Frontend Template

## Übersicht

Dieses Frontend-Template ermöglicht es, individuelle Creator-Websites aus einem einzigen Template zu generieren. Jede Website wird mit creator-spezifischen Konfigurationen und Branding erstellt.

---

## 📁 Struktur

```
frontend/
├── template/                    # Basis-Template
│   ├── public/                  # HTML-Dateien
│   │   ├── index.html
│   │   ├── live.html
│   │   ├── shop.html
│   │   └── ...
│   │
│   ├── src/
│   │   ├── js/
│   │   │   ├── config.template.js  # Template mit Variablen
│   │   │   └── main.js
│   │   │
│   │   └── css/
│   │       └── styles.css
│   │
│   ├── build.js                 # Build-Script
│   ├── package.json
│   └── dist/                    # Generierte Websites
│       ├── creator1/
│       └── creator2/
│
└── customizations/              # Creator-spezifische Anpassungen
    ├── example/
    │   ├── config.json          # Creator-Konfiguration
    │   ├── branding.css         # Custom Styles
    │   └── assets/
    │       ├── logo.png
    │       └── favicon.ico
    │
    └── creator2/
        └── ...
```

---

## 🚀 Verwendung

### **1. Customization erstellen**

```bash
# Ordner erstellen
mkdir -p customizations/creator-name/assets

# config.json erstellen
cp customizations/example/config.json customizations/creator-name/
```

### **2. config.json anpassen**

```json
{
  "creator": {
    "name": "Creator Name",
    "slug": "creator-name",
    "domain": "creator.com",
    "tagline": "Your Tagline",
    "description": "Description"
  },
  "aws": {
    "region": "eu-central-1",
    "cognito": {
      "userPoolId": "eu-central-1_ABC123",
      "clientId": "abc123def456",
      "authDomain": "creator-auth.auth.eu-central-1.amazoncognito.com"
    },
    "api": {
      "sponsorApi": "https://abc.execute-api.eu-central-1.amazonaws.com",
      "shopApi": "https://def.execute-api.eu-central-1.amazonaws.com"
    }
  },
  "branding": {
    "colors": {
      "primary": "#FFC400",
      "secondary": "#FFB700",
      "accent": "#FF8A00"
    }
  }
}
```

### **3. Assets hinzufügen**

```bash
# Logo & Favicon
cp /path/to/logo.png customizations/creator-name/assets/
cp /path/to/favicon.ico customizations/creator-name/assets/
```

### **4. Website bauen**

```bash
cd template
npm install
npm run build -- --creator=creator-name
```

**Output:** `template/dist/creator-name/` (fertige Website)

### **5. Zu S3 deployen**

```bash
cd ../..
./scripts/deployment/deploy-frontend.sh creator-name
```

---

## 🎨 Customization

### **Farben anpassen**

In `customizations/creator-name/branding.css`:

```css
:root {
    --primary-color: #YOUR_COLOR;
    --secondary-color: #YOUR_COLOR;
    --accent-color: #YOUR_COLOR;
}

/* Custom styles */
.hero-title {
    color: var(--primary-color);
}
```

### **Content anpassen**

In `customizations/creator-name/config.json`:

```json
{
  "content": {
    "nextEvent": {
      "title": "My Event",
      "date": "2024-12-31",
      "location": "Berlin",
      "description": "Event description"
    }
  }
}
```

---

## 📝 Template-Variablen

### **Verfügbare Variablen:**

| Variable | Beschreibung | Beispiel |
|----------|--------------|----------|
| `{{CREATOR_NAME}}` | Creator-Name | "Kasper Kast" |
| `{{CREATOR_SLUG}}` | URL-freundlicher Slug | "kasper" |
| `{{CREATOR_DOMAIN}}` | Domain | "kasper.live" |
| `{{CREATOR_TAGLINE}}` | Tagline | "Your Tagline" |
| `{{PRIMARY_COLOR}}` | Primärfarbe | "#FFC400" |
| `{{COGNITO_USER_POOL_ID}}` | Cognito User Pool | "eu-central-1_ABC123" |
| `{{SPONSOR_API_ENDPOINT}}` | Sponsor API | "https://..." |
| `{{YOUTUBE_URL}}` | YouTube Link | "https://youtube.com/@..." |

**Vollständige Liste:** Siehe `template/build.js`

---

## 🔧 Build-Prozess

### **Was passiert beim Build?**

1. **Config laden:** `customizations/creator-name/config.json`
2. **Variablen ersetzen:** `{{VAR}}` → Wert
3. **Dateien kopieren:** HTML, CSS, JS, Assets
4. **Output generieren:** `dist/creator-name/`

### **Beispiel:**

**Vorher (Template):**
```html
<title>{{CREATOR_NAME}} - Platform</title>
<h1>{{CREATOR_NAME}}</h1>
```

**Nachher (Kasper):**
```html
<title>Kasper Kast - Platform</title>
<h1>Kasper Kast</h1>
```

---

## 📦 Deployment

### **Automatisch (empfohlen):**

```bash
./scripts/deployment/deploy-frontend.sh creator-name
```

### **Manuell:**

```bash
# Build
cd frontend/template
npm run build -- --creator=creator-name

# Upload zu S3
BUCKET=$(terraform output -raw s3_bucket_name)
aws s3 sync dist/creator-name/ s3://$BUCKET/ --delete

# CloudFront invalidieren
DIST_ID=$(terraform output -raw cloudfront_distribution_id)
aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"
```

---

## 🎯 Best Practices

### **1. Versionierung**

```bash
# Git Tag für jede Version
git tag -a v1.0.0 -m "Initial release"
git push origin v1.0.0
```

### **2. Testing**

```bash
# Lokal testen
cd template/dist/creator-name
python -m http.server 8000
# Öffne http://localhost:8000
```

### **3. Backup**

```bash
# Vor jedem Build
cp -r customizations/creator-name customizations/creator-name.backup
```

---

## 🐛 Troubleshooting

### **Build-Fehler:**

```bash
# Dependencies neu installieren
cd template
rm -rf node_modules package-lock.json
npm install
```

### **Variablen nicht ersetzt:**

- Prüfe `config.json` Syntax (JSON-Validator)
- Prüfe Variable-Namen (Case-sensitive!)
- Prüfe `build.js` für neue Variablen

### **Assets fehlen:**

```bash
# Prüfe Assets-Ordner
ls -la customizations/creator-name/assets/

# Kopiere manuell
cp /path/to/assets/* customizations/creator-name/assets/
```

---

## 📚 Weitere Dokumentation

- [Setup-Guide](../docs/SETUP-GUIDE.md)
- [Deployment-Guide](../docs/DEPLOYMENT-GUIDE.md)
- [Architecture](../docs/ARCHITECTURE.md)

---

Made with 🍯 by Kiro AI
