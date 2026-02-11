import { useState, useEffect, useRef } from 'react'
import { X, Save, Settings, Radio, Plus, Play, Square, Edit, Trash2, RefreshCw, Youtube, Facebook, Twitch, Key, Tv, Copy, Clock, StopCircle, AlertTriangle, Send, Users, Link as LinkIcon, Image, Upload } from 'lucide-react'
import { StreamDestination, restreamingService, IVSChannelInfo } from '../services/restreaming.service'
import { StreamDestinationModal } from './StreamDestinationModal'
import { StreamInfo, StreamGuest } from '../services/stream.service'
import { newsfeedService } from '../services/newsfeed.service'
import { liveService } from '../services/live.service'
import { prefetchService } from '../services/prefetch.service'
import { ImageCropper } from './ImageCropper'
import { toast } from '../utils/toast-alert'

interface StreamSettingsProps {
  onClose: () => void
  onSave: (settings: StreamInfo) => Promise<void>
  currentSettings: StreamInfo
  onImageChange?: () => void
}

type TabType = 'general' | 'multistreaming'

// Helper function to format remaining time
const formatRemainingTime = (targetDate: string): string => {
  const now = new Date().getTime()
  const target = new Date(targetDate).getTime()
  const diff = target - now

  if (diff <= 0) return 'Abgelaufen'

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  } else {
    return `${seconds}s`
  }
}

