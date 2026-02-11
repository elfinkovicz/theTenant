import { useState, useRef, useEffect } from 'react';
import { X, Upload, Music, Image, Plus, Trash2, Link, Sparkles, Loader2, Newspaper, Lock, Settings } from 'lucide-react';
import { podcastService, PodcastGuest } from '../services/podcast.service';
import { newsfeedService } from '../services/newsfeed.service';
import { slotsService } from '../services/slots.service';
import { ImageCropper } from './ImageCropper';
import { SlotSelector } from './SlotSelector';
import { SlotManagerModal } from './SlotManagerModal';
import { toast } from '../utils/toast-alert';
import { useTenant } from '../providers/TenantProvider';
import { prefetchService } from '../services/prefetch.service';

interface PodcastUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories?: string[];
}

export function PodcastUploadModal({ isOpen, onClose, onSuccess, categories = [] }: PodcastUploadModalProps) {
  const { subdomain } = useTenant();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploadedAudioKey, setUploadedAudioKey] = useState<string | null>(null);
  const [uploadedThumbnailKey, setUploadedThumbnailKey] = useState<string | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [guests, setGuests] = useState<PodcastGuest[]>([]);
  const [isExclusive, setIsExclusive] = useState(false);
  const [publishOption, setPublishOption] = useState<'now' | 'slot' | 'schedule'>('now');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [hasSlots, setHasSlots] = useState(false);
  const [showSlotManager, setShowSlotManager] = useState(false);
  const [useAiDescription, setUseAiDescription] = useState(false);
  const [aiStatus, setAiStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [publishToNewsfeed, setPublishToNewsfeed] = useState(true);
  
  // Cropper state
  const [cropperImage, setCropperImage] = useState<string | null>(null);

  const audioInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  // Load slots availability when modal opens
  useEffect(() => {
    if (!isOpen) return;
    
    const loadSlotsAvailability = async () => {
      try {
        const slotsData = await slotsService.getSlots();
        const hasActiveSlots = slotsData.slots && slotsData.slots.some(s => s.enabled);
        setHasSlots(hasActiveSlots);
        
        // Set default to slot if slots are available
        if (hasActiveSlots) {
          setPublishOption('slot');
        }
      } catch (err) {
        console.error('Error checking slots:', err);
        setHasSlots(false);
      }
    };

    // Set default scheduled date/time to tomorrow at 12:00
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0);
    setScheduledDate(tomorrow.toISOString().split('T')[0]);
    setScheduledTime('12:00');
    
    loadSlotsAvailability();
  }, [isOpen]);

  const handleSlotSelected = (datetime: string) => {
    const date = new Date(datetime);
    setScheduledDate(date.toISOString().split('T')[0]);
    setScheduledTime(date.toTimeString().slice(0, 5));
  };

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('audio/')) {
        setError('Bitte wähle eine Audio-Datei aus');
        return;
      }
      setAudioFile(file);
      setError('');
    }
  };

  const handleThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Bitte wähle ein Bild aus');
        return;
      }
      // Open cropper
      const reader = new FileReader();
      reader.onload = () => {
        setCropperImage(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError('');
    }
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    const file = new File([croppedBlob], 'thumbnail.png', { type: 'image/png' });
    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(croppedBlob));
    setCropperImage(null);
  };

  const addGuest = () => {
    setGuests([...guests, { id: crypto.randomUUID(), name: '', links: [''] }]);
  };

  const updateGuestName = (id: string, name: string) => {
    setGuests(guests.map(g => g.id === id ? { ...g, name } : g));
  };

  const updateGuestLink = (guestId: string, linkIndex: number, value: string) => {
    setGuests(guests.map(g => {
      if (g.id === guestId) {
        const newLinks = [...(g.links || [])];
        newLinks[linkIndex] = value;
        return { ...g, links: newLinks };
      }
      return g;
    }));
  };

  const addGuestLink = (guestId: string) => {
    setGuests(guests.map(g => {
      if (g.id === guestId && (g.links?.length || 0) < 7) {
        return { ...g, links: [...(g.links || []), ''] };
      }
      return g;
    }));
  };

  const removeGuestLink = (guestId: string, linkIndex: number) => {
    setGuests(guests.map(g => {
      if (g.id === guestId) {
        const newLinks = (g.links || []).filter((_, i) => i !== linkIndex);
        return { ...g, links: newLinks.length > 0 ? newLinks : [''] };
      }
      return g;
    }));
  };

  const removeGuest = (id: string) => {
    setGuests(guests.filter(g => g.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('Bitte gib einen Titel ein');
      return;
    }
    if (!audioFile) {
      setError('Bitte wähle eine Audio-Datei aus');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const duration = await podcastService.getAudioDuration(audioFile);

      setUploadProgress(10);
      const audioUpload = await podcastService.generateUploadUrl(audioFile.name, audioFile.type, 'audio');
      await podcastService.uploadToS3(audioUpload.uploadUrl, audioFile, (progress) => {
        setUploadProgress(10 + progress * 0.7);
      });
      setUploadedAudioKey(audioUpload.key);

      let thumbnailKey = null;
      if (thumbnailFile) {
        setUploadProgress(80);
        const thumbUpload = await podcastService.generateUploadUrl(thumbnailFile.name, thumbnailFile.type, 'thumbnail');
        await podcastService.uploadToS3(thumbUpload.uploadUrl, thumbnailFile);
        thumbnailKey = thumbUpload.key;
        setUploadedThumbnailKey(thumbnailKey);
      }

      setUploadProgress(90);

      // Clean up guest links (remove empty ones)
      const cleanedGuests = guests
        .filter(g => g.name && g.name.trim())
        .map(g => ({
          id: g.id,
          name: g.name.trim(),
          imageUrl: g.imageUrl,
          links: (g.links || []).filter(l => l && typeof l === 'string' && l.trim().length > 0)
        }));

      console.log('Saving guests with links:', JSON.stringify(cleanedGuests, null, 2));

      const podcastId = crypto.randomUUID();

      // Determine status and scheduledAt
      const isScheduling = publishOption === 'slot' || publishOption === 'schedule';
      const scheduledAt = isScheduling && scheduledDate && scheduledTime 
        ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString() 
        : undefined;
      const status = isScheduling && scheduledAt ? 'scheduled' : 'published';

      await podcastService.addPodcast({
        podcastId,
        title: title.trim(),
        description: useAiDescription ? '' : description.trim(),
        category: category || 'Allgemein',
        audioKey: audioUpload.key,
        thumbnailKey,
        duration,
        fileSize: audioFile.size,
        status,
        uploadedBy: 'admin',
        guests: cleanedGuests,
        isExclusive,
        scheduledAt,
        ...(useAiDescription && { aiStatus: 'pending', aiDescription: true })
      });

      // Start AI transcription if enabled
      if (useAiDescription) {
        setAiStatus('processing');
        try {
          await podcastService.startAiTranscription(podcastId, audioUpload.key);
        } catch (aiErr) {
          console.error('AI transcription start failed:', aiErr);
          // Don't fail the whole upload, just log the error
        }
      }

      // Publish to newsfeed if enabled (only if not scheduled)
      if (publishToNewsfeed && publishOption === 'now') {
        try {
          // Build podcast URL
          const podcastUrl = `https://${subdomain}.viraltenant.com/podcasts`;
          
          // Guest names for description
          const guestNames = cleanedGuests.length > 0 
            ? `\n\n🎙️ Mit: ${cleanedGuests.map(g => g.name).join(', ')}`
            : '';
          
          // Pass thumbnailFile directly so newsfeed service can upload it with correct key format
          await newsfeedService.createPost({
            title: `🎧 Neuer Podcast: ${title.trim()}`,
            description: `${useAiDescription ? 'Neue Podcast-Episode verfügbar!' : (description.trim() || `Höre jetzt unsere neue Podcast-Episode "${title.trim()}"!`)}${guestNames}\n\n🔗 ${podcastUrl}`,
            externalLink: podcastUrl,
            tags: category ? [category, 'Podcast'] : ['Podcast'],
            status: 'published'
          }, undefined, undefined, undefined, thumbnailFile || undefined);
          console.log('Podcast announced in newsfeed');
        } catch (newsfeedErr) {
          console.error('Failed to publish to newsfeed:', newsfeedErr);
          // Don't fail the whole upload
        }
      }

      setUploadProgress(100);
      
      toast.success('Podcast erfolgreich hochgeladen!');
      
      // Invalidate cache before calling onSuccess
      prefetchService.invalidate('podcasts');
      
      // Clear uploaded keys so they won't be deleted on close
      setUploadedAudioKey(null);
      setUploadedThumbnailKey(null);
      
      // Reset form
      setTitle('');
      setDescription('');
      setCategory('');
      setAudioFile(null);
      setThumbnailFile(null);
      setThumbnailPreview(null);
      setGuests([]);
      setIsExclusive(false);
      setPublishOption('now');
      setScheduledDate('');
      setScheduledTime('');
      setUseAiDescription(false);
      setAiStatus('idle');
      setPublishToNewsfeed(true);
      
      setUploading(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.response?.data?.message || 'Upload fehlgeschlagen');
      toast.error('Fehler beim Hochladen des Podcasts');
      
      // Clean up uploaded files on error
      if (uploadedAudioKey) {
        try {
          await podcastService.deleteAsset(uploadedAudioKey);
        } catch (deleteErr) {
          console.error('Failed to delete audio:', deleteErr);
        }
      }
      if (uploadedThumbnailKey) {
        try {
          await podcastService.deleteAsset(uploadedThumbnailKey);
        } catch (deleteErr) {
          console.error('Failed to delete thumbnail:', deleteErr);
        }
      }
      
      setUploadedAudioKey(null);
      setUploadedThumbnailKey(null);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleClose = async () => {
    // Delete uploaded files if user cancels
    if (uploadedAudioKey) {
      try {
        await podcastService.deleteAsset(uploadedAudioKey);
        console.log('Deleted unpublished audio:', uploadedAudioKey);
      } catch (err) {
        console.error('Failed to delete audio:', err);
      }
    }
    if (uploadedThumbnailKey) {
      try {
        await podcastService.deleteAsset(uploadedThumbnailKey);
        console.log('Deleted unpublished thumbnail:', uploadedThumbnailKey);
      } catch (err) {
        console.error('Failed to delete thumbnail:', err);
      }
    }
    
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Podcast hochladen</h2>
            <button onClick={handleClose} className="p-2 rounded-lg hover:bg-dark-800 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Audio Upload */}
            <div>
              <label className="block text-sm font-medium mb-2">Audio-Datei <span className="text-red-500">*</span></label>
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                onChange={handleAudioSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => audioInputRef.current?.click()}
                className="w-full p-4 border-2 border-dashed border-dark-600 rounded-xl hover:border-primary-500 transition-colors"
              >
                {audioFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <Music className="w-6 h-6 text-primary-500" />
                    <div className="text-left">
                      <p className="font-medium text-sm">{audioFile.name}</p>
                      <p className="text-xs text-dark-400">
                        {(audioFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-dark-400">
                    <Upload className="w-8 h-8" />
                    <span className="text-sm">Audio-Datei auswählen</span>
                    <span className="text-xs">MP3, WAV, M4A</span>
                  </div>
                )}
              </button>
            </div>

            {/* Thumbnail Upload */}
            <div>
              <label className="block text-sm font-medium mb-2">Thumbnail</label>
              <input
                ref={thumbnailInputRef}
                type="file"
                accept="image/*"
                onChange={handleThumbnailSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => thumbnailInputRef.current?.click()}
                className="w-full p-3 border-2 border-dashed border-dark-600 rounded-xl hover:border-primary-500 transition-colors"
              >
                {thumbnailPreview ? (
                  <div className="flex items-center justify-center gap-3">
                    <img src={thumbnailPreview} alt="Preview" className="w-12 h-12 rounded-lg object-cover" />
                    <span className="text-sm">Thumbnail ändern</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-dark-400">
                    <Image className="w-5 h-5" />
                    <span className="text-sm">Thumbnail auswählen</span>
                  </div>
                )}
              </button>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium mb-2">Titel <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input w-full"
                placeholder="Podcast-Titel"
              />
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">Beschreibung</label>
                <div 
                  onClick={() => setUseAiDescription(!useAiDescription)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <span className="text-sm flex items-center gap-1.5 text-purple-400">
                    <Sparkles className="w-4 h-4" />
                    KI Beschreibung
                  </span>
                  <div
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      useAiDescription ? 'bg-purple-600' : 'bg-dark-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        useAiDescription ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </div>
                </div>
              </div>
              {useAiDescription ? (
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 text-center">
                  <Sparkles className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                  <p className="text-sm text-purple-300">
                    Die Beschreibung wird automatisch aus dem Audio-Inhalt generiert.
                  </p>
                  <p className="text-xs text-purple-400/70 mt-1">
                    Dies kann einige Minuten dauern.
                  </p>
                </div>
              ) : (
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input w-full h-20 resize-none"
                  placeholder="Beschreibe den Podcast..."
                  maxLength={3000}
                />
              )}
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium mb-2">Kategorie</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input w-full"
              >
                <option value="">Kategorie wählen</option>
                {categories.filter(c => c !== 'Alle').map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                <option value="Allgemein">Allgemein</option>
              </select>
            </div>

            {/* Guests */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Gäste</label>
                <button
                  type="button"
                  onClick={addGuest}
                  className="flex items-center gap-1 text-sm text-primary-400 hover:text-primary-300"
                >
                  <Plus className="w-4 h-4" />
                  Gast hinzufügen
                </button>
              </div>
              
              {guests.map((guest) => (
                <div key={guest.id} className="p-3 rounded-lg bg-dark-800/50 mb-2">
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={guest.name}
                      onChange={(e) => updateGuestName(guest.id, e.target.value)}
                      className="input flex-1"
                      placeholder="Name des Gastes"
                    />
                    <button
                      type="button"
                      onClick={() => removeGuest(guest.id)}
                      className="p-2 rounded-lg bg-dark-700 hover:bg-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Social Links */}
                  <div className="space-y-1">
                    {(guest.links || ['']).map((link, idx) => (
                      <div key={idx} className="flex gap-1">
                        <div className="flex items-center px-2 bg-dark-700 rounded-l-lg">
                          <Link className="w-3.5 h-3.5 text-dark-400" />
                        </div>
                        <input
                          type="url"
                          value={link}
                          onChange={(e) => updateGuestLink(guest.id, idx, e.target.value)}
                          className="input flex-1 text-sm rounded-l-none"
                          placeholder="Social Media Link"
                        />
                        {(guest.links?.length || 0) > 1 && (
                          <button
                            type="button"
                            onClick={() => removeGuestLink(guest.id, idx)}
                            className="p-1.5 rounded-lg bg-dark-700 hover:bg-red-600/50 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    {(guest.links?.length || 0) < 7 && (
                      <button
                        type="button"
                        onClick={() => addGuestLink(guest.id)}
                        className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Link hinzufügen (max. 7)
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Checkboxes Row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Publish to Newsfeed */}
              <div 
                onClick={() => !uploading && setPublishToNewsfeed(!publishToNewsfeed)}
                className="flex items-center justify-between p-3 bg-dark-800 rounded-lg border border-dark-700 cursor-pointer hover:bg-dark-700/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Newspaper className="w-4 h-4 text-primary-500" />
                  <div>
                    <p className="text-sm font-medium">Im Newsfeed veröffentlichen</p>
                    <p className="text-xs text-dark-400">Erstellt automatisch einen Post</p>
                  </div>
                </div>
                <div
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                    publishToNewsfeed ? 'bg-primary-600' : 'bg-dark-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      publishToNewsfeed ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </div>
              </div>

              {/* Exclusive Content */}
              <div 
                onClick={() => !uploading && setIsExclusive(!isExclusive)}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                  isExclusive 
                    ? 'bg-yellow-500/10 border-yellow-500/30 hover:bg-yellow-500/15' 
                    : 'bg-dark-800 border-dark-700 hover:bg-dark-700/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Lock className={`w-4 h-4 ${isExclusive ? 'text-yellow-500' : 'text-dark-400'}`} />
                  <div>
                    <p className={`text-sm font-medium ${isExclusive ? 'text-yellow-400' : ''}`}>Exklusiver Inhalt</p>
                    <p className="text-xs text-dark-400">Nur für Mitglieder</p>
                  </div>
                </div>
                <div
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                    isExclusive ? 'bg-yellow-500' : 'bg-dark-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isExclusive ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Publish Options */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium">Veröffentlichung</label>
                <button
                  type="button"
                  onClick={() => setShowSlotManager(true)}
                  className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1"
                >
                  <Settings className="w-3 h-3" />
                  Slots verwalten
                </button>
              </div>
              <div className="flex gap-4 mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="publishOptionPodcast"
                    value="now"
                    checked={publishOption === 'now'}
                    onChange={() => setPublishOption('now')}
                    disabled={uploading}
                    className="w-4 h-4 text-primary-500"
                  />
                  <span>Sofort veröffentlichen</span>
                </label>
                {hasSlots && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="publishOptionPodcast"
                      value="slot"
                      checked={publishOption === 'slot'}
                      onChange={() => setPublishOption('slot')}
                      disabled={uploading}
                      className="w-4 h-4 text-primary-500"
                    />
                    <span>Nächster Slot</span>
                  </label>
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="publishOptionPodcast"
                    value="schedule"
                    checked={publishOption === 'schedule'}
                    onChange={() => setPublishOption('schedule')}
                    disabled={uploading}
                    className="w-4 h-4 text-primary-500"
                  />
                  <span>Zeitplanung</span>
                </label>
              </div>

              {/* Slot Selector */}
              {publishOption === 'slot' && (
                <SlotSelector
                  onSlotSelected={handleSlotSelected}
                  onManageSlots={() => setShowSlotManager(true)}
                />
              )}

              {/* Schedule Date/Time */}
              {publishOption === 'schedule' && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-dark-800/50 rounded-lg border border-dark-700">
                  <div>
                    <label className="block text-sm font-medium mb-2">Datum</label>
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      disabled={uploading}
                      min={new Date().toISOString().split('T')[0]}
                      className="input w-full disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Uhrzeit</label>
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      disabled={uploading}
                      className="input w-full disabled:opacity-50"
                    />
                  </div>
                  <div className="col-span-2 text-sm text-dark-400">
                    📅 Podcast wird veröffentlicht am {scheduledDate && scheduledTime ? new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString('de-DE', { 
                      day: '2-digit', 
                      month: 'long', 
                      year: 'numeric', 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    }) : '...'} Uhr
                  </div>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Progress */}
            {uploading && (
              <div className="space-y-2">
                <div className="h-2 bg-dark-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-600 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-sm text-center text-dark-400">
                  {aiStatus === 'processing' ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      KI-Analyse wird gestartet...
                    </span>
                  ) : (
                    `Hochladen... ${uploadProgress}%`
                  )}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary flex-1"
                disabled={uploading}
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="btn-primary flex-1"
                disabled={uploading || !audioFile || !title.trim()}
              >
                {uploading ? 'Hochladen...' : 'Hochladen'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Image Cropper */}
      {cropperImage && (
        <ImageCropper
          image={cropperImage}
          onCropComplete={handleCropComplete}
          onCancel={() => setCropperImage(null)}
          aspectRatio={1}
          title="Thumbnail zuschneiden"
          preserveFormat={true}
          optimizeForCrossposting={false}
        />
      )}

      {/* Slot Manager Modal */}
      {showSlotManager && (
        <SlotManagerModal
          isOpen={showSlotManager}
          onClose={() => setShowSlotManager(false)}
          onSlotsUpdated={() => {
            // Reload slots availability
            slotsService.getSlots().then(slotsData => {
              const hasActiveSlots = slotsData.slots && slotsData.slots.some(s => s.enabled);
              setHasSlots(hasActiveSlots);
            });
            setShowSlotManager(false);
          }}
        />
      )}
    </>
  );
}
