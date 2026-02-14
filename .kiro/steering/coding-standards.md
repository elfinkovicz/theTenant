---
inclusion: always
---
# Coding Standards

## Frontend (React/TypeScript)

### Dateistruktur
```
src/
├── components/     # UI-Komponenten (layout/, ui/, Feature-spezifisch)
├── pages/          # Seiten (1:1 zu Routes)
├── services/       # API-Kommunikation
├── hooks/          # Custom Hooks
├── store/          # Zustand State
├── providers/      # Context Provider
├── utils/          # Hilfsfunktionen
└── config/         # Konfiguration
```

### Namenskonventionen
- Komponenten: `PascalCase.tsx`
- Services: `camelCase.service.ts`
- Hooks: `useHookName.ts`

### Komponenten-Pattern
```tsx
interface Props {
  title: string
  onClose: () => void
}

export const Component = ({ title, onClose }: Props) => {
  const [state, setState] = useState<Type>(initial)
  const { isAdmin } = useAdmin()
  
  useEffect(() => { /* ... */ }, [deps])
  
  const handleClick = () => { /* ... */ }
  
  return <div>...</div>
}
```

### State Management
- Zustand für globalen State
- React State für lokalen State
- Services für API-Calls (nicht in Komponenten)

## Backend (Lambda/Node.js)

### Lambda Layers (WICHTIG!)
Immer Lambda Layers für shared Dependencies verwenden:
```
lambda-layers/common-deps/nodejs/node_modules/
```

**Layer bauen:**
```powershell
cd lambda-layers/common-deps/nodejs && npm install
Compress-Archive -Path nodejs -DestinationPath common-deps-layer.zip -Force
```

### Handler-Pattern
```javascript
exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Creator-ID'
  }
  
  try {
    const tenantId = event.requestContext?.authorizer?.tenantId
    switch (event.httpMethod) {
      case 'GET': return await handleGet(event, tenantId)
      case 'POST': return await handlePost(event, tenantId)
    }
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) }
  }
}
```

### DynamoDB-Konventionen
- Tabelle: `viraltenant-tenant-{feature}-production`
- Keys: `tenant_id` (Hash) + `{item}_id` (Range)
- Timestamps: `created_at`, `updated_at` (ISO 8601)

## API-Design

```
GET    /tenants/{id}/{feature}           # Abrufen
POST   /tenants/{id}/{feature}           # Erstellen
PUT    /tenants/{id}/{feature}/{itemId}  # Aktualisieren
DELETE /tenants/{id}/{feature}/{itemId}  # Löschen
```

**Response:** `{ "success": true, "data": {...} }`
**Error:** `{ "error": "message", "code": "CODE" }`
