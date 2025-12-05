import { useState, useEffect } from 'react'
import { X, Youtube, Facebook, Twitch, Radio } from 'lucide-react'
import { 
  StreamDestination, 
  CreateDestinationRequest,
  restreamingService 
} from '../services/restreaming.service'

interface Props {
  destination?: StreamDestination
  onClose: () => void
  onSave: () => void
}

export const StreamDestinationModal = ({ destination, onClose, onSave }: Props) => {
  const [formData, setFormData] = useState<CreateDestinationRequest>({
    platform: 'youtube',
    name: '',
    rtmpUrl: '',
    streamKey: '',
    enabled: true
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (destination) {
      setFormData({
        platform: destination.platform,
        name: destination.name,
        rtmpUrl: destination.rtmpUrl,
        streamKey: destination.streamKey,
        enabled: destination.enabled
      })
    } else {
      // Set default RTMP URL for YouTube
      setFormData(prev => ({
        ...prev,
        rtmpUrl: restreamingService.getPlatformRtmpUrl('youtube')
      }))
    }
  }, [destination])

  const handlePlatformChange = (platform: StreamDestination['platform']) => {
    setFormData(prev => ({
      ...prev,
      platform,
      rtmpUrl: restreamingService.getPlatformRtmpUrl(platform)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (destination) {
        await restreamingService.updateDestination(destination.id, formData)
      } else {
        await restreamingService.createDestination(formData)
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
    { id: 'youtube', name: 'YouTube', icon: Youtube, color: 'text-red-500' },
    { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'text-blue-500' },
    { id: 'twitch', name: 'Twitch', icon: Twitch, color: 'text-purple-500' },
    { id: 'tiktok', name: 'TikTok', icon: Radio, color: 'text-pink-500' },
    { id: 'instagram', name: 'Instagram', icon: Radio, color: 'text-purple-400' },
    { id: 'rumble', name: 'Rumble', icon: Radio, color: 'text-green-500' },
    { id: 'custom', name: 'Custom RTMP', icon: Radio, color: 'text-primary-500' }
  ]

  const isVerticalPlatform = restreamingService.isVerticalPlatform(formData.platform)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">
            {destination ? 'Streaming-Ziel bearbeiten' : 'Neues Streaming-Ziel'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Platform Selection */}
          <div>
            <label className="block text-sm font-medium mb-3">Plattform</label>
            <div className="grid grid-cols-2 gap-3">
              {platforms.map(platform => {
                const Icon = platform.icon
                return (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => handlePlatformChange(platform.id as any)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      formData.platform === platform.id
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-dark-700 hover:border-dark-600'
                    }`}
                  >
                    <Icon size={32} className={`mx-auto mb-2 ${platform.color}`} />
                    <div className="font-medium">{platform.name}</div>
                  </button>
                )
              })}
            </div>
          </div>

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
              <p className="text-xs text-dark-500">
                💡 Crop & Scale empfohlen für optimale Mobile-Darstellung
              </p>
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
              <li>• Der Stream wird automatisch zu diesem Ziel weitergeleitet</li>
              <li>• Der Stream Key wird sicher verschlüsselt gespeichert</li>
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
              disabled={loading}
            >
              {loading ? 'Speichern...' : destination ? 'Aktualisieren' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
