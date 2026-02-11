import { useState, useEffect } from 'react'
import { Play, Users, MessageCircle, Share2, RefreshCw, Edit, Settings, AlertCircle, Twitter, Instagram, Youtube, Twitch, Linkedin, Facebook, Globe, Lock, Crown } from 'lucide-react'
import { liveService, IVSInfo, LiveSettings } from '../services/live.service'
import { prefetchService } from '../services/prefetch.service'
import { VideoPlayer } from '../components/VideoPlayer'
import { LiveChat } from '../components/LiveChat'
import { AdManagement } from '../components/AdManagement'
import { StreamSettings } from '../components/StreamSettings'
import { PageBanner } from '../components/PageBanner'
import { advertisementService, Advertisement } from '../services/advertisement.service'
import { useAdmin } from '../hooks/useAdmin'
import { usePremium } from '../hooks/usePremium'
import { useAuthStore } from '../store/authStore'
import { usePageTitle } from '../hooks/usePageTitle'
import { toast } from '../utils/toast-alert'

// TikTok Icon
const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

// Discord Icon
const DiscordIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

// Spotify Icon
const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

const detectPlatform = (url: string): string => {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) return 'twitter';
  if (lowerUrl.includes('instagram.com')) return 'instagram';
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'youtube';
  if (lowerUrl.includes('twitch.tv')) return 'twitch';
  if (lowerUrl.includes('tiktok.com')) return 'tiktok';
  if (lowerUrl.includes('linkedin.com')) return 'linkedin';
  if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.com')) return 'facebook';
  if (lowerUrl.includes('discord.gg') || lowerUrl.includes('discord.com')) return 'discord';
  if (lowerUrl.includes('spotify.com') || lowerUrl.includes('open.spotify')) return 'spotify';
  return 'website';
};

const getPlatformIcon = (platform: string) => {
  switch (platform) {
    case 'twitter': return <Twitter className="w-3.5 h-3.5" />;
    case 'instagram': return <Instagram className="w-3.5 h-3.5" />;
    case 'youtube': return <Youtube className="w-3.5 h-3.5" />;
    case 'twitch': return <Twitch className="w-3.5 h-3.5" />;
    case 'tiktok': return <TikTokIcon />;
    case 'linkedin': return <Linkedin className="w-3.5 h-3.5" />;
    case 'facebook': return <Facebook className="w-3.5 h-3.5" />;
    case 'discord': return <DiscordIcon />;
    case 'spotify': return <SpotifyIcon />;
    default: return <Globe className="w-3.5 h-3.5" />;
  }
};

const getPlatformColor = (platform: string): string => {
  switch (platform) {
    case 'twitter': return 'hover:bg-sky-500';
    case 'instagram': return 'hover:bg-pink-500';
    case 'youtube': return 'hover:bg-red-600';
    case 'twitch': return 'hover:bg-purple-600';
    case 'tiktok': return 'hover:bg-black';
    case 'linkedin': return 'hover:bg-blue-700';
    case 'facebook': return 'hover:bg-blue-600';
    case 'discord': return 'hover:bg-indigo-600';
    case 'spotify': return 'hover:bg-green-600';
    default: return 'hover:bg-primary-600';
  }
};

