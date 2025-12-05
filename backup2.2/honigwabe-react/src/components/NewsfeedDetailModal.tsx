import { X, ExternalLink, MapPin, Image as ImageIcon, Video } from 'lucide-react';
import { NewsfeedPost } from '../services/newsfeed.service';

interface NewsfeedDetailModalProps {
  post: NewsfeedPost | null;
  isOpen: boolean;
  onClose: () => void;
}

export function NewsfeedDetailModal({ post, isOpen, onClose }: NewsfeedDetailModalProps) {
  if (!isOpen || !post) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div 
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-dark-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-dark-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-dark-900/80 hover:bg-dark-800 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Media */}
          {post.videoUrl ? (
            <div className="w-full overflow-hidden rounded-t-lg bg-black">
              <video 
                src={post.videoUrl} 
                controls 
                className="w-full max-h-[500px] object-contain"
              />
            </div>
          ) : post.imageUrl ? (
            <div className="w-full overflow-hidden rounded-t-lg">
              <img 
                src={post.imageUrl} 
                alt={post.title} 
                className="w-full max-h-[500px] object-contain bg-dark-800"
              />
            </div>
          ) : null}
        </div>

        {/* Content */}
        <div className="p-6 md:p-8">
          {/* Title */}
          <h2 className="text-3xl md:text-4xl font-bold mb-4 glow-text">
            {post.title}
          </h2>

          {/* Date */}
          <p className="text-sm text-dark-400 mb-6">
            {formatDate(post.createdAt)}
          </p>

          {/* Description */}
          <div className="mb-6">
            <p className="text-dark-300 whitespace-pre-wrap leading-relaxed text-lg">
              {post.description}
            </p>
          </div>

          {/* Footer Info */}
          {(post.location || post.externalLink) && (
            <div className="flex flex-wrap gap-4 pt-6 border-t border-dark-800">
              {/* Location */}
              {post.location && (
                <div className="flex items-center gap-2 p-3 bg-dark-800 rounded-lg">
                  <MapPin size={20} className="text-primary-400" />
                  {post.locationUrl ? (
                    <a
                      href={post.locationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary-400 transition-colors font-medium"
                    >
                      {post.location}
                    </a>
                  ) : (
                    <span className="font-medium">{post.location}</span>
                  )}
                </div>
              )}

              {/* External Link */}
              {post.externalLink && (
                <a
                  href={post.externalLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors font-medium"
                >
                  <ExternalLink size={20} />
                  Mehr erfahren
                </a>
              )}
            </div>
          )}

          {/* Media Indicators */}
          <div className="flex items-center gap-3 mt-6 text-dark-500 text-sm">
            {post.imageUrl && (
              <div className="flex items-center gap-1">
                <ImageIcon size={16} />
                <span>Bild</span>
              </div>
            )}
            {post.videoUrl && (
              <div className="flex items-center gap-1">
                <Video size={16} />
                <span>Video</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
