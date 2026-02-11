import { awsConfig } from '../config/aws-config'
import { useAuthStore } from '../store/authStore'

export interface YouTubeChannel {
  id: string
  title: string
  thumbnailUrl: string
  subscriberCount?: string
}

export interface YouTubeBroadcast {
  id: string
  title: string
  description: string
  scheduledStartTime?: string
  status: 'created' | 'ready' | 'testing' | 'live' | 'complete'
  boundStreamId?: string
}

export interface YouTubeOAuthStatus {
  connected: boolean
  channelId?: string
  channelTitle?: string
  channelThumbnail?: string
  expiresAt?: string
  scopes?: string[]
}

export interface YouTubeStreamMetadata {
  title: string
  description: string
  privacyStatus?: 'public' | 'unlisted' | 'private'
  categoryId?: string
  tags?: string[]
  enableAutoStart?: boolean
  enableAutoStop?: boolean
  enableDvr?: boolean
  enableEmbed?: boolean
  recordFromStart?: boolean
}

class YouTubeOAuthService {
  private baseUrl = awsConfig.api.user

  private getTenantId(): string {
    // Priority: currentTenantId (set by TenantProvider after domain resolution)
    const currentTenantId = localStorage.getItem('currentTenantId')
    if (currentTenantId) return currentTenantId
    
    // Fallback: detect from hostname (should rarely happen)
    const hostname = window.location.hostname
    if (hostname.includes('viraltenant.com')) {
      const parts = hostname.split('.')
      if (parts.length >= 3 && parts[0] !== 'www') return parts[0]
    }
    return '319190e1-0791-43b0-bd04-506f959c1471'
  }

  private getStoredTenantId(): string | null {
    return localStorage.getItem('currentTenantId')
  }

