import { useState, useEffect } from 'react';
import { X, Upload, Calendar, Newspaper, Users, Plus, Trash2, Lock, Settings } from 'lucide-react';
import { eventService, Event, CreateEventData, EventGuest } from '../services/event.service';
import { newsfeedService } from '../services/newsfeed.service';
import { slotsService } from '../services/slots.service';
import { ImageCropper } from './ImageCropper';
import { SlotSelector } from './SlotSelector';
import { SlotManagerModal } from './SlotManagerModal';
import { toast } from '../utils/toast-alert';
import { prefetchService } from '../services/prefetch.service';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  event?: Event | null;
  mode: 'create' | 'edit';
}

export function EventModal({ isOpen, onClose, onSuccess, event, mode }: EventModalProps) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [location, setLocation] = useState('');
  const [locationUrl, setLocationUrl] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');
  const [guests, setGuests] = useState<EventGuest[]>([]);
  const [isExclusive, setIsExclusive] = useState(false);
  const [publishOption, setPublishOption] = useState<'now' | 'slot' | 'schedule'>('now');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [hasSlots, setHasSlots] = useState(false);
  const [showSlotManager, setShowSlotManager] = useState(false);
  const [publishToNewsfeed, setPublishToNewsfeed] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [cropperImage, setCropperImage] = useState<string | null>(null);

  useEffect(() => {
    if (event && mode === 'edit') {
      setTitle(event.title);
      setDescription(event.description);
      setEventDate(event.eventDate);
      setEventTime(event.eventTime || '');
      setLocation(event.location || '');
      setLocationUrl(event.locationUrl || '');
      setTicketUrl(event.ticketUrl || '');
      setGuests(event.guests || []);
      setIsExclusive(event.isExclusive || false);
      if (event.status === 'scheduled' && event.scheduledAt) {
        setPublishOption('schedule');
        const scheduledDateTime = new Date(event.scheduledAt);
        setScheduledDate(scheduledDateTime.toISOString().split('T')[0]);
        setScheduledTime(scheduledDateTime.toTimeString().slice(0, 5));
      }
      if (event.imageUrl) {
        setImagePreview(event.imageUrl);
      }
    }
  }, [event, mode]);

  // Load slots availability when modal opens
  useEffect(() => {
    if (!isOpen) return;
    
    const loadSlotsAvailability = async () => {
      try {
        const slotsData = await slotsService.getSlots();
        const hasActiveSlots = slotsData.slots && slotsData.slots.some(s => s.enabled);
        setHasSlots(hasActiveSlots);
        
        // Set default to slot if slots are available and creating new event
        if (hasActiveSlots && mode === 'create') {
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
    if (!scheduledDate) {
      setScheduledDate(tomorrow.toISOString().split('T')[0]);
      setScheduledTime('12:00');
    }
    
    loadSlotsAvailability();
  }, [isOpen, mode]);

  const handleSlotSelected = (datetime: string) => {
    const date = new Date(datetime);
    setScheduledDate(date.toISOString().split('T')[0]);
    setScheduledTime(date.toTimeString().slice(0, 5));
  };

  if (!isOpen) return null;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Bitte wähle ein Bild aus');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('Bild ist zu groß (max. 10MB)');
        return;
      }
      setError('');
      // Open cropper
      const reader = new FileReader();
      reader.onloadend = () => {
        setCropperImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    const file = new File([croppedBlob], 'event-image.png', { type: 'image/png' });
    setImageFile(file);
    setImagePreview(URL.createObjectURL(croppedBlob));
    setCropperImage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !description.trim() || !eventDate) {
      setError('Titel, Beschreibung und Datum sind erforderlich');
      return;
    }

    setUploading(true);
    setError('');

    try {
      let imageKey = event?.imageKey;

      // Upload image if new file selected
      if (imageFile) {
        const uploadData = await eventService.generateUploadUrl(
          imageFile.name,
          imageFile.type
        );
        await eventService.uploadToS3(uploadData.uploadUrl, imageFile);
        imageKey = uploadData.key;
      }

      // Determine status and scheduledAt
      const isScheduling = publishOption === 'slot' || publishOption === 'schedule';
      const scheduledAt = isScheduling && scheduledDate && scheduledTime 
        ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString() 
        : undefined;

      const data: CreateEventData = {
        title: title.trim(),
        description: description.trim(),
        eventDate,
        eventTime: eventTime.trim() || undefined,
        location: location.trim() || undefined,
        locationUrl: locationUrl.trim() || undefined,
        ticketUrl: ticketUrl.trim() || undefined,
        imageKey,
        status: isScheduling && scheduledAt ? 'scheduled' : 'published',
        isExclusive,
        guests: guests.length > 0 ? guests : undefined,
        scheduledAt
      };

      if (mode === 'create') {
        await eventService.createEvent(data);
        
        // Create newsfeed post if checkbox is checked (only if not scheduled)
        if (publishToNewsfeed && publishOption === 'now') {
          try {
            const formattedDate = new Date(eventDate).toLocaleDateString('de-DE', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
            const timeStr = eventTime ? ` um ${eventTime} Uhr` : '';
            const locationStr = location ? ` in ${location}` : '';
            
            await newsfeedService.createPost({
              title: `📅 Neues Event: ${title.trim()}`,
              description: `${description.trim()}\n\n📆 ${formattedDate}${timeStr}${locationStr}`,
              imageKey,
              location: location.trim() || undefined,
              locationUrl: locationUrl.trim() || undefined,
              externalLink: ticketUrl.trim() || `/events`,
              status: 'published'
            });
            console.log('Newsfeed post created for event');
          } catch (newsfeedError) {
            console.error('Failed to create newsfeed post:', newsfeedError);
            // Don't fail the whole creation if newsfeed post fails
          }
        }
        toast.success('Event erfolgreich erstellt!');
      } else if (event) {
        await eventService.updateEvent(event.eventId, data);
        toast.success('Event erfolgreich aktualisiert!');
      }

      prefetchService.invalidate('events');
      onSuccess();
      setUploading(false);
      handleClose();
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.response?.data?.error || 'Fehler beim Speichern');
      toast.error('Fehler beim Speichern des Events');
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setImageFile(null);
      setImagePreview('');
      setTitle('');
      setDescription('');
      setEventDate('');
      setEventTime('');
      setLocation('');
      setLocationUrl('');
      setTicketUrl('');
      setGuests([]);
      setIsExclusive(false);
      setPublishOption('now');
      setScheduledDate('');
      setScheduledTime('');
      setPublishToNewsfeed(true);
      setError('');
      setUploading(false);
      onClose();
    }
  };

  const addGuest = () => {
    setGuests([...guests, { id: crypto.randomUUID(), name: '', links: [''] }]);
  };

  const removeGuest = (guestId: string) => {
    setGuests(guests.filter(g => g.id !== guestId));
  };

  const updateGuest = (guestId: string, field: keyof EventGuest, value: any) => {
    setGuests(guests.map(g => g.id === guestId ? { ...g, [field]: value } : g));
  };

  const addGuestLink = (guestId: string) => {
    setGuests(guests.map(g => {
      if (g.id === guestId && (g.links?.length || 0) < 7) {
        return { ...g, links: [...(g.links || []), ''] };
      }
      return g;
    }));
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

  const removeGuestLink = (guestId: string, linkIndex: number) => {
    setGuests(guests.map(g => {
      if (g.id === guestId) {
        const newLinks = (g.links || []).filter((_, i) => i !== linkIndex);
        return { ...g, links: newLinks };
      }
      return g;
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      {/* Image Cropper Modal */}
      {cropperImage && (
        <ImageCropper
          image={cropperImage}
          onCropComplete={handleCropComplete}
          onCancel={() => setCropperImage(null)}
          aspectRatio={16 / 9}
          cropShape="rect"
          title="Event-Bild zuschneiden (16:9)"
          preserveFormat={true}
          optimizeForCrossposting={false}
        />
      )}
      
      <div className="bg-dark-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden border border-dark-800 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-800 flex-shrink-0">
          <h2 className="text-2xl font-bold">
            {mode === 'create' ? 'Event hinzufügen' : 'Event bearbeiten'}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={uploading}
            className="p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Image Upload - 16:9 Format */}
          <div>
            <label className="block text-sm font-medium mb-2">Event-Bild</label>
            <div className="flex items-start gap-4">
              <div className="w-full aspect-[16/9] rounded-lg bg-dark-800 overflow-hidden flex items-center justify-center">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Calendar className="w-16 h-16 text-dark-400" />
                )}
              </div>
            </div>
            <div className="mt-3">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                disabled={uploading}
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className="btn-secondary cursor-pointer inline-flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Bild hochladen
              </label>
              <p className="text-sm text-dark-400 mt-2">Max. 10MB, JPG oder PNG (empfohlen: 1920x1080px im 16:9 Format)</p>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Titel <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={uploading}
              placeholder="Event-Titel"
              className="input w-full disabled:opacity-50"
              maxLength={200}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Beschreibung <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={uploading}
              placeholder="Event-Beschreibung..."
              rows={6}
              className="input w-full disabled:opacity-50 resize-none"
              maxLength={5000}
            />
            <p className="text-xs text-dark-400 mt-1">{description.length}/5000 Zeichen</p>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Datum <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                disabled={uploading}
                className="input w-full disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Uhrzeit</label>
              <input
                type="time"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
                disabled={uploading}
                className="input w-full disabled:opacity-50"
              />
            </div>
          </div>

          {/* Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Ort</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={uploading}
                placeholder="z.B. Berlin, Deutschland"
                className="input w-full disabled:opacity-50"
                maxLength={200}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Google Maps Link</label>
              <input
                type="url"
                value={locationUrl}
                onChange={(e) => setLocationUrl(e.target.value)}
                disabled={uploading}
                placeholder="https://maps.google.com/..."
                className="input w-full disabled:opacity-50"
              />
              <p className="text-sm text-dark-400 mt-1">Für Wegbeschreibung</p>
            </div>
          </div>

          {/* Ticket URL */}
          <div>
            <label className="block text-sm font-medium mb-2">Ticket-Link</label>
            <input
              type="url"
              value={ticketUrl}
              onChange={(e) => setTicketUrl(e.target.value)}
              disabled={uploading}
              placeholder="https://tickets.example.com/..."
              className="input w-full disabled:opacity-50"
            />
            <p className="text-sm text-dark-400 mt-1">Link zu externem Ticket-Shop</p>
          </div>

          {/* Guests */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4" />
                Gäste / Künstler
              </label>
              <button
                type="button"
                onClick={addGuest}
                disabled={uploading}
                className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Gast hinzufügen
              </button>
            </div>
            
            {guests.length > 0 && (
              <div className="space-y-4">
                {guests.map((guest, guestIndex) => (
                  <div key={guest.id} className="p-4 bg-dark-800 rounded-lg border border-dark-700">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={guest.name}
                          onChange={(e) => updateGuest(guest.id, 'name', e.target.value)}
                          placeholder={`Gast ${guestIndex + 1} Name`}
                          disabled={uploading}
                          className="input w-full text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeGuest(guest.id)}
                        disabled={uploading}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-xs text-dark-400">Social Media Links (max. 7)</p>
                      {guest.links?.map((link, linkIndex) => (
                        <div key={linkIndex} className="flex gap-2">
                          <input
                            type="url"
                            value={link}
                            onChange={(e) => updateGuestLink(guest.id, linkIndex, e.target.value)}
                            placeholder="https://twitter.com/..."
                            disabled={uploading}
                            className="input flex-1 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => removeGuestLink(guest.id, linkIndex)}
                            disabled={uploading}
                            className="p-2 text-dark-400 hover:text-red-400"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {(guest.links?.length || 0) < 7 && (
                        <button
                          type="button"
                          onClick={() => addGuestLink(guest.id)}
                          disabled={uploading}
                          className="text-xs text-primary-400 hover:text-primary-300"
                        >
                          + Link hinzufügen
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Toggle Options */}
          <div className={mode === 'create' ? 'grid grid-cols-2 gap-3' : ''}>
            {/* Publish to Newsfeed - only show in create mode */}
            {mode === 'create' && (
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
            )}

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
                  name="publishOptionEvent"
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
                    name="publishOptionEvent"
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
                  name="publishOptionEvent"
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
                  📅 Event wird veröffentlicht am {scheduledDate && scheduledTime ? new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString('de-DE', { 
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
            <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 text-red-500">
              {error}
            </div>
          )}
          </div>

          {/* Actions - Fixed at bottom */}
          <div className="flex gap-3 p-6 border-t border-dark-800 flex-shrink-0">
            <button
              type="button"
              onClick={handleClose}
              disabled={uploading}
              className="btn-secondary flex-1 disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={uploading || !title.trim() || !description.trim() || !eventDate}
              className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Wird gespeichert...' : mode === 'create' ? 'Hinzufügen' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>

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
    </div>
  );
}
