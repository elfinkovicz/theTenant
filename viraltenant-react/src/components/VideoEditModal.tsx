import { useState, useEffect } from 'react';
import { X, Save, Upload, Users, Plus, Trash2, Lock } from 'lucide-react';
import { Video, videoService, VideoGuest } from '../services/video.service';
import { ImageCropper } from './ImageCropper';
import { AIThumbnailGenerator } from './AIThumbnailGenerator';
import { useTenant } from '../providers/TenantProvider';
import { ExtractedFrame } from '../utils/videoFrameExtractor';
import { toast } from '../utils/toast-alert';
import { prefetchService } from '../services/prefetch.service';

interface VideoEditModalProps {
  isOpen: boolean;
  video: Video | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function VideoEditModal({ isOpen, video, onClose, onSuccess }: VideoEditModalProps) {
  const { tenantId } = useTenant();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<'draft' | 'published' | 'scheduled'>('published');
  const [isExclusive, setIsExclusive] = useState(false);
  const [guests, setGuests] = useState<VideoGuest[]>([]);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [aiThumbnailUrl, setAiThumbnailUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [cropperImage, setCropperImage] = useState<string | null>(null);
  const [extractedFrames, setExtractedFrames] = useState<ExtractedFrame[]>([]);
  const [extractingFrames, setExtractingFrames] = useState(false);

  useEffect(() => {
    if (video) {
      setTitle(video.title);
      setDescription(video.description || '');
      setCategory(video.category || '');
      setStatus(video.status);
      setIsExclusive(video.isExclusive || false);
      setGuests(video.guests || []);
      setThumbnailPreview(video.thumbnailUrl || null);
      setThumbnailFile(null);
      setAiThumbnailUrl(null);
      setExtractedFrames([]);
      setExtractingFrames(false);
    }
  }, [video]);

  // Lade Kategorien aus den Video-Einstellungen
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const { categories: cats } = await videoService.getVideos();
        // Filtere 'Alle' aus, da es nur ein Filter ist
        const filteredCats = cats.filter(c => c !== 'Alle');
        setCategories(filteredCats);
        
        // Setze erste Kategorie als Standard nur wenn noch keine gesetzt UND kein Video geladen
        if (!category && !video && filteredCats.length > 0) {
          setCategory(filteredCats[0]);
        }
      } catch (err) {
        console.error('Failed to load categories:', err);
        setCategories([]);
      }
    };
    
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  if (!isOpen || !video) return null;

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Bitte wähle eine Bilddatei');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Thumbnail darf maximal 5MB groß sein');
      return;
    }

    setError('');

    // Open cropper
    const reader = new FileReader();
    reader.onloadend = () => {
      setCropperImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    const file = new File([croppedBlob], 'thumbnail.png', { type: 'image/png' });
    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(croppedBlob));
    setCropperImage(null);
  };

  const extractFramesFromUploadedVideo = async () => {
    if (!video?.videoUrl) {
      setError('Video-URL nicht verfügbar');
      return;
    }

    setExtractingFrames(true);
    setError('');

    try {
      console.log('Extracting frames from uploaded video:', video.videoUrl);

      // Create video element to load the uploaded video
      const videoElement = document.createElement('video');
      videoElement.crossOrigin = 'anonymous';
      videoElement.preload = 'metadata';
      videoElement.muted = true;
      videoElement.playsInline = true;

      // Wait for video to load
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Video-Laden Timeout'));
        }, 30000);

        videoElement.onloadedmetadata = () => {
          clearTimeout(timeout);
          resolve();
        };

        videoElement.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Video konnte nicht geladen werden'));
        };

        videoElement.src = video.videoUrl || '';
      });

      const duration = videoElement.duration;
      if (!duration || duration === 0 || !isFinite(duration)) {
        throw new Error('Video-Dauer konnte nicht ermittelt werden');
      }

      console.log(`Video duration: ${duration.toFixed(2)}s`);

      // Extract frames at 20%, 40%, 60%, 80%, 100%
      const percentages = [0.2, 0.4, 0.6, 0.8, 1.0];
      const frames: ExtractedFrame[] = [];

      for (const percentage of percentages) {
        const timestamp = Math.min(duration * percentage, duration - 0.5);
        
        // Seek to timestamp
        videoElement.currentTime = timestamp;
        
        // Wait for seek to complete
        await new Promise<void>((resolve) => {
          videoElement.onseeked = () => resolve();
        });

        // Wait a bit for frame to be ready
        await new Promise(resolve => setTimeout(resolve, 200));

        // Create canvas and extract frame
        const canvas = document.createElement('canvas');
        const maxWidth = 1280;
        const maxHeight = 720;
        const aspectRatio = videoElement.videoWidth / videoElement.videoHeight;

        if (aspectRatio > maxWidth / maxHeight) {
          canvas.width = maxWidth;
          canvas.height = Math.round(maxWidth / aspectRatio);
        } else {
          canvas.height = maxHeight;
          canvas.width = Math.round(maxHeight * aspectRatio);
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

        // Convert to blob
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, 'image/jpeg', 0.85);
        });

        if (blob) {
          frames.push({
            timestamp,
            blob,
            url: URL.createObjectURL(blob)
          });
          console.log(`Extracted frame at ${timestamp.toFixed(2)}s`);
        }
      }

      if (frames.length === 0) {
        throw new Error('Keine Frames konnten extrahiert werden');
      }

      console.log(`Successfully extracted ${frames.length} frames`);
      setExtractedFrames(frames);

    } catch (err: any) {
      console.error('Frame extraction error:', err);
      setError(err.message || 'Frame-Extraktion fehlgeschlagen');
    } finally {
      setExtractingFrames(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('Bitte gib einen Titel ein');
      return;
    }

    setSaving(true);
    setError('');
    setUploadProgress(0);

    try {
      let thumbnailKey = video.thumbnailKey;

      // Use AI thumbnail if generated
      if (aiThumbnailUrl) {
        const url = new URL(aiThumbnailUrl);
        thumbnailKey = url.pathname.substring(1); // Remove leading slash
        setUploadProgress(50);
      }
      // Upload new thumbnail if selected
      else if (thumbnailFile) {
        setUploadProgress(10);
        
        // Generate upload URL for thumbnail
        const uploadData = await videoService.generateUploadUrl(
          thumbnailFile.name,
          thumbnailFile.type,
          'thumbnail'
        );

        setUploadProgress(30);

        // Upload thumbnail to S3
        await videoService.uploadToS3(
          uploadData.uploadUrl,
          thumbnailFile,
          (progress) => {
            setUploadProgress(30 + (progress * 0.5)); // 30-80%
          }
        );

        thumbnailKey = uploadData.key || null;
        setUploadProgress(80);
      }

      // Update video in tenant's video list
      const { videos, categories: cats, settings } = await videoService.getVideos();
      const updatedVideos = videos.map(v => 
        v.videoId === video.videoId 
          ? { 
              ...v, 
              title: title.trim(),
              description: description.trim(),
              category,
              status,
              isExclusive,
              guests: guests.length > 0 ? guests : undefined,
              thumbnailKey: thumbnailKey || v.thumbnailKey,
              updatedAt: new Date().toISOString()
            }
          : v
      );
      await videoService.updateVideos(updatedVideos, cats, settings);

      setUploadProgress(100);
      toast.success('Video erfolgreich aktualisiert!');
      prefetchService.invalidate('videos');
      setSaving(false);
      onSuccess();
      handleClose();
    } catch (err: any) {
      console.error('Update error:', err);
      setError(err.response?.data?.error || 'Aktualisierung fehlgeschlagen');
      toast.error('Fehler beim Aktualisieren des Videos');
      setSaving(false);
      setUploadProgress(0);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setError('');
      setThumbnailFile(null);
      setThumbnailPreview(null);
      setAiThumbnailUrl(null);
      setUploadProgress(0);
      setGuests([]);
      
      // Cleanup extracted frame URLs
      extractedFrames.forEach(frame => {
        if (frame.url.startsWith('blob:')) {
          URL.revokeObjectURL(frame.url);
        }
      });
      setExtractedFrames([]);
      
      onClose();
    }
  };

  const addGuest = () => {
    setGuests([...guests, { id: crypto.randomUUID(), name: '', links: [''] }]);
  };

  const removeGuest = (guestId: string) => {
    setGuests(guests.filter(g => g.id !== guestId));
  };

  const updateGuest = (guestId: string, field: keyof VideoGuest, value: any) => {
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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
      {/* Image Cropper Modal */}
      {cropperImage && (
        <ImageCropper
          image={cropperImage}
          onCropComplete={handleCropComplete}
          onCancel={() => setCropperImage(null)}
          aspectRatio={16 / 9}
          cropShape="rect"
          title="Thumbnail zuschneiden (16:9)"
          preserveFormat={true}
          optimizeForCrossposting={false}
        />
      )}
      
      <div className="bg-dark-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-dark-800 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-800">
          <h2 className="text-2xl font-bold">Video bearbeiten</h2>
          <button
            onClick={handleClose}
            disabled={saving}
            className="text-dark-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Titel <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={saving}
              placeholder="Mein Gaming Video"
              className="input w-full disabled:opacity-50"
              maxLength={100}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">Beschreibung</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
              placeholder="Beschreibe dein Video..."
              rows={6}
              className="input w-full disabled:opacity-50 resize-none"
              maxLength={5000}
            />
            <p className="text-xs text-dark-400 mt-1">{description.length}/5000 Zeichen</p>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium mb-2">Kategorie</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={saving}
              className="input w-full disabled:opacity-50"
              style={{ color: 'rgb(var(--color-input-text))' }}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat} style={{ color: 'rgb(var(--color-input-text))', backgroundColor: 'rgb(var(--color-input-background))' }}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Thumbnail */}
          <div>
            <label className="block text-sm font-medium mb-2">Thumbnail</label>
            
            {/* Current/Preview Thumbnail */}
            {thumbnailPreview && (
              <div className="mb-3 relative">
                <img
                  src={thumbnailPreview}
                  alt="Thumbnail Preview"
                  className="w-full h-48 object-cover rounded-lg border border-dark-700"
                />
                {(thumbnailFile || aiThumbnailUrl) && (
                  <div className="absolute top-2 right-2 bg-primary-600 text-white text-xs px-2 py-1 rounded">
                    {aiThumbnailUrl ? 'AI Generiert' : 'Neu'}
                  </div>
                )}
              </div>
            )}

            {/* Upload Button */}
            <label className="btn-secondary w-full flex items-center justify-center gap-2 cursor-pointer">
              <Upload className="w-5 h-5" />
              {thumbnailFile || aiThumbnailUrl ? 'Anderes Thumbnail wählen' : 'Thumbnail ändern'}
              <input
                type="file"
                accept="image/*"
                onChange={handleThumbnailChange}
                disabled={saving}
                className="hidden"
              />
            </label>
            <p className="text-sm text-dark-400 mt-2">
              Empfohlen: 16:9 Format, max. 5MB
            </p>
          </div>

          {/* AI Thumbnail Generator */}
          {video?.s3Key && (
            <AIThumbnailGenerator
              videoKey={video.s3Key}
              videoTitle={title}
              tenantId={tenantId}
              videoUrl={video.videoUrl}
              preExtractedFrames={extractedFrames}
              isExtracting={extractingFrames}
              onExtractFrames={extractFramesFromUploadedVideo}
              onThumbnailGenerated={(url) => {
                setAiThumbnailUrl(url);
                setThumbnailPreview(url);
                setThumbnailFile(null); // Clear manual thumbnail if AI is used
              }}
            />
          )}

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
                disabled={saving}
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
                          disabled={saving}
                          className="input w-full text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeGuest(guest.id)}
                        disabled={saving}
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
                            disabled={saving}
                            className="input flex-1 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => removeGuestLink(guest.id, linkIndex)}
                            disabled={saving}
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
                          disabled={saving}
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

          {/* Exclusive Content Toggle */}
          <div 
            onClick={() => !saving && setIsExclusive(!isExclusive)}
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

          {/* Status */}
          <div>
            <label className="block text-sm font-medium mb-2">Status</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="published"
                  checked={status === 'published'}
                  onChange={(e) => setStatus(e.target.value as 'published')}
                  disabled={saving}
                  className="w-4 h-4 text-primary-600"
                />
                <span>Veröffentlicht</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="draft"
                  checked={status === 'draft'}
                  onChange={(e) => setStatus(e.target.value as 'draft')}
                  disabled={saving}
                  className="w-4 h-4 text-primary-600"
                />
                <span>Entwurf</span>
              </label>
            </div>
          </div>

          {/* Upload Progress */}
          {saving && uploadProgress > 0 && (
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Upload-Fortschritt</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-dark-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary-600 h-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

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
              disabled={saving}
              className="btn-secondary flex-1 disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Wird gespeichert...' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
