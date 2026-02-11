# ViralTenant V1.0 - Requirements Document

## Einführung

ViralTenant ist eine All-in-One Creator-Plattform für Influencer, Content Creator, Medienschaffende und Personen des öffentlichen Lebens. Die Plattform bietet einen vollständigen Internetauftritt mit Subdomain-basiertem Multi-Tenancy auf einer serverless AWS-Infrastruktur.

## Glossar

| Begriff | Definition |
|---------|------------|
| Tenant | Isolierter Creator-Bereich mit eigener `tenant_id` und Subdomain |
| Creator | Plattform-Nutzer mit eigenem Tenant (Influencer, Medienschaffende) |
| Fan/Subscriber | Besucher/Abonnent eines Creator-Tenants |
| Lambda Authorizer | JWT-Validation und Tenant-Zugriffsprüfung |
| Crossposting | Automatische Verteilung von Content auf Social Media |
| Multistreaming | Gleichzeitiges Streaming zu mehreren Plattformen |

---

## Kernfunktionen V1.0

### Requirement 1: Subdomain-basierter Internetauftritt

**User Story:** Als Creator möchte ich über meine eigene Subdomain (z.B. `meinname.viraltenant.com`) erreichbar sein und meinen Auftritt individuell gestalten können.

#### Acceptance Criteria
1. WHEN ein Creator sich registriert, THEN erhält er automatisch eine Subdomain `{name}.viraltenant.com`
2. WHEN ein Besucher die Subdomain aufruft, THEN wird er zum korrekten Tenant geroutet
3. WHEN ein Creator seine Homepage bearbeitet, THEN kann er Hero-Section, Logo, Hintergrund und Theme anpassen
4. WHEN ein Creator Custom Pages erstellt, THEN sind diese unter `/page/{slug}` erreichbar
5. WHEN ein Creator rechtliche Seiten pflegt, THEN sind Impressum, Datenschutz und AGB verfügbar

#### Implementierte Seiten
- `/` - Homepage mit Hero-Section
- `/team` - Team-Mitglieder
- `/contact` - Kontaktformular
- `/legal` - Rechtliche Seiten
- `/page/{slug}` - Custom Pages

---

### Requirement 2: Live-Streaming & Multistreaming

**User Story:** Als Creator möchte ich live streamen und meinen Stream gleichzeitig auf mehreren Plattformen verteilen können.

#### Acceptance Criteria
1. WHEN ein Creator die Live-Seite konfiguriert, THEN kann er Stream-Thumbnail und Overlay setzen
2. WHEN ein Creator Stream-Destinations hinzufügt, THEN werden YouTube, Twitch, Kick, Instagram und TikTok unterstützt
3. WHEN ein Creator YouTube verbindet, THEN erfolgt dies über OAuth 2.0
4. WHEN ein Stream startet, THEN wird er automatisch an alle konfigurierten Destinations verteilt
5. WHEN ein Stream endet, THEN kann er optional als VOD im Newsfeed veröffentlicht werden

#### Unterstützte Streaming-Plattformen
- YouTube Live (OAuth)
- Twitch (RTMP)
- Kick (RTMP)
- Instagram Live (OAuth)
- TikTok Live (OAuth)

---

### Requirement 3: Channel-Übersicht (Linktree-Style)

**User Story:** Als Creator möchte ich alle meine Social-Media-Kanäle auf einer übersichtlichen Seite präsentieren.

#### Acceptance Criteria
1. WHEN ein Creator OAuth-Verbindungen herstellt, THEN werden Kanäle automatisch zur Channel-Seite hinzugefügt
2. WHEN ein Creator Kanäle manuell hinzufügt, THEN kann er Name, URL, Icon und Farbe konfigurieren
3. WHEN ein Besucher die Channel-Seite aufruft, THEN sieht er alle Kanäle kategorisiert (Video, Social, Community, Newsletter)
4. WHEN ein Creator Kanäle sortiert, THEN wird die Reihenfolge gespeichert

#### Unterstützte Kategorien
- Video: YouTube, Twitch, TikTok
- Social: Instagram, Facebook, X/Twitter, LinkedIn, Threads, Bluesky, Mastodon, Snapchat
- Community: Discord, Slack, Telegram, WhatsApp, Signal
- Newsletter: E-Mail

---

### Requirement 4: Content-Hosting (Videos & Podcasts)

**User Story:** Als Creator möchte ich meine Videos und Podcasts auf meiner eigenen Plattform hosten und präsentieren.

#### Acceptance Criteria
1. WHEN ein Creator Videos hochlädt, THEN werden diese in S3 gespeichert und über CloudFront ausgeliefert
2. WHEN ein Creator Kategorien erstellt, THEN können Videos gruppiert werden
3. WHEN ein Creator den AI-Thumbnail-Generator nutzt, THEN werden automatisch Thumbnails aus Video-Frames erstellt
4. WHEN ein Creator Podcasts hochlädt, THEN werden Audio-Dateien mit Metadaten gespeichert
5. WHEN ein Creator AI-Transkription aktiviert, THEN wird der Podcast-Inhalt automatisch transkribiert
6. WHEN ein Creator Shorts erstellt, THEN werden diese im 9:16 Format für Social Media optimiert

---

### Requirement 5: Eventkalender

**User Story:** Als Creator möchte ich Events erstellen und meinen Fans präsentieren können.

#### Acceptance Criteria
1. WHEN ein Creator Events erstellt, THEN kann er Titel, Beschreibung, Datum, Ort und Bild angeben
2. WHEN ein Creator Slot-basierte Buchung aktiviert, THEN können Fans Zeitslots reservieren
3. WHEN ein Besucher die Event-Seite aufruft, THEN sieht er kommende Events chronologisch sortiert
4. WHEN ein Event vergangen ist, THEN wird es automatisch archiviert

