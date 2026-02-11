import { awsConfig } from '../config/aws-config'
import { useAuthStore } from '../store/authStore'

export interface StreamDestination {
  id: string
  platform: 'youtube' | 'facebook' | 'twitch' | 'tiktok' | 'instagram' | 'rumble' | 'linkedin' | 'custom'
  name: string
  rtmpUrl: string
  streamKey: string
  enabled: boolean
  status: 'inactive' | 'creating' | 'starting' | 'active' | 'stopping' | 'error'
  verticalMode?: 'crop' | 'letterbox'  // Nur für TikTok/Instagram
  mediaLiveChannelId?: string
  mediaLiveInputId?: string
  // OAuth-Integration (YouTube, etc.)
  connectionType: 'manual' | 'oauth'  // manual = RTMP URL/Key, oauth = Plattform-Verbindung
  oauthConnected?: boolean
  oauthChannelId?: string
  oauthChannelTitle?: string
  oauthBroadcastId?: string
  // Stream Metadaten (nur bei OAuth)
  streamTitle?: string
  streamDescription?: string
  privacyStatus?: 'public' | 'unlisted' | 'private'
  createdAt: string
  updatedAt: string
}

export interface CreateDestinationRequest {
  platform: StreamDestination['platform']
  name: string
  connectionType: 'manual' | 'oauth'
  // Für manual connection
  rtmpUrl?: string
  streamKey?: string
  // Für OAuth connection
  oauthConnected?: boolean
  oauthChannelId?: string
  oauthChannelTitle?: string
  oauthAccessToken?: string  // For Meta Live OAuth (page access token)
  // Stream Metadaten (für OAuth)
  streamTitle?: string
  streamDescription?: string
  privacyStatus?: 'public' | 'unlisted' | 'private'
  enabled?: boolean
  verticalMode?: 'crop' | 'letterbox'
}

export interface UpdateDestinationRequest {
  name?: string
  rtmpUrl?: string
  streamKey?: string
  enabled?: boolean
  verticalMode?: 'crop' | 'letterbox'
  // Stream Metadaten (für OAuth)
  streamTitle?: string
  streamDescription?: string
  privacyStatus?: 'public' | 'unlisted' | 'private'
}

export interface IVSChannelInfo {
  channelArn: string
  ingestEndpoint: string
  streamKey: string
  playbackUrl: string
  chatRoomArn: string
}

class RestreamingService {
  private baseUrl = awsConfig.api.user

  private getTenantId(): string {
    // Priority: currentTenantId (set by TenantProvider) > hostname detection > platform UUID
    const currentTenantId = localStorage.getItem('currentTenantId');
    if (currentTenantId) return currentTenantId;
    
    const hostname = window.location.hostname;
    if (hostname.includes('viraltenant.com')) {
      const parts = hostname.split('.');
      return (parts.length >= 3 && parts[0] !== 'www') ? parts[0] : '319190e1-0791-43b0-bd04-506f959c1471';
    }
    return '319190e1-0791-43b0-bd04-506f959c1471';
  }

  private getStoredTenantId(): string | null {
    // Priority: currentTenantId (set by TenantProvider) > resolvedTenantId (legacy)
    return localStorage.getItem('currentTenantId') || localStorage.getItem('resolvedTenantId');
  }

