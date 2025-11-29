# Creator Platform Template

## 🎯 Quick Start

### Option 1: Direkt im Browser öffnen
Öffne einfach die Datei **`OPEN-ME.html`** in deinem Browser!

### Option 2: Mit lokalem Server
```bash
# Python 3
python -m http.server 8000

# Node.js (mit npx)
npx http-server -p 8000

# PHP
php -S localhost:8000
```

Dann öffne: `http://localhost:8000/OPEN-ME.html`

## 📁 Struktur

```
template/
├── OPEN-ME.html          ← Öffne diese Datei im Browser!
├── public/               ← Alle HTML-Seiten
│   ├── index.html
│   ├── live.html
│   ├── shop.html
│   ├── events.html
│   ├── team.html
│   ├── kanaele.html
│   ├── kontakt.html
│   ├── login.html
│   ├── register.html
│   ├── exklusiv.html
│   ├── impressum.html
│   └── datenschutz.html
├── src/
│   ├── css/
│   │   └── styles.css    ← Haupt-Stylesheet
│   └── js/
│       └── main.js       ← Haupt-JavaScript
└── build.js              ← Build-Script für Creator-Deployment
```

## 🎨 Features

✅ **Vollständig responsiv** - Mobile, Tablet, Desktop
✅ **Animierte Elemente** - Floating Bienen, Countdown-Timer
✅ **Moderne UI** - Hexagon-Design, Honey-Theme
✅ **Alle Seiten** - 13 HTML-Seiten komplett integriert
✅ **Template-System** - Bereit für Multi-Creator-Deployment

## 🔧 Anpassung

### CSS-Variablen (in `src/css/styles.css`)
```css
:root {
    --honey-yellow: #FFC400;
    --honey-gold: #FFB700;
    --honey-orange: #FF8A00;
    --honey-beige: #FFF4D6;
    --warm-black: #111111;
}
```

### Template-Variablen (für Build-System)
- `{{CREATOR_NAME}}` - Name des Creators
- `{{YOUTUBE_URL}}` - YouTube-Kanal
- `{{TWITTER_URL}}` - Twitter/X-Profil
- `{{TELEGRAM_URL}}` - Telegram-Kanal
- `{{PRIMARY_COLOR}}` - Primärfarbe
- `{{SECONDARY_COLOR}}` - Sekundärfarbe

## 🚀 Deployment

### Für einen Creator deployen:
```bash
cd ../
node template/build.js --creator example
```

Dies erstellt eine personalisierte Version in `customizations/example/dist/`

## 📝 Personenbezogene Daten entfernt

✅ Alle Honigwabe-spezifischen Namen entfernt
✅ Hardcodierte URLs durch Variablen ersetzt
✅ Generic "Creator Platform" als Platzhalter
✅ Bereit für Multi-Tenant-Deployment

## 🎯 Nächste Schritte

1. **Teste die Website**: Öffne `OPEN-ME.html`
2. **Passe Farben an**: Bearbeite CSS-Variablen
3. **Erstelle Creator-Config**: Siehe `../customizations/example/config.json`
4. **Deploye**: Nutze das Build-System für AWS-Deployment

## 💡 Hinweise

- Die Website funktioniert komplett offline
- Alle Assets sind lokal (außer Google Fonts)
- Mobile Menu funktioniert ab < 768px Breite
- Countdown zählt bis zum nächsten Sonntag 18:00 Uhr
