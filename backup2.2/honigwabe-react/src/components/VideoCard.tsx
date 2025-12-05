import { Video } from '../services/video.service';
import { useAdmin } from '../hooks/useAdmin';
import { Pencil, Trash2, Play, Eye } from 'lucide-react';

interface VideoCardProps {
  video: Video;
  onEdit?: (video: Video) => void;
  onDelete?: (video: Video) => void;
  onClick?: (video: Video) => void;
}

export function VideoCard({ video, onEdit, onDelete, onClick }: VideoCardProps) {
  const { isAdmin } = useAdmin();
  
  // Debug logging
  console.log('VideoCard render:', {
    title: video.title,
    thumbnailKey: video.thumbnailKey,
    thumbnailUrl: video.thumbnailUrl,
    hasThumbnail: !!video.thumbnailUrl
  });

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatViews = (views: number) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views.toString();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Heute';
    if (diffDays === 1) return 'Gestern';
    if (diffDays < 7) return `vor ${diffDays} Tagen`;
    if (diffDays < 30) return `vor ${Math.floor(diffDays / 7)} Wochen`;
    if (diffDays < 365) return `vor ${Math.floor(diffDays / 30)} Monaten`;
    return `vor ${Math.floor(diffDays / 365)} Jahren`;
  };

  return (
    <div className="card group relative overflow-hidden hover:border-primary-600 hover:shadow-lg hover:shadow-primary-500/20 transition-all">
      {/* Thumbnail */}
      <div 
        className="relative aspect-video bg-dark-800 cursor-pointer"
        onClick={() => onClick?.(video)}
      >
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              console.error('Thumbnail load error:', video.thumbnailUrl);
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.parentElement?.querySelector('.fallback-icon');
              if (fallback) {
                fallback.classList.remove('hidden');
              }
            }}
          />
        ) : null}
        <div className={`absolute inset-0 bg-gradient-to-br from-primary-900/20 to-dark-900 flex items-center justify-center ${video.thumbnailUrl ? 'hidden fallback-icon' : ''}`}>
          <Play className="w-16 h-16 text-dark-600" />
        </div>
        
        {/* Duration Badge */}
        {video.duration > 0 && (
          <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-xs font-medium">
            {formatDuration(video.duration)}
          </div>
        )}

        {/* Play Overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <Play className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Draft Badge */}
        {video.status === 'draft' && (
          <div className="absolute top-2 left-2 bg-primary-600 text-white px-2 py-1 rounded text-xs font-bold">
            ENTWURF
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-white line-clamp-2 mb-2">
          {video.title}
        </h3>
        
        {video.description && (
          <p className="text-sm text-dark-400 line-clamp-2 mb-3">
            {video.description}
          </p>
        )}

        <div className="flex items-center justify-between text-sm text-dark-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              {formatViews(video.views)}
            </span>
            <span>{formatDate(video.uploadedAt)}</span>
          </div>

          {video.category && (
            <span className="text-primary-400 text-xs font-medium">
              {video.category}
            </span>
          )}
        </div>

        {/* Admin Actions */}
        {isAdmin && (
          <div className="flex gap-2 mt-3 pt-3 border-t border-dark-800">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(video);
              }}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 hover:bg-primary-700 rounded text-sm font-medium transition-colors"
            >
              <Pencil className="w-4 h-4" />
              Bearbeiten
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(video);
              }}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Löschen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
