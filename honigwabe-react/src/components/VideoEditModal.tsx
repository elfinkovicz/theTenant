import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const categories = ['Gaming', 'Tutorials', 'Vlogs', 'Reviews', 'Highlights', 'Sonstiges'];

  useEffect(() => {
    if (video) {
      setTitle(video.title);
      setDescription(video.description || '');
      setCategory(video.category || 'Gaming');
      setStatus(video.status);
    }
  }, [video]);

  if (!isOpen || !video) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('Bitte gib einen Titel ein');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await videoService.updateVideo(video.videoId, {
        title: title.trim(),
        description: description.trim(),
        category,
        status,
      });

      onSuccess();
      handleClose();
    } catch (err: any) {
      console.error('Update error:', err);
      setError(err.response?.data?.error || 'Aktualisierung fehlgeschlagen');
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setError('');
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
