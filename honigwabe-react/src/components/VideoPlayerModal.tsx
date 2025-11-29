import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Video } from '../services/video.service';

interface VideoPlayerModalProps {
  isOpen: boolean;
  video: Video | null;
  onClose: () => void;
}

export function VideoPlayerModal({ isOpen, video, onClose }: VideoPlayerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (isOpen && videoRef.current) {
      videoRef.current.play().catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen || !video) return null;

  return (
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">{video.title}</h2>
            {video.description && (
              <p className="text-dark-400 mt-1">{video.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-dark-400 hover:text-white transition-colors"
          >
            <X className="w-8 h-8" />
          </button>
        </div>

        {/* Video Player */}
        <div className="bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            src={video.videoUrl}
            controls
            className="w-full aspect-video"
            poster={video.thumbnailUrl || undefined}
          >
            Dein Browser unterstützt das Video-Tag nicht.
          </video>
        </div>

        {/* Info */}
        <div className="mt-4 flex items-center justify-between text-sm text-dark-400">
          <div className="flex items-center gap-4">
            <span className="text-primary-400">{video.category}</span>
            <span>•</span>
            <span>{video.views} Aufrufe</span>
          </div>
          <span>{new Date(video.uploadedAt).toLocaleDateString('de-DE')}</span>
        </div>
      </div>
    </div>
  );
}
