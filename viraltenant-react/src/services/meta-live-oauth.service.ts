import { awsConfig } from '../config/aws-config'

export interface MetaLiveOAuthStatus {
  connected: boolean
  platform: 'facebook-live' | 'instagram-live'
  accountId?: string
  accountName?: string
  accessToken?: string
  expiresAt?: string
}

export interface MetaLiveAccount {
  id: string
  name: string
  platform: 'facebook-live' | 'instagram-live'
}

class MetaLiveOAuthService {
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

  /**
   * Get Meta App ID for OAuth
   */
  async getAppId(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/meta/oauth/config`)
    if (!response.ok) {
      throw new Error('Meta OAuth nicht konfiguriert')
    }
    const { appId } = await response.json()
    return appId
  }

  /**
   * Opens OAuth popup for Facebook Live or Instagram Live
   */
  openOAuthPopup(platform: 'facebook-live' | 'instagram-live'): Promise<MetaLiveOAuthStatus | null> {
    return new Promise(async (resolve, reject) => {
      try {
        const appId = await this.getAppId()
        const tenantId = this.getTenantId()
        // Zentrale Redirect-URI über viraltenant.com für alle Tenants
        const redirectUri = encodeURIComponent(`https://viraltenant.com/meta-callback`)
        // originUrl für postMessage zurück zur Tenant-Subdomain
        const originUrl = window.location.origin
        // Get access token for callback authentication (base64 encode to avoid delimiter issues)
        const accessToken = localStorage.getItem('accessToken') || ''
        const encodedToken = btoa(accessToken)
        // State format: platform|tenantId|originUrl|encodedToken (using | as delimiter)
        const state = encodeURIComponent(`${platform}|${tenantId}|${originUrl}|${encodedToken}`)
        
        // Different scopes for Facebook Live vs Instagram Live
        let scope: string
        if (platform === 'facebook-live') {
          // Facebook Live requires publish_video AND pages_manage_posts for livestreaming
          scope = encodeURIComponent('pages_show_list,pages_read_engagement,pages_manage_posts,publish_video')
        } else {
          // Instagram Live - uses Instagram Business Account via Facebook
          scope = encodeURIComponent('instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,business_management')
        }
        
        const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}&response_type=code`
        
        // Open popup
        const width = 600
        const height = 700
        const left = window.screenX + (window.outerWidth - width) / 2
        const top = window.screenY + (window.outerHeight - height) / 2
        
        const popup = window.open(
          authUrl,
          'meta_live_oauth',
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
        )
        
        if (!popup) {
          throw new Error('Popup wurde blockiert. Bitte erlaube Popups für diese Seite.')
        }
        
        // Store platform for callback handling
        sessionStorage.setItem('meta_live_oauth_platform', platform)
        
        // Message handler for callback
        const messageHandler = async (event: MessageEvent) => {
          // Prüfe ob es eine Meta OAuth Message ist
          if (event.data?.type === 'meta-oauth-success' && event.data?.platform === platform) {
            window.removeEventListener('message', messageHandler)
            clearInterval(checkClosed)
            clearTimeout(timeoutId)
            sessionStorage.removeItem('meta_live_oauth_platform')
            
            resolve({
              connected: true,
              platform,
              accountId: event.data.accountId,
              accountName: event.data.accountName,
              accessToken: event.data.accessToken
            })
          } else if (event.data?.type === 'meta-oauth-error') {
            window.removeEventListener('message', messageHandler)
            clearInterval(checkClosed)
            clearTimeout(timeoutId)
            sessionStorage.removeItem('meta_live_oauth_platform')
            
            reject(new Error(event.data.error || 'OAuth fehlgeschlagen'))
          }
        }
        
        window.addEventListener('message', messageHandler)
        
        // Polling for popup close
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed)
            window.removeEventListener('message', messageHandler)
            sessionStorage.removeItem('meta_live_oauth_platform')
            
            // Check if we got the data via localStorage (fallback)
            const storedData = localStorage.getItem(`meta_live_${platform}`)
            if (storedData) {
              try {
                const data = JSON.parse(storedData)
                localStorage.removeItem(`meta_live_${platform}`)
                resolve({
                  connected: true,
                  platform,
                  accountId: data.accountId || data.pageId,
                  accountName: data.accountName || data.pageName,
                  accessToken: data.accessToken || data.pageAccessToken
                })
              } catch {
                resolve(null)
              }
            } else {
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

  /**
   * Get stored OAuth status for a platform
   */
  getStoredStatus(platform: 'facebook-live' | 'instagram-live'): MetaLiveOAuthStatus | null {
    const storedData = localStorage.getItem(`meta_live_${platform}`)
    if (!storedData) return null
    
    try {
      const data = JSON.parse(storedData)
      return {
        connected: true,
        platform,
        accountId: data.accountId || data.pageId,
        accountName: data.accountName || data.pageName,
        accessToken: data.accessToken || data.pageAccessToken
      }
    } catch {
      return null
    }
  }

  /**
   * Store OAuth data locally
   */
  storeOAuthData(platform: 'facebook-live' | 'instagram-live', data: any): void {
    localStorage.setItem(`meta_live_${platform}`, JSON.stringify(data))
  }

  /**
   * Clear stored OAuth data
   */
  clearOAuthData(platform: 'facebook-live' | 'instagram-live'): void {
    localStorage.removeItem(`meta_live_${platform}`)
  }
}

export const metaLiveOAuthService = new MetaLiveOAuthService()
