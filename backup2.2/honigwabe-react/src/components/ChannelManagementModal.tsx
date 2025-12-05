import { useState, useEffect } from 'react'
import { X, Save } from 'lucide-react'
import { SocialChannel, channelService } from '../services/channel.service'

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

  const handleToggle = (channelId: string) => {
    setEditedChannels(prev =>
      prev.map(ch =>
        ch.id === channelId ? { ...ch, enabled: !ch.enabled } : ch
      )
    )
  }

  const handleChange = (channelId: string, field: 'name' | 'description', value: string) => {
    setEditedChannels(prev =>
      prev.map(ch =>
        ch.id === channelId ? { ...ch, [field]: value } : ch
      )
    )
  }

  const handleSave = async () => {
    setLoading(true)
    setError('')

    try {
      await channelService.updateChannels(editedChannels)
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

  // Group channels by category
  const channelsByCategory = editedChannels.reduce((acc, channel) => {
    if (!acc[channel.category]) {
      acc[channel.category] = []
    }
    acc[channel.category].push(channel)
    return acc
  }, {} as Record<string, SocialChannel[]>)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="bg-dark-900 rounded-xl border border-dark-700 w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-700">
          <h2 className="text-2xl font-bold">Channel Management</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-8">
            {Object.entries(channelsByCategory).map(([category, categoryChannels]) => (
              <div key={category}>
                <h3 className="text-lg font-semibold mb-4 text-primary-400">{category}</h3>
                <div className="space-y-4">
                  {categoryChannels.map((channel) => (
                    <div
                      key={channel.id}
                      className="p-4 bg-dark-800 rounded-lg border border-dark-700"
                    >
                      <div className="flex items-start gap-4">
                        {/* Toggle Switch */}
                        <div className="flex-shrink-0 pt-1">
                          <button
                            onClick={() => handleToggle(channel.id)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              channel.enabled ? 'bg-primary-600' : 'bg-dark-600'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                channel.enabled ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>

                        {/* Channel Info */}
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: channel.color }}
                            />
                            <span className="font-semibold">{channel.platform}</span>
                            <span className="text-dark-400 text-sm">({channel.followers} followers)</span>
                          </div>

                          {/* Name Input */}
                          <div>
                            <label className="block text-sm text-dark-400 mb-1">
                              Channel Name
                            </label>
                            <input
                              type="text"
                              value={channel.name}
                              onChange={(e) => handleChange(channel.id, 'name', e.target.value)}
                              className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500"
                              placeholder="@yourchannel"
                            />
                          </div>

                          {/* Description Input */}
                          <div>
                            <label className="block text-sm text-dark-400 mb-1">
                              Description
                            </label>
                            <textarea
                              value={channel.description}
                              onChange={(e) => handleChange(channel.id, 'description', e.target.value)}
                              className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500 resize-none"
                              rows={2}
                              placeholder="Channel description"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-dark-700">
          <button
            onClick={onClose}
            className="btn-secondary"
            disabled={loading}
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            className="btn-primary flex items-center gap-2"
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
