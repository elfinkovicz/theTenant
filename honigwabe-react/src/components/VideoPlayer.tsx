import { useEffect, useRef } from 'react'
import videojs from 'video.js'
import type Player from 'video.js/dist/types/player'

interface VideoPlayerProps {
  src: string
  onReady?: (player: Player) => void
  onError?: (error: any) => void
}

export const VideoPlayer = ({ src, onReady, onError }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Player | null>(null)

  useEffect(() => {
    // Stelle sicher, dass Video.js Player nur einmal initialisiert wird
    if (!playerRef.current && videoRef.current) {
      const videoElement = document.createElement('video-js')
      videoElement.classList.add('vjs-big-play-centered')
      videoRef.current.appendChild(videoElement)

      const player = videojs(videoElement, {
        autoplay: true,
        controls: true,
        responsive: true,
        fluid: true,
        liveui: true,
        html5: {
          vhs: {
            enableLowInitialPlaylist: true,
            smoothQualityChange: true,
            overrideNative: true
          }
        },
        sources: [{
          src: src,
          type: 'application/x-mpegURL'
        }]
      }, () => {
        console.log('Player is ready')
        onReady?.(player)
      })

      player.on('error', () => {
        const error = player.error()
        console.error('Player error:', error)
        onError?.(error)
      })

      playerRef.current = player
    }

    return () => {
      const player = playerRef.current
      if (player && !player.isDisposed()) {
        player.dispose()
        playerRef.current = null
      }
    }
  }, [src, onReady, onError])

  return (
    <div data-vjs-player className="w-full h-full">
      <div ref={videoRef} className="w-full h-full" />
    </div>
  )
}
