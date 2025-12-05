# Password Reset - Debugging Guide

## Problem

Fehler beim Zurücksetzen des Passworts: "Fehler beim Zurücksetzen des Passworts"

## Debug-Schritte

### 1. Test-Seite öffnen

Öffne `test-password-reset.html` im Browser und teste die Endpunkte:

1. **Test All Endpoints** - Prüfe ob `/forgot-password` und `/confirm-forgot-password` erreichbar sind
2. **Send Reset Code** - Teste ob Code gesendet wird
3. **Reset Password** - Teste ob Passwort zurückgesetzt werden kann

### 2. CloudWatch Logs prüfen

```bash
# Auth Lambda Logs
aws logs tail /aws/lambda/honigwabe-auth --follow

# Filtere nach Forgot Password
aws logs filter-pattern "ConfirmForgotPassword" \
  --log-group-name /aws/lambda/honigwabe-auth \
  --start-time $(date -u -d '10 minutes ago' +%s)000
```

### 3. API Gateway Routen prüfen

```bash
# Hole API ID
API_ID=$(aws apigatewayv2 get-apis --query "Items[?Name=='honigwabe-user-api'].ApiId" --output text)

# Liste alle Routen
aws apigatewayv2 get-routes --api-id $API_ID --query "Items[*].[RouteKey,Target]" --output table
```

**Erwartete Routen:**
- POST /forgot-password
- POST /confirm-forgot-password

### 4. Lambda-Funktion testen

```bash
# Teste direkt die Lambda-Funktion
aws lambda invoke \
  --function-name honigwabe-auth \
  --payload '{
    "requestContext": {
      "http": {
        "method": "POST",
        "path": "/forgot-password"
      }
    },
    "body": "{\"email\":\"test@example.com\"}"
  }' \
  response.json

cat response.json
```

### 5. Netzwerk-Tab im Browser prüfen

1. Öffne Developer Tools (F12)
2. Gehe zum Network-Tab
3. Versuche Passwort zurückzusetzen
4. Prüfe die Request/Response Details:
   - Request URL
   - Request Headers
   - Request Payload
   - Response Status
   - Response Body

### 6. Console Logs prüfen

Im Browser Console solltest du sehen:
```
ConfirmForgotPassword error: Error: ...
Error details: { message: "...", name: "...", stack: "..." }
```

## Häufige Probleme

### Problem 1: Route nicht gefunden (404)

**Symptom:** HTTP 404 Not Found

**Lösung:**
```bash
# Re-deploye User-Auth Modul
cd TerraformInfluencerTemplate
terraform apply -target=module.user_auth -var-file=clients/honigwabe/terraform.tfvars
```

### Problem 2: Lambda-Berechtigung fehlt

**Symptom:** 500 Internal Server Error, "Access Denied" in Logs

**Lösung:**
```bash
# Prüfe IAM-Rolle
aws iam get-role-policy \
  --role-name honigwabe-auth-lambda \
  --policy-name cognito-auth-access

# Sollte enthalten:
# - cognito-idp:ForgotPassword
# - cognito-idp:ConfirmForgotPassword
```

### Problem 3: CORS-Fehler

**Symptom:** CORS error im Browser

**Lösung:**
```bash
# Prüfe CORS-Konfiguration
aws apigatewayv2 get-api --api-id $API_ID --query "CorsConfiguration"
```

### Problem 4: Ungültiger Code

**Symptom:** "CodeMismatchException"

**Lösung:**
- Prüfe ob Code korrekt eingegeben wurde
- Code ist case-sensitive
- Code läuft nach 1 Stunde ab

### Problem 5: Passwort-Anforderungen nicht erfüllt

**Symptom:** "InvalidPasswordException"

**Lösung:**
Passwort muss enthalten:
- Mindestens 8 Zeichen
- Mindestens 1 Großbuchstabe
- Mindestens 1 Kleinbuchstabe
- Mindestens 1 Zahl
- Optional: 1 Sonderzeichen

### Problem 6: User nicht gefunden

**Symptom:** "UserNotFoundException"

**Lösung:**
- Prüfe ob E-Mail korrekt ist
- Prüfe ob User existiert in Cognito:
```bash
aws cognito-idp admin-get-user \
  --user-pool-id eu-central-1_51DAT0n1j \
  --username test@example.com
```

## Detailliertes Debugging

### Frontend Console Logs

Füge temporär mehr Logging hinzu:

```typescript
// In cognito.service.ts
console.log('API URL:', awsConfig.api.user);
console.log('Request:', { email, code: '***', newPassword: '***' });
console.log('Response status:', response.status);
console.log('Response headers:', response.headers);
```

### Backend Lambda Logs

Die Lambda-Funktion loggt jetzt:
- Request data (ohne Passwort)
- Cognito Command
- Error details (name, message, stack)

Prüfe CloudWatch Logs:
```bash
aws logs tail /aws/lambda/honigwabe-auth --follow --format short
```

### API Gateway Logs aktivieren (optional)

```hcl
# In main.tf
resource "aws_apigatewayv2_stage" "user_api" {
  api_id      = aws_apigatewayv2_api.user_api.id
  name        = "$default"
  auto_deploy = true
  
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
    })
  }
}

resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${var.project_name}-user-api"
  retention_in_days = 7
}
```

## Test-Szenarien

### Szenario 1: Erfolgreicher Reset

1. User existiert und E-Mail ist verifiziert
2. Code wird korrekt gesendet
3. Code ist noch gültig (< 1 Stunde)
4. Neues Passwort erfüllt Anforderungen
5. **Erwartetes Ergebnis:** 200 OK, "Passwort erfolgreich zurückgesetzt"

### Szenario 2: Ungültiger Code

1. User fordert Code an
2. Gibt falschen Code ein
3. **Erwartetes Ergebnis:** 400 Bad Request, "Ungültiger Code"

### Szenario 3: Abgelaufener Code

1. User fordert Code an
2. Wartet > 1 Stunde
3. Versucht Code zu verwenden
4. **Erwartetes Ergebnis:** 400 Bad Request, "Code ist abgelaufen"

### Szenario 4: Schwaches Passwort

1. User fordert Code an
2. Gibt gültigen Code ein
3. Gibt schwaches Passwort ein (z.B. "12345678")
4. **Erwartetes Ergebnis:** 400 Bad Request, "Passwort erfüllt nicht die Anforderungen"

## Nächste Schritte

1. ✅ Verbesserte Fehlerbehandlung im Frontend
2. ✅ Detailliertes Logging im Backend
3. ✅ Test-Seite erstellt
4. ⏭️ CloudWatch Logs prüfen
5. ⏭️ API Gateway Routen verifizieren
6. ⏭️ Lambda-Funktion direkt testen

## Support

Falls das Problem weiterhin besteht:

1. Sammle alle Logs (Frontend Console + CloudWatch)
2. Prüfe API Gateway Routen
3. Teste mit `test-password-reset.html`
4. Prüfe Cognito User Pool Konfiguration