  private async getAuthHeaders() {
    const token = useAuthStore.getState().accessToken
    if (!token) {
      throw new Error('Not authenticated')
    }
    
    const tenantId = this.getTenantId();
    
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Creator-ID': tenantId
    }
  }

  // AWS IVS Integration
  async getIVSChannelInfo(): Promise<IVSChannelInfo | null> {
    const tenantId = this.getTenantId();
    
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/live/ivs-info`)

    if (!response.ok) {
      throw new Error('Failed to fetch IVS channel info')
    }

    const data = await response.json()
    
    if (data.resolvedTenantId) {
      localStorage.setItem('resolvedTenantId', data.resolvedTenantId);
    }

    return data.ivsInfo
  }

  async createChatToken(username?: string): Promise<string> {
    const storedTenantId = this.getStoredTenantId();
    const tenantId = storedTenantId || this.getTenantId();
    
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/live/chat-token`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify({ username })
    })

    if (!response.ok) {
      throw new Error('Failed to create chat token')
    }

    const data = await response.json()
    
    if (data.resolvedTenantId) {
      localStorage.setItem('resolvedTenantId', data.resolvedTenantId);
    }

    return data.chatToken
  }

  // Stream Destinations Management
  async getDestinations(): Promise<StreamDestination[]> {
    const storedTenantId = this.getStoredTenantId();
    const tenantId = storedTenantId || this.getTenantId();
    
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/live/destinations`, {
      headers: await this.getAuthHeaders()
    })

    if (!response.ok) {
      throw new Error('Failed to fetch destinations')
    }

    const data = await response.json()
    
    if (data.resolvedTenantId) {
      localStorage.setItem('resolvedTenantId', data.resolvedTenantId);
    }

    return data.destinations || []
  }

  async createDestination(data: CreateDestinationRequest): Promise<StreamDestination> {
    const storedTenantId = this.getStoredTenantId();
    const tenantId = storedTenantId || this.getTenantId();
    
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/live/destinations`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create destination')
    }

    const result = await response.json()
    
    if (result.resolvedTenantId) {
      localStorage.setItem('resolvedTenantId', result.resolvedTenantId);
    }

    return result.destination
  }

  async updateDestination(id: string, data: UpdateDestinationRequest): Promise<StreamDestination> {
    const storedTenantId = this.getStoredTenantId();
    const tenantId = storedTenantId || this.getTenantId();
    
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/live/destinations/${id}`, {
      method: 'PUT',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update destination')
    }

    const result = await response.json()
    
    if (result.resolvedTenantId) {
      localStorage.setItem('resolvedTenantId', result.resolvedTenantId);
    }

    return result.destination
  }

  async deleteDestination(id: string): Promise<void> {
    const storedTenantId = this.getStoredTenantId();
    const tenantId = storedTenantId || this.getTenantId();
    
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/live/destinations/${id}`, {
      method: 'DELETE',
      headers: await this.getAuthHeaders()
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete destination')
    }

    const result = await response.json()
    
    if (result.resolvedTenantId) {
      localStorage.setItem('resolvedTenantId', result.resolvedTenantId);
    }
  }

  // TODO: Implement MediaLive integration for start/stop restreaming
  async startRestreaming(id: string): Promise<{ message: string; destination: StreamDestination; autoDestroyAt?: string; warning?: string }> {
    const storedTenantId = this.getStoredTenantId();
    const tenantId = storedTenantId || this.getTenantId();
    
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/live/restreaming/${id}/start`, {
      method: 'POST',
      headers: await this.getAuthHeaders()
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to start restreaming')
    }

    const result = await response.json()
    
    if (result.resolvedTenantId) {
      localStorage.setItem('resolvedTenantId', result.resolvedTenantId);
    }

    return result
  }

  async stopRestreaming(id: string): Promise<{ message: string; destination: StreamDestination }> {
    const storedTenantId = this.getStoredTenantId();
    const tenantId = storedTenantId || this.getTenantId();
    
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/live/restreaming/${id}/stop`, {
      method: 'POST',
      headers: await this.getAuthHeaders()
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to stop restreaming')
    }

    const result = await response.json()
    
    if (result.resolvedTenantId) {
      localStorage.setItem('resolvedTenantId', result.resolvedTenantId);
    }

    return result
  }

  async stopAllRestreaming(): Promise<{ message: string }> {
    const storedTenantId = this.getStoredTenantId();
    const tenantId = storedTenantId || this.getTenantId();
    
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/live/restreaming/stop-all`, {
      method: 'POST',
      headers: await this.getAuthHeaders()
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to stop all restreaming')
    }

    return response.json()
  }

  async getRestreamingStatus(): Promise<{
    destinations: Array<{ id: string; platform: string; name: string; status: string; startedAt?: string; lastError?: string }>;
    autoDestroyTimer: number | null;
    autoDestroyAt: string | null;
    autoStopSetting: number;
    hasActiveChannels: boolean;
  }> {
    const storedTenantId = this.getStoredTenantId();
    const tenantId = storedTenantId || this.getTenantId();
    
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/live/restreaming/status`, {
      headers: await this.getAuthHeaders()
    })

    if (!response.ok) {
      throw new Error('Failed to get restreaming status')
    }

    return response.json()
  }

  async setAutoDestroyTimer(minutes: number): Promise<{ message: string; destroyAt: string | null; autoStopSetting: number; warning?: string }> {
    const storedTenantId = this.getStoredTenantId();
    const tenantId = storedTenantId || this.getTenantId();
    
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/live/restreaming/auto-destroy`, {
      method: 'PUT',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify({ minutes })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to set auto-destroy timer')
    }

    return response.json()
  }

  // Vordefinierte RTMP URLs für bekannte Plattformen
  getPlatformRtmpUrl(platform: StreamDestination['platform']): string {
    const urls: Record<string, string> = {
      youtube: 'rtmp://a.rtmp.youtube.com/live2',
      facebook: 'rtmps://live-api-s.facebook.com:443/rtmp/',
      twitch: 'rtmp://live.twitch.tv/app',
      tiktok: 'rtmp://push.tiktok.com/live',
      instagram: 'rtmps://live-upload.instagram.com:443/rtmp/',
      rumble: 'rtmp://stream.rumble.com/live',
      linkedin: 'rtmps://live-upload.linkedin.com:443/live',
      custom: ''
    }
    return urls[platform] || ''
  }

  getPlatformName(platform: StreamDestination['platform']): string {
    const names: Record<string, string> = {
      youtube: 'YouTube',
      facebook: 'Facebook',
      twitch: 'Twitch',
      tiktok: 'TikTok',
      instagram: 'Instagram',
      rumble: 'Rumble',
      linkedin: 'LinkedIn',
      custom: 'Custom RTMP'
    }
    return names[platform] || platform
  }

  isVerticalPlatform(platform: StreamDestination['platform']): boolean {
    return platform === 'tiktok' || platform === 'instagram'
  }
}

export const restreamingService = new RestreamingService()
