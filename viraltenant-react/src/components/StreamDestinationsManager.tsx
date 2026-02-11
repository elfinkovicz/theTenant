import { useState, useEffect } from 'react'
import { X, Plus, Play, Square, Edit, Trash2, Youtube, Facebook, Twitch, Radio, RefreshCw, Clock, StopCircle } from 'lucide-react'
import { StreamDestination, restreamingService } from '../services/restreaming.service'
import { StreamDestinationModal } from './StreamDestinationModal'

interface Props {
  onClose: () => void
}

export const StreamDestinationsManager = ({ onClose }: Props) => {
  const [destinations, setDestinations] = useState<StreamDestination[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingDestination, setEditingDestination] = useState<StreamDestination | undefined>()
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [autoStopMinutes, setAutoStopMinutes] = useState<number>(60)
  const [autoDestroyAt, setAutoDestroyAt] = useState<string | null>(null)
  const [showAutoStopModal, setShowAutoStopModal] = useState(false)

  useEffect(() => {
    loadDestinations()
    loadRestreamingStatus()
  }, [])

  const loadRestreamingStatus = async () => {
    try {
      const status = await restreamingService.getRestreamingStatus()
      setAutoDestroyAt(status.autoDestroyAt)
    } catch (err) {
      console.error('Failed to load restreaming status:', err)
    }
  }

  const loadDestinations = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await restreamingService.getDestinations()
      setDestinations(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load destinations')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingDestination(undefined)
    setShowModal(true)
  }

  const handleEdit = (destination: StreamDestination) => {
    setEditingDestination(destination)
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
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

  const handleStart = async (id: string) => {
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

  const handleStop = async (id: string) => {
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

  const handleSetAutoStop = async () => {
    setActionLoading('autostop')
    try {
      const result = await restreamingService.setAutoDestroyTimer(autoStopMinutes)
      setAutoDestroyAt(result.destroyAt)
      setShowAutoStopModal(false)
      if (result.destroyAt) {
        alert(`Auto-Stopp gesetzt: Alle Streams werden um ${new Date(result.destroyAt).toLocaleTimeString()} gestoppt.`)
      } else {
        alert('Auto-Stopp deaktiviert.')
      }
    } catch (err: any) {
      alert(err.message || 'Failed to set auto-stop timer')
    } finally {
      setActionLoading(null)
    }
  }

  const handleStopAll = async () => {
    if (!confirm('Möchtest du wirklich ALLE aktiven Streams stoppen?')) {
      return
    }
    setActionLoading('stopall')
    try {
      await restreamingService.stopAllRestreaming()
      setAutoDestroyAt(null)
      await loadDestinations()
    } catch (err: any) {
      alert(err.message || 'Failed to stop all streams')
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
      creating: { text: 'Wird erstellt...', class: 'bg-blue-500/20 text-blue-500' },
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Multistreaming Verwaltung</h2>
            <p className="text-dark-400 text-sm mt-1">
              Leite deinen Stream zu mehreren Plattformen weiter
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={handleCreate}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={20} />
            Neues Ziel hinzufügen
          </button>
          <button
            onClick={() => setShowAutoStopModal(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <Clock size={20} />
            Auto-Stopp Timer
          </button>
          {destinations.some(d => d.status === 'active') && (
            <button
              onClick={handleStopAll}
              disabled={actionLoading === 'stopall'}
              className="btn-secondary flex items-center gap-2 text-red-500 border-red-500/30 hover:bg-red-500/10"
            >
              <StopCircle size={20} />
              Alle stoppen
            </button>
          )}
          <button
            onClick={loadDestinations}
            className="btn-secondary flex items-center gap-2"
            disabled={loading}
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            Aktualisieren
          </button>
        </div>

        {/* Auto-Stop Timer Info */}
        {autoDestroyAt && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center gap-3">
            <Clock size={24} className="text-yellow-500" />
            <div>
              <p className="font-semibold text-yellow-500">Auto-Stopp aktiv</p>
              <p className="text-sm text-dark-300">
                Alle Streams werden automatisch um {new Date(autoDestroyAt).toLocaleTimeString()} gestoppt
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 mb-6">
            {error}
          </div>
        )}

        {/* Destinations List */}
        {loading ? (
          <div className="text-center py-12">
            <RefreshCw size={48} className="mx-auto mb-4 text-primary-500 animate-spin" />
            <p className="text-dark-400">Lade Streaming-Ziele...</p>
          </div>
        ) : destinations.length === 0 ? (
          <div className="text-center py-12">
            <Radio size={48} className="mx-auto mb-4 text-dark-600" />
            <p className="text-dark-400 mb-4">Noch keine Streaming-Ziele konfiguriert</p>
            <button onClick={handleCreate} className="btn-primary">
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
                              onClick={() => handleStop(destination.id)}
                              disabled={isLoading}
                              className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-500 transition-colors disabled:opacity-50"
                              title="Streaming stoppen"
                            >
                              <Square size={20} />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStart(destination.id)}
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
                        onClick={() => handleEdit(destination)}
                        disabled={isLoading}
                        className="p-2 rounded-lg hover:bg-dark-700 transition-colors disabled:opacity-50"
                        title="Bearbeiten"
                      >
                        <Edit size={20} />
                      </button>
                      <button
                        onClick={() => handleDelete(destination.id)}
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
        <div className="mt-6 p-4 bg-primary-500/10 border border-primary-500/20 rounded-lg">
          <h4 className="font-semibold mb-2">💡 Hinweise</h4>
          <ul className="text-sm text-dark-300 space-y-1">
            <li>• Jeder Stream zu einer Plattform kann 30-60 Sekunden dauern, bis er erscheint</li>
            <li>• Stelle sicher, dass deine Stream Keys korrekt sind</li>
          </ul>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <StreamDestinationModal
          destination={editingDestination}
          onClose={() => setShowModal(false)}
          onSave={loadDestinations}
        />
      )}

      {/* Auto-Stop Modal */}
      {showAutoStopModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="card max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Auto-Stopp Timer</h3>
              <button
                onClick={() => setShowAutoStopModal(false)}
                className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-dark-400 mb-4">
              Setze einen Timer, nach dem alle aktiven Streams automatisch gestoppt werden.
              Dies hilft, unbeabsichtigte Kosten zu vermeiden.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Zeit bis Auto-Stopp</label>
              <select
                value={autoStopMinutes}
                onChange={(e) => setAutoStopMinutes(Number(e.target.value))}
                className="input w-full"
              >
                <option value={15}>15 Minuten</option>
                <option value={30}>30 Minuten</option>
                <option value={60}>1 Stunde</option>
                <option value={120}>2 Stunden</option>
                <option value={180}>3 Stunden</option>
                <option value={240}>4 Stunden</option>
                <option value={360}>6 Stunden</option>
                <option value={480}>8 Stunden</option>
              </select>
            </div>

            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-6">
              <p className="text-sm text-yellow-500">
                ⚠️ Multistreaming verursacht laufende Kosten. Der Auto-Stopp Timer hilft, vergessene Streams automatisch zu beenden.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowAutoStopModal(false)}
                className="btn-secondary flex-1"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSetAutoStop}
                disabled={actionLoading === 'autostop'}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {actionLoading === 'autostop' ? (
                  <RefreshCw size={20} className="animate-spin" />
                ) : (
                  <Clock size={20} />
                )}
                Timer setzen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
