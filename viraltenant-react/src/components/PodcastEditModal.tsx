import { useState, useEffect, useRef } from 'react';
import { X, Image, Plus, Trash2, Link, Lock } from 'lucide-react';
import { Podcast, PodcastGuest, podcastService } from '../services/podcast.service';
import { ImageCropper } from './ImageCropper';
import { toast } from '../utils/toast-alert';
import { prefetchService } from '../services/prefetch.service';

interface PodcastEditModalProps {
  isOpen: boolean;
  podcast: Podcast | null;
  onClose: () => void;
  onSuccess: () => void;
  categories?: string[];
}

export function PodcastEditModal({ isOpen, podcast, onClose, onSuccess, categories = [] }: PodcastEditModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [guests, setGuests] = useState<PodcastGuest[]>([]);
  const [isExclusive, setIsExclusive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  // Cropper state
  const [cropperImage, setCropperImage] = useState<string | null>(null);

  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (podcast) {
      setTitle(podcast.title);
      setDescription(podcast.description || '');
      setCategory(podcast.category || '');
      setThumbnailPreview(podcast.thumbnailUrl || null);
      setThumbnailFile(null);
      // Migrate old guest format to new format
      const migratedGuests = (podcast.guests || []).map(g => ({
        id: g.id || crypto.randomUUID(),
        name: g.name || '',
        imageUrl: g.imageUrl,
        links: (g.links && g.links.length > 0) ? g.links : ((g as any).link ? [(g as any).link] : [''])
      }));
      setGuests(migratedGuests);
      setIsExclusive(podcast.isExclusive || false);
    }
  }, [podcast]);

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
    
    if (!podcast) return;
    if (!title.trim()) {
      setError('Bitte gib einen Titel ein');
      return;
    }

    setSaving(true);
    setError('');

    try {
      let thumbnailKey = podcast.thumbnailKey;

      if (thumbnailFile) {
        if (podcast.thumbnailKey) {
          await podcastService.deleteAsset(podcast.thumbnailKey);
        }
        
        const thumbUpload = await podcastService.generateUploadUrl(thumbnailFile.name, thumbnailFile.type, 'thumbnail');
        await podcastService.uploadToS3(thumbUpload.uploadUrl, thumbnailFile);
        thumbnailKey = thumbUpload.key;
      }

      // Clean up guest links
      const cleanedGuests = guests
        .filter(g => g.name && g.name.trim())
        .map(g => ({
          id: g.id,
          name: g.name.trim(),
          imageUrl: g.imageUrl,
          links: (g.links || []).filter(l => l && typeof l === 'string' && l.trim().length > 0)
        }));

      console.log('Saving guests with links:', JSON.stringify(cleanedGuests, null, 2));

      const data = await podcastService.getPodcasts();
      const updatedPodcasts = data.podcasts.map(p => {
        if (p.podcastId === podcast.podcastId) {
          return {
            ...p,
            title: title.trim(),
            description: description.trim(),
            category: category || 'Allgemein',
            thumbnailKey,
            guests: cleanedGuests,
            isExclusive,
            updatedAt: new Date().toISOString()
          };
        }
        return p;
      });

      await podcastService.updatePodcasts(updatedPodcasts, data.categories, data.settings);
      
      toast.success('Podcast erfolgreich aktualisiert!');
      
      prefetchService.invalidate('podcasts');
      setSaving(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.response?.data?.message || 'Speichern fehlgeschlagen');
      toast.error('Fehler beim Aktualisieren des Podcasts');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !podcast) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Podcast bearbeiten</h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-dark-800 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Thumbnail */}
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
              <label className="block text-sm font-medium mb-2">Titel *</label>
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
              <label className="block text-sm font-medium mb-2">Beschreibung</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input w-full h-20 resize-none"
                placeholder="Beschreibe den Podcast..."
              />
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

            {/* Exclusive Toggle */}
            <div 
              onClick={() => setIsExclusive(!isExclusive)}
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
                  <p className="text-xs text-dark-400">Nur für eingeloggte Mitglieder</p>
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

            {/* Error */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary flex-1"
                disabled={saving}
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="btn-primary flex-1"
                disabled={saving || !title.trim()}
              >
                {saving ? 'Speichern...' : 'Speichern'}
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
    </>
  );
}
