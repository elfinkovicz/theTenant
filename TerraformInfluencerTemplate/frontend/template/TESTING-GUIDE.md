# 🧪 Testing Guide

## ✅ Alle Pfade wurden korrigiert!

Alle HTML-Dateien im `public/` Ordner verwenden jetzt die korrekten Pfade:
- CSS: `../src/css/styles.css`
- JS: `../src/js/main.js`

## 🚀 Website testen

### Option 1: Direkt im Browser öffnen
```
Öffne diese Datei:
📁 TerraformInfluencerTemplate/frontend/template/index.html
```

### Option 2: Mit lokalem Server (empfohlen)
```bash
# Im template-Ordner:
cd TerraformInfluencerTemplate/frontend/template

# Python 3
python -m http.server 8000

# Oder Node.js
npx http-server -p 8000

# Oder PHP
php -S localhost:8000
```

Dann öffne: `http://localhost:8000/index.html`

## 📄 Verfügbare Seiten

### Haupt-Seiten
- ✅ `index.html` - Homepage (im template-Root)
- ✅ `public/index.html` - Alternative Homepage
- ✅ `public/team.html` - Team-Seite
- ✅ `public/kanaele.html` - Kanal-Übersicht
- ✅ `public/live.html` - Live-Stream
- ✅ `public/events.html` - Events
- ✅ `public/shop.html` - Shop
- ✅ `public/kontakt.html` - Kontakt

### User-Bereich
- ✅ `public/login.html` - Login
- ✅ `public/register.html` - Registrierung
- ✅ `public/exklusiv.html` - Exklusiv-Bereich
- ✅ `public/sponsor-booking.html` - Sponsor-Buchung

### Legal
- ✅ `public/impressum.html` - Impressum
- ✅ `public/datenschutz.html` - Datenschutz

## 🎨 Was wurde korrigiert

### 1. CSS-Pfade
**Vorher:** `href="css/styles.css"` ❌
**Nachher:** `href="../src/css/styles.css"` ✅

### 2. JS-Pfade
**Vorher:** `src="js/main.js"` ❌
**Nachher:** `src="../src/js/main.js"` ✅

### 3. Branding
**Vorher:** "Honigwabe LIVE" ❌
**Nachher:** "Creator Platform" ✅

## 🔍 Überprüfung

### Alle Seiten sollten jetzt:
- ✅ Korrekte Styles anzeigen (Honey-Theme)
- ✅ Responsive sein (Mobile, Tablet, Desktop)
- ✅ Animationen haben (Floating Bienen)
- ✅ Funktionierende Navigation
- ✅ Countdown-Timer (auf Homepage)

### Wenn etwas nicht funktioniert:
1. Öffne die Browser-Konsole (F12)
2. Prüfe auf 404-Fehler bei CSS/JS-Dateien
3. Stelle sicher, dass du einen lokalen Server verwendest

## 📁 Datei-Struktur

```
template/
├── index.html              ← Haupt-Homepage
├── public/                 ← Alle Unterseiten
│   ├── index.html
│   ├── live.html
│   ├── shop.html
│   └── ... (11 weitere)
└── src/
    ├── css/
    │   ├── styles.css      ← Haupt-Stylesheet
    │   ├── live.css
    │   └── ... (9 weitere)
    └── js/
        ├── main.js         ← Haupt-JavaScript
        └── ... (weitere)
```

## 💡 Tipps

### Browser-Cache leeren
Wenn Änderungen nicht sichtbar sind:
- Chrome/Edge: `Ctrl + Shift + R`
- Firefox: `Ctrl + F5`
- Safari: `Cmd + Shift + R`

### Lokaler Server ist wichtig
Manche Browser blockieren lokale Dateien aus Sicherheitsgründen.
Ein lokaler Server löst dieses Problem.

## ✅ Checkliste

- [x] CSS-Pfade korrigiert
- [x] JS-Pfade korrigiert
- [x] "Honigwabe LIVE" → "Creator Platform"
- [x] Navigation funktioniert
- [x] Alle 14 Seiten verfügbar
- [x] Responsive Design
- [x] Animationen aktiv

## 🎉 Fertig!

Die Website ist jetzt vollständig funktionsfähig und kann getestet werden!

**Öffne:** `index.html` im Browser oder starte einen lokalen Server.
