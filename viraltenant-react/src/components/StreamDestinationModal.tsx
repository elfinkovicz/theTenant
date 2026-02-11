import { useState, useEffect } from 'react'
import { X, Youtube, Facebook, Twitch, Radio, Link2, Key, CheckCircle, Loader2, ExternalLink, AlertCircle, Instagram } from 'lucide-react'
import { 
  StreamDestination, 
  CreateDestinationRequest,
  restreamingService 
} from '../services/restreaming.service'
import { youtubeOAuthService, YouTubeOAuthStatus } from '../services/youtube-oauth.service'
import { metaLiveOAuthService, MetaLiveOAuthStatus } from '../services/meta-live-oauth.service'
import { twitchOAuthService, TwitchOAuthStatus } from '../services/twitch-oauth.service'

interface Props {
  destination?: StreamDestination
  onClose: () => void
  onSave: () => void
  existingDestinations?: StreamDestination[] // Liste der bereits konfigurierten Ziele für diesen Tenant
}

type ConnectionType = 'manual' | 'oauth'

export const StreamDestinationModal = ({ destination, onClose, onSave, existingDestinations = [] }: Props) => {
  // Bestimme den initialen connectionType basierend auf vorhandenen Daten
  const getInitialConnectionType = (): ConnectionType => {
    if (destination?.connectionType) return destination.connectionType
    if (destination?.oauthConnected) return 'oauth'
    return 'manual'
  }
  
  const [connectionType, setConnectionType] = useState<ConnectionType>(getInitialConnectionType())
  const [formData, setFormData] = useState<CreateDestinationRequest>({
    platform: 'youtube',
    name: '',
    connectionType: 'manual',
    rtmpUrl: '',
    streamKey: '',
    streamTitle: '',
    streamDescription: '',
    privacyStatus: 'public',
    enabled: true
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // OAuth State
  const [oauthStatus, setOauthStatus] = useState<YouTubeOAuthStatus | null>(null)
  const [metaLiveStatus, setMetaLiveStatus] = useState<MetaLiveOAuthStatus | null>(null)
  const [twitchStatus, setTwitchStatus] = useState<TwitchOAuthStatus | null>(null)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [oauthError, setOauthError] = useState('')

  useEffect(() => {
    if (destination) {
      const destConnectionType = destination.connectionType || (destination.oauthConnected ? 'oauth' : 'manual')
      setConnectionType(destConnectionType)
      setFormData({
        platform: destination.platform,
        name: destination.name,
        connectionType: destConnectionType,
        rtmpUrl: destination.rtmpUrl || '',
        streamKey: destination.streamKey || '',
        streamTitle: destination.streamTitle || '',
        streamDescription: destination.streamDescription || '',
        privacyStatus: destination.privacyStatus || 'public',
        enabled: destination.enabled
      })
      
      // Lade OAuth-Status wenn OAuth-Verbindung
      if (destination.connectionType === 'oauth') {
        if (destination.platform === 'youtube') {
          loadOAuthStatus()
        } else if (destination.platform === 'facebook' || destination.platform === 'instagram') {
          loadMetaLiveStatus(destination.platform === 'facebook' ? 'facebook-live' : 'instagram-live')
        } else if (destination.platform === 'twitch') {
          loadTwitchStatus()
        }
      }
    } else {
      // Set default RTMP URL for YouTube
      setFormData(prev => ({
        ...prev,
        rtmpUrl: restreamingService.getPlatformRtmpUrl('youtube')
      }))
    }
  }, [destination])

  const loadOAuthStatus = async () => {
    if (formData.platform !== 'youtube') return
    
    setOauthLoading(true)
    setOauthError('')
    try {
      const status = await youtubeOAuthService.getOAuthStatus()
      setOauthStatus(status)
    } catch (err: any) {
      setOauthError(err.message || 'Fehler beim Laden des OAuth-Status')
    } finally {
      setOauthLoading(false)
    }
  }

  const loadMetaLiveStatus = (platform: 'facebook-live' | 'instagram-live') => {
    const status = metaLiveOAuthService.getStoredStatus(platform)
    setMetaLiveStatus(status)
  }

  const loadTwitchStatus = async () => {
    // Twitch OAuth ist noch nicht implementiert - setze auf nicht verbunden
    // TODO: Aktivieren wenn Twitch OAuth Backend konfiguriert ist
    setTwitchStatus({ connected: false })
  }

  const handlePlatformChange = (platform: StreamDestination['platform']) => {
    setFormData(prev => ({
      ...prev,
      platform,
      rtmpUrl: restreamingService.getPlatformRtmpUrl(platform)
    }))
    
    // Reset OAuth status when platform changes
    setOauthStatus(null)
    setMetaLiveStatus(null)
    setTwitchStatus(null)
    setOauthError('')
    
    // Lade OAuth-Status für unterstützte Plattformen
    if (connectionType === 'oauth') {
      if (platform === 'youtube') {
        loadOAuthStatus()
      } else if (platform === 'facebook') {
        loadMetaLiveStatus('facebook-live')
      } else if (platform === 'instagram') {
        loadMetaLiveStatus('instagram-live')
      } else if (platform === 'twitch') {
        loadTwitchStatus()
      }
    }
  }

  const handleConnectionTypeChange = (type: ConnectionType) => {
    setConnectionType(type)
    setFormData(prev => ({ ...prev, connectionType: type }))
    
    // Lade OAuth-Status wenn auf OAuth gewechselt wird
    if (type === 'oauth') {
      if (formData.platform === 'youtube') {
        loadOAuthStatus()
      } else if (formData.platform === 'facebook') {
        loadMetaLiveStatus('facebook-live')
      } else if (formData.platform === 'instagram') {
        loadMetaLiveStatus('instagram-live')
      } else if (formData.platform === 'twitch') {
        loadTwitchStatus()
      }
    }
  }

  const handleConnectYouTube = async () => {
    setOauthLoading(true)
    setOauthError('')
    try {
      const success = await youtubeOAuthService.openOAuthPopup()
      if (success) {
        await loadOAuthStatus()
      } else {
        setOauthError('Verbindung fehlgeschlagen oder abgebrochen')
      }
    } catch (err: any) {
      setOauthError(err.message || 'Fehler bei der Verbindung')
    } finally {
      setOauthLoading(false)
    }
  }

  const handleDisconnectYouTube = async () => {
    if (!confirm('Möchtest du die YouTube-Verbindung wirklich trennen?')) return
    
    setOauthLoading(true)
    try {
      await youtubeOAuthService.disconnectOAuth()
      setOauthStatus(null)
    } catch (err: any) {
      setOauthError(err.message || 'Fehler beim Trennen')
    } finally {
      setOauthLoading(false)
    }
  }

  const handleConnectMetaLive = async (platform: 'facebook-live' | 'instagram-live') => {
    setOauthLoading(true)
    setOauthError('')
    try {
      const status = await metaLiveOAuthService.openOAuthPopup(platform)
      if (status) {
        setMetaLiveStatus(status)
      } else {
        setOauthError('Verbindung fehlgeschlagen oder abgebrochen')
      }
    } catch (err: any) {
      setOauthError(err.message || 'Fehler bei der Verbindung')
    } finally {
      setOauthLoading(false)
    }
  }

  const handleDisconnectMetaLive = (platform: 'facebook-live' | 'instagram-live') => {
    if (!confirm(`Möchtest du die ${platform === 'facebook-live' ? 'Facebook Live' : 'Instagram Live'}-Verbindung wirklich trennen?`)) return
    
    metaLiveOAuthService.clearOAuthData(platform)
    setMetaLiveStatus(null)
  }

  const handleConnectTwitch = async () => {
    setOauthLoading(true)
    setOauthError('')
    try {
      const status = await twitchOAuthService.openOAuthPopup()
      if (status) {
        setTwitchStatus(status)
      } else {
        setOauthError('Verbindung fehlgeschlagen oder abgebrochen')
      }
    } catch (err: any) {
      setOauthError(err.message || 'Fehler bei der Verbindung')
    } finally {
      setOauthLoading(false)
    }
  }

  const handleDisconnectTwitch = async () => {
    if (!confirm('Möchtest du die Twitch-Verbindung wirklich trennen?')) return
    
    setOauthLoading(true)
    try {
      await twitchOAuthService.disconnectOAuth()
      setTwitchStatus(null)
    } catch (err: any) {
      setOauthError(err.message || 'Fehler beim Trennen')
    } finally {
      setOauthLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const submitData: CreateDestinationRequest = {
        ...formData,
        connectionType: effectiveConnectionType
      }
      
      // Bei YouTube OAuth: Füge OAuth-Daten hinzu
      if (effectiveConnectionType === 'oauth' && formData.platform === 'youtube' && oauthStatus?.connected) {
        submitData.oauthConnected = true
        submitData.oauthChannelId = oauthStatus.channelId
        submitData.oauthChannelTitle = oauthStatus.channelTitle
      }
      
      // Bei Meta Live OAuth (Facebook/Instagram): Füge OAuth-Daten hinzu
      if (effectiveConnectionType === 'oauth' && (formData.platform === 'facebook' || formData.platform === 'instagram') && metaLiveStatus?.connected) {
        submitData.oauthConnected = true
        submitData.oauthChannelId = metaLiveStatus.accountId
        submitData.oauthChannelTitle = metaLiveStatus.accountName
        // Store access token for livestreaming
        if (metaLiveStatus.accessToken) {
          (submitData as any).oauthAccessToken = metaLiveStatus.accessToken
        }
      }
      
      // Bei Twitch OAuth: Füge OAuth-Daten hinzu
      if (effectiveConnectionType === 'oauth' && formData.platform === 'twitch' && twitchStatus?.connected) {
        submitData.oauthConnected = true
        submitData.oauthChannelId = twitchStatus.userId
        submitData.oauthChannelTitle = twitchStatus.displayName || twitchStatus.username
        // Twitch stream key wird vom Backend geholt
        if (twitchStatus.streamKey) {
          submitData.streamKey = twitchStatus.streamKey
          submitData.rtmpUrl = 'rtmp://live.twitch.tv/app'
        }
      }
      
      if (destination) {
        await restreamingService.updateDestination(destination.id, submitData)
      } else {
        await restreamingService.createDestination(submitData)
      }
      onSave()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to save destination')
    } finally {
      setLoading(false)
    }
  }

  const platforms = [
    { id: 'youtube', name: 'YouTube', icon: Youtube, color: 'text-red-500', supportsOAuth: true },
    { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'text-blue-500', supportsOAuth: true },
    { id: 'twitch', name: 'Twitch', icon: Twitch, color: 'text-purple-500', supportsOAuth: true },
    { id: 'tiktok', name: 'TikTok', icon: Radio, color: 'text-pink-500', supportsOAuth: false },
    { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'text-purple-400', supportsOAuth: true },
    { id: 'rumble', name: 'Rumble', icon: Radio, color: 'text-green-500', supportsOAuth: false },
    { id: 'custom', name: 'Custom RTMP', icon: Radio, color: 'text-primary-500', supportsOAuth: false }
  ]

  // Prüfe welche Plattformen bereits für diesen Tenant konfiguriert sind
  const isPlatformConfigured = (platformId: string) => {
    return existingDestinations.some(dest => dest.platform === platformId)
  }

  const currentPlatform = platforms.find(p => p.id === formData.platform)
  const supportsOAuth = currentPlatform?.supportsOAuth || false
  const isVerticalPlatform = restreamingService.isVerticalPlatform(formData.platform)

  // Validierung - für manuelle Verbindungen bei Plattformen ohne OAuth ist rtmpUrl/streamKey erforderlich
  // Für Plattformen ohne OAuth-Support ist immer manual mode aktiv
  const effectiveConnectionType = supportsOAuth ? connectionType : 'manual'
  const isManualValid = effectiveConnectionType === 'manual' && formData.name && formData.rtmpUrl && formData.streamKey
  const isYouTubeOAuthValid = effectiveConnectionType === 'oauth' && formData.platform === 'youtube' && formData.name && oauthStatus?.connected && formData.streamTitle
  const isMetaLiveOAuthValid = effectiveConnectionType === 'oauth' && (formData.platform === 'facebook' || formData.platform === 'instagram') && formData.name && metaLiveStatus?.connected
  const isTwitchOAuthValid = effectiveConnectionType === 'oauth' && formData.platform === 'twitch' && formData.name && twitchStatus?.connected
  const isFormValid = isManualValid || isYouTubeOAuthValid || isMetaLiveOAuthValid || isTwitchOAuthValid

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">
            {destination ? 'Streaming-Ziel bearbeiten' : 'Neues Streaming-Ziel'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Platform Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Plattform</label>
            <div className="grid grid-cols-4 gap-2">
              {platforms.map(platform => {
                const Icon = platform.icon
                const isConfigured = isPlatformConfigured(platform.id)
                return (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => handlePlatformChange(platform.id as any)}
                    className={`p-2 rounded-lg border-2 transition-all relative ${
                      formData.platform === platform.id
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-dark-700 hover:border-dark-600'
                    }`}
                    title={platform.name}
                  >
                    <Icon size={20} className={`mx-auto ${platform.color}`} />
                    <div className="text-xs mt-1 truncate">{platform.name}</div>
                    {isConfigured && (
                      <span 
                        className="absolute -top-1 -right-1" 
                        title="Bereits konfiguriert für diesen Tenant"
                      >
                        <CheckCircle 
                          size={16} 
                          className="text-green-500 bg-dark-900 rounded-full" 
                        />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Connection Type Selection (nur für Plattformen mit OAuth) */}
          {supportsOAuth && (
            <div>
              <label className="block text-sm font-medium mb-2">Verbindungsart</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleConnectionTypeChange('oauth')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    connectionType === 'oauth'
                      ? 'border-primary-500 bg-primary-500/10'
                      : 'border-dark-700 hover:border-dark-600'
                  }`}
                >
                  <Link2 size={18} className="mx-auto mb-1 text-green-500" />
                  <div className="text-sm font-semibold">OAuth</div>
                  <div className="text-xs text-dark-400">Automatisch</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleConnectionTypeChange('manual')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    connectionType === 'manual'
                      ? 'border-primary-500 bg-primary-500/10'
                      : 'border-dark-700 hover:border-dark-600'
                  }`}
                >
                  <Key size={18} className="mx-auto mb-1 text-yellow-500" />
                  <div className="text-sm font-semibold">RTMP</div>
                  <div className="text-xs text-dark-400">Manuell</div>
                </button>
              </div>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="z.B. Mein YouTube Kanal"
              className="input w-full"
              required
            />
          </div>

          {/* OAuth Connection Section */}
          {effectiveConnectionType === 'oauth' && supportsOAuth && (
            <div className="space-y-4">
              {/* YouTube OAuth Status */}
              {formData.platform === 'youtube' && (
                <div className="p-4 bg-dark-800 rounded-lg border border-dark-700">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Youtube size={20} className="text-red-500" />
                      <span className="font-medium">YouTube Verbindung</span>
                    </div>
                    {oauthLoading && <Loader2 size={20} className="animate-spin text-primary-500" />}
                  </div>
                  
                  {oauthError && (
                    <div className="flex items-center gap-2 text-red-400 text-sm mb-3">
                      <AlertCircle size={16} />
                      {oauthError}
                    </div>
                  )}
                  
                  {oauthStatus?.connected ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <CheckCircle size={20} className="text-green-500" />
                        <div className="flex-1">
                          <div className="font-medium text-green-400">Verbunden</div>
                          <div className="text-sm text-dark-300">{oauthStatus.channelTitle}</div>
                        </div>
                        {oauthStatus.channelThumbnail && (
                          <img 
                            src={oauthStatus.channelThumbnail} 
                            alt="Channel" 
                            className="w-10 h-10 rounded-full"
                          />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleDisconnectYouTube}
                        className="text-sm text-red-400 hover:text-red-300"
                        disabled={oauthLoading}
                      >
                        Verbindung trennen
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleConnectYouTube}
                      disabled={oauthLoading}
                      className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                      {oauthLoading ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : (
                        <>
                          <ExternalLink size={20} />
                          Mit YouTube verbinden
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Facebook Live OAuth Status */}
              {formData.platform === 'facebook' && (
                <div className="p-4 bg-dark-800 rounded-lg border border-dark-700">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Facebook size={20} className="text-blue-500" />
                      <span className="font-medium">Facebook Live Verbindung</span>
                    </div>
                    {oauthLoading && <Loader2 size={20} className="animate-spin text-primary-500" />}
                  </div>
                  
                  {oauthError && (
                    <div className="flex items-center gap-2 text-red-400 text-sm mb-3">
                      <AlertCircle size={16} />
                      {oauthError}
                    </div>
                  )}
                  
                  {metaLiveStatus?.connected ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <CheckCircle size={20} className="text-green-500" />
                        <div className="flex-1">
                          <div className="font-medium text-green-400">Verbunden</div>
                          <div className="text-sm text-dark-300">{metaLiveStatus.accountName}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDisconnectMetaLive('facebook-live')}
                        className="text-sm text-red-400 hover:text-red-300"
                      >
                        Verbindung trennen
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleConnectMetaLive('facebook-live')}
                      disabled={oauthLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 transition-all"
                    >
                      {oauthLoading ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : (
                        <>
                          <ExternalLink size={20} />
                          Mit Facebook verbinden
                        </>
                      )}
                    </button>
                  )}
                  <p className="text-xs text-dark-400 mt-3">
                    Verbinde deine Facebook-Seite für automatisches Livestreaming
                  </p>
                </div>
              )}

              {/* Instagram Live OAuth Status */}
              {formData.platform === 'instagram' && (
                <div className="p-4 bg-dark-800 rounded-lg border border-dark-700">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Instagram size={20} className="text-pink-500" />
                      <span className="font-medium">Instagram Live Verbindung</span>
                    </div>
                    {oauthLoading && <Loader2 size={20} className="animate-spin text-primary-500" />}
                  </div>
                  
                  {oauthError && (
                    <div className="flex items-center gap-2 text-red-400 text-sm mb-3">
                      <AlertCircle size={16} />
                      {oauthError}
                    </div>
                  )}
                  
                  {metaLiveStatus?.connected ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <CheckCircle size={20} className="text-green-500" />
                        <div className="flex-1">
                          <div className="font-medium text-green-400">Verbunden</div>
                          <div className="text-sm text-dark-300">{metaLiveStatus.accountName}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDisconnectMetaLive('instagram-live')}
                        className="text-sm text-red-400 hover:text-red-300"
                      >
                        Verbindung trennen
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleConnectMetaLive('instagram-live')}
                      disabled={oauthLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-white transition-all hover:scale-[1.02]"
                      style={{ background: 'linear-gradient(45deg, #833AB4, #E1306C, #F77737)' }}
                    >
                      {oauthLoading ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : (
                        <>
                          <ExternalLink size={20} />
                          Mit Instagram verbinden
                        </>
                      )}
                    </button>
                  )}
                  <p className="text-xs text-dark-400 mt-3">
                    Instagram Business Account erforderlich (mit Facebook-Seite verknüpft)
                  </p>
                </div>
              )}

              {/* Twitch OAuth Status */}
              {formData.platform === 'twitch' && (
                <div className="p-4 bg-dark-800 rounded-lg border border-dark-700">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Twitch size={20} className="text-purple-500" />
                      <span className="font-medium">Twitch Verbindung</span>
                    </div>
                    {oauthLoading && <Loader2 size={20} className="animate-spin text-primary-500" />}
                  </div>
                  
                  {oauthError && (
                    <div className="flex items-center gap-2 text-red-400 text-sm mb-3">
                      <AlertCircle size={16} />
                      {oauthError}
                    </div>
                  )}
                  
                  {twitchStatus?.connected ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <CheckCircle size={20} className="text-green-500" />
                        <div className="flex-1">
                          <div className="font-medium text-green-400">Verbunden</div>
                          <div className="text-sm text-dark-300">{twitchStatus.displayName || twitchStatus.username}</div>
                        </div>
                        {twitchStatus.profileImageUrl && (
                          <img 
                            src={twitchStatus.profileImageUrl} 
                            alt="Twitch" 
                            className="w-10 h-10 rounded-full"
                          />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleDisconnectTwitch}
                        className="text-sm text-red-400 hover:text-red-300"
                        disabled={oauthLoading}
                      >
                        Verbindung trennen
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleConnectTwitch}
                      disabled={oauthLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-white bg-purple-600 hover:bg-purple-700 transition-all"
                    >
                      {oauthLoading ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : (
                        <>
                          <ExternalLink size={20} />
                          Mit Twitch verbinden
                        </>
                      )}
                    </button>
                  )}
                  <p className="text-xs text-dark-400 mt-3">
                    Stream Key wird automatisch abgerufen
                  </p>
                </div>
              )}

              {/* Stream Metadaten (nur wenn YouTube verbunden) */}
              {formData.platform === 'youtube' && oauthStatus?.connected && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Stream Titel <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.streamTitle}
                      onChange={(e) => setFormData({ ...formData, streamTitle: e.target.value })}
                      placeholder="Titel deines Livestreams"
                      className="input w-full"
                      required
                    />
                    <p className="text-xs text-dark-400 mt-1">
                      Wird automatisch auf YouTube gesetzt
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Beschreibung
                    </label>
                    <textarea
                      value={formData.streamDescription}
                      onChange={(e) => setFormData({ ...formData, streamDescription: e.target.value })}
                      placeholder="Beschreibung deines Livestreams..."
                      className="input w-full h-24 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Sichtbarkeit
                    </label>
                    <select
                      value={formData.privacyStatus}
                      onChange={(e) => setFormData({ ...formData, privacyStatus: e.target.value as any })}
                      className="input w-full"
                    >
                      <option value="public">Öffentlich</option>
                      <option value="unlisted">Nicht gelistet</option>
                      <option value="private">Privat</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Manual RTMP Section */}
          {effectiveConnectionType === 'manual' && (
            <>
              {/* RTMP URL */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  RTMP URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.rtmpUrl}
                  onChange={(e) => setFormData({ ...formData, rtmpUrl: e.target.value })}
                  placeholder="rtmp://..."
                  className="input w-full font-mono text-sm"
                  required
                />
                <p className="text-xs text-dark-400 mt-1">
                  Standard: {restreamingService.getPlatformRtmpUrl(formData.platform)}
                </p>
              </div>

              {/* Stream Key */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Stream Key <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={formData.streamKey}
                  onChange={(e) => setFormData({ ...formData, streamKey: e.target.value })}
                  placeholder="Dein Stream Key von der Plattform"
                  className="input w-full font-mono text-sm"
                  required
                />
                <p className="text-xs text-dark-400 mt-1">
                  {formData.platform === 'youtube' && 
                    'Zu finden unter: YouTube Studio → Livestreaming → Stream-Schlüssel'}
                  {formData.platform === 'facebook' && 
                    'Zu finden unter: Facebook Live Producer → Stream Key'}
                  {formData.platform === 'twitch' && 
                    'Zu finden unter: Twitch Dashboard → Einstellungen → Stream-Schlüssel'}
                  {formData.platform === 'tiktok' && 
                    'Zu finden unter: TikTok Live Studio → Server URL & Stream Key'}
                  {formData.platform === 'instagram' && 
                    'Zu finden unter: Instagram Professional Dashboard → Live'}
                  {formData.platform === 'rumble' && 
                    'Zu finden unter: Rumble Studio → Stream Settings'}
                  {formData.platform === 'custom' && 
                    'Stream Key von deinem RTMP Server'}
                </p>
              </div>
            </>
          )}

          {/* Vertical Mode Toggle (nur für TikTok/Instagram) */}
          {isVerticalPlatform && (
            <div className="space-y-3">
              <label className="block text-sm font-medium">
                Hochformat-Modus (16:9 → 9:16)
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, verticalMode: 'crop' })}
                  className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                    formData.verticalMode === 'crop' || !formData.verticalMode
                      ? 'border-primary-500 bg-primary-500/10'
                      : 'border-dark-700 hover:border-dark-600'
                  }`}
                >
                  <div className="font-semibold mb-1">Crop & Scale</div>
                  <div className="text-xs text-dark-400">
                    Schneidet Ränder ab, füllt Bildschirm
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, verticalMode: 'letterbox' })}
                  className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                    formData.verticalMode === 'letterbox'
                      ? 'border-primary-500 bg-primary-500/10'
                      : 'border-dark-700 hover:border-dark-600'
                  }`}
                >
                  <div className="font-semibold mb-1">Letterbox</div>
                  <div className="text-xs text-dark-400">
                    Behält gesamtes Bild, schwarze Balken
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Enabled Toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="w-4 h-4"
            />
            <label htmlFor="enabled" className="text-sm font-medium cursor-pointer">
              Ziel aktiviert
            </label>
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500">
              {error}
            </div>
          )}

          {/* Info Box */}
          <div className="p-4 bg-primary-500/10 border border-primary-500/20 rounded-lg">
            <h4 className="font-semibold mb-2">ℹ️ Wichtig</h4>
            <ul className="text-sm text-dark-300 space-y-1">
              {effectiveConnectionType === 'oauth' ? (
                <>
                  <li>• Stream-Titel und Beschreibung werden automatisch auf YouTube gesetzt</li>
                  <li>• Du kannst die Metadaten jederzeit hier ändern</li>
                  <li>• Die Verbindung bleibt bestehen bis du sie trennst</li>
                </>
              ) : (
                <>
                  <li>• Der Stream wird automatisch zu diesem Ziel weitergeleitet</li>
                  <li>• Der Stream Key wird sicher verschlüsselt gespeichert</li>
                </>
              )}
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={loading}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={loading || !isFormValid}
            >
              {loading ? 'Speichern...' : destination ? 'Aktualisieren' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