---

### Requirement 6: Newsfeed & Crossposting

**User Story:** Als Creator möchte ich Posts erstellen und diese automatisch auf allen meinen Social-Media-Kanälen verteilen.

#### Acceptance Criteria
1. WHEN ein Creator einen Post erstellt, THEN kann er Text, Bilder und Videos hinzufügen
2. WHEN ein Creator Crossposting aktiviert, THEN wird der Post an alle verbundenen Plattformen gesendet
3. WHEN ein Creator Posts plant, THEN werden diese zum geplanten Zeitpunkt veröffentlicht
4. WHEN ein Creator Shorts erstellt, THEN werden diese für vertikale Formate optimiert
5. WHEN Crossposting fehlschlägt, THEN wird der Creator benachrichtigt

#### Crossposting-Plattformen
- **OAuth**: YouTube, TikTok, Snapchat, Facebook, Instagram, X/Twitter, LinkedIn, Threads
- **Webhook**: Telegram, Discord, Slack
- **API**: WhatsApp (AWS), Signal, E-Mail (SES)
- **Dezentral**: Bluesky, Mastodon

---

### Requirement 7: Paywall & Monetarisierung

**User Story:** Als Creator möchte ich exklusive Inhalte hinter einer Paywall anbieten und Einnahmen generieren.

#### Acceptance Criteria
1. WHEN ein Creator Membership aktiviert, THEN können Fans kostenpflichtige Abonnements abschließen
2. WHEN ein Fan ein Abo abschließt, THEN erhält er Zugang zu exklusiven Inhalten
3. WHEN ein Creator Produkte im Shop anbietet, THEN können Fans diese kaufen
4. WHEN eine Zahlung erfolgt, THEN wird diese über Stripe oder Mollie abgewickelt
5. WHEN ein Creator Mollie Connect nutzt, THEN erhält er direkte Auszahlungen

#### Zahlungsanbieter
- Stripe (aktiv)
- Mollie Connect (aktiv)
- PayPal (geplant)
- Paddle (Approval ausstehend)
- Unzer (Approval ausstehend)

---

## Technische Requirements

### Requirement 8: Multi-Tenant-Isolation

**User Story:** Als Platform-Administrator möchte ich vollständig isolierte Creator-Daten ohne Cross-Tenant-Zugriffe.

#### Acceptance Criteria
1. WHEN ein Creator erstellt wird, THEN erhält er eine eindeutige `tenant_id`
2. WHEN ein User auf Daten zugreift, THEN wird die Berechtigung über `user_tenants`-Tabelle geprüft
3. WHEN Assets hochgeladen werden, THEN werden sie unter `/tenants/{tenant_id}/` gespeichert
4. WHEN ein API-Request erfolgt, THEN filtert das Backend automatisch nach `tenant_id`
5. WHEN ein User fremde Tenant-Daten anfordert, THEN wird der Zugriff verweigert (403)

### Requirement 9: Admin-Isolation

**User Story:** Als Platform-Administrator möchte ich strikte Admin-Isolation, sodass Admins eines Tenants KEINE Admin-Rechte auf anderen Tenants haben.

#### Acceptance Criteria
1. WHEN ein User Admin-Zugriff anfordert, THEN prüft das System expliziten Eintrag in `user_tenants` mit `role=admin`
2. WHEN ein Platform-Admin auf andere Tenants zugreift, THEN wird KEIN automatischer Zugriff gewährt
3. WHEN `X-Creator-ID` Header manipuliert wird, THEN wird Zugriff verweigert (userId aus JWT nicht manipulierbar)
4. WHEN `isUserTenantAdmin()` aufgerufen wird, THEN erfolgt für ALLE Tenants die DB-Prüfung

### Requirement 10: JWT-Token-Validation

**User Story:** Als System möchte ich alle API-Anfragen über JWT validieren und Tenant-Zugriff prüfen.

#### Acceptance Criteria
1. WHEN ein API-Request eingeht, THEN wird JWT aus Authorization-Header extrahiert
2. WHEN JWT validiert wird, THEN wird Cognito JWKS-Signatur geprüft
3. WHEN `tenant_id` benötigt wird, THEN wird diese aus Subdomain/Header/URL extrahiert
4. WHEN Zugriff geprüft wird, THEN wird `user_tenants`-Tabelle abgefragt
5. WHEN Berechtigung fehlt, THEN wird IAM-Policy mit Deny generiert

---

## Offene Punkte / Backlog

### API-Approvals
- [ ] Meta API Review (Facebook, Instagram, WhatsApp)
- [ ] Snapchat Vertrieb-Kontakt
- [ ] Mollie Profil-Zugriff

### Bugs & Verbesserungen
- [ ] E-Mail-Benachrichtigung bei User-Registrierung für Creator
- [ ] Übersicht für Paid-Abonnenten
- [ ] Hyperlinks auf Custom-Seite funktionsfähig machen
- [ ] Pflichtfeld-Sternchen rot bei Podcast-Upload
- [ ] Safari/YouTube OAuth-Probleme
- [ ] X Crossposting: Video-Support (aktuell nur Bild)
- [ ] Discord Crossposting: Shorts-Support
- [ ] Post-Links sollen auf Video direkt zeigen
- [ ] Auto-Channel-Erkennung bei Newsfeed-Verbindung
- [ ] Facebook/LinkedIn im Newsfeed-Modal anzeigen trotz Connection
- [ ] Einstellungen ohne Speichern aktivieren

### AI-Features
- [ ] Thumbnail-Generator: Aktuelleres Model
- [ ] AI Clipping Feature

### Integrationen
- [ ] Shopify-Integration prüfen
