---
inclusion: manual
---
# Crossposting System

## Plattformen

| Typ | Plattformen | Status |
|-----|-------------|--------|
| OAuth | YouTube ✅, TikTok ✅, X/Twitter ✅, LinkedIn ✅, Threads ✅, Facebook ⏳, Instagram ⏳, Snapchat 🔄 |
| Webhook | Telegram, Discord, Slack, WhatsApp (AWS), Signal, E-Mail (SES) |
| Dezentral | Bluesky, Mastodon |

## Architektur
```
Newsfeed Post → tenant-newsfeed Lambda → crosspost-dispatcher → Platform-Lambdas (fan-out)
```

## OAuth Flow
```tsx
// 1. Connect
window.location.href = buildOAuthUrl(platform, redirectUri)

// 2. Callback
const code = searchParams.get('code')
await exchangeCodeForToken(code)
await autoChannelService.addOrUpdateChannel(connectionData)
```

## Content-Limits
| Plattform | Text | Video |
|-----------|------|-------|
| Twitter/X | 280 | 512MB, 2:20 |
| LinkedIn | 3000 | 200MB, 10min |
| TikTok | 2200 | 4GB, 10min |
| Instagram | 2200 | 4GB, 60min |
| Threads | 500 | - |
| Bluesky | 300 | - |

## Einschränkungen
- TikTok: Nur Draft-Posts, Commercial Disclosure nötig
- Meta: API Review + Business Account erforderlich
- Snapchat: Nur verifizierte Business Accounts
