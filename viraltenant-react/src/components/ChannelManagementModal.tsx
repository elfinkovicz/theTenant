import { useState, useEffect } from 'react'
import { X, Save, Plus, Trash2, Twitter, Instagram, Youtube, Twitch, Linkedin, Facebook, Globe } from 'lucide-react'
import { SocialChannel, channelService } from '../services/channel.service'

// TikTok Icon
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className || "w-5 h-5"}>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
)

// Discord Icon
const DiscordIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className || "w-5 h-5"}>
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
)

// Spotify Icon
const SpotifyIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className || "w-5 h-5"}>
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
)

interface PlatformInfo {
  platform: string
  color: string
  iconType: string
  category: string
}

const detectPlatformInfo = (url: string): PlatformInfo => {
  const lowerUrl = url.toLowerCase()
  
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
    return { platform: 'YouTube', color: '#FF0000', iconType: 'youtube', category: 'Video' }
  }
  if (lowerUrl.includes('twitch.tv')) {
    return { platform: 'Twitch', color: '#9146FF', iconType: 'twitch', category: 'Video' }
  }
  if (lowerUrl.includes('instagram.com')) {
    return { platform: 'Instagram', color: '#E4405F', iconType: 'instagram', category: 'Social' }
  }
  if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) {
    return { platform: 'X (Twitter)', color: '#1DA1F2', iconType: 'twitter', category: 'Social' }
  }
  if (lowerUrl.includes('tiktok.com')) {
    return { platform: 'TikTok', color: '#ff0050', iconType: 'tiktok', category: 'Social' }
  }
  if (lowerUrl.includes('linkedin.com')) {
    return { platform: 'LinkedIn', color: '#0A66C2', iconType: 'linkedin', category: 'Social' }
  }
  if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.com')) {
    return { platform: 'Facebook', color: '#1877F2', iconType: 'facebook', category: 'Social' }
  }
  if (lowerUrl.includes('discord.gg') || lowerUrl.includes('discord.com')) {
    return { platform: 'Discord', color: '#5865F2', iconType: 'discord', category: 'Community' }
  }
  if (lowerUrl.includes('spotify.com') || lowerUrl.includes('open.spotify')) {
    return { platform: 'Spotify', color: '#1DB954', iconType: 'spotify', category: 'Music' }
  }
  if (lowerUrl.includes('soundcloud.com')) {
    return { platform: 'SoundCloud', color: '#FF5500', iconType: 'music', category: 'Music' }
  }
  if (lowerUrl.includes('patreon.com')) {
    return { platform: 'Patreon', color: '#FF424D', iconType: 'dollar', category: 'Support' }
  }
  if (lowerUrl.includes('ko-fi.com')) {
    return { platform: 'Ko-fi', color: '#FF5E5B', iconType: 'dollar', category: 'Support' }
  }
  
  return { platform: 'Website', color: '#6B7280', iconType: 'link', category: 'Other' }
}

const getPlatformIcon = (iconType: string) => {
  switch (iconType) {
    case 'youtube': return <Youtube className="w-5 h-5" />
    case 'twitch': return <Twitch className="w-5 h-5" />
    case 'instagram': return <Instagram className="w-5 h-5" />
    case 'twitter': return <Twitter className="w-5 h-5" />
    case 'tiktok': return <TikTokIcon className="w-5 h-5" />
    case 'linkedin': return <Linkedin className="w-5 h-5" />
    case 'facebook': return <Facebook className="w-5 h-5" />
    case 'discord': return <DiscordIcon className="w-5 h-5" />
    case 'spotify': return <SpotifyIcon className="w-5 h-5" />
    default: return <Globe className="w-5 h-5" />
  }
}

interface ChannelManagementModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  channels: SocialChannel[]
}

