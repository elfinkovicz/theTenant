import { awsConfig } from '../config/aws-config'
import { useAuthStore } from '../store/authStore'

export interface StreamDestination {
  id: string
  platform: 'youtube' | 'facebook' | 'twitch' | 'tiktok' | 'instagram' | 'rumble' | 'linkedin' | 'custom'
  name: string
  rtmpUrl: string
  streamKey: string
  enabled: boolean
  status: 'inactive' | 'starting' | 'active' | 'stopping' | 'error'
  verticalMode?: 'crop' | 'letterbox'  // Nur für TikTok/Instagram
  mediaLiveChannelId?: string
  mediaLiveInputId?: string
  createdAt: string
  updatedAt: string
}

export interface CreateDestinationRequest {
  platform: StreamDestination['platform']
  name: string
  rtmpUrl: string
  streamKey: string
  enabled?: boolean
  verticalMode?: 'crop' | 'letterbox'
}

export interface UpdateDestinationRequest {
  name?: string
  rtmpUrl?: string
  streamKey?: string
  enabled?: boolean
  verticalMode?: 'crop' | 'letterbox'
}

class RestreamingService {
  private baseUrl = awsConfig.api.user

  private async getAuthHeaders() {
    const token = useAuthStore.getState().accessToken
    if (!token) {
      throw new Error('Not authenticated')
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }

  async getDestinations(): Promise<StreamDestination[]> {
    const response = await fetch(`${this.baseUrl}/stream-destinations`, {
      headers: await this.getAuthHeaders()
    })

    if (!response.ok) {
      throw new Error('Failed to fetch destinations')
    }

    return response.json()
  }

  async createDestination(data: CreateDestinationRequest): Promise<StreamDestination> {
    const response = await fetch(`${this.baseUrl}/stream-destinations`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create destination')
    }

    return response.json()
  }

  async updateDestination(id: string, data: UpdateDestinationRequest): Promise<StreamDestination> {
    const response = await fetch(`${this.baseUrl}/stream-destinations/${id}`, {
      method: 'PUT',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update destination')
    }

    return response.json()
  }

  async deleteDestination(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/stream-destinations/${id}`, {
      method: 'DELETE',
      headers: await this.getAuthHeaders()
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete destination')
    }
  }

  async startRestreaming(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/stream-destinations/${id}/start`, {
      method: 'POST',
      headers: await this.getAuthHeaders()
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to start restreaming')
    }
  }

  async stopRestreaming(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/stream-destinations/${id}/stop`, {
      method: 'POST',
      headers: await this.getAuthHeaders()
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to stop restreaming')
    }
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
