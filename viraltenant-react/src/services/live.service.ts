import { awsConfig } from '../config/aws-config'
import { useAuthStore } from '../store/authStore'
import { StreamGuest } from './stream.service'

export interface IVSInfo {
  channelArn: string | null
  ingestEndpoint: string | null
  streamKey: string | null
  playbackUrl: string | null
  chatRoomArn: string | null
}

export interface LiveSettings {
  tenant_id: string
  streamTitle: string
  streamDescription: string
  chatEnabled: boolean
  isLive: boolean
  viewerCount: number
  ivs_channel_arn?: string
  ivs_ingest_endpoint?: string
  ivs_stream_key?: string
  ivs_playback_url?: string
  ivs_chat_room_arn?: string
  thumbnailUrl?: string
  offlineImageUrl?: string
  offlineImageKey?: string
  schedule?: ScheduleItem[]
  guests?: StreamGuest[]
  autoSaveStream?: boolean
  autoPublishToNewsfeed?: boolean
  membersOnly?: boolean
  settings?: {
    autoStart: boolean
    lowLatency: boolean
    dvr: boolean
  }
}

export interface ScheduleItem {
  id: string
  title: string
  date: string
  time: string
  description?: string
}

class LiveService {
  private baseUrl = awsConfig.api.user

  /**
   * Get tenant ID - always use currentTenantId from localStorage (set by TenantProvider)
   */
  private getTenantId(): string {
    // Priority: currentTenantId (set by TenantProvider after domain resolution)
    const currentTenantId = localStorage.getItem('currentTenantId')
    if (currentTenantId) {
      return currentTenantId
    }
    
    // Fallback: detect from hostname (should rarely happen)
    const hostname = window.location.hostname
    if (hostname.includes('viraltenant.com')) {
      const parts = hostname.split('.')
      if (parts.length >= 3 && parts[0] !== 'www') {
        return parts[0]
      }
    }
    
    return '319190e1-0791-43b0-bd04-506f959c1471'
  }