export const StreamSettings = ({ onClose, currentSettings, onSave, onImageChange }: StreamSettingsProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('general')
  const [title, setTitle] = useState(currentSettings.title)
  const [description, setDescription] = useState(currentSettings.description)
  const [autoSaveStream, setAutoSaveStream] = useState(currentSettings.autoSaveStream || false)
  const [autoPublishToNewsfeed, setAutoPublishToNewsfeed] = useState(currentSettings.autoPublishToNewsfeed || false)
  const [membersOnly, setMembersOnly] = useState(currentSettings.membersOnly || false)
  const [guests, setGuests] = useState<StreamGuest[]>(currentSettings.guests || [])
  const [isSaving, setIsSaving] = useState(false)
  
  // Offline Image State
  const [offlineImageUrl, setOfflineImageUrl] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [cropperImage, setCropperImage] = useState<string | null>(null)
  const offlineImageInputRef = useRef<HTMLInputElement>(null)
  
  // AWS IVS State
  const [ivsChannelInfo, setIvsChannelInfo] = useState<IVSChannelInfo | null>(null)
  const [loadingIVS, setLoadingIVS] = useState(false)
  const [streamKeyCopied, setStreamKeyCopied] = useState(false)
  const [ingestUrlCopied, setIngestUrlCopied] = useState(false)
  
  // Multistreaming State
  const [destinations, setDestinations] = useState<StreamDestination[]>([])
  const [loadingDestinations, setLoadingDestinations] = useState(false)
  const [showDestinationModal, setShowDestinationModal] = useState(false)
  const [editingDestination, setEditingDestination] = useState<StreamDestination | undefined>()
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [autoStopMinutes, setAutoStopMinutes] = useState<number>(120) // Default 2 Stunden
  const [autoDestroyAt, setAutoDestroyAt] = useState<string | null>(null)
  const [remainingTime, setRemainingTime] = useState<string>('')
  const [hasActiveChannels, setHasActiveChannels] = useState(false)

  useEffect(() => {
    if (activeTab === 'general') {
      loadIVSChannelInfo()
      loadOfflineImage()
    } else if (activeTab === 'multistreaming') {
      loadDestinations()
    }
  }, [activeTab])

  const loadOfflineImage = async () => {
    try {
      console.log('[StreamSettings] Loading offline image from backend...')
      const settings = await liveService.getLiveSettings()
      console.log('[StreamSettings] Got settings, offlineImageUrl:', settings?.offlineImageUrl)
      if (settings?.offlineImageUrl) {
        setOfflineImageUrl(settings.offlineImageUrl)
      }
    } catch (error) {
      console.error('[StreamSettings] Failed to load offline image:', error)
    }
  }

  const handleOfflineImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Bitte wähle eine Bilddatei aus')
      return
    }

    // Validate file size (max 10MB for cropping)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Das Bild darf maximal 10MB groß sein')
      return
    }

    // Open cropper instead of uploading directly
    const reader = new FileReader()
    reader.onloadend = () => {
      setCropperImage(reader.result as string)
    }
    reader.readAsDataURL(file)
    
    // Reset input
    if (offlineImageInputRef.current) {
      offlineImageInputRef.current.value = ''
    }
  }

  const handleCropComplete = async (croppedBlob: Blob) => {
    setCropperImage(null)
    setUploadingImage(true)
    
    try {
      const file = new File([croppedBlob], 'offline-image.png', { type: 'image/png' })
      console.log('[StreamSettings] Uploading offline image, size:', file.size, 'type:', file.type)
      const result = await liveService.uploadOfflineImage(file)
      console.log('[StreamSettings] Upload result:', JSON.stringify(result))
      if (result.imageUrl) {
        console.log('[StreamSettings] Setting offlineImageUrl to:', result.imageUrl)
        setOfflineImageUrl(result.imageUrl)
        // Invalidate prefetch cache so Live page gets fresh data
        prefetchService.invalidate('live')
        toast.success('Offline-Bild erfolgreich hochgeladen')
        onImageChange?.()
      } else {
        console.error('[StreamSettings] No imageUrl in result:', result)
        toast.error('Bild-URL nicht erhalten')
      }
    } catch (error: any) {
      console.error('[StreamSettings] Failed to upload offline image:', error)
      console.error('[StreamSettings] Error details:', error.response?.data || error.message)
      toast.error('Fehler beim Hochladen: ' + (error.message || 'Unbekannter Fehler'))
    } finally {
      setUploadingImage(false)
    }
  }

  const handleDeleteOfflineImage = async () => {
    if (!confirm('Möchtest du das Offline-Bild wirklich löschen?')) return

    try {
      await liveService.deleteOfflineImage()
      setOfflineImageUrl(null)
      // Invalidate prefetch cache so Live page gets fresh data
      prefetchService.invalidate('live')
      toast.success('Offline-Bild erfolgreich gelöscht')
      onImageChange?.()
    } catch (error) {
      console.error('Failed to delete offline image:', error)
      toast.error('Fehler beim Löschen des Bildes')
    }
  }

  // Countdown Timer Effect - aktualisiert jede Sekunde
  useEffect(() => {
    if (!autoDestroyAt) {
      setRemainingTime('')
      return
    }

    // Prüfe ob bereits abgelaufen beim Mount
    const targetTime = new Date(autoDestroyAt).getTime()
    if (targetTime <= Date.now()) {
      setRemainingTime('Abgelaufen')
      setAutoDestroyAt(null)
      return
    }

    const updateRemainingTime = () => {
      const now = Date.now()
      const target = new Date(autoDestroyAt).getTime()
      
      if (target <= now) {
        setRemainingTime('Abgelaufen')
        setAutoDestroyAt(null)
        // Nicht automatisch loadDestinations aufrufen - User kann manuell aktualisieren
        return
      }
      
      setRemainingTime(formatRemainingTime(autoDestroyAt))
    }

    // Sofort aktualisieren
    updateRemainingTime()

    // Jede Sekunde aktualisieren
    const interval = setInterval(updateRemainingTime, 1000)
    return () => clearInterval(interval)
  }, [autoDestroyAt])

  // Periodisch Status vom Backend laden (alle 30 Sekunden)
  useEffect(() => {
    if (activeTab !== 'multistreaming') return

    const interval = setInterval(async () => {
      try {
        const status = await restreamingService.getRestreamingStatus()
        
        // Nur setzen wenn Timer noch nicht abgelaufen ist
        if (status.autoDestroyAt) {
          const targetTime = new Date(status.autoDestroyAt).getTime()
          if (targetTime > Date.now()) {
            setAutoDestroyAt(status.autoDestroyAt)
          } else {
            setAutoDestroyAt(null)
          }
        } else {
          setAutoDestroyAt(null)
        }
        
        setAutoStopMinutes(status.autoStopSetting !== undefined ? status.autoStopSetting : 60)
        setHasActiveChannels(status.hasActiveChannels)
        
        // Destinations Status aktualisieren
        if (status.destinations && status.destinations.length > 0) {
          setDestinations(prev => prev.map(d => {
            const updated = status.destinations.find(s => s.id === d.id)
            return updated ? { ...d, status: updated.status as StreamDestination['status'] } : d
          }))
        }
      } catch (err) {
        console.error('Failed to refresh status:', err)
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [activeTab])

  const loadIVSChannelInfo = async () => {
    setLoadingIVS(true)
    try {
      const info = await restreamingService.getIVSChannelInfo()
      setIvsChannelInfo(info)
    } catch (error) {
      console.error('Failed to load IVS channel info:', error)
    } finally {
      setLoadingIVS(false)
    }
  }

  const copyToClipboard = async (text: string, type: 'streamKey' | 'ingestUrl') => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === 'streamKey') {
        setStreamKeyCopied(true)
        setTimeout(() => setStreamKeyCopied(false), 2000)
      } else if (type === 'ingestUrl') {
        setIngestUrlCopied(true)
        setTimeout(() => setIngestUrlCopied(false), 2000)
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave({ title, description, autoSaveStream, autoPublishToNewsfeed, membersOnly, guests: guests.length > 0 ? guests : undefined })
      onClose()
    } catch (error) {
      console.error('Failed to save stream settings:', error)
      toast.error('Fehler beim Speichern der Einstellungen')
    } finally {
      setIsSaving(false)
    }
  }

  // Guest Management Functions
  const addGuest = () => {
    setGuests([...guests, { id: crypto.randomUUID(), name: '', links: [''] }])
  }

  const removeGuest = (guestId: string) => {
    setGuests(guests.filter(g => g.id !== guestId))
  }

  const updateGuest = (guestId: string, field: keyof StreamGuest, value: any) => {
    setGuests(guests.map(g => g.id === guestId ? { ...g, [field]: value } : g))
  }

  const addGuestLink = (guestId: string) => {
    setGuests(guests.map(g => {
      if (g.id === guestId && (g.links?.length || 0) < 7) {
        return { ...g, links: [...(g.links || []), ''] }
      }
      return g
    }))
  }

  const updateGuestLink = (guestId: string, linkIndex: number, value: string) => {
    setGuests(guests.map(g => {
      if (g.id === guestId) {
        const newLinks = [...(g.links || [])]
        newLinks[linkIndex] = value
        return { ...g, links: newLinks }
      }
      return g
    }))
  }

  const removeGuestLink = (guestId: string, linkIndex: number) => {
    setGuests(guests.map(g => {
      if (g.id === guestId) {
        const newLinks = (g.links || []).filter((_, i) => i !== linkIndex)
        return { ...g, links: newLinks }
      }
      return g
    }))
  }

  // Multistreaming Functions
  const loadDestinations = async () => {
    setLoadingDestinations(true)
    try {
      const data = await restreamingService.getDestinations()
      setDestinations(data)
      // Also load restreaming status for auto-destroy timer and setting
      const status = await restreamingService.getRestreamingStatus()
      console.log('Loaded status:', status)
      
      // Nur setzen wenn Timer noch nicht abgelaufen ist
      if (status.autoDestroyAt) {
        const targetTime = new Date(status.autoDestroyAt).getTime()
        if (targetTime > Date.now()) {
          setAutoDestroyAt(status.autoDestroyAt)
        } else {
          setAutoDestroyAt(null) // Timer ist abgelaufen
        }
      } else {
        setAutoDestroyAt(null)
      }
      
      setHasActiveChannels(status.hasActiveChannels)
      // Lade die gespeicherte Auto-Stopp Einstellung
      setAutoStopMinutes(status.autoStopSetting !== undefined ? status.autoStopSetting : 60)
    } catch (err: any) {
      console.error('Failed to load destinations:', err)
    } finally {
      setLoadingDestinations(false)
    }
  }

  const handleAutoStopChange = async (minutes: number) => {
    setAutoStopMinutes(minutes)
    
    // Speichere die Einstellung immer auf dem Server
    try {
      const result = await restreamingService.setAutoDestroyTimer(minutes)
      setAutoDestroyAt(result.destroyAt)
    } catch (err: any) {
      console.error('Failed to set auto-stop timer:', err)
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

  const handleStartAll = async () => {
    const inactiveDestinations = destinations.filter(d => d.enabled && d.status === 'inactive')
    if (inactiveDestinations.length === 0) {
      alert('Keine inaktiven Streaming-Ziele zum Starten vorhanden.')
      return
    }
    
    // Prüfe aktive Kanäle
    const activeCount = destinations.filter(d => d.status === 'active' || d.status === 'starting' || d.status === 'creating').length
    const canStart = Math.min(inactiveDestinations.length, 7 - activeCount)
    
    if (canStart <= 0) {
      alert('Maximale Anzahl von 7 aktiven Kanälen erreicht! Bitte stoppe zuerst einige Streams.')
      return
    }
    
    if (canStart < inactiveDestinations.length) {
      if (!confirm(`Du kannst nur ${canStart} von ${inactiveDestinations.length} Streams starten (Limit: 7 aktive Kanäle). Fortfahren?`)) {
        return
      }
    } else {
      if (!confirm(`Möchtest du ${canStart} Stream(s) starten?`)) {
        return
      }
    }
    
    setActionLoading('startall')
    try {
      // Starte nur die erlaubte Anzahl
      const toStart = inactiveDestinations.slice(0, canStart)
      let lastResult: any = null
      for (const dest of toStart) {
        try {
          lastResult = await restreamingService.startRestreaming(dest.id)
        } catch (err: any) {
          console.error(`Failed to start ${dest.name}:`, err)
        }
      }
      // Aktualisiere Timer-Status nach dem Starten
      if (lastResult?.autoDestroyAt) {
        setAutoDestroyAt(lastResult.autoDestroyAt)
        setHasActiveChannels(true)
      }
      // Lade Status neu
      const status = await restreamingService.getRestreamingStatus()
      setAutoDestroyAt(status.autoDestroyAt)
      setHasActiveChannels(status.hasActiveChannels)
      await loadDestinations()
    } catch (err: any) {
      alert(err.message || 'Failed to start streams')
    } finally {
      setActionLoading(null)
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
    // Prüfe Limit von 7 aktiven Kanälen
    const activeCount = destinations.filter(d => d.status === 'active' || d.status === 'starting' || d.status === 'creating').length
    if (activeCount >= 7) {
      alert('Maximale Anzahl von 7 aktiven Kanälen erreicht! Bitte stoppe zuerst einen anderen Stream.')
      return
    }
    
    setActionLoading(id)
    try {
      const result = await restreamingService.startRestreaming(id)
      // Backend setzt Auto-Stopp Timer automatisch basierend auf auto_stop_setting
      if (result.autoDestroyAt) {
        setAutoDestroyAt(result.autoDestroyAt)
        setHasActiveChannels(true)
      }
      // Lade Status neu um sicherzustellen dass alles synchron ist
      const status = await restreamingService.getRestreamingStatus()
      setAutoDestroyAt(status.autoDestroyAt)
      setHasActiveChannels(status.hasActiveChannels)
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
    <>
      {/* Image Cropper Modal - rendered outside main modal for proper z-index */}
      {cropperImage && (
        <div className="fixed inset-0 z-[60]">
          <ImageCropper
            image={cropperImage}
            onCropComplete={handleCropComplete}
            onCancel={() => setCropperImage(null)}
            aspectRatio={16 / 9}
            cropShape="rect"
            title="Offline-Bild zuschneiden (16:9)"
            preserveFormat={true}
            optimizeForCrossposting={false}
          />
        </div>
      )}
      
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="card max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-dark-700">
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

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto py-6">
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
            {/* Toggle Options - 2 Column Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Auto-Save Stream Toggle */}
              <div 
                onClick={() => setAutoSaveStream(!autoSaveStream)}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                  autoSaveStream 
                    ? 'bg-primary-600/10 border-primary-500/30 hover:bg-primary-600/15' 
                    : 'bg-dark-800 border-dark-700 hover:bg-dark-700/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Save size={16} className={autoSaveStream ? 'text-primary-500' : 'text-dark-400'} />
                  <div>
                    <p className={`text-sm font-medium ${autoSaveStream ? 'text-primary-400' : ''}`}>Automatisch speichern</p>
                    <p className="text-xs text-dark-400">Aufzeichnungen als Videos</p>
                  </div>
                </div>
                <div
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                    autoSaveStream ? 'bg-primary-600' : 'bg-dark-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      autoSaveStream ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </div>
              </div>

              {/* Members Only Toggle */}
              <div 
                onClick={() => setMembersOnly(!membersOnly)}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                  membersOnly 
                    ? 'bg-primary-600/10 border-primary-500/30 hover:bg-primary-600/15' 
                    : 'bg-dark-800 border-dark-700 hover:bg-dark-700/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Users size={16} className={membersOnly ? 'text-primary-500' : 'text-dark-400'} />
                  <div>
                    <p className={`text-sm font-medium ${membersOnly ? 'text-primary-400' : ''}`}>Nur für Mitglieder</p>
                    <p className="text-xs text-dark-400">Nur eingeloggte Benutzer</p>
                  </div>
                </div>
                <div
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                    membersOnly ? 'bg-primary-600' : 'bg-dark-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      membersOnly ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </div>
              </div>

              {/* Auto-Publish to Newsfeed Toggle */}
              <div 
                onClick={() => autoSaveStream && setAutoPublishToNewsfeed(!autoPublishToNewsfeed)}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                  !autoSaveStream ? 'opacity-50 cursor-not-allowed' : ''
                } ${
                  autoPublishToNewsfeed && autoSaveStream 
                    ? 'bg-primary-600/10 border-primary-500/30 hover:bg-primary-600/15' 
                    : 'bg-dark-800 border-dark-700 hover:bg-dark-700/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Send size={16} className={autoPublishToNewsfeed && autoSaveStream ? 'text-primary-500' : 'text-dark-400'} />
                  <div>
                    <p className={`text-sm font-medium ${autoPublishToNewsfeed && autoSaveStream ? 'text-primary-400' : ''}`}>Im Newsfeed posten</p>
                    <p className="text-xs text-dark-400">Videos automatisch teilen</p>
                  </div>
                </div>
                <div
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                    autoPublishToNewsfeed && autoSaveStream ? 'bg-primary-600' : 'bg-dark-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      autoPublishToNewsfeed && autoSaveStream ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Publish to Newsfeed Button */}
            <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <Send size={18} className="text-primary-500" />
                    Im Newsfeed ankündigen
                  </h3>
                  <p className="text-sm text-dark-400 mt-1">
                    Erstelle einen Newsfeed-Post und kündige jetzt den startenden Livestream an. Aktuell gesetzter Titel und Beschreibung werden mitgesendet.
                  </p>
                </div>
                <button
                  onClick={async () => {
                    if (!title.trim()) {
                      toast.error('Bitte gib einen Stream-Titel ein')
                      return
                    }
                    try {
                      let postDescription = description || 'Jetzt live! Schau vorbei!'
                      
                      // Füge Gäste zur Beschreibung hinzu
                      if (guests.length > 0) {
                        const guestNames = guests.map(g => g.name).filter(n => n.trim()).join(', ')
                        if (guestNames) {
                          postDescription += `\n\n👥 Mit dabei: ${guestNames}`
                        }
                      }
                      
                      await newsfeedService.createPost({
                        title: `🔴 LIVE: ${title}`,
                        description: postDescription,
                        externalLink: '/live',
                        status: 'published'
                      })
                      toast.success('Stream-Ankündigung wurde im Newsfeed veröffentlicht!')
                    } catch (error) {
                      console.error('Failed to publish to newsfeed:', error)
                      toast.error('Fehler beim Veröffentlichen: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'))
                    }
                  }}
                  className="btn-primary flex items-center gap-2"
                >
                  <Send size={18} />
                  Veröffentlichen
                </button>
              </div>
            </div>

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

            {/* Offline Image */}
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <Image size={16} className="text-primary-500" />
                Offline-Bild
              </label>
              <p className="text-xs text-dark-400 mb-3">
                Wird angezeigt wenn der Stream offline ist (16:9 Format empfohlen)
              </p>
              
              {offlineImageUrl ? (
                <div className="space-y-3">
                  {/* Preview im 16:9 Format wie auf der Live-Seite */}
                  <div className="relative aspect-video max-w-lg rounded-xl overflow-hidden bg-dark-900 border border-dark-600 shadow-lg">
                    <img 
                      src={offlineImageUrl} 
                      alt="Offline-Bild Vorschau" 
                      className="absolute inset-0 w-full h-full object-cover z-0"
                    />
                    {/* Overlay wie auf der Live-Seite */}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                      <div className="text-center">
                        <div className="w-16 h-16 rounded-full bg-primary-600 flex items-center justify-center mx-auto mb-3 shadow-lg">
                          <Play size={32} className="text-white ml-1" />
                        </div>
                        <p className="text-white font-semibold text-lg">Aktuell Offline</p>
                        <p className="text-white/70 text-sm">Der nächste Stream kommt bald!</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => offlineImageInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="btn-secondary text-sm py-2 px-4 flex items-center gap-2"
                    >
                      {uploadingImage ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          Hochladen...
                        </>
                      ) : (
                        <>
                          <Upload size={14} />
                          Bild ändern
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteOfflineImage}
                      disabled={uploadingImage}
                      className="btn-secondary text-sm py-2 px-4 flex items-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 size={14} />
                      Löschen
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  className="border-2 border-dashed border-dark-600 hover:border-primary-500 rounded-lg p-4 text-center transition-colors cursor-pointer max-w-xs"
                  onClick={() => !uploadingImage && offlineImageInputRef.current?.click()}
                >
                  {uploadingImage ? (
                    <div className="flex items-center gap-3">
                      <RefreshCw size={20} className="text-primary-500 animate-spin" />
                      <span className="text-sm">Hochladen...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Image size={20} className="text-dark-400" />
                      <div className="text-left">
                        <p className="text-sm font-medium">Offline-Bild hochladen</p>
                        <p className="text-xs text-dark-500">16:9 Format, max 10MB</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <input
                ref={offlineImageInputRef}
                type="file"
                accept="image/*"
                onChange={handleOfflineImageUpload}
                className="hidden"
              />
            </div>

            {/* Guests */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Gäste
                </label>
                <button
                  type="button"
                  onClick={addGuest}
                  className="text-sm text-primary-500 hover:text-primary-400 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Gast hinzufügen
                </button>
              </div>
              
              {guests.length > 0 && (
                <div className="space-y-4">
                  {guests.map((guest) => (
                    <div key={guest.id} className="p-4 bg-dark-800 rounded-lg border border-dark-700">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <input
                          type="text"
                          value={guest.name}
                          onChange={(e) => updateGuest(guest.id, 'name', e.target.value)}
                          placeholder="Name des Gastes"
                          className="input flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => removeGuest(guest.id)}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Guest Links */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-dark-400 flex items-center gap-1">
                            <LinkIcon className="w-3 h-3" />
                            Social Media Links
                          </label>
                          {(guest.links?.length || 0) < 7 && (
                            <button
                              type="button"
                              onClick={() => addGuestLink(guest.id)}
                              className="text-xs text-primary-500 hover:text-primary-400"
                            >
                              + Link
                            </button>
                          )}
                        </div>
                        {guest.links?.map((link, linkIndex) => (
                          <div key={linkIndex} className="flex gap-2">
                            <input
                              type="url"
                              value={link}
                              onChange={(e) => updateGuestLink(guest.id, linkIndex, e.target.value)}
                              placeholder="https://..."
                              className="input flex-1 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => removeGuestLink(guest.id, linkIndex)}
                              className="p-2 text-dark-400 hover:text-red-500 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AWS IVS Streaming Info */}
            <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
              <div className="flex items-center gap-2 mb-4">
                <Tv className="text-primary-500" size={20} />
                <h3 className="font-semibold text-lg">AWS IVS Streaming Info</h3>
              </div>
              
              {loadingIVS ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                </div>
              ) : ivsChannelInfo ? (
                <div className="space-y-4">
                  {/* Ingest Endpoint */}
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Ingest Server (RTMP URL)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={ivsChannelInfo.ingestEndpoint}
                        readOnly
                        className="flex-1 px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-200 font-mono text-sm"
                      />
                      <button
                        onClick={() => copyToClipboard(ivsChannelInfo.ingestEndpoint, 'ingestUrl')}
                        className="px-3 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors flex items-center gap-2 text-sm"
                      >
                        {ingestUrlCopied ? '✓' : <Copy size={14} />}
                        {ingestUrlCopied ? 'Kopiert!' : 'Kopieren'}
                      </button>
                    </div>
                  </div>

                  {/* Stream Key */}
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Stream Key
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={ivsChannelInfo.streamKey}
                        readOnly
                        className="flex-1 px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-200 font-mono text-sm"
                      />
                      <button
                        onClick={() => copyToClipboard(ivsChannelInfo.streamKey, 'streamKey')}
                        className="px-3 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors flex items-center gap-2 text-sm"
                      >
                        {streamKeyCopied ? '✓' : <Key size={14} />}
                        {streamKeyCopied ? 'Kopiert!' : 'Kopieren'}
                      </button>
                    </div>
                    <p className="text-xs text-dark-400 mt-1">
                      Privat halten! Für OBS als Stream Key verwenden
                    </p>
                  </div>

                  {/* OBS Setup Instructions */}
                  <div className="bg-dark-900 rounded-lg p-3 mt-4">
                    <h4 className="font-medium mb-2 text-primary-400 text-sm">OBS Studio Setup:</h4>
                    <ol className="text-xs text-dark-300 space-y-1">
                      <li>1. Öffne OBS Studio</li>
                      <li>2. Gehe zu Einstellungen → Stream</li>
                      <li>3. Wähle "Benutzerdefiniert..." als Service</li>
                      <li>4. Kopiere die RTMP URL oben als "Server"</li>
                      <li>5. Kopiere den Stream Key als "Stream-Schlüssel"</li>
                      <li>6. Klicke "OK" und starte das Streaming!</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-dark-400">
                  <Tv size={48} className="mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Kein AWS IVS Channel konfiguriert</p>
                  <p className="text-xs mt-1">Kontaktiere den Administrator für die Einrichtung</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Multistreaming Tab */}
        {activeTab === 'multistreaming' && (
          <div className="space-y-6">
            {/* Auto-Stopp Dropdown und Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleCreateDestination}
                className="btn-primary flex items-center gap-2"
              >
                <Plus size={20} />
                Neues Ziel hinzufügen
              </button>
              
              {/* Auto-Stopp Dropdown */}
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-dark-400" />
                <select
                  value={autoStopMinutes}
                  onChange={(e) => handleAutoStopChange(Number(e.target.value))}
                  className="input py-2 px-3 min-w-[160px]"
                >
                  <option value={0}>Auto-Stopp aus</option>
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
              
              {/* Alle starten Button - nur wenn inaktive Destinations vorhanden */}
              {destinations.some(d => d.enabled && d.status === 'inactive') && (
                <button
                  onClick={handleStartAll}
                  disabled={actionLoading === 'startall'}
                  className="btn-secondary flex items-center gap-2 text-green-500 border-green-500/30 hover:bg-green-500/10"
                >
                  {actionLoading === 'startall' ? (
                    <RefreshCw size={20} className="animate-spin" />
                  ) : (
                    <Play size={20} />
                  )}
                  Alle starten
                </button>
              )}
              
              {/* Alle stoppen Button - nur wenn aktive Destinations vorhanden */}
              {destinations.some(d => d.status === 'active' || d.status === 'starting' || d.status === 'creating') && (
                <button
                  onClick={handleStopAll}
                  disabled={actionLoading === 'stopall'}
                  className="btn-secondary flex items-center gap-2 text-red-500 border-red-500/30 hover:bg-red-500/10"
                >
                  {actionLoading === 'stopall' ? (
                    <RefreshCw size={20} className="animate-spin" />
                  ) : (
                    <StopCircle size={20} />
                  )}
                  Alle stoppen
                </button>
              )}
              <button
                onClick={loadDestinations}
                className="btn-secondary flex items-center gap-2"
                disabled={loadingDestinations}
              >
                <RefreshCw size={20} className={loadingDestinations ? 'animate-spin' : ''} />
                Aktualisieren
              </button>
            </div>

            {/* Hinweis zur Wartezeit */}
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-3">
              <Clock size={18} className="text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-300">
                <span className="font-semibold">Hinweis:</span> Nach dem Starten oder Stoppen bitte mindestens 1 Minute warten. 
                Die Streaming-Ressourcen benötigen Zeit, um verfügbar zu werden oder wieder freigegeben zu werden.
              </p>
            </div>

            {/* Auto-Stop Timer Info - Immer sichtbar */}
            <div className={`p-4 rounded-lg flex items-center gap-3 ${
              autoStopMinutes === 0 
                ? 'bg-red-500/20 border border-red-500/40' 
                : autoDestroyAt 
                  ? 'bg-yellow-500/10 border border-yellow-500/20'
                  : 'bg-dark-800 border border-dark-700'
            }`}>
              <Clock size={24} className={
                autoStopMinutes === 0 
                  ? 'text-red-500' 
                  : autoDestroyAt 
                    ? 'text-yellow-500 animate-pulse' 
                    : 'text-dark-400'
              } />
              <div className="flex-1">
                {autoStopMinutes === 0 ? (
                  <>
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={18} className="text-red-500" />
                      <p className="font-semibold text-red-500">Auto-Stopp deaktiviert</p>
                    </div>
                    <p className="text-sm text-red-300">
                      Multistreaming verursacht laufende Kosten! Streams laufen unbegrenzt weiter.
                    </p>
                  </>
                ) : autoDestroyAt ? (
                  <>
                    <div className="flex items-center gap-3">
                      <p className="font-semibold text-yellow-500">⏱️ Auto-Stopp aktiv</p>
                      <span className="px-3 py-1 bg-yellow-500/20 rounded-full text-yellow-400 font-mono font-bold text-lg">
                        {remainingTime || formatRemainingTime(autoDestroyAt)}
                      </span>
                    </div>
                    <p className="text-sm text-dark-300 mt-1">
                      Alle Streams werden automatisch um {new Date(autoDestroyAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr gestoppt
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-dark-300">
                      Auto-Stopp: {autoStopMinutes >= 60 ? `${autoStopMinutes / 60} Stunde${autoStopMinutes > 60 ? 'n' : ''}` : `${autoStopMinutes} Minuten`}
                    </p>
                    <p className="text-sm text-dark-400">
                      {hasActiveChannels 
                        ? 'Timer wird beim nächsten Stream-Start aktiviert'
                        : 'Timer startet automatisch beim ersten Stream-Start'}
                    </p>
                  </>
                )}
              </div>
              {/* Manueller Stopp-Button wenn Timer aktiv */}
              {autoDestroyAt && (
                <button
                  onClick={handleStopAll}
                  disabled={actionLoading === 'stopall'}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-500 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  {actionLoading === 'stopall' ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <StopCircle size={16} />
                  )}
                  Jetzt stoppen
                </button>
              )}
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
                              {destination.status === 'active' ? (
                                <button
                                  onClick={() => handleStopStreaming(destination.id)}
                                  disabled={isLoading}
                                  className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-500 transition-colors disabled:opacity-50"
                                  title="Streaming stoppen"
                                >
                                  <Square size={20} />
                                </button>
                              ) : destination.status === 'creating' || destination.status === 'starting' ? (
                                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-500" title="Channel wird vorbereitet...">
                                  <RefreshCw size={20} className="animate-spin" />
                                </div>
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
                <li>• <strong>Maximale Anzahl:</strong> Es können maximal 7 Kanäle gleichzeitig aktiv sein</li>
                <li>• Jeder Stream zu einer Plattform kann 30-60 Sekunden dauern, bis er erscheint</li>
                <li>• Stelle sicher, dass deine Stream Keys korrekt sind</li>
                <li>• Die drei Stopp-Buttons: "Alle stoppen" (oben), "Jetzt stoppen" (beim Timer), und einzelne Kanal-Stopps</li>
              </ul>
            </div>
          </div>
        )}
        </div>

        {/* Fixed Footer with Buttons */}
        {activeTab === 'general' && (
          <div className="pt-6 border-t border-dark-700 flex gap-3">
            <button
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Abbrechen
            </button>
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
          </div>
        )}
        </div>

        {/* Destination Modal */}
        {showDestinationModal && (
          <StreamDestinationModal
            destination={editingDestination}
            existingDestinations={destinations}
            onClose={() => setShowDestinationModal(false)}
            onSave={loadDestinations}
          />
        )}
      </div>
    </>
  )
}