export const ChannelManagementModal = ({ isOpen, onClose, onSuccess, channels }: ChannelManagementModalProps) => {
  const [editedChannels, setEditedChannels] = useState<SocialChannel[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setEditedChannels(JSON.parse(JSON.stringify(channels)))
      setError('')
    }
  }, [isOpen, channels])

  const addChannel = () => {
    const newChannel: SocialChannel = {
      id: `channel-${Date.now()}`,
      name: '',
      platform: 'Website',
      url: '',
      description: '',
      color: '#6B7280',
      iconType: 'link',
      category: 'Other',
      enabled: true
    }
    setEditedChannels([...editedChannels, newChannel])
  }

  const removeChannel = (channelId: string) => {
    setEditedChannels(editedChannels.filter(ch => ch.id !== channelId))
  }

  const handleUrlChange = (channelId: string, url: string) => {
    setEditedChannels(prev =>
      prev.map(ch => {
        if (ch.id === channelId) {
          const platformInfo = detectPlatformInfo(url)
          return {
            ...ch,
            url,
            platform: platformInfo.platform,
            color: platformInfo.color,
            iconType: platformInfo.iconType,
            category: platformInfo.category,
            // Auto-fill name if empty
            name: ch.name || platformInfo.platform
          }
        }
        return ch
      })
    )
  }

  const handleNameChange = (channelId: string, name: string) => {
    setEditedChannels(prev =>
      prev.map(ch =>
        ch.id === channelId ? { ...ch, name } : ch
      )
    )
  }

  const handleSave = async () => {
    const invalidChannels = editedChannels.filter(ch => !ch.url.trim())
    if (invalidChannels.length > 0) {
      setError('Bitte fülle die URL für alle Channels aus')
      return
    }

    setLoading(true)
    setError('')

    try {
      // All channels are enabled by default
      const channelsToSave = editedChannels.map(ch => ({ ...ch, enabled: true }))
      await channelService.updateChannels(channelsToSave)
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Failed to update channels:', err)
      setError(err.response?.data?.error || 'Fehler beim Speichern')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 overflow-y-auto">
      <div className="bg-dark-900 rounded-xl border border-dark-700 w-full max-w-2xl max-h-[90vh] flex flex-col my-auto">
        <div className="flex items-center justify-between p-6 border-b border-dark-700">
          <h2 className="text-2xl font-bold">Channel Management</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
              {error}
            </div>
          )}

          <div className="mb-4">
            <p className="text-sm text-dark-400 mb-3">
              Füge deine Social Media Channels hinzu. Die Plattform wird automatisch erkannt.
            </p>
            <button
              type="button"
              onClick={addChannel}
              className="btn-primary flex items-center gap-2 w-full"
            >
              <Plus className="w-5 h-5" />
              Channel hinzufügen
            </button>
          </div>

          {editedChannels.length === 0 ? (
            <div className="text-center py-12 bg-dark-800 rounded-lg border border-dark-700">
              <Globe className="w-12 h-12 text-dark-600 mx-auto mb-3" />
              <p className="text-dark-400 mb-4">Noch keine Channels vorhanden</p>
              <p className="text-sm text-dark-500">Klicke auf "Channel hinzufügen" um zu starten</p>
            </div>
          ) : (
            <div className="space-y-3">
              {editedChannels.map((channel) => (
                <div
                  key={channel.id}
                  className="p-4 rounded-lg bg-dark-900 border border-dark-700 hover:border-dark-600 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* Platform Icon */}
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 bg-dark-800 border border-dark-600"
                      style={{ color: channel.color }}
                    >
                      {getPlatformIcon(channel.iconType)}
                    </div>

                    {/* Input Fields */}
                    <div className="flex-1 space-y-2">
                      {/* URL Input */}
                      <input
                        type="url"
                        value={channel.url}
                        onChange={(e) => handleUrlChange(channel.id, e.target.value)}
                        className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500 text-sm text-white placeholder-dark-500"
                        placeholder="https://youtube.com/@yourchannel"
                      />

                      {/* Name Input (optional) */}
                      <input
                        type="text"
                        value={channel.name}
                        onChange={(e) => handleNameChange(channel.id, e.target.value)}
                        className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500 text-sm text-white placeholder-dark-500"
                        placeholder="Anzeigename (optional)"
                      />

                      {/* Platform Display */}
                      {channel.url && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-dark-300">Erkannt als:</span>
                          <span style={{ color: channel.color }} className="font-medium">
                            {channel.platform}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => removeChannel(channel.id)}
                      className="p-2 text-dark-400 hover:text-red-400 hover:bg-dark-700 rounded-lg transition-colors flex-shrink-0"
                      title="Entfernen"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-dark-700">
          <button onClick={onClose} className="btn-secondary flex-1" disabled={loading}>
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Speichern...
              </>
            ) : (
              <>
                <Save size={20} />
                Speichern
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