  /**
   * Get IVS channel info for the current tenant
   */
  async getIVSInfo(): Promise<IVSInfo | null> {
    try {
      const tenantId = this.getTenantId()
      const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/live/ivs-info`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Creator-ID': tenantId
        }
      })

      if (!response.ok) {
        console.error('Failed to get IVS info:', response.status)
        return null
      }

      const data = await response.json()
      return data.ivsInfo || null
    } catch (error) {
      console.error('Error fetching IVS info:', error)
      return null
    }
  }

  /**
   * Get live settings for the current tenant
   */
  async getLiveSettings(): Promise<LiveSettings | null> {
    try {
      const tenantId = this.getTenantId()
      const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/live`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Creator-ID': tenantId
        }
      })

      if (!response.ok) {
        console.error('Failed to get live settings:', response.status)
        return null
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching live settings:', error)
      return null
    }
  }

  /**
   * Get stream status from IVS (checks if stream is actually live)
   * Uses the ivs-info endpoint which includes stream status
   */
  async getStreamStatus(): Promise<{ isLive: boolean; state: string; viewerCount: number }> {
    try {
      const tenantId = this.getTenantId()
      const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/live/ivs-info`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Creator-ID': tenantId
        }
      })

      if (!response.ok) {
        console.error('Failed to get stream status:', response.status)
        return { isLive: false, state: 'ERROR', viewerCount: 0 }
      }

      const data = await response.json()
      return data.streamStatus || { isLive: false, state: 'UNKNOWN', viewerCount: 0 }
    } catch (error) {
      console.error('Error fetching stream status:', error)
      return { isLive: false, state: 'ERROR', viewerCount: 0 }
    }
  }

  /**
   * Update live settings (admin only)
   */
  async updateLiveSettings(settings: Partial<LiveSettings>): Promise<LiveSettings | null> {
    const token = useAuthStore.getState().accessToken
    if (!token) {
      throw new Error('Not authenticated')
    }

    try {
      const tenantId = this.getTenantId()
      const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/live`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Creator-ID': tenantId
        },
        body: JSON.stringify(settings)
      })

      if (!response.ok) {
        throw new Error('Failed to update live settings')
      }

      return await response.json()
    } catch (error) {
      console.error('Error updating live settings:', error)
      throw error
    }
  }

  /**
   * Check if stream is available by testing the playback URL
   */
  async checkStreamAvailability(playbackUrl: string): Promise<boolean> {
    if (!playbackUrl) return false

    return new Promise((resolve) => {
      const video = document.createElement('video')
      video.src = playbackUrl
      video.muted = true

      const timeout = setTimeout(() => {
        video.remove()
        resolve(false)
      }, 5000)

      video.onloadedmetadata = () => {
        clearTimeout(timeout)
        video.remove()
        resolve(true)
      }

      video.onerror = () => {
        clearTimeout(timeout)
        video.remove()
        resolve(false)
      }

      video.load()
    })
  }

  /**
   * Upload offline image for stream
   */
  async uploadOfflineImage(file: File): Promise<{ imageUrl: string; imageKey: string }> {
    const token = useAuthStore.getState().accessToken
    if (!token) {
      throw new Error('Not authenticated')
    }

    const tenantId = this.getTenantId()
    console.log('[LiveService] Uploading offline image for tenant:', tenantId)
    
    // Get presigned upload URL
    const urlResponse = await fetch(`${this.baseUrl}/tenants/${tenantId}/live/offline-image/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Creator-ID': tenantId
      },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type
      })
    })

    if (!urlResponse.ok) {
      const errorText = await urlResponse.text()
      console.error('[LiveService] Failed to get upload URL:', urlResponse.status, errorText)
      throw new Error('Failed to get upload URL: ' + errorText)
    }

    const urlData = await urlResponse.json()
    console.log('[LiveService] Got upload URL response:', JSON.stringify(urlData))
    
    // Handle different possible field names from backend
    const uploadUrl = urlData.uploadUrl
    const imageKey = urlData.imageKey || urlData.key
    const imageUrl = urlData.imageUrl || urlData.publicUrl
    
    if (!uploadUrl) {
      throw new Error('No uploadUrl in response')
    }

    // Upload to S3
    console.log('[LiveService] Uploading to S3, key:', imageKey)
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type
      },
      body: file
    })

    if (!uploadResponse.ok) {
      console.error('[LiveService] S3 upload failed:', uploadResponse.status)
      throw new Error('Failed to upload image to S3')
    }
    console.log('[LiveService] S3 upload successful')

    // Update live settings with the new image URL and key
    console.log('[LiveService] Updating live settings with:', { imageUrl, imageKey })
    await this.updateLiveSettings({
      offlineImageUrl: imageUrl,
      offlineImageKey: imageKey
    })
    console.log('[LiveService] Live settings updated')

    return { imageUrl, imageKey }
  }

  /**
   * Delete offline image
   */
  async deleteOfflineImage(): Promise<void> {
    const token = useAuthStore.getState().accessToken
    if (!token) {
      throw new Error('Not authenticated')
    }

    const tenantId = this.getTenantId()
    
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/live/offline-image`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Creator-ID': tenantId
      }
    })

    if (!response.ok) {
      throw new Error('Failed to delete offline image')
    }
  }

  /**
   * Get chat token for authenticated users
   */
  async getChatToken(username: string): Promise<string | null> {
    const token = useAuthStore.getState().accessToken
    if (!token) {
      console.error('Not authenticated')
      return null
    }

    try {
      const tenantId = this.getTenantId()
      const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/live/chat-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Creator-ID': tenantId
        },
        body: JSON.stringify({ username })
      })

      if (!response.ok) {
        throw new Error('Failed to get chat token')
      }

      const data = await response.json()
      return data.chatToken || null
    } catch (error) {
      console.error('Error getting chat token:', error)
      return null
    }
  }
}

export const liveService = new LiveService()