export const Live = () => {
  const [isLive, setIsLive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [viewerCount] = useState(0)
  const [topBanner, setTopBanner] = useState<Advertisement | null>(null)
  const [bottomBanner, setBottomBanner] = useState<Advertisement | null>(null)
  const [showAdManagement, setShowAdManagement] = useState(false)
  const [showStreamSettings, setShowStreamSettings] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { isAdmin } = useAdmin()
  const { isPremium } = usePremium()
  const { isAuthenticated } = useAuthStore()
  const { title: pageTitle, subtitle: pageSubtitle } = usePageTitle('/live')

  // IVS Info vom Backend
  const [ivsInfo, setIvsInfo] = useState<IVSInfo | null>(null)
  const [liveSettings, setLiveSettings] = useState<LiveSettings | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Lade IVS Info und Live Settings beim Start
  useEffect(() => {
    loadLiveData()
    loadAdvertisement()

    // Prüfe alle 30 Sekunden
    const interval = setInterval(checkStreamStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadLiveData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Lade IVS Info und Live Settings parallel
      const [ivsData, settingsData] = await Promise.all([
        liveService.getIVSInfo(),
        prefetchService.getLive()
      ])

      setIvsInfo(ivsData)
      setLiveSettings(settingsData)

      if (!ivsData || !ivsData.playbackUrl) {
        setError('Kein Live-Stream für diesen Kanal konfiguriert')
        setIsLive(false)
      } else {
        // Check stream status via backend API (more reliable)
        const status = await liveService.getStreamStatus()
        setIsLive(status.isLive)
      }
    } catch (err) {
      console.error('Failed to load live data:', err)
      setError('Fehler beim Laden der Stream-Daten')
    } finally {
      setIsLoading(false)
    }
  }

  const checkStreamStatus = async () => {
    if (!ivsInfo?.playbackUrl) return

    try {
      // Use backend API to check IVS stream status (more reliable than video element)
      const status = await liveService.getStreamStatus()
      setIsLive(status.isLive)
    } catch (error) {
      console.error('Failed to check stream status:', error)
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

  const handlePlayClick = async () => {
    if (isRefreshing) return
    
    setIsRefreshing(true)
    
    try {
      // Lade IVS Info und Stream-Status neu vom Backend
      const [ivsData, status] = await Promise.all([
        liveService.getIVSInfo(),
        liveService.getStreamStatus()
      ])
      
      setIvsInfo(ivsData)
      setIsLive(status.isLive)
    } catch (error) {
      console.error('Failed to check stream status:', error)
      setIsLive(false)
    }
    
    // 5 Sekunden Cooldown
    setTimeout(() => {
      setIsRefreshing(false)
    }, 5000)
  }

  const handlePlayerError = (error: any) => {
    console.error('Player error:', error)
    setIsLive(false)
  }

  const handleSettingsSave = async (info: { title: string; description: string; autoSaveStream?: boolean; autoPublishToNewsfeed?: boolean; membersOnly?: boolean; guests?: any[] }) => {
    try {
      await liveService.updateLiveSettings({
        streamTitle: info.title,
        streamDescription: info.description,
        autoSaveStream: info.autoSaveStream,
        autoPublishToNewsfeed: info.autoPublishToNewsfeed,
        membersOnly: info.membersOnly,
        guests: info.guests
      })
      // Reload settings
      const settings = await liveService.getLiveSettings()
      setLiveSettings(settings)
      toast.success('Stream-Einstellungen erfolgreich gespeichert')
    } catch (error) {
      console.error('Failed to save stream info:', error)
      toast.error('Fehler beim Speichern der Stream-Einstellungen')
      throw error
    }
  }

  const streamTitle = liveSettings?.streamTitle || 'Live Stream'
  const streamDescription = liveSettings?.streamDescription || 'Willkommen zum Stream!'

  // Members Only Check - show login/upgrade prompt if user doesn't have access
  // User hat Zugang wenn: nicht membersOnly ODER (eingeloggt UND (Premium ODER Admin))
  const hasStreamAccess = !liveSettings?.membersOnly || (isAuthenticated && (isPremium || isAdmin));
  
  if (liveSettings?.membersOnly && !hasStreamAccess) {
    return (
      <div className="min-h-screen">
        <PageBanner pageId="live">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold mb-2" style={{ color: 'rgb(var(--color-text))' }}>
              <span className="glow-text">{pageTitle}</span>
            </h1>
            <p className="text-lg" style={{ color: 'rgb(var(--color-text-secondary))' }}>
              {pageSubtitle}
            </p>
          </div>
        </PageBanner>

        <div className="container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto text-center">
            <div className="bg-dark-800 rounded-2xl p-8 border border-yellow-500/30">
              <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Lock className="w-8 h-8 text-yellow-400" />
              </div>
              <h2 className="text-2xl font-bold mb-4">
                {isAuthenticated ? 'Nur für Premium-Mitglieder' : 'Nur für Mitglieder'}
              </h2>
              <p className="text-dark-400 mb-6">
                {isAuthenticated 
                  ? 'Dieser Stream ist nur für Premium-Mitglieder sichtbar. Werde jetzt Mitglied, um Zugang zu allen exklusiven Inhalten zu erhalten.'
                  : 'Dieser Stream ist nur für eingeloggte Mitglieder sichtbar. Bitte melde dich an, um den Stream zu sehen.'}
              </p>
              {isAuthenticated ? (
                <a 
                  href="/exclusive" 
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-bold rounded-xl hover:from-yellow-400 hover:to-amber-400 transition-all"
                >
                  <Crown className="w-5 h-5" />
                  Mitglied werden
                </a>
              ) : (
                <a 
                  href="/login" 
                  className="btn-primary inline-flex items-center gap-2 px-6 py-3"
                >
                  <Users className="w-5 h-5" />
                  Jetzt anmelden
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Page Banner mit Titel */}
      <PageBanner pageId="live">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold mb-2" style={{ color: 'rgb(var(--color-text))' }}>
            <span className="glow-text">{pageTitle}</span>
          </h1>
          <p className="text-lg" style={{ color: 'rgb(var(--color-text-secondary))' }}>
            {pageSubtitle}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowStreamSettings(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Settings size={20} />
            Optionen
          </button>
        )}
      </PageBanner>

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
              <div className="h-60 flex items-center justify-center rounded-lg border-2 border-dashed border-dark-700">
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
                {isLoading ? (
                  <div className="text-center">
                    <RefreshCw size={64} className="mx-auto mb-4 text-primary-500 animate-spin" />
                    <p className="text-xl font-semibold mb-2">Stream wird geladen...</p>
                    <p className="text-dark-400">Bitte warten</p>
                  </div>
                ) : error && !ivsInfo?.playbackUrl ? (
                  <div className="text-center p-8">
                    <AlertCircle size={64} className="mx-auto mb-4 text-yellow-500" />
                    <p className="text-xl font-semibold mb-2">Stream nicht verfügbar</p>
                    <p className="text-dark-400 mb-4">{error}</p>
                    {isAdmin && (
                      <p className="text-sm text-dark-500">
                        Als Admin kannst du in den Stream-Optionen einen IVS-Kanal konfigurieren.
                      </p>
                    )}
                    <button
                      onClick={loadLiveData}
                      className="btn-secondary flex items-center gap-2 mx-auto mt-4"
                    >
                      <RefreshCw size={16} />
                      Erneut versuchen
                    </button>
                  </div>
                ) : ivsInfo?.playbackUrl && isLive ? (
                  <div className="w-full h-full relative bg-black">
                    {/* AWS IVS Video Player */}
                    <VideoPlayer 
                      src={ivsInfo.playbackUrl}
                      onError={handlePlayerError}
                    />
                    
                    {/* Live Badge */}
                    <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2 z-10">
                      <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      LIVE
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center"
                       style={liveSettings?.offlineImageUrl ? {
                         backgroundImage: `url(${liveSettings.offlineImageUrl})`,
                         backgroundSize: 'cover',
                         backgroundPosition: 'center'
                       } : undefined}
                  >
                    {liveSettings?.offlineImageUrl && (
                      <div className="absolute inset-0 bg-black/40 z-0" />
                    )}
                    <div className="relative z-10 text-center">
                      <button
                        onClick={handlePlayClick}
                        disabled={isRefreshing}
                        className={`mb-4 p-4 rounded-full bg-primary-600 hover:bg-primary-700 transition-colors ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {isRefreshing ? (
                          <RefreshCw size={64} className="text-white animate-spin" />
                        ) : (
                          <Play size={64} className="text-white" />
                        )}
                      </button>
                      <p className={`text-xl font-semibold mb-2 ${liveSettings?.offlineImageUrl ? 'text-white' : ''}`} 
                         style={!liveSettings?.offlineImageUrl ? { color: 'rgb(var(--color-text))' } : undefined}>
                        Aktuell Offline
                      </p>
                      <p className={`mb-4 ${liveSettings?.offlineImageUrl ? 'text-white/80' : ''}`}
                         style={!liveSettings?.offlineImageUrl ? { color: 'rgb(var(--color-text-secondary))' } : undefined}>
                        Der nächste Stream kommt bald!
                      </p>
                      <button
                        onClick={handlePlayClick}
                        disabled={isRefreshing}
                        className={`btn-secondary flex items-center gap-2 mx-auto ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                        Erneut prüfen
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 flex-shrink-0">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold" style={{ color: 'rgb(var(--color-text))' }}>{streamTitle}</h2>
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

                {/* Guests */}
                {liveSettings?.guests && liveSettings.guests.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap mb-4">
                    <span className="text-dark-400 font-medium">Mit:</span>
                    {liveSettings.guests.map((guest) => (
                      <div 
                        key={guest.id} 
                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg border"
                        style={{ 
                          backgroundColor: 'rgb(var(--color-secondary))',
                          borderColor: 'rgb(var(--color-border))',
                          color: 'rgb(var(--color-text))'
                        }}
                      >
                        {guest.imageUrl && (
                          <img src={guest.imageUrl} alt={guest.name} className="w-5 h-5 rounded-full object-cover" />
                        )}
                        <span className="text-sm font-semibold">{guest.name}</span>
                        {guest.links?.slice(0, 7).map((url, idx) => {
                          const platform = detectPlatform(url);
                          return (
                            <a
                              key={idx}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`p-1 rounded transition-colors ${getPlatformColor(platform)}`}
                            >
                              {getPlatformIcon(platform)}
                            </a>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}

                <p className="whitespace-pre-wrap" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  {streamDescription}
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

              <LiveChat isStreamLive={isLive} />
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
              <div className="h-60 flex items-center justify-center rounded-lg border-2 border-dashed border-dark-700">
                <span className="text-dark-500 text-lg">Bottom Advertisement Space - 1920x240px</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Ad Management Modal */}
      {showAdManagement && (
        <AdManagement 
          onClose={() => setShowAdManagement(false)}
          onSave={() => loadAdvertisement()}
        />
      )}

      {/* Stream Settings */}
      {showStreamSettings && (
        <StreamSettings
          currentSettings={{ 
            title: streamTitle, 
            description: streamDescription,
            autoSaveStream: liveSettings?.autoSaveStream || false,
            autoPublishToNewsfeed: liveSettings?.autoPublishToNewsfeed || false,
            membersOnly: liveSettings?.membersOnly || false,
            guests: liveSettings?.guests
          }}
          onSave={handleSettingsSave}
          onClose={() => setShowStreamSettings(false)}
          onImageChange={async () => {
            const settings = await liveService.getLiveSettings()
            setLiveSettings(settings)
          }}
        />
      )}
    </div>
  )
}