  private async getAuthHeaders() {
    const token = useAuthStore.getState().accessToken
    if (!token) {
      throw new Error('Not authenticated')
    }
    
    const storedTenantId = this.getStoredTenantId()
    const tenantId = storedTenantId || this.getTenantId()
    
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Creator-ID': tenantId
    }
  }

  /**
   * Startet den OAuth-Flow - öffnet YouTube Login in neuem Fenster
   */
  async initiateOAuth(): Promise<{ authUrl: string; state: string }> {
    const storedTenantId = this.getStoredTenantId()
    const tenantId = storedTenantId || this.getTenantId()
    
    // Zentrale Redirect-URI über viraltenant.com für alle Tenants
    // Die ursprüngliche Origin wird im State gespeichert für die Weiterleitung
    const redirectUri = `https://viraltenant.com/youtube/oauth/callback`
    const originUrl = window.location.origin
    
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/youtube/oauth/initiate`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify({ redirectUri, originUrl })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to initiate OAuth')
    }

    return response.json()
  }

  /**
   * Prüft den OAuth-Status für den aktuellen Tenant
   */
  async getOAuthStatus(): Promise<YouTubeOAuthStatus> {
    const storedTenantId = this.getStoredTenantId()
    const tenantId = storedTenantId || this.getTenantId()
    
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/youtube/oauth/status`, {
      headers: await this.getAuthHeaders()
    })

    if (!response.ok) {
      throw new Error('Failed to get OAuth status')
    }

    return response.json()
  }

  /**
   * Trennt die YouTube-Verbindung
   */
  async disconnectOAuth(): Promise<void> {
    const storedTenantId = this.getStoredTenantId()
    const tenantId = storedTenantId || this.getTenantId()
    
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/youtube/oauth/disconnect`, {
      method: 'DELETE',
      headers: await this.getAuthHeaders()
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to disconnect')
    }
  }

  /**
   * Erstellt einen neuen YouTube Broadcast mit Metadaten
   */
  async createBroadcast(metadata: YouTubeStreamMetadata): Promise<YouTubeBroadcast> {
    const storedTenantId = this.getStoredTenantId()
    const tenantId = storedTenantId || this.getTenantId()
    
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/youtube/broadcast`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(metadata)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to create broadcast')
    }

    return response.json()
  }

  /**
   * Aktualisiert Metadaten eines bestehenden Broadcasts
   */
  async updateBroadcast(broadcastId: string, metadata: Partial<YouTubeStreamMetadata>): Promise<YouTubeBroadcast> {
    const storedTenantId = this.getStoredTenantId()
    const tenantId = storedTenantId || this.getTenantId()
    
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/youtube/broadcast/${broadcastId}`, {
      method: 'PUT',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(metadata)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to update broadcast')
    }

    return response.json()
  }

  /**
   * Holt den aktuellen/letzten Broadcast
   */
  async getCurrentBroadcast(): Promise<YouTubeBroadcast | null> {
    const storedTenantId = this.getStoredTenantId()
    const tenantId = storedTenantId || this.getTenantId()
    
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/youtube/broadcast/current`, {
      headers: await this.getAuthHeaders()
    })

    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error('Failed to get current broadcast')
    }

    return response.json()
  }

  /**
   * Holt die Stream-Credentials (RTMP URL + Key) für einen verbundenen Account
   */
  async getStreamCredentials(): Promise<{ rtmpUrl: string; streamKey: string; broadcastId: string } | null> {
    const storedTenantId = this.getStoredTenantId()
    const tenantId = storedTenantId || this.getTenantId()
    
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/youtube/stream-credentials`, {
      headers: await this.getAuthHeaders()
    })

    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error('Failed to get stream credentials')
    }

    return response.json()
  }

  /**
   * Öffnet OAuth-Popup und wartet auf Callback
   */
  openOAuthPopup(): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      try {
        const { authUrl, state } = await this.initiateOAuth()
        
        // Speichere state für Validierung
        sessionStorage.setItem('youtube_oauth_state', state)
        
        // Öffne Popup
        const width = 600
        const height = 700
        const left = window.screenX + (window.outerWidth - width) / 2
        const top = window.screenY + (window.outerHeight - height) / 2
        
        const popup = window.open(
          authUrl,
          'youtube_oauth',
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
        )
        
        if (!popup) {
          throw new Error('Popup wurde blockiert. Bitte erlaube Popups für diese Seite.')
        }
        
        // Message Handler für Callback
        const messageHandler = async (event: MessageEvent) => {
          // Prüfe ob es eine YouTube OAuth Message ist
          if (event.data?.type === 'youtube-oauth-success') {
            window.removeEventListener('message', messageHandler)
            clearInterval(checkClosed)
            clearTimeout(timeoutId)
            sessionStorage.removeItem('youtube_oauth_state')
            
            // OAuth war erfolgreich
            resolve(true)
          } else if (event.data?.type === 'youtube-oauth-error') {
            window.removeEventListener('message', messageHandler)
            clearInterval(checkClosed)
            clearTimeout(timeoutId)
            sessionStorage.removeItem('youtube_oauth_state')
            
            reject(new Error(`OAuth Fehler: ${event.data.error}`))
          }
        }
        
        window.addEventListener('message', messageHandler)
        
        // Fallback: Polling für Popup-Schließung (falls postMessage nicht funktioniert)
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed)
            window.removeEventListener('message', messageHandler)
            sessionStorage.removeItem('youtube_oauth_state')
            
            // Prüfe ob OAuth erfolgreich war
            this.getOAuthStatus()
              .then(status => resolve(status.connected))
              .catch(() => resolve(false))
          }
        }, 500)
        
        // Timeout nach 5 Minuten
        const timeoutId = setTimeout(() => {
          clearInterval(checkClosed)
          window.removeEventListener('message', messageHandler)
          if (!popup.closed) {
            popup.close()
          }
          reject(new Error('OAuth Timeout'))
        }, 5 * 60 * 1000)
        
      } catch (error) {
        reject(error)
      }
    })
  }
}

export const youtubeOAuthService = new YouTubeOAuthService()
