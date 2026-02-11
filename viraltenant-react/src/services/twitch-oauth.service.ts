import { awsConfig } from '../config/aws-config'
import { useAuthStore } from '../store/authStore'

export interface TwitchOAuthStatus {
  connected: boolean
  userId?: string
  username?: string
  displayName?: string
  profileImageUrl?: string
  streamKey?: string
  expiresAt?: string
}

class TwitchOAuthService {
  private baseUrl = awsConfig.api.user

  private getTenantId(): string {
    // Priority: currentTenantId (set by TenantProvider) > hostname detection > platform UUID
    const currentTenantId = localStorage.getItem('currentTenantId')
    if (currentTenantId) return currentTenantId
    
    const hostname = window.location.hostname
    if (hostname.includes('viraltenant.com')) {
      const parts = hostname.split('.')
      return (parts.length >= 3 && parts[0] !== 'www') ? parts[0] : '319190e1-0791-43b0-bd04-506f959c1471'
    }
    return '319190e1-0791-43b0-bd04-506f959c1471'
  }

  private async getAuthHeaders() {
    const token = useAuthStore.getState().accessToken
    if (!token) {
      throw new Error('Not authenticated')
    }
    
    const tenantId = this.getTenantId()
    
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Creator-ID': tenantId
    }
  }

  /**
   * Get Twitch OAuth status
   */
  async getOAuthStatus(): Promise<TwitchOAuthStatus> {
    const tenantId = this.getTenantId()
    
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/twitch/oauth/status`, {
      headers: await this.getAuthHeaders()
    })

    if (!response.ok) {
      if (response.status === 404) {
        return { connected: false }
      }
      throw new Error('Failed to get Twitch OAuth status')
    }

    return response.json()
  }

  /**
   * Disconnect Twitch OAuth
   */
  async disconnectOAuth(): Promise<void> {
    const tenantId = this.getTenantId()
    
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/twitch/oauth/disconnect`, {
      method: 'DELETE',
      headers: await this.getAuthHeaders()
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to disconnect Twitch')
    }
  }

  /**
   * Opens OAuth popup for Twitch
   */
  openOAuthPopup(): Promise<TwitchOAuthStatus | null> {
    return new Promise(async (resolve, reject) => {
      try {
        // Get Twitch Client ID from backend
        const configResponse = await fetch(`${this.baseUrl}/twitch/oauth/config`)
        if (!configResponse.ok) {
          throw new Error('Twitch OAuth nicht konfiguriert')
        }
        const { clientId } = await configResponse.json()
        
        const tenantId = this.getTenantId()
        // Zentrale Redirect-URI über viraltenant.com (für alle Tenants)
        const redirectUri = encodeURIComponent(`https://viraltenant.com/twitch-callback`)
        const state = encodeURIComponent(tenantId)
        
        // Twitch OAuth scopes for streaming
        const scopes = encodeURIComponent([
          'channel:read:stream_key',
          'channel:manage:broadcast',
          'user:read:email'
        ].join(' '))
        
        const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scopes}&state=${state}`
        
        // Open popup
        const width = 600
        const height = 700
        const left = window.screenX + (window.outerWidth - width) / 2
        const top = window.screenY + (window.outerHeight - height) / 2
        
        const popup = window.open(
          authUrl,
          'twitch_oauth',
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
        )
        
        if (!popup) {
          throw new Error('Popup wurde blockiert. Bitte erlaube Popups für diese Seite.')
        }
        
        // Store for callback
        sessionStorage.setItem('twitch_oauth_pending', 'true')
        
        // Message handler for callback
        const messageHandler = async (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return
          
          if (event.data?.type === 'twitch-oauth-success') {
            window.removeEventListener('message', messageHandler)
            clearInterval(checkClosed)
            clearTimeout(timeoutId)
            sessionStorage.removeItem('twitch_oauth_pending')
            
            resolve({
              connected: true,
              userId: event.data.userId,
              username: event.data.username,
              displayName: event.data.displayName,
              profileImageUrl: event.data.profileImageUrl,
              streamKey: event.data.streamKey
            })
          } else if (event.data?.type === 'twitch-oauth-error') {
            window.removeEventListener('message', messageHandler)
            clearInterval(checkClosed)
            clearTimeout(timeoutId)
            sessionStorage.removeItem('twitch_oauth_pending')
            
            reject(new Error(event.data.error || 'OAuth fehlgeschlagen'))
          }
        }
        
        window.addEventListener('message', messageHandler)
        
        // Polling for popup close
        const checkClosed = setInterval(async () => {
          if (popup.closed) {
            clearInterval(checkClosed)
            window.removeEventListener('message', messageHandler)
            sessionStorage.removeItem('twitch_oauth_pending')
            
            // Check if OAuth was successful by fetching status
            try {
              const status = await this.getOAuthStatus()
              resolve(status.connected ? status : null)
            } catch {
              resolve(null)
            }
          }
        }, 500)
        
        // Timeout after 5 minutes
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

export const twitchOAuthService = new TwitchOAuthService()
