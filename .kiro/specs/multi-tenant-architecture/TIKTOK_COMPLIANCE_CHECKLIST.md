# TikTok Direct Post API - Compliance Checklist

## Aktueller Stand vs. TikTok Richtlinien

### ✅ Vollständig implementiert

| Anforderung | Status | Implementierung |
|-------------|--------|-----------------|
| OAuth 2.0 mit PKCE | ✅ | `NewsfeedSettings.tsx` - Code Challenge/Verifier |
| Token Refresh | ✅ | `tenant-crosspost-tiktok/index.js` - `refreshAccessToken()` |
| PULL_FROM_URL für Server-Videos | ✅ | Videos werden von `viraltenant.com` gezogen |
| Privacy Level Auswahl | ✅ | Dynamisch aus `creator_info` API |
| Creator Info API Abfrage | ✅ | `creator_info/query` wird vor dem Posten aufgerufen |
| Fallback auf verfügbare Privacy-Optionen | ✅ | Automatischer Fallback wenn Option nicht verfügbar |
| Post als Entwurf Option | ✅ | `postAsDraft` sendet an TikTok Inbox |
| Publish Status Check | ✅ | `checkPublishStatus()` nach Upload |
| Client Secret serverseitig | ✅ | Nur in Lambda Environment Variables |
| **Posting Counter** | ✅ | `postsToday` / `postsLastReset` in Settings |
| **Interaction Settings** | ✅ | `allowComment`, `allowDuet`, `allowStitch` |
| **Commercial Content Disclosure** | ✅ | `commercialContentEnabled`, `brandOrganic`, `brandedContent` |
| **Branded Content Privacy-Einschränkung** | ✅ | Automatisch PUBLIC wenn brandedContent=true |
| **TikTok Terms Consent** | ✅ | Consent-Modal beim Aktivieren mit allen Links |
| **Music Usage Confirmation** | ✅ | Link im Consent-Modal |
| **Branded Content Policy** | ✅ | Link im Consent-Modal |
| **Video-Dauer Validierung** | ✅ | 90 Sekunden Limit im Frontend (ShortModal) |
| **Dynamische Privacy-Optionen** | ✅ | `privacyLevelOptions` aus creator_info in DB gespeichert |
| **Disabled Interactions** | ✅ | `commentDisabledByCreator`, `duetDisabledByCreator`, `stitchDisabledByCreator` |
| **Creator Nickname Anzeige** | ✅ | `@displayName` im Header und Settings |
| **Aktivierte Channels Anzeige** | ✅ | Im Modal-Header werden alle aktivierten Channels angezeigt |

---

## Implementierte Features

### 1. TikTok Terms Consent (NEU)
Beim ersten Aktivieren von TikTok muss der User den Bedingungen zustimmen:
- TikTok Music Usage Confirmation
- TikTok Branded Content Policy  
- TikTok Terms of Service

```tsx
// NewsfeedSettings.tsx - TikTok Tab
{!tiktokSettings.termsAccepted && (
  <div className="consent-modal">
    <h4>TikTok Nutzungsbedingungen</h4>
    <ul>
      <li>Music Usage Confirmation</li>
      <li>Branded Content Policy</li>
      <li>Terms of Service</li>
    </ul>
    <button onClick={() => setTiktokSettings({ 
      ...tiktokSettings, 
      termsAccepted: true, 
      termsAcceptedAt: new Date().toISOString()
    })}>
      Ich stimme zu
    </button>
  </div>
)}
```

### 2. Dynamische Privacy-Optionen (NEU)
Privacy-Optionen werden aus der TikTok creator_info API geladen und in DynamoDB gespeichert:

