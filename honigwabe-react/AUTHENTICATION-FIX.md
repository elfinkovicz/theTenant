# Authentication Fix - Token-Ablauf & Auto-Logout

## Problem gelöst ✅

1. **Token läuft zu schnell ab** → Token-Lebensdauer auf 1 Stunde erhöht
2. **Kein automatischer Logout** → Auto-Logout bei 401/403 Errors implementiert
3. **Benutzer bleibt eingeloggt obwohl Token ungültig** → Force-Logout Mechanismus

## Änderungen

### 1. Backend: Token-Lebensdauer (Terraform)

**Datei:** `TerraformInfluencerTemplate/modules/user-auth/main.tf`

```hcl
# Token-Lebensdauer: 1 Stunde
access_token_validity  = 60  # Minuten
id_token_validity      = 60  # Minuten
refresh_token_validity = 30  # Tage

token_validity_units {
  access_token  = "minutes"
  id_token      = "minutes"
  refresh_token = "days"
}
```

**Deployment:**
```bash
cd TerraformInfluencerTemplate
terraform apply -var-file="clients/honigwabe/terraform.tfvars"
```

### 2. Frontend: API Interceptor

**Neue Datei:** `src/utils/api-interceptor.ts`

Bietet:
- `fetchWithAuth()` - Fetch mit automatischem Logout
- `apiGet()`, `apiPost()`, `apiPut()`, `apiDelete()` - Helper-Funktionen
- `handleApiError()` - Fehlerbehandlung
- `isAuthError()` - Prüft ob Auth-Fehler

### 3. Frontend: Auth Store erweitert

**Datei:** `src/store/authStore.ts`

Neue Features:
- `tokenExpiry` - Speichert wann Token abläuft
- `refreshToken` - Für zukünftiges Token-Refresh
- `isTokenExpired()` - Prüft Token-Gültigkeit
- `forceLogout()` - Logout ohne Cognito-Call (für abgelaufene Tokens)

## Verwendung

### Option 1: API Interceptor verwenden (Empfohlen)

```typescript
import { apiGet, apiPost, apiPut, apiDelete, handleApiError } from '../utils/api-interceptor'
import { useAuthStore } from '../store/authStore'

// GET Request
try {
  const { accessToken } = useAuthStore.getState()
  const data = await apiGet<MyType>('/api/endpoint', accessToken)
} catch (error) {
  handleApiError(error) // Automatischer Logout bei 401/403
}

// POST Request
try {
  const { accessToken } = useAuthStore.getState()
  const result = await apiPost<MyType>('/api/endpoint', { data }, accessToken)
} catch (error) {
  handleApiError(error)
}
```

### Option 2: fetchWithAuth direkt verwenden

```typescript
import { fetchWithAuth } from '../utils/api-interceptor'
import { useAuthStore } from '../store/authStore'

const { accessToken } = useAuthStore.getState()

const response = await fetchWithAuth('/api/endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify(data)
})

// Bei 401/403 wird automatisch ausgeloggt und zur Login-Seite weitergeleitet
```

### Option 3: Manuell in try-catch

```typescript
try {
  const response = await fetch('/api/endpoint', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  })
  
  if (response.status === 401 || response.status === 403) {
    const { forceLogout } = useAuthStore.getState()
    forceLogout()
    alert('Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.')
    window.location.href = '/login'
    return
  }
  
  const data = await response.json()
} catch (error) {
  console.error(error)
}
```

## Services aktualisieren

### Beispiel: Video Service

**Vorher:**
```typescript
async getVideos(): Promise<Video[]> {
  const response = await axios.get(`${API_BASE_URL}/videos`)
  return response.data.videos
}
```

**Nachher:**
```typescript
import { apiGet, handleApiError } from '../utils/api-interceptor'

async getVideos(): Promise<Video[]> {
  try {
    const data = await apiGet<{ videos: Video[] }>(`${API_BASE_URL}/videos`)
    return data.videos
  } catch (error) {
    handleApiError(error) // Auto-Logout bei 401/403
    throw error
  }
}
```

### Beispiel: Admin-Funktion mit Token

**Vorher:**
```typescript
async deleteVideo(videoId: string): Promise<void> {
  const token = useAuthStore.getState().accessToken
  await axios.delete(`${API_BASE_URL}/videos/${videoId}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
}
```

**Nachher:**
```typescript
import { apiDelete, handleApiError } from '../utils/api-interceptor'

