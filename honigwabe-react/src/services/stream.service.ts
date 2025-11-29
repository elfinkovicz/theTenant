import { awsConfig } from '../config/aws-config'

export interface StreamStatus {
  isLive: boolean
  viewerCount?: number
  startTime?: string
}

class StreamService {
  /**
   * Prüft den Stream-Status über AWS IVS
   * Hinweis: Dies erfordert einen Backend-Endpoint, da IVS API-Aufrufe
   * AWS-Credentials benötigen, die nicht im Frontend sein sollten.
   */
  async getStreamStatus(): Promise<StreamStatus> {
    try {
      // TODO: Backend-Endpoint erstellen für Stream-Status
      // Für jetzt: Versuche den Stream zu laden und prüfe ob er verfügbar ist
      await fetch(awsConfig.ivs.playbackUrl, {
        method: 'HEAD',
        mode: 'no-cors'
      })
      
      // Da no-cors keine Response-Details liefert, nehmen wir an der Stream ist live
      // wenn die URL erreichbar ist
      return {
        isLive: true,
        viewerCount: 0
      }
    } catch (error) {
      console.error('Stream status check failed:', error)
      return {
        isLive: false
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
