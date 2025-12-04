import { useState, useEffect } from 'react';
import { X, Save, Upload } from 'lucide-react';
import { Video, videoService } from '../services/video.service';

interface VideoEditModalProps {
  isOpen: boolean;
  video: Video | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function VideoEditModal({ isOpen, video, onClose, onSuccess }: VideoEditModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Gaming');
  const [status, setStatus] = useState<'draft' | 'published'>('published');
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const categories = ['Gaming', 'Tutorials', 'Vlogs', 'Reviews', 'Highlights', 'Sonstiges'];

  useEffect(() => {
    if (video) {
      setTitle(video.title);
      setDescription(video.description || '');
      setCategory(video.category || 'Gaming');
      setStatus(video.status);
      setThumbnailPreview(video.thumbnailUrl || null);
      setThumbnailFile(null);
    }
  }, [video]);

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

    setThumbnailFile(file);
    setError('');

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setThumbnailPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
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

      // Upload new thumbnail if selected
      if (thumbnailFile) {
        setUploadProgress(10);
        
        // Generate upload URL for thumbnail
        const uploadData = await videoService.generateUploadUrl(
          thumbnailFile.name,
          thumbnailFile.type,
          'thumbnail',
          video.videoId
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

        thumbnailKey = uploadData.thumbnailKey || null;
        setUploadProgress(80);
      }

      // Update video metadata
      await videoService.updateVideo(video.videoId, {
        title: title.trim(),
        description: description.trim(),
        category,
        status,
        thumbnailKey: thumbnailKey || undefined,
      });

      setUploadProgress(100);
      onSuccess();
      handleClose();
    } catch (err: any) {
      console.error('Update error:', err);
      setError(err.response?.data?.error || 'Aktualisierung fehlgeschlagen');
      setSaving(false);
      setUploadProgress(0);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setError('');
      setThumbnailFile(null);
      setThumbnailPreview(null);
      setUploadProgress(0);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 rounded-lg max-w-2xl w-full border border-dark-800">
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
              rows={4}
              className="input w-full disabled:opacity-50 resize-none"
              maxLength={500}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium mb-2">Kategorie</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={saving}
              className="input w-full disabled:opacity-50"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
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
                {thumbnailFile && (
                  <div className="absolute top-2 right-2 bg-primary-600 text-white text-xs px-2 py-1 rounded">
                    Neu
                  </div>
                )}
              </div>
            )}

            {/* Upload Button */}
            <label className="btn-secondary w-full flex items-center justify-center gap-2 cursor-pointer">
              <Upload className="w-5 h-5" />
              {thumbnailFile ? 'Anderes Thumbnail wählen' : 'Thumbnail ändern'}
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
