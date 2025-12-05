import { awsConfig } from '../config/aws-config'
import { heroService } from './hero.service'
import { useAuthStore } from '../store/authStore'

export interface StreamStatus {
  isLive: boolean
  viewerCount?: number
  startTime?: string
}

export interface StreamInfo {
  title: string
  description: string
}

class StreamService {
  /**
   * Prüft den Stream-Status über AWS IVS
   * Holt Viewer Count vom Backend
   */
  async getStreamStatus(): Promise<StreamStatus> {
    try {
      const response = await fetch(`${awsConfig.api.user}/stream/status`)
      if (!response.ok) {
        throw new Error('Failed to get stream status')
      }
      const data = await response.json()
      return {
        isLive: data.isLive || false,
        viewerCount: data.viewerCount || 0,
        startTime: data.startTime
      }
    } catch (error) {
      console.error('Stream status check failed:', error)
      return {
        isLive: false,
        viewerCount: 0
      }
    }
  }

  /**
   * Alternative: Prüfe ob der Stream durch Laden des Players verfügbar ist
   */
  async checkStreamAvailability(): Promise<boolean> {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      video.src = awsConfig.ivs.playbackUrl
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

  getPlaybackUrl(): string {
    return awsConfig.ivs.playbackUrl
  }

  getChatRoomArn(): string {
    return awsConfig.ivs.chatRoomArn
  }

  /**
   * Get stream info (title, description) from backend
   */
  async getStreamInfo(): Promise<StreamInfo> {
    try {
      const heroContent = await heroService.getHeroContent()
      return {
        title: heroContent.streamTitle || 'Live Stream',
        description: heroContent.streamDescription || 'Welcome to the stream!'
      }
    } catch (error) {
      console.error('Failed to load stream info:', error)
      return {
        title: 'Live Stream',
        description: 'Welcome to the stream!'
      }
    }
  }

  /**
   * Update stream info (title, description) in backend
   */
  async updateStreamInfo(info: StreamInfo): Promise<void> {
    const token = useAuthStore.getState().accessToken
    if (!token) {
      throw new Error('Not authenticated')
    }
    await heroService.updateHeroContent({
      streamTitle: info.title,
      streamDescription: info.description
    }, token)
  }
}

export const streamService = new StreamService()
