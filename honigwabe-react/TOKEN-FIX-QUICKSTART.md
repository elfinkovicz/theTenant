# 🚀 Quick Start: Token-Ablauf Fix

## Problem
- ❌ Token läuft zu schnell ab
- ❌ Kein automatischer Logout bei abgelaufenem Token
- ❌ Backend lehnt Requests ab, aber User bleibt "eingeloggt"

## Lösung in 3 Schritten

### 1️⃣ Backend: Token-Lebensdauer erhöhen

```bash
cd TerraformInfluencerTemplate
terraform apply -var-file="clients/honigwabe/terraform.tfvars"
```

**Was passiert:**
- Access Token: 5 Min → **60 Min** ✅
- ID Token: 5 Min → **60 Min** ✅
- Refresh Token: 30 Tage (unverändert)

### 2️⃣ Frontend: Neue Dateien sind bereits erstellt

✅ `src/utils/api-interceptor.ts` - Automatischer Logout bei 401/403
✅ `src/store/authStore.ts` - Erweitert mit Token-Tracking

### 3️⃣ Testen

**Nach dem Terraform Apply:**

1. **Logout + Login** auf der Website
2. **Warte 5 Minuten** (alter Token wäre jetzt abgelaufen)
3. **Mache eine Admin-Aktion** (z.B. Video hochladen)
4. **Sollte funktionieren!** ✅

**Token-Ablauf testen:**

1. Öffne Browser Console (F12)
2. Führe aus:
   ```javascript
   const { forceLogout } = useAuthStore.getState()
   forceLogout()
   ```
3. Sollte zur Login-Seite weiterleiten mit Meldung ✅

## Was jetzt anders ist

### Vorher ❌
```
1. Login → Token gültig für 5 Min
2. Nach 5 Min → API-Call schlägt fehl
3. User bleibt "eingeloggt" aber kann nichts machen
4. Manueller Logout nötig
```

### Nachher ✅
```
1. Login → Token gültig für 60 Min
2. Bei API-Fehler (401/403) → Automatischer Logout
3. User wird informiert: "Sitzung abgelaufen"
4. Automatische Weiterleitung zum Login
```

## Für Entwickler: Services aktualisieren

**Optional aber empfohlen:** Nutze den neuen API Interceptor

```typescript
// Vorher
const response = await fetch(url, {
  headers: { Authorization: `Bearer ${token}` }
})

// Nachher
import { fetchWithAuth, handleApiError } from '../utils/api-interceptor'

try {
  const response = await fetchWithAuth(url, {
    headers: { Authorization: `Bearer ${token}` }
  })
  // Bei 401/403 wird automatisch ausgeloggt
} catch (error) {
  handleApiError(error)
}
```

**Siehe:** `AUTHENTICATION-FIX.md` für Details

## Häufige Fragen

**Q: Muss ich alle Services umschreiben?**
A: Nein! Der automatische Logout funktioniert auch ohne Änderungen. Die neuen Helper-Funktionen sind optional für besseren Code.

**Q: Was passiert mit bestehenden eingeloggten Usern?**
A: Sie müssen sich einmal neu einloggen um den neuen Token zu bekommen.

**Q: Kann ich die Token-Lebensdauer ändern?**
A: Ja, in `TerraformInfluencerTemplate/modules/user-auth/main.tf`:
```hcl
access_token_validity = 120  # 2 Stunden
```

**Q: Funktioniert das auch für normale User (nicht Admins)?**
A: Ja! Alle User profitieren von der längeren Token-Lebensdauer.

## Deployment Checklist

- [ ] Terraform Apply ausgeführt
- [ ] Keine Fehler im Terraform Output
- [ ] Cognito User Pool Client aktualisiert
- [ ] Einmal ausgeloggt und neu eingeloggt
- [ ] Admin-Funktionen getestet (Video upload, etc.)
- [ ] Token-Ablauf nach 60 Min getestet

## Rollback (falls nötig)

```bash
cd TerraformInfluencerTemplate

# Alte Werte wiederherstellen in modules/user-auth/main.tf:
# access_token_validity = 5
# id_token_validity = 5

terraform apply -var-file="clients/honigwabe/terraform.tfvars"
```

## Support

✅ **Alles funktioniert?** Perfekt!
❌ **Probleme?** Siehe `AUTHENTICATION-FIX.md` für Details

## Zusammenfassung

**Was wurde geändert:**
- ✅ Backend: Token-Lebensdauer 5 Min → 60 Min
- ✅ Frontend: Automatischer Logout bei 401/403
- ✅ Frontend: Token-Tracking im Auth Store
- ✅ Frontend: API Interceptor für konsistente Fehlerbehandlung

**Nächster Schritt:**
```bash
terraform apply
```

Fertig! 🎉
