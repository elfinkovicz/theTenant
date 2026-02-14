# i18n Implementierungsplan - ViralTenant Web

## Status: In Arbeit

## Phase 1: Setup (1 Tag) ✅ DONE

- [x] `react-i18next` und `i18next-browser-languagedetector` installieren
- [x] i18n Konfiguration erstellen (`src/i18n/index.ts`)
- [x] Ordnerstruktur anlegen (`src/i18n/locales/de/`, `src/i18n/locales/en/`)
- [x] i18n Provider in `main.tsx` einbinden
- [x] Basis-Übersetzungen erstellt (common, nav, auth, platform, tenant, modals, errors, footer)

## Phase 2: Language Switcher (0.5 Tage) ✅ DONE

- [x] `LanguageSwitcher` Komponente erstellen (Dropdown DE/EN)
- [x] In Header (Desktop + Mobile) integriert
- [x] Sprachpräferenz in LocalStorage (`viraltenant-language`)
- [x] Browser-Sprache als Default

## Phase 3: String-Extraktion - Platform Pages (2 Tage) 🔄 IN PROGRESS

Priorität 1 (öffentlich sichtbar):
- [ ] `PlatformHome.tsx` - Landing Page
- [ ] `PlatformPricing.tsx` - Preisseite
- [ ] `Login.tsx` / `Register.tsx` / `ForgotPassword.tsx`
- [ ] `TenantRegistration.tsx`
- [ ] Layout-Komponenten (Navbar, Footer)

## Phase 4: String-Extraktion - Tenant Pages (3 Tage)

Priorität 2 (Creator-Seiten):
- [ ] `Home.tsx` - Creator Homepage
- [ ] `Videos.tsx` / `Podcasts.tsx`
- [ ] `Live.tsx` / `Events.tsx`
- [ ] `Shop.tsx` / `Cart.tsx`
- [ ] `Newsfeed.tsx` / `Team.tsx` / `Contact.tsx`
- [ ] `Channels.tsx` / `Exclusive.tsx`

## Phase 5: String-Extraktion - Modals & Components (2 Tage)

~50 Komponenten mit UI-Text:
- [ ] Alle Modals (VideoEditModal, EventModal, etc.)
- [ ] Cards (VideoCard, PodcastCard, BillingCard)
- [ ] Management-Komponenten
- [ ] UI-Komponenten (Buttons, Labels, Placeholders)

## Phase 6: Übersetzung DE → EN (2-3 Tage)

- [ ] Platform-Texte übersetzen
- [ ] Tenant-Texte übersetzen
- [ ] Fehlermeldungen übersetzen
- [ ] Validierungstexte übersetzen

## Phase 7: SEO & Finishing (1 Tag)

- [ ] `hreflang` Tags im `<head>` setzen
- [ ] `lang` Attribut am `<html>` Tag dynamisch setzen
- [ ] Meta-Descriptions übersetzen
- [ ] Testing aller Sprachen

## Geschätzter Gesamtaufwand: ~12 Tage
