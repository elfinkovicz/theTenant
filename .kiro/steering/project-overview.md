---
inclusion: always
---
# ViralTenant - All-in-One Creator Platform

## Projektübersicht
ViralTenant ist eine serverless Multi-Tenant Creator-Plattform auf AWS für Creatoren, Influencer und Personen des öffentlichen Lebens.

**Version:** 1.0 (In Entwicklung)
**Domain:** `{creator}.viraltenant.com`

## Kernfunktionen V1.0

| Feature | Beschreibung |
|---------|--------------|
| Homepage | Hero-Section, Team, Kontakt, Custom Pages, Legal |
| Live | Streaming + Multistreaming (YouTube, Twitch, Kick, Instagram, TikTok) |
| Channels | Linktree-Style Social-Media-Übersicht |
| Videos | Upload, Kategorien, AI-Thumbnails |
| Podcasts | Audio-Upload, AI-Transkription |
| Events | Kalender mit Slot-Buchung |
| Newsfeed | Posts + Crossposting zu 15+ Plattformen |
| Membership | Paywall für exklusive Inhalte |
| Shop | Digitale/physische Produkte |

## Tech-Stack

| Layer | Technologie |
|-------|-------------|
| Frontend | React 18, TypeScript, Vite, TailwindCSS, Zustand |
| Backend | API Gateway, Lambda (Node.js), DynamoDB |
| Storage | S3 + CloudFront |
| Auth | Cognito + Lambda Authorizer |
| IaC | Terraform (modular) |
| Payments | Mollie (Connect + Platform Billing) |

## Architektur-Prinzipien
1. Multi-Tenancy mit vollständiger Datenisolation
2. Serverless & automatisch skalierend
3. JWT-basierte Auth mit Lambda Authorizer
4. CDN-First für alle Assets
5. Modulare Terraform-Architektur
