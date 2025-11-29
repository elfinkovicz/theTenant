import { useState } from 'react';
import { X, Upload, Film, Image as ImageIcon } from 'lucide-react';
import { videoService } from '../services/video.service';

interface VideoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function VideoUploadModal({ isOpen, onClose, onSuccess }: VideoUploadModalProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Gaming');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');

  const categories = ['Gaming', 'Tutorials', 'Vlogs', 'Reviews', 'Highlights', 'Sonstiges'];

  if (!isOpen) return null;

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        setError('Bitte wähle eine Video-Datei aus');
        return;
      }
      if (file.size > 500 * 1024 * 1024) { // 500MB limit
        setError('Video ist zu groß (max. 500MB)');
        return;
      }
      setVideoFile(file);
      setError('');
      
      // Auto-fill title from filename
      if (!title) {
        const name = file.name.replace(/\.[^/.]+$/, '');
        setTitle(name);
      }
    }
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Bitte wähle ein Bild aus');
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('Thumbnail ist zu groß (max. 5MB)');
        return;
      }
      setThumbnailFile(file);
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!videoFile) {
      setError('Bitte wähle ein Video aus');
      return;
    }
    
    if (!title.trim()) {
      setError('Bitte gib einen Titel ein');
      return;
    }

    setUploading(true);
    setError('');
    setUploadProgress(0);

    try {
      // 1. Generate upload URLs
      const uploadData = await videoService.generateUploadUrl(
        videoFile.name,
        videoFile.type
      );

      // 2. Upload video to S3
      await videoService.uploadToS3(uploadData.uploadUrl, videoFile, (progress) => {
        setUploadProgress(progress * 0.8); // 80% for video upload
      });

      // 3. Upload thumbnail if provided
      let thumbnailKey = uploadData.thumbnailKey;
      if (thumbnailFile) {
        const thumbnailData = await videoService.generateUploadUrl(
          thumbnailFile.name,
          thumbnailFile.type,
          'thumbnail'
        );
        await videoService.uploadToS3(thumbnailData.uploadUrl, thumbnailFile);
        thumbnailKey = thumbnailData.thumbnailKey;
      }

      setUploadProgress(90);

      // 4. Get video duration
      const duration = await videoService.getVideoDuration(videoFile);

      // 5. Create video metadata
      await videoService.createVideo({
        videoId: uploadData.videoId,
        title: title.trim(),
        description: description.trim(),
        category,
        s3Key: uploadData.s3Key,
        thumbnailKey,
        duration,
        fileSize: videoFile.size,
        status: 'published',
      });

      setUploadProgress(100);

      // Success!
      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 500);

    } catch (err: any) {
      console.error('Upload error:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        stack: err.stack
      });
      
      let errorMessage = 'Upload fehlgeschlagen';
      
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.response?.status === 403) {
        errorMessage = 'Keine Admin-Berechtigung. Bitte als Admin einloggen.';
      } else if (err.response?.status === 401) {
        errorMessage = 'Nicht authentifiziert. Bitte neu einloggen.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setVideoFile(null);
      setThumbnailFile(null);
      setTitle('');
      setDescription('');
      setCategory('Gaming');
      setUploadProgress(0);
      setError('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-dark-800">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-800">
          <h2 className="text-2xl font-bold">Video hochladen</h2>
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
          {/* Video Upload */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Video <span className="text-red-500">*</span>
            </label>
            <div className="border-2 border-dashed border-dark-700 rounded-lg p-8 text-center hover:border-primary-600 transition-colors">
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
                className="cursor-pointer flex flex-col items-center gap-3"
              >
                <Film className="w-12 h-12 text-dark-400" />
                {videoFile ? (
                  <div>
                    <p className="font-medium text-primary-400">{videoFile.name}</p>
                    <p className="text-sm text-dark-400">
                      {(videoFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="font-medium">Video auswählen oder hierher ziehen</p>
                    <p className="text-sm text-dark-400">Max. 500MB</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Thumbnail Upload */}
          <div>
            <label className="block text-sm font-medium mb-2">Thumbnail (optional)</label>
            <div className="border-2 border-dashed border-dark-700 rounded-lg p-6 text-center hover:border-primary-600 transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={handleThumbnailChange}
                disabled={uploading}
                className="hidden"
                id="thumbnail-upload"
              />
              <label
                htmlFor="thumbnail-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <ImageIcon className="w-8 h-8 text-dark-400" />
                {thumbnailFile ? (
                  <p className="text-sm text-primary-400">{thumbnailFile.name}</p>
                ) : (
                  <p className="text-sm text-dark-400">Thumbnail hochladen (max. 5MB)</p>
                )}
              </label>
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
              disabled={uploading}
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
              disabled={uploading}
              className="input w-full disabled:opacity-50"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 text-red-500">
              {error}
            </div>
          )}

          {/* Progress */}
          {uploading && (
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-dark-800 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
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
              disabled={uploading || !videoFile || !title.trim()}
              className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Upload className="w-5 h-5" />
              {uploading ? 'Wird hochgeladen...' : 'Hochladen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
