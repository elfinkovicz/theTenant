/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_ENDPOINT: string
  readonly VITE_USER_POOL_ID: string
  readonly VITE_CLIENT_ID: string
  readonly VITE_COGNITO_DOMAIN: string
  readonly VITE_IVS_PLAYBACK_URL: string
  readonly VITE_IVS_CHAT_ROOM_ARN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
