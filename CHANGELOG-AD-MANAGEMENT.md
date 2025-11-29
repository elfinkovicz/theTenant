# Changelog - Advertisement Management

## Datum: 29.11.2025

### Neue Features

#### Advertisement Management System
- ✅ Neues Terraform-Modul `ad-management` erstellt
- ✅ DynamoDB Tabelle für Advertisement-Daten
- ✅ Lambda-Funktion für API-Endpunkte
- ✅ API Gateway Integration mit JWT-Authentifizierung
- ✅ S3 Integration für Bild-Upload
- ✅ CloudFront CDN für Bild-Auslieferung

#### Frontend-Komponenten
- ✅ `advertisement.service.ts` - Service für API-Kommunikation
- ✅ `AdManagement.tsx` - Admin-Modal für Banner-Verwaltung
- ✅ `Live.tsx` - Integration in Live-Seite mit Edit-Buttons

### Geänderte Dateien

#### Terraform
- `TerraformInfluencerTemplate/main.tf` - Ad-Management Modul hinzugefügt
- `TerraformInfluencerTemplate/variables.tf` - `enable_ad_management` Variable
- `TerraformInfluencerTemplate/modules/ad-management/` - Neues Modul
  - `main.tf` - Terraform-Konfiguration
  - `variables.tf` - Modul-Variablen
  - `outputs.tf` - Modul-Outputs
  - `lambda/index.js` - Lambda-Funktion
  - `lambda/package.json` - Dependencies
  - `README.md` - Modul-Dokumentation

#### Deployment
- `deployment_config.py` - `ENABLE_AD_MANAGEMENT` Variable hinzugefügt
- `deploy.py` - `enable_ad_management` in tfvars hinzugefügt
- `TerraformInfluencerTemplate/scripts/prepare_lambdas.py` - Ad-Management Lambda

#### Frontend
- `honigwabe-react/src/services/advertisement.service.ts` - Neu
- `honigwabe-react/src/components/AdManagement.tsx` - Neu
- `honigwabe-react/src/pages/Live.tsx` - Banner-Integration

#### Dokumentation
- `AD-MANAGEMENT-SETUP.md` - Setup-Anleitung
- `CHANGELOG-AD-MANAGEMENT.md` - Diese Datei

### API-Endpunkte

#### Public
- `GET /advertisement` - Aktuelles Banner abrufen

#### Admin (JWT Auth erforderlich)
- `PUT /advertisement` - Banner aktualisieren
- `POST /advertisement/upload-url` - Presigned URL für Upload
- `DELETE /advertisement/image` - Banner-Bild löschen

### Funktionsweise

1. **Admin-Zugriff**
   - Nur Mitglieder der "admins" Cognito-Gruppe
   - JWT-Token-basierte Authentifizierung

2. **Banner-Verwaltung**
   - Single Banner für Live-Seite
   - Bild-Upload über Presigned S3 URLs
   - Optional: Link-URL für Klicks
   - Enable/Disable Toggle

3. **Frontend-Integration**
   - Banner wird oben und unten auf Live-Seite angezeigt
   - Edit-Button erscheint beim Hover (nur für Admins)
   - Modal für Banner-Verwaltung
   - Automatisches Reload nach Speichern

### Deployment-Schritte

1. **Konfiguration**
   ```python
   # In deployment_config.py
   self.ENABLE_AD_MANAGEMENT = True
   ```

2. **Terraform Deployment**
   ```bash
   python deploy.py
   ```

3. **Frontend Build & Deploy**
   ```bash
   cd honigwabe-react
   npm run build
   # Upload wird vom deploy.py Script gemacht
   ```

### Kosten

Geschätzte monatliche Kosten: **< $1**
- DynamoDB: < $0.10
- Lambda: < $0.10
- S3: < $0.10
- CloudFront: Bereits vorhanden

### Sicherheit

- ✅ JWT-Authentifizierung für Admin-Endpunkte
- ✅ Cognito-Gruppen-basierte Autorisierung
- ✅ Presigned URLs für S3-Upload (1h gültig)
- ✅ CORS-Konfiguration
- ✅ IAM-Rollen mit minimalen Berechtigungen

### Testing

#### Manuelles Testing
1. Als Admin einloggen
2. Zur Live-Seite navigieren
3. Über Banner hovern → Edit-Button erscheint
4. Bild hochladen (1920x240px empfohlen)
5. Optional: Link-URL eingeben
6. Speichern
7. Banner wird angezeigt

#### API Testing
```bash
# Public Endpoint
curl https://API_URL/advertisement

# Admin Endpoint (mit Token)
curl -X PUT https://API_URL/advertisement \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"imageKey":"ads/test.jpg","linkUrl":"https://example.com","enabled":true}'
```

### Bekannte Einschränkungen

- Nur ein Banner pro Live-Seite
- Keine zeitgesteuerten Banner
- Kein Click-Tracking
- Keine Banner-Rotation

### Zukünftige Erweiterungen

- [ ] Mehrere Banner-Positionen
- [ ] Zeitgesteuerte Banner (Start-/Enddatum)
- [ ] A/B-Testing
- [ ] Click-Tracking und Analytics
- [ ] Banner-Rotation
- [ ] Banner-Vorschau vor Veröffentlichung

### Migration

Keine Migration erforderlich - neues Feature.

### Rollback

Falls Probleme auftreten:

1. **Terraform**
   ```python
   # In deployment_config.py
   self.ENABLE_AD_MANAGEMENT = False
   ```
   ```bash
   python deploy.py
   ```

2. **Frontend**
   - Alte Version deployen
   - Oder: Edit-Buttons ausblenden

### Support

Bei Problemen:
1. CloudWatch Logs prüfen: `{project_name}-ad-api`
2. DynamoDB Tabelle prüfen: `{project_name}-advertisements`
3. Browser Developer Console prüfen
4. API-Endpunkte testen

### Checkliste für Deployment

- [ ] `deployment_config.py` aktualisiert
- [ ] `python deploy.py` ausgeführt
- [ ] Terraform erfolgreich deployed
- [ ] Frontend gebaut und deployed
- [ ] Als Admin eingeloggt
- [ ] Banner-Upload getestet
- [ ] Banner-Anzeige getestet
- [ ] Link-Funktionalität getestet
- [ ] Enable/Disable getestet

### Verantwortlich

- **Entwicklung**: Kiro AI Assistant
- **Review**: Niels Fink
- **Deployment**: Automatisch via deploy.py