async deleteVideo(videoId: string): Promise<void> {
  try {
    const token = useAuthStore.getState().accessToken
    await apiDelete(`${API_BASE_URL}/videos/${videoId}`, token)
  } catch (error) {
    handleApiError(error) // Auto-Logout bei 401/403
    throw error
  }
}
```

## Token-Prüfung vor API-Calls

Optional: Prüfe Token vor jedem Call:

```typescript
import { useAuthStore } from '../store/authStore'

async function myApiCall() {
  const { isTokenExpired, forceLogout, accessToken } = useAuthStore.getState()
  
  // Prüfe ob Token abgelaufen
  if (isTokenExpired()) {
    forceLogout()
    alert('Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.')
    window.location.href = '/login'
    return
  }
  
  // Mache API-Call
  const response = await fetch('/api/endpoint', {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
}
```

## React Component: Token-Prüfung

Automatische Token-Prüfung in geschützten Routen:

```typescript
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export function ProtectedComponent() {
  const navigate = useNavigate()
  const { isAuthenticated, isTokenExpired, forceLogout } = useAuthStore()
  
  useEffect(() => {
    // Prüfe bei Component-Mount
    if (!isAuthenticated || isTokenExpired()) {
      forceLogout()
      alert('Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.')
      navigate('/login')
    }
  }, [isAuthenticated, isTokenExpired, forceLogout, navigate])
  
  return <div>Protected Content</div>
}
```

## Testing

### 1. Token-Ablauf testen

```typescript
// In Browser Console:
const { forceLogout } = useAuthStore.getState()
forceLogout()
// Sollte zur Login-Seite weiterleiten
```

### 2. API-Fehler simulieren

```typescript
// Mache API-Call mit ungültigem Token
fetch('/api/endpoint', {
  headers: { Authorization: 'Bearer invalid-token' }
})
// Sollte automatisch ausloggen und zur Login-Seite weiterleiten
```

### 3. Token-Lebensdauer prüfen

```typescript
// In Browser Console nach Login:
const { tokenExpiry } = useAuthStore.getState()
const minutesLeft = (tokenExpiry - Date.now()) / 1000 / 60
console.log(`Token läuft ab in ${minutesLeft} Minuten`)
// Sollte ~60 Minuten sein
```

## Checkliste: Services migrieren

Für jeden Service der API-Calls macht:

- [ ] Import `api-interceptor` hinzufügen
- [ ] `axios` durch `apiGet/apiPost/apiPut/apiDelete` ersetzen
- [ ] `try-catch` mit `handleApiError()` hinzufügen
- [ ] Token aus `useAuthStore` holen
- [ ] Testen mit abgelaufenem Token

## Vorteile

✅ **Automatischer Logout** - Keine manuellen Checks mehr nötig
✅ **Konsistente Fehlerbehandlung** - Alle API-Calls behandeln Auth-Fehler gleich
✅ **Bessere UX** - User wird informiert und zur Login-Seite geleitet
✅ **Längere Token-Lebensdauer** - 1 Stunde statt Standard (5-30 Minuten)
✅ **Sicherer** - Abgelaufene Tokens werden sofort erkannt

## Nächste Schritte (Optional)

### Token-Refresh implementieren

Für noch bessere UX: Automatisches Token-Refresh vor Ablauf

```typescript
// In authStore.ts
refreshAccessToken: async () => {
  const { refreshToken } = get()
  if (!refreshToken) return false
  
  try {
    const newTokens = await cognitoService.refreshToken(refreshToken)
    const tokenExpiry = Date.now() + (60 * 60 * 1000)
    
    set({
      accessToken: newTokens.accessToken,
      tokenExpiry
    })
    
    return true
  } catch (error) {
    console.error('Token refresh failed:', error)
    get().forceLogout()
    return false
  }
}
```

### Background Token-Check

```typescript
// In App.tsx
useEffect(() => {
  const interval = setInterval(() => {
    const { isAuthenticated, isTokenExpired, refreshAccessToken } = useAuthStore.getState()
    
    if (isAuthenticated && isTokenExpired()) {
      // Versuche Token zu refreshen
      refreshAccessToken().then(success => {
        if (!success) {
          alert('Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.')
          window.location.href = '/login'
        }
      })
    }
  }, 60000) // Prüfe jede Minute
  
  return () => clearInterval(interval)
}, [])
```

## Support

Bei Problemen:
1. Prüfe Browser Console auf Fehler
2. Prüfe ob Token in LocalStorage gespeichert ist
3. Prüfe ob Cognito Token-Einstellungen deployed wurden
4. Teste mit `terraform output cognito_user_pool_id`
