---
inclusion: manual
---
# Authentifizierung & Autorisierung

## Architektur
```
Frontend → API Gateway + Lambda Authorizer → Lambda Functions
    ↓              ↓
 Cognito    user_tenants (DynamoDB)
```

## Cognito
- Region: `eu-central-1`, ein User Pool für alle Tenants
- JWT enthält `sub` (userId), KEINE `tenant_id`
- Tenant-Zuordnung über `user_tenants` Tabelle

## JWT Claims
```json
{ "sub": "user-uuid", "cognito:username": "email@example.com", "token_use": "access" }
```

## Lambda Authorizer Flow
1. JWT aus Authorization Header validieren (JWKS)
2. `tenant_id` aus `X-Creator-ID` Header
3. `user_tenants` Tabelle prüfen
4. IAM Policy generieren mit Context: `{ userId, tenantId, role }`

## Rollen
| Rolle | Berechtigungen |
|-------|----------------|
| `admin` | Vollzugriff |
| `member` | Lesen + eingeschränktes Schreiben |
| `viewer` | Nur öffentliche Daten |

## Frontend Auth
```tsx
// Login
const { AccessToken, IdToken, RefreshToken } = await cognito.initiateAuth({
  AuthFlow: 'USER_PASSWORD_AUTH', ClientId, AuthParameters: { USERNAME, PASSWORD }
})

// API Headers
headers: { 'Authorization': `Bearer ${accessToken}`, 'X-Creator-ID': tenantId }

// Admin-Check
const { isAdmin } = useAdmin() // prüft user.tenants[].role
```

## DynamoDB Tabellen
```
user_tenants: user_id (Hash) + tenant_id (Range) → { role, created_at }
tenants: tenant_id (Hash), GSI: subdomain-index → { subdomain, name, status, plan }
```

## Sicherheit
- Cross-Tenant: JWT `sub` nicht manipulierbar, alle Queries filtern nach `tenant_id`
- Tokens: Access 1h, Refresh 30d, nur Memory (kein localStorage), HTTPS-only
