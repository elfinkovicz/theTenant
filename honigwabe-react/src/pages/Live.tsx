import { useState, useEffect } from 'react'
import { Play, Users, MessageCircle, Heart, Share2, RefreshCw, Edit } from 'lucide-react'
import { streamService } from '../services/stream.service'
import { awsConfig } from '../config/aws-config'
import { VideoPlayer } from '../components/VideoPlayer'
import { LiveChat } from '../components/LiveChat'
import { AdManagement } from '../components/AdManagement'
import { advertisementService, Advertisement } from '../services/advertisement.service'
import { useAdmin } from '../hooks/useAdmin'

export const Live = () => {
  const [isLive, setIsLive] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [showPlayer, setShowPlayer] = useState(false)
  const [viewerCount] = useState(0)
  const [advertisement, setAdvertisement] = useState<Advertisement | null>(null)
  const [showAdManagement, setShowAdManagement] = useState(false)
  const { isAdmin } = useAdmin()

  // Prüfe Stream-Status beim Laden
  useEffect(() => {
    checkStreamStatus()
    loadAdvertisement()
    
    // Prüfe alle 30 Sekunden
    const interval = setInterval(checkStreamStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadAdvertisement = async () => {
    try {
      const ad = await advertisementService.getAdvertisement()
      setAdvertisement(ad)
    } catch (error) {
      console.error('Failed to load advertisement:', error)
    }
  }

  const checkStreamStatus = async () => {
    setIsChecking(true)
    try {
      const isAvailable = await streamService.checkStreamAvailability()
      setIsLive(isAvailable)
      
      // Wenn Stream live ist, zeige den Player
      if (isAvailable) {
        setShowPlayer(true)
      }
    } catch (error) {
      console.error('Failed to check stream status:', error)
      setIsLive(false)
      setShowPlayer(false)
    } finally {
      setIsChecking(false)
    }
  }

  const handlePlayClick = () => {
    // Versuche den Player zu laden, auch wenn Check fehlschlägt
    setShowPlayer(true)
    setIsLive(true)
    checkStreamStatus()
  }

  const handlePlayerError = (error: any) => {
    console.error('Player error:', error)
    setIsLive(false)
    setShowPlayer(false)
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="relative py-12 overflow-hidden bg-gradient-to-br from-primary-900/20 via-dark-950 to-dark-950">
        <div className="container mx-auto px-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold mb-2">
              <span className="glow-text">Live Stream</span>
            </h1>
            <p className="text-dark-400 text-lg">
              Erlebe spannende Live-Inhalte und sei Teil der Community
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">

        {/* Top Ad Banner - Full Width */}
        {(advertisement?.enabled && advertisement?.imageUrl) || isAdmin ? (
          <div className="mb-6 relative group">
            {isAdmin && (
              <button
                onClick={() => setShowAdManagement(true)}
                className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-dark-800/80 hover:bg-primary-600 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Edit size={16} />
              </button>
            )}
            
            {advertisement?.enabled && advertisement?.imageUrl ? (
              advertisement.linkUrl ? (
                <a 
                  href={advertisement.linkUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block"
                >
                  <img 
                    src={advertisement.imageUrl} 
                    alt="Advertisement" 
                    className="w-full h-60 object-cover rounded-lg"
                  />
                </a>
              ) : (
                <img 
                  src={advertisement.imageUrl} 
                  alt="Advertisement" 
                  className="w-full h-60 object-cover rounded-lg"
                />
              )
            ) : isAdmin ? (
              <div className="h-60 bg-gradient-to-r from-primary-900/20 via-dark-800 to-primary-900/20 flex items-center justify-center rounded-lg border-2 border-dashed border-dark-700">
                <span className="text-dark-500 text-lg">Advertisement Space - 1920x240px</span>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Player */}
          <div className="lg:col-span-2 flex flex-col">
            <div className="card p-0 overflow-hidden flex-1 flex flex-col">
              <div className="relative aspect-video bg-dark-800 flex items-center justify-center flex-shrink-0">
                {isChecking ? (
                  <div className="text-center">
                    <RefreshCw size={64} className="mx-auto mb-4 text-primary-500 animate-spin" />
                    <p className="text-xl font-semibold mb-2">Checking Stream Status...</p>
                    <p className="text-dark-400">Please wait</p>
                  </div>
                ) : showPlayer ? (
                  <div className="w-full h-full relative bg-black">
                    {/* AWS IVS Video Player mit Video.js */}
                    <VideoPlayer 
                      src={awsConfig.ivs.playbackUrl}
                      onError={handlePlayerError}
                    />
                    
                    {/* Live Badge */}
                    {isLive && (
                      <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2 z-10">
                        <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                        LIVE
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center">
                    <button
                      onClick={handlePlayClick}
                      className="mb-4 p-4 rounded-full bg-primary-600 hover:bg-primary-700 transition-colors"
                    >
                      <Play size={64} className="text-white" />
                    </button>
                    <p className="text-xl font-semibold mb-2">Currently Offline</p>
                    <p className="text-dark-400 mb-4">Next stream coming soon!</p>
                    <button
                      onClick={handlePlayClick}
                      className="btn-secondary flex items-center gap-2 mx-auto"
                    >
                      <RefreshCw size={16} />
                      Check Again
                    </button>
                  </div>
                )}
              </div>

              <div className="p-6 flex-shrink-0">
                <h2 className="text-2xl font-bold mb-4">Stream Title</h2>
                
                <div className="flex items-center gap-6 mb-4">
                  <div className="flex items-center gap-2 text-dark-400">
                    <Users size={20} />
                    <span>{isLive ? `${viewerCount} viewers` : 'Offline'}</span>
                  </div>
                  <button className="flex items-center gap-2 text-dark-400 hover:text-red-500 transition-colors">
                    <Heart size={20} />
                    <span>456</span>
                  </button>
                  <button className="flex items-center gap-2 text-dark-400 hover:text-primary-500 transition-colors">
                    <Share2 size={20} />
                    <span>Share</span>
                  </button>
                </div>

                <p className="text-dark-400">
                  Welcome to today's stream! We have exciting content prepared for you.
                </p>
              </div>
            </div>
          </div>

          {/* Chat */}
          <div className="lg:col-span-1 flex flex-col">
            <div className="card flex flex-col flex-1">
              <div className="flex items-center gap-2 mb-4 pb-4 border-b border-dark-800">
                <MessageCircle size={24} className="text-primary-500" />
                <h3 className="text-xl font-semibold">Live Chat</h3>
              </div>

              <LiveChat isStreamLive={showPlayer} />
            </div>
          </div>
        </div>

        {/* Bottom Ad Banner - Full Width */}
        {(advertisement?.enabled && advertisement?.imageUrl) || isAdmin ? (
          <div className="mt-6 relative group">
            {isAdmin && (
              <button
                onClick={() => setShowAdManagement(true)}
                className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-dark-800/80 hover:bg-primary-600 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Edit size={16} />
              </button>
            )}
            
            {advertisement?.enabled && advertisement?.imageUrl ? (
              advertisement.linkUrl ? (
                <a 
                  href={advertisement.linkUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block"
                >
                  <img 
                    src={advertisement.imageUrl} 
                    alt="Advertisement" 
                    className="w-full h-60 object-cover rounded-lg"
                  />
                </a>
              ) : (
                <img 
                  src={advertisement.imageUrl} 
                  alt="Advertisement" 
                  className="w-full h-60 object-cover rounded-lg"
                />
              )
            ) : isAdmin ? (
              <div className="h-60 bg-gradient-to-r from-primary-900/20 via-dark-800 to-primary-900/20 flex items-center justify-center rounded-lg border-2 border-dashed border-dark-700">
                <span className="text-dark-500 text-lg">Advertisement Space - 1920x240px</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Ad Management Modal */}
      {showAdManagement && (
        <AdManagement 
          onClose={() => {
            setShowAdManagement(false)
            loadAdvertisement()
          }} 
        />
      )}
    </div>
  )
}
