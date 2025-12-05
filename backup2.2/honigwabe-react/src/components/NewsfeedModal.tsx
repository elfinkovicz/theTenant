import { useState, useEffect } from 'react';
import { X, Upload, Image as ImageIcon, Video, Link as LinkIcon, MapPin } from 'lucide-react';
import { newsfeedService, NewsfeedPost, CreatePostData } from '../services/newsfeed.service';

interface NewsfeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  post?: NewsfeedPost | null;
  mode: 'create' | 'edit';
}

export function NewsfeedModal({ isOpen, onClose, onSuccess, post, mode }: NewsfeedModalProps) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [videoPreview, setVideoPreview] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [externalLink, setExternalLink] = useState('');
  const [location, setLocation] = useState('');
  const [locationUrl, setLocationUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (post && mode === 'edit') {
      setTitle(post.title);
      setDescription(post.description);
      setExternalLink(post.externalLink || '');
      setLocation(post.location || '');
      setLocationUrl(post.locationUrl || '');
      if (post.imageUrl) {
        setImagePreview(post.imageUrl);
      }
      if (post.videoUrl) {
        setVideoPreview(post.videoUrl);
      }
    }
  }, [post, mode]);

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

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        setError('Bitte wähle ein Video aus');
        return;
      }
      if (file.size > 100 * 1024 * 1024) {
        setError('Video ist zu groß (max. 100MB)');
        return;
      }
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
      setError('');
    }
  };

  // Helper: Ensure URL has protocol
  const ensureProtocol = (url: string): string => {
    if (!url) return url;
    const trimmed = url.trim();
    if (!trimmed) return trimmed;
    
    // Check if URL already has a protocol
    if (trimmed.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//)) {
      return trimmed;
    }
    
    // Add https:// if missing
    return `https://${trimmed}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('Submit clicked!', { title, description });

    if (!title.trim() || !description.trim()) {
      setError('Titel und Beschreibung sind erforderlich');
      alert('Titel und Beschreibung sind erforderlich');
      return;
    }

    setUploading(true);
    setError('');
    console.log('Starting upload...');

    try {
      let imageKey = post?.imageKey;
      let videoKey = post?.videoKey;

      // Upload image if new file selected
      if (imageFile) {
        const uploadData = await newsfeedService.generateUploadUrl(
          imageFile.name,
          imageFile.type,
          'image'
        );
        await newsfeedService.uploadToS3(uploadData.uploadUrl, imageFile);
        imageKey = uploadData.mediaKey;
      }

      // Upload video if new file selected
      if (videoFile) {
        const uploadData = await newsfeedService.generateUploadUrl(
          videoFile.name,
          videoFile.type,
          'video'
        );
        await newsfeedService.uploadToS3(uploadData.uploadUrl, videoFile);
        videoKey = uploadData.mediaKey;
      }

      // Ensure URLs have protocol
      const finalExternalLink = externalLink.trim() ? ensureProtocol(externalLink.trim()) : undefined;
      const finalLocationUrl = locationUrl.trim() ? ensureProtocol(locationUrl.trim()) : undefined;

      const data: CreatePostData = {
        title: title.trim(),
        description: description.trim(),
        imageKey,
        videoKey,
        externalLink: finalExternalLink,
        location: location.trim() || undefined,
        locationUrl: finalLocationUrl,
        status: 'published'
      };

      console.log('Creating post with data:', data);
      
      if (mode === 'create') {
        const result = await newsfeedService.createPost(data);
        console.log('Post created:', result);
      } else if (post) {
        await newsfeedService.updatePost(post.postId, data);
        console.log('Post updated');
      }

      alert('Post erfolgreich erstellt!');
      onSuccess();
      handleClose();
    } catch (err: any) {
      console.error('Error creating post:', err);
      console.error('Error response:', err.response);
      const errorMessage = err.response?.data?.error || err.message || 'Fehler beim Speichern';
      setError(errorMessage);
      setUploading(false);
      alert(`Fehler: ${errorMessage}`); // Temporär für Debugging
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setImageFile(null);
      setVideoFile(null);
      setImagePreview('');
      setVideoPreview('');
      setTitle('');
      setDescription('');
      setExternalLink('');
      setLocation('');
      setLocationUrl('');
      setError('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-dark-800">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-800">
          <h2 className="text-2xl font-bold">
            {mode === 'create' ? 'Newsfeed-Post erstellen' : 'Post bearbeiten'}
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
              placeholder="Post-Titel"
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
              placeholder="Post-Beschreibung..."
              rows={5}
              className="input w-full disabled:opacity-50 resize-none"
              maxLength={2000}
            />
          </div>

          {/* Media Upload */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium mb-2">Bild (optional)</label>
              <div className="w-full h-40 rounded-lg bg-dark-800 overflow-hidden flex items-center justify-center">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-12 h-12 text-dark-400" />
                )}
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
                  className="btn-secondary cursor-pointer inline-flex items-center gap-2 text-sm"
                >
                  <Upload className="w-4 h-4" />
                  Bild hochladen
                </label>
                <p className="text-xs text-dark-400 mt-1">Max. 10MB</p>
              </div>
            </div>

            {/* Video Upload */}
            <div>
              <label className="block text-sm font-medium mb-2">Video (optional)</label>
              <div className="w-full h-40 rounded-lg bg-dark-800 overflow-hidden flex items-center justify-center">
                {videoPreview ? (
                  <video src={videoPreview} className="w-full h-full object-cover" controls />
                ) : (
                  <Video className="w-12 h-12 text-dark-400" />
                )}
              </div>
              <div className="mt-3">
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoChange}
                  disabled={uploading}
                  className="hidden"
                  id="video-upload"
                />
                <label
                  htmlFor="video-upload"
                  className="btn-secondary cursor-pointer inline-flex items-center gap-2 text-sm"
                >
                  <Upload className="w-4 h-4" />
                  Video hochladen
                </label>
                <p className="text-xs text-dark-400 mt-1">Max. 100MB</p>
              </div>
            </div>
          </div>

          {/* External Link */}
          <div>
            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
              <LinkIcon size={16} />
              Externer Link (optional)
            </label>
            <input
              type="text"
              value={externalLink}
              onChange={(e) => setExternalLink(e.target.value)}
              disabled={uploading}
              placeholder="example.com oder https://example.com"
              className="input w-full disabled:opacity-50"
            />
            <p className="text-sm text-dark-400 mt-1">Link zu einer externen Webseite (https:// wird automatisch hinzugefügt)</p>
          </div>

          {/* Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <MapPin size={16} />
                Ort (optional)
              </label>
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
              <label className="block text-sm font-medium mb-2">Google Maps Link (optional)</label>
              <input
                type="text"
                value={locationUrl}
                onChange={(e) => setLocationUrl(e.target.value)}
                disabled={uploading}
                placeholder="maps.google.com/... oder https://..."
                className="input w-full disabled:opacity-50"
              />
              <p className="text-xs text-dark-400 mt-1">https:// wird automatisch hinzugefügt</p>
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
              disabled={uploading}
              className="btn-secondary flex-1 disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={uploading || !title.trim() || !description.trim()}
              className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Wird gespeichert...' : mode === 'create' ? 'Veröffentlichen' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
