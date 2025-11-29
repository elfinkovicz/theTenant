import { useState, useEffect } from 'react';
import { X, Upload, Calendar } from 'lucide-react';
import { eventService, Event, CreateEventData } from '../services/event.service';

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
  const [ticketUrl, setTicketUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (event && mode === 'edit') {
      setTitle(event.title);
      setDescription(event.description);
      setEventDate(event.eventDate);
      setEventTime(event.eventTime || '');
      setLocation(event.location || '');
      setTicketUrl(event.ticketUrl || '');
      if (event.imageUrl) {
        setImagePreview(event.imageUrl);
      }
    }
  }, [event, mode]);

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
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setError('');
    }
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
        imageKey = uploadData.imageKey;
      }

      const data: CreateEventData = {
        title: title.trim(),
        description: description.trim(),
        eventDate,
        eventTime: eventTime.trim() || undefined,
        location: location.trim() || undefined,
        ticketUrl: ticketUrl.trim() || undefined,
        imageKey,
        status: 'published' // Immer veröffentlicht
      };

      if (mode === 'create') {
        await eventService.createEvent(data);
      } else if (event) {
        await eventService.updateEvent(event.eventId, data);
      }

      onSuccess();
      handleClose();
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.response?.data?.error || 'Fehler beim Speichern');
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
      setTicketUrl('');
      setError('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-dark-800">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-800">
          <h2 className="text-2xl font-bold">
            {mode === 'create' ? 'Event hinzufügen' : 'Event bearbeiten'}
          </h2>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="text-dark-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium mb-2">Event-Bild</label>
            <div className="flex items-start gap-4">
              <div className="w-full h-48 rounded-lg bg-dark-800 overflow-hidden flex items-center justify-center">
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
              <p className="text-sm text-dark-400 mt-2">Max. 10MB, JPG oder PNG (empfohlen: 1920x600px für Banner)</p>
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
              rows={4}
              className="input w-full disabled:opacity-50 resize-none"
              maxLength={1000}
            />
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
          <div>
            <label className="block text-sm font-medium mb-2">Ort</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={uploading}
              placeholder="Event-Location"
              className="input w-full disabled:opacity-50"
              maxLength={200}
            />
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

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 text-red-500">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
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
    </div>
  );
}