```javascript
// tenant-crosspost-tiktok/index.js
const creatorInfoData = {
  privacyLevelOptions: creatorInfo.data?.privacy_level_options || [],
  maxVideoDuration: creatorInfo.data?.max_video_post_duration_sec || 600,
  commentDisabledByCreator: creatorInfo.data?.comment_disabled || false,
  duetDisabledByCreator: creatorInfo.data?.duet_disabled || false,
  stitchDisabledByCreator: creatorInfo.data?.stitch_disabled || false
};

// In DynamoDB speichern
await dynamodb.send(new UpdateCommand({
  TableName: process.env.TIKTOK_SETTINGS_TABLE,
  Key: { tenant_id: tenantId },
  UpdateExpression: 'SET privacyLevelOptions = :plo, ...',
  ExpressionAttributeValues: { ':plo': creatorInfoData.privacyLevelOptions, ... }
}));
```

### 3. Disabled Interactions (NEU)
Wenn der Creator Comment/Duet/Stitch in seinen TikTok-Einstellungen deaktiviert hat, werden die Checkboxen ausgegraut:

```tsx
// NewsfeedSettings.tsx
<label className={tiktokSettings.commentDisabledByCreator ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}>
  <input 
    type="checkbox" 
    checked={tiktokSettings.allowComment && !tiktokSettings.commentDisabledByCreator} 
    disabled={tiktokSettings.commentDisabledByCreator}
  />
  <span>Kommentare erlauben</span>
  {tiktokSettings.commentDisabledByCreator && (
    <p className="text-yellow-400">⚠️ In deinen TikTok-Einstellungen deaktiviert</p>
  )}
</label>
```

### 4. Aktivierte Channels im Modal-Header (NEU)
Im Header der Post-Modals werden alle aktivierten Crosspost-Channels angezeigt:

```tsx
// ShortModal.tsx / NewsfeedModal.tsx
<p className="text-sm text-dark-400">
  Hochkant-Video (9:16) • Max. 90s
  {enabledChannels.length > 0 && (
    <span className="ml-2 text-primary-400">
      → {enabledChannels.map(ch => ch.displayName).join(', ')}
    </span>
  )}
</p>
```

### 5. Video-Dauer Validierung
Das 90-Sekunden-Limit wird im Frontend validiert:

```tsx
// ShortModal.tsx
const MAX_DURATION = 90; // 90 seconds for cross-platform compatibility

if (duration > MAX_DURATION) {
  setError(`⚠️ Shorts sollten maximal ${MAX_DURATION} Sekunden lang sein.`);
}
```

---

## TikTokSettings Interface

```typescript
export interface TikTokSettings {
  enabled: boolean
  accessToken: string
  refreshToken: string
  openId: string
  displayName: string
  avatarUrl: string
  expiresAt: number
  postAsDraft: boolean
  defaultPrivacy: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY'
  // Interaction Settings
  allowComment: boolean
  allowDuet: boolean
  allowStitch: boolean
  // Commercial Content
  commercialContentEnabled: boolean
  brandOrganic: boolean
  brandedContent: boolean
  // Posting Stats
  postsToday: number
  postsLastReset: string
  // Terms Acceptance
  termsAccepted: boolean
  termsAcceptedAt: string
  // Creator Info from TikTok API (dynamic)
  privacyLevelOptions?: string[]
  maxVideoDuration?: number
  commentDisabledByCreator?: boolean
  duetDisabledByCreator?: boolean
  stitchDisabledByCreator?: boolean
}
```

---

## Zusammenfassung

**Implementiert: 20 von 20 Anforderungen ✅**

Alle TikTok API Compliance-Anforderungen sind jetzt implementiert:

1. ✅ Terms Consent beim Aktivieren (Music Usage, Branded Content Policy, ToS)
2. ✅ 90 Sekunden Video-Limit (Frontend-Validierung)
3. ✅ Dynamische Privacy-Optionen aus creator_info
4. ✅ Disabled Interactions aus creator_info (ausgegraut wenn deaktiviert)
5. ✅ Creator Nickname Anzeige (@displayName)
6. ✅ Aktivierte Channels im Modal-Header
7. ✅ Commercial Content Disclosure mit Your Brand / Branded Content
8. ✅ Branded Content kann nicht privat sein
9. ✅ Posting Counter mit 10/Tag Limit
10. ✅ Processing Time Hinweis
