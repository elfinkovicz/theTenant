# Live Chat Setup - AWS IVS Chat Integration

## 🚀 Vollautomatisches Deployment

Das gesamte Setup ist jetzt vollautomatisch in `deploy.py` integriert!

```bash
python deploy.py
```

Das Script:
1. ✅ Installiert automatisch Lambda Dependencies (IVS Chat SDK)
2. ✅ Erstellt Terraform Konfiguration
3. ✅ Deployt Infrastructure (inkl. IVS Chat)
4. ✅ Generiert Frontend-Konfiguration mit Chat-API-URL
5. ✅ Baut und deployt Frontend

**Keine manuellen Schritte mehr erforderlich!**

---

## ✅ Was wurde implementiert

### 1. **AWS IVS Chat Service** (`src/services/chat.service.ts`)
- WebSocket-Verbindung zu AWS IVS Chat
- Nachrichtenversand und -empfang
- Connection State Management
- Event Handler für Messages und Connection States

### 2. **Live Chat Komponente** (`src/components/LiveChat.tsx`)
- Zeigt Chat nur wenn Stream live ist
- Authentifizierung erforderlich
- Auto-Scroll zu neuen Nachrichten
- Zeitstempel für Nachrichten
- Connection Status Anzeige
- Error Handling

### 3. **Video Player** (`src/components/VideoPlayer.tsx`)
- Video.js mit HLS-Support für AWS IVS Streams
- Adaptive Bitrate Streaming
- Live-UI mit Controls
- Error Handling

### 4. **Live-Seite Updates** (`src/pages/Live.tsx`)
- Stream-Status-Check beim Laden
- Automatische Prüfung alle 30 Sekunden
- Manueller Refresh-Button
- Integration von VideoPlayer und LiveChat
- Drei Zustände: Checking, Live, Offline

## 🔧 Nächste Schritte

### 1. Chat API Endpoint konfigurieren

Nach dem Terraform Deployment musst du die Chat-API-URL aktualisieren:

```bash
# Hole die Chat API URL aus Terraform Outputs
cd TerraformInfluencerTemplate
terraform output ivs_chat_api_endpoint
```

Dann aktualisiere in `honigwabe-react/src/config/aws-config.ts`:

```typescript
api: {
  // ... andere APIs
  chat: 'https://YOUR_ACTUAL_CHAT_API_ENDPOINT' // Ersetze mit dem Output
}
```

### 2. Terraform Deployment

Das IVS Chat Modul ist bereits aktiviert. Stelle sicher, dass es deployed ist:

```bash
cd TerraformInfluencerTemplate
terraform plan
terraform apply
```

### 3. Lambda Dependencies

Die Chat-Token Lambda benötigt das AWS SDK. Stelle sicher, dass die Dependencies installiert sind:

```bash
cd TerraformInfluencerTemplate/modules/ivs-chat/lambda
npm install @aws-sdk/client-ivschat
```

Dann das Lambda neu packen und deployen.

### 4. Frontend Deployment

```bash
cd honigwabe-react
npm run build
# Deploy dist/ zu S3
```

## 📋 Funktionsweise

### Chat-Flow:

1. **User öffnet Live-Seite**
   - Stream-Status wird geprüft
   - Wenn live: VideoPlayer wird geladen

2. **User ist eingeloggt**
   - Chat-Komponente fordert Token vom Backend an
   - Backend erstellt AWS IVS Chat Token (3h gültig)
   - Frontend verbindet sich zum Chat Room

3. **Nachrichten senden/empfangen**
   - User sendet Nachricht über WebSocket
   - Alle verbundenen Clients empfangen die Nachricht
   - Nachrichten werden mit Timestamp angezeigt

### Sicherheit:

- ✅ Chat nur für authentifizierte User
- ✅ Chat nur wenn Stream live ist
- ✅ Token-basierte Authentifizierung
- ✅ Backend generiert Tokens (nicht im Frontend)
- ✅ Tokens haben Ablaufzeit (3 Stunden)
- ✅ Rate Limiting (10 Nachrichten/Sekunde)
- ✅ Maximale Nachrichtenlänge (500 Zeichen)

## 🎨 Features

### Aktuell implementiert:
- ✅ Echtzeit-Chat mit AWS IVS
- ✅ Authentifizierung erforderlich
- ✅ Auto-Scroll zu neuen Nachrichten
- ✅ Zeitstempel
- ✅ Connection Status
- ✅ Error Handling
- ✅ Responsive Design

### Mögliche Erweiterungen:
- 🔄 User-Badges (Admin, Moderator, Subscriber)
- 🔄 Emojis/Emotes
- 🔄 Chat-Moderation (Timeout, Ban)
- 🔄 Slow Mode
- 🔄 Subscriber-Only Mode
- 🔄 Chat-Befehle (/clear, /timeout, etc.)
- 🔄 Umfragen im Chat
- 🔄 Pinned Messages

## 🐛 Troubleshooting

### Chat verbindet nicht:
1. Prüfe ob Chat API URL korrekt ist
2. Prüfe Browser Console für Fehler
3. Prüfe ob User eingeloggt ist
4. Prüfe ob Stream live ist

### Token-Fehler:
1. Prüfe Lambda Logs in CloudWatch
2. Prüfe IAM Permissions für Lambda
3. Prüfe ob Chat Room ARN korrekt ist

### Nachrichten kommen nicht an:
1. Prüfe WebSocket Connection Status
2. Prüfe Browser Console für Fehler
3. Prüfe Rate Limits
4. Prüfe Nachrichtenlänge (max 500 Zeichen)

## 📚 Dokumentation

- [AWS IVS Chat Docs](https://docs.aws.amazon.com/ivs/latest/userguide/chat.html)
- [IVS Chat Messaging SDK](https://github.com/aws/amazon-ivs-chat-messaging-sdk-js)
- [Video.js Docs](https://videojs.com/)

## 🔐 Umgebungsvariablen

Keine zusätzlichen Umgebungsvariablen erforderlich. Alle Konfigurationen sind in `aws-config.ts`.

## 💡 Hinweise

- Der Chat ist nur verfügbar wenn der Stream live ist
- User müssen eingeloggt sein um zu chatten
- Tokens sind 3 Stunden gültig
- Maximale Nachrichtenlänge: 500 Zeichen
- Rate Limit: 10 Nachrichten pro Sekunde
