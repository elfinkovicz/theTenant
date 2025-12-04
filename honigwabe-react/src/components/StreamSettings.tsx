import { useState, useEffect } from 'react'
import { X, Save, Settings, Radio, Plus, Play, Square, Edit, Trash2, RefreshCw, Youtube, Facebook, Twitch } from 'lucide-react'
import { StreamDestination, restreamingService } from '../services/restreaming.service'
import { StreamDestinationModal } from './StreamDestinationModal'

interface StreamSettingsProps {
  onClose: () => void
  onSave: (settings: StreamInfo) => void
  currentSettings: StreamInfo
}

export interface StreamInfo {
  title: string
  description: string
}

type TabType = 'general' | 'multistreaming'

export const StreamSettings = ({ onClose, currentSettings, onSave }: StreamSettingsProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('general')
  const [title, setTitle] = useState(currentSettings.title)
  const [description, setDescription] = useState(currentSettings.description)
  const [isSaving, setIsSaving] = useState(false)
  
  // Multistreaming State
  const [destinations, setDestinations] = useState<StreamDestination[]>([])
  const [loadingDestinations, setLoadingDestinations] = useState(false)
  const [showDestinationModal, setShowDestinationModal] = useState(false)
  const [editingDestination, setEditingDestination] = useState<StreamDestination | undefined>()
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    if (activeTab === 'multistreaming') {
      loadDestinations()
    }
  }, [activeTab])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave({ title, description })
      onClose()
    } catch (error) {
      console.error('Failed to save stream settings:', error)
      alert('Fehler beim Speichern der Einstellungen')
    } finally {
      setIsSaving(false)
    }
  }

  // Multistreaming Functions
  const loadDestinations = async () => {
    setLoadingDestinations(true)
    try {
      const data = await restreamingService.getDestinations()
      setDestinations(data)
    } catch (err: any) {
      console.error('Failed to load destinations:', err)
    } finally {
      setLoadingDestinations(false)
    }
  }

  const handleCreateDestination = () => {
    setEditingDestination(undefined)
    setShowDestinationModal(true)
  }

  const handleEditDestination = (destination: StreamDestination) => {
    setEditingDestination(destination)
    setShowDestinationModal(true)
  }

  const handleDeleteDestination = async (id: string) => {
    if (!confirm('Möchtest du dieses Streaming-Ziel wirklich löschen?')) {
      return
    }
    setActionLoading(id)
    try {
      await restreamingService.deleteDestination(id)
      await loadDestinations()
    } catch (err: any) {
      alert(err.message || 'Failed to delete destination')
    } finally {
      setActionLoading(null)
    }
  }

  const handleStartStreaming = async (id: string) => {
    setActionLoading(id)
    try {
      await restreamingService.startRestreaming(id)
      await loadDestinations()
    } catch (err: any) {
      alert(err.message || 'Failed to start restreaming')
    } finally {
      setActionLoading(null)
    }
  }

  const handleStopStreaming = async (id: string) => {
    setActionLoading(id)
    try {
      await restreamingService.stopRestreaming(id)
      await loadDestinations()
    } catch (err: any) {
      alert(err.message || 'Failed to stop restreaming')
    } finally {
      setActionLoading(null)
    }
  }

  const getPlatformIcon = (platform: StreamDestination['platform']) => {
    const icons = {
      youtube: Youtube,
      facebook: Facebook,
      twitch: Twitch,
      tiktok: Radio,
      instagram: Radio,
      rumble: Radio,
      linkedin: Radio,
      custom: Radio
    }
    return icons[platform] || Radio
  }

  const getPlatformColor = (platform: StreamDestination['platform']) => {
    const colors = {
      youtube: 'text-red-500',
      facebook: 'text-blue-500',
      twitch: 'text-purple-500',
      tiktok: 'text-pink-500',
      instagram: 'text-purple-400',
      rumble: 'text-green-500',
      linkedin: 'text-blue-600',
      custom: 'text-primary-500'
    }
    return colors[platform] || 'text-primary-500'
  }

  const getStatusBadge = (status: StreamDestination['status']) => {
    const badges = {
      inactive: { text: 'Inaktiv', class: 'bg-dark-700 text-dark-300' },
      starting: { text: 'Startet...', class: 'bg-yellow-500/20 text-yellow-500' },
      active: { text: 'Live', class: 'bg-green-500/20 text-green-500' },
      stopping: { text: 'Stoppt...', class: 'bg-yellow-500/20 text-yellow-500' },
      error: { text: 'Fehler', class: 'bg-red-500/20 text-red-500' }
    }
    const badge = badges[status] || badges.inactive
    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${badge.class}`}>
        {badge.text}
      </span>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-6 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <Settings className="text-primary-500" size={24} />
            <h2 className="text-2xl font-bold">Stream Optionen</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-dark-700 pb-4 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'general'
                ? 'bg-primary-600 text-white'
                : 'bg-dark-800 text-dark-400 hover:text-white'
            }`}
          >
            <Settings size={18} />
            Allgemein
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('multistreaming')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'multistreaming'
                ? 'bg-primary-600 text-white'
                : 'bg-dark-800 text-dark-400 hover:text-white'
            }`}
          >
            <Radio size={18} />
            Multistreaming
          </button>
        </div>

        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            {/* Stream Title */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Stream Titel
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input w-full"
                placeholder="z.B. Live Gaming Session"
                maxLength={100}
              />
              <p className="text-xs text-dark-400 mt-1">
                {title.length}/100 Zeichen
              </p>
            </div>

            {/* Stream Description */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Stream Beschreibung
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input w-full min-h-[120px] resize-y"
                placeholder="Beschreibe deinen Stream..."
                maxLength={500}
              />
              <p className="text-xs text-dark-400 mt-1">
                {description.length}/500 Zeichen
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Wird gespeichert...
                  </>
                ) : (
                  <>
                    <Save size={20} />
                    Speichern
                  </>
                )}
              </button>
              <button
                onClick={onClose}
                className="btn-secondary flex-1"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {/* Multistreaming Tab */}
        {activeTab === 'multistreaming' && (
          <div className="space-y-6">
            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleCreateDestination}
                className="btn-primary flex items-center gap-2"
              >
                <Plus size={20} />
                Neues Ziel hinzufügen
              </button>
              <button
                onClick={loadDestinations}
                className="btn-secondary flex items-center gap-2"
                disabled={loadingDestinations}
              >
                <RefreshCw size={20} className={loadingDestinations ? 'animate-spin' : ''} />
                Aktualisieren
              </button>
            </div>

            {/* Destinations List */}
            {loadingDestinations ? (
              <div className="text-center py-12">
                <RefreshCw size={48} className="mx-auto mb-4 text-primary-500 animate-spin" />
                <p className="text-dark-400">Lade Streaming-Ziele...</p>
              </div>
            ) : destinations.length === 0 ? (
              <div className="text-center py-12">
                <Radio size={48} className="mx-auto mb-4 text-dark-600" />
                <p className="text-dark-400 mb-4">Noch keine Streaming-Ziele konfiguriert</p>
                <button onClick={handleCreateDestination} className="btn-primary">
                  Erstes Ziel hinzufügen
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {destinations.map(destination => {
                  const Icon = getPlatformIcon(destination.platform)
                  const isLoading = actionLoading === destination.id
                  const isActive = destination.status === 'active'

                  return (
                    <div
                      key={destination.id}
                      className="p-4 bg-dark-800 rounded-lg border border-dark-700 hover:border-dark-600 transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        {/* Platform Icon */}
                        <div className={`p-3 rounded-lg bg-dark-900 ${getPlatformColor(destination.platform)}`}>
                          <Icon size={24} />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">{destination.name}</h3>
                            {getStatusBadge(destination.status)}
                            {!destination.enabled && (
                              <span className="px-2 py-1 rounded text-xs font-semibold bg-dark-700 text-dark-400">
                                Deaktiviert
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-dark-400 mb-1">
                            {restreamingService.getPlatformName(destination.platform)}
                          </p>
                          <p className="text-xs text-dark-500 font-mono truncate">
                            {destination.rtmpUrl}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {destination.enabled && (
                            <>
                              {isActive ? (
                                <button
                                  onClick={() => handleStopStreaming(destination.id)}
                                  disabled={isLoading}
                                  className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-500 transition-colors disabled:opacity-50"
                                  title="Streaming stoppen"
                                >
                                  <Square size={20} />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleStartStreaming(destination.id)}
                                  disabled={isLoading}
                                  className="p-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-500 transition-colors disabled:opacity-50"
                                  title="Streaming starten"
                                >
                                  <Play size={20} />
                                </button>
                              )}
                            </>
                          )}
                          <button
                            onClick={() => handleEditDestination(destination)}
                            disabled={isLoading}
                            className="p-2 rounded-lg hover:bg-dark-700 transition-colors disabled:opacity-50"
                            title="Bearbeiten"
                          >
                            <Edit size={20} />
                          </button>
                          <button
                            onClick={() => handleDeleteDestination(destination.id)}
                            disabled={isLoading || isActive}
                            className="p-2 rounded-lg hover:bg-red-500/20 text-red-500 transition-colors disabled:opacity-50"
                            title="Löschen"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Info Box */}
            <div className="bg-primary-900/20 border border-primary-500/20 rounded-lg p-4">
              <h4 className="font-semibold mb-2">💡 Hinweise</h4>
              <ul className="text-sm text-dark-300 space-y-1">
                <li>• Streaming-Ziele können nur gestartet werden, wenn der IVS Stream aktiv ist</li>
                <li>• AWS MediaLive verursacht zusätzliche Kosten (ca. $2-3 pro Stunde pro Ziel)</li>
                <li>• Es kann 30-60 Sekunden dauern, bis der Stream auf der Zielplattform erscheint</li>
                <li>• Stelle sicher, dass deine Stream Keys korrekt sind</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Destination Modal */}
      {showDestinationModal && (
        <StreamDestinationModal
          destination={editingDestination}
          onClose={() => setShowDestinationModal(false)}
          onSave={loadDestinations}
        />
      )}
    </div>
  )
}
