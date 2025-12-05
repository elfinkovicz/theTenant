import { useState, useEffect } from 'react'
import { Play, Users, MessageCircle, Share2, RefreshCw, Edit, Settings } from 'lucide-react'
import { streamService, StreamInfo } from '../services/stream.service'
import { awsConfig } from '../config/aws-config'
import { VideoPlayer } from '../components/VideoPlayer'
import { LiveChat } from '../components/LiveChat'
import { AdManagement } from '../components/AdManagement'
import { StreamSettings } from '../components/StreamSettings'
import { advertisementService, Advertisement } from '../services/advertisement.service'
import { useAdmin } from '../hooks/useAdmin'

export const Live = () => {
  const [isLive, setIsLive] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [showPlayer, setShowPlayer] = useState(false)
  const [viewerCount, setViewerCount] = useState(0)
  const [topBanner, setTopBanner] = useState<Advertisement | null>(null)
  const [bottomBanner, setBottomBanner] = useState<Advertisement | null>(null)
  const [showAdManagement, setShowAdManagement] = useState(false)
  const [showStreamSettings, setShowStreamSettings] = useState(false)
  const [streamInfo, setStreamInfo] = useState<StreamInfo>({
    title: 'Stream Title',
    description: 'Welcome to today\'s stream! We have exciting content prepared for you.'
  })
  const [shareCopied, setShareCopied] = useState(false)
  const { isAdmin } = useAdmin()

  // Prüfe Stream-Status beim Laden
  useEffect(() => {
    checkStreamStatus()
    loadAdvertisement()
    loadStreamInfo()
    
    // Prüfe alle 30 Sekunden
    const interval = setInterval(checkStreamStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  // Update Viewer Count wenn Stream live ist
  useEffect(() => {
    if (isLive) {
      updateViewerCount()
      // Update alle 60 Sekunden
      const interval = setInterval(updateViewerCount, 60000)
      return () => clearInterval(interval)
    }
  }, [isLive])

  const updateViewerCount = async () => {
    try {
      const status = await streamService.getStreamStatus()
      if (status.viewerCount !== undefined) {
        setViewerCount(status.viewerCount)
      }
    } catch (error) {
      console.error('Failed to update viewer count:', error)
    }
  }

  const loadStreamInfo = async () => {
    try {
      const info = await streamService.getStreamInfo()
      setStreamInfo(info)
    } catch (error) {
      console.error('Failed to load stream info:', error)
    }
  }

  const saveStreamInfo = async (info: StreamInfo) => {
    try {
      await streamService.updateStreamInfo(info)
      setStreamInfo(info)
    } catch (error) {
      console.error('Failed to save stream info:', error)
      throw error
    }
  }

  const loadAdvertisement = async () => {
    try {
      const data = await advertisementService.getAdvertisements()
      if (data) {
        setTopBanner(data.topBanner)
        setBottomBanner(data.bottomBanner)
      }
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
    // Versuche den Player zu laden
    setShowPlayer(true)
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">
                <span className="glow-text">Live Stream</span>
              </h1>
              <p className="text-dark-400 text-lg">
                Erlebe spannende Live-Inhalte und sei Teil der Community
              </p>
            </div>
            {isAdmin && (
              <div className="flex gap-3">
                <button
                  onClick={() => setShowStreamSettings(true)}
                  className="btn-primary flex items-center gap-2"
                >
                  <Settings size={20} />
                  Optionen
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">

        {/* Top Ad Banner - Full Width */}
        {(topBanner?.enabled && topBanner?.imageUrl) || isAdmin ? (
          <div className="mb-6 relative group">
            {isAdmin && (
              <button
                onClick={() => setShowAdManagement(true)}
                className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-dark-800/80 hover:bg-primary-600 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Edit size={16} />
              </button>
            )}
            
            {topBanner?.enabled && topBanner?.imageUrl ? (
              topBanner.linkUrl ? (
                <a 
                  href={topBanner.linkUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block"
                >
                  <img 
                    src={topBanner.imageUrl} 
                    alt="Top Advertisement" 
                    className="w-full h-60 object-cover rounded-lg"
                  />
                </a>
              ) : (
                <img 
                  src={topBanner.imageUrl} 
                  alt="Top Advertisement" 
                  className="w-full h-60 object-cover rounded-lg"
                />
              )
            ) : isAdmin ? (
              <div className="h-60 bg-gradient-to-r from-primary-900/20 via-dark-800 to-primary-900/20 flex items-center justify-center rounded-lg border-2 border-dashed border-dark-700">
                <span className="text-dark-500 text-lg">Top Advertisement Space - 1920x240px</span>
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
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold">{streamInfo.title}</h2>
                  {isAdmin && (
                    <button
                      onClick={() => setShowStreamSettings(true)}
                      className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
                      title="Stream bearbeiten"
                    >
                      <Edit size={20} />
                    </button>
                  )}
                </div>
                
                <div className="flex items-center gap-6 mb-4">
                  <div className="flex items-center gap-2">
                    {isLive ? (
                      <>
                        <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-green-400 font-medium">Online</span>
                      </>
                    ) : (
                      <>
                        <span className="w-2.5 h-2.5 bg-gray-500 rounded-full" />
                        <span className="text-gray-400">Offline</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-dark-400">
                    <Users size={20} />
                    <span>{viewerCount} Zuschauer</span>
                  </div>
                  <button 
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(window.location.href)
                        setShareCopied(true)
                        setTimeout(() => setShareCopied(false), 2000)
                      } catch (error) {
                        console.error('Failed to copy:', error)
                      }
                    }}
                    className={`flex items-center gap-2 transition-all ${
                      shareCopied 
                        ? 'text-green-400 scale-110' 
                        : 'text-dark-400 hover:text-primary-500'
                    }`}
                  >
                    <Share2 size={20} />
                    <span>{shareCopied ? 'Kopiert!' : 'Teilen'}</span>
                  </button>
                </div>

                <p className="text-dark-400 whitespace-pre-wrap">
                  {streamInfo.description}
                </p>
              </div>
            </div>
          </div>

          {/* Chat */}
          <div className="lg:col-span-1 flex flex-col">
            <div className="card flex flex-col resize overflow-auto" style={{ minHeight: '400px', maxHeight: '800px', height: '600px' }}>
              <div className="flex items-center gap-2 mb-4 pb-4 border-b border-dark-800 flex-shrink-0">
                <MessageCircle size={24} className="text-primary-500" />
                <h3 className="text-xl font-semibold">Live Chat</h3>
              </div>

              <LiveChat isStreamLive={showPlayer} />
            </div>
          </div>
        </div>

        {/* Bottom Ad Banner - Full Width */}
        {(bottomBanner?.enabled && bottomBanner?.imageUrl) || isAdmin ? (
          <div className="mt-6 relative group">
            {isAdmin && (
              <button
                onClick={() => setShowAdManagement(true)}
                className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-dark-800/80 hover:bg-primary-600 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Edit size={16} />
              </button>
            )}
            
            {bottomBanner?.enabled && bottomBanner?.imageUrl ? (
              bottomBanner.linkUrl ? (
                <a 
                  href={bottomBanner.linkUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block"
                >
                  <img 
                    src={bottomBanner.imageUrl} 
                    alt="Bottom Advertisement" 
                    className="w-full h-60 object-cover rounded-lg"
                  />
                </a>
              ) : (
                <img 
                  src={bottomBanner.imageUrl} 
                  alt="Bottom Advertisement" 
                  className="w-full h-60 object-cover rounded-lg"
                />
              )
            ) : isAdmin ? (
              <div className="h-60 bg-gradient-to-r from-primary-900/20 via-dark-800 to-primary-900/20 flex items-center justify-center rounded-lg border-2 border-dashed border-dark-700">
                <span className="text-dark-500 text-lg">Bottom Advertisement Space - 1920x240px</span>
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

      {/* Stream Settings */}
      {showStreamSettings && (
        <StreamSettings
          currentSettings={streamInfo}
          onSave={saveStreamInfo}
          onClose={() => setShowStreamSettings(false)}
        />
      )}
    </div>
  )
}
