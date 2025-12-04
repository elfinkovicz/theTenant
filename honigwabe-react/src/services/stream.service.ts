import { awsConfig } from '../config/aws-config'

export interface StreamStatus {
  isLive: boolean
  viewerCount?: number
  startTime?: string
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
}

export const streamService = new StreamService()
