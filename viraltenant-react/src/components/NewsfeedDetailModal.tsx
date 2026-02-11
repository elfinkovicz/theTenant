import { useState } from 'react';
import { X, ExternalLink, MapPin, Image as ImageIcon, Video, Smartphone, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { NewsfeedPost } from '../services/newsfeed.service';

interface NewsfeedDetailModalProps {
  post: NewsfeedPost | null;
  isOpen: boolean;
  onClose: () => void;
}

// Media item type for carousel
type MediaItem = { type: 'video', url: string } | { type: 'image', url: string };

// Combined Media Carousel - Video + all images in one carousel with arrows
// Uses object-contain for full visibility of any aspect ratio (16:9, 9:16, 4:3, 1:1, etc.)
// In detail view we show the FULL image/video without cropping
const MediaCarousel = ({ videoUrl, images, alt }: { videoUrl?: string, images: string[], alt: string }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Build media items array: video first (if exists), then all images
  const mediaItems: MediaItem[] = [];
  if (videoUrl) {
    mediaItems.push({ type: 'video', url: videoUrl });
  }
  images.forEach(url => {
    mediaItems.push({ type: 'image', url });
  });

  const goToPrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev === 0 ? mediaItems.length - 1 : prev - 1));
  };

  const goToNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev === mediaItems.length - 1 ? 0 : prev + 1));
  };

  if (mediaItems.length === 0) return null;
  
  const currentItem = mediaItems[currentIndex];

  return (
    <div className="relative bg-black flex items-center justify-center min-h-[300px] max-h-[60vh]">
      {/* Current Media - object-contain shows full image without cropping */}
      {currentItem.type === 'video' ? (
        <video 
          src={currentItem.url} 
          controls 
          autoPlay
          className="max-w-full max-h-[60vh] object-contain"
        />
      ) : (
        <img 
          src={currentItem.url} 
          alt={`${alt} - ${currentIndex + 1}`} 
          className="max-w-full max-h-[60vh] object-contain"
        />
      )}
      
      {/* Navigation Arrows - only show if more than 1 item */}
      {mediaItems.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/80 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/80 transition-colors"
          >
            <ChevronRight size={24} />
          </button>
          
          {/* Indicator Dots with type icons */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
            {mediaItems.map((item, idx) => (
              <button
                key={idx}
                onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  idx === currentIndex ? 'bg-white text-black' : 'bg-black/60 text-white hover:bg-black/80'
                }`}
              >
                {item.type === 'video' ? <Play size={14} /> : <ImageIcon size={14} />}
              </button>
            ))}
          </div>
          
          {/* Counter */}
          <div className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-black/60 text-sm">
            {currentIndex + 1} / {mediaItems.length}
          </div>
        </>
      )}
    </div>
  );
};

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

  // Short Detail Layout - Two Column
  if (post.isShort) {
    return (
      <div 
        className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <div 
          className="bg-dark-900 rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden border border-dark-800 flex"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Left Column - Content */}
          <div className="flex-1 flex flex-col min-w-0 p-8 overflow-y-auto">
            {/* Close Button - Mobile */}
            <button
              onClick={onClose}
              className="absolute top-4 left-4 z-10 p-2 rounded-lg bg-dark-800 hover:bg-dark-700 transition-colors md:hidden"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-3xl md:text-4xl font-bold glow-text">{post.title}</h2>
                <span className="px-3 py-1 bg-gradient-to-r from-pink-500 to-purple-600 rounded-lg text-sm font-medium">
                  Short
                </span>
              </div>
              <p className="text-dark-400">{formatDate(post.createdAt)}</p>
            </div>

            {/* Description */}
            <div className="flex-1 mb-6">
              <p className="text-dark-300 whitespace-pre-wrap leading-relaxed text-lg">
                {post.description}
              </p>
            </div>

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap mb-6">
                {post.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-800/80"
                  >
                    <span className="text-pink-400">#</span>
                    <span className="text-white">{tag}</span>
                  </span>
                ))}
              </div>
            )}

            {/* Footer Info */}
            {(post.location || post.externalLink) && (
              <div className="flex flex-wrap gap-4 pt-6 border-t border-dark-800">
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
          </div>

          {/* Right Column - Video (9:16) Full Height */}
          <div className="w-[450px] flex-shrink-0 bg-black relative">
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-dark-900/80 hover:bg-dark-800 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {post.videoUrl ? (
              <video 
                src={post.videoUrl} 
                controls 
                autoPlay
                poster={post.imageUrl || undefined}
                className="w-full h-full object-contain"
                style={{ maxHeight: '85vh' }}
              />
            ) : post.imageUrl ? (
              <img 
                src={post.imageUrl} 
                alt={post.title} 
                className="w-full h-full object-contain"
                style={{ maxHeight: '85vh' }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-dark-500">
                <Smartphone size={64} />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Regular Post Layout
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

          {/* Media - Combined Carousel with Video + all Images */}
          {(post.videoUrl || post.imageUrl || (post.imageUrls && post.imageUrls.length > 0)) && (
            <div className="w-full overflow-hidden rounded-t-lg">
              <MediaCarousel 
                videoUrl={post.videoUrl} 
                images={post.imageUrls && post.imageUrls.length > 0 ? post.imageUrls : (post.imageUrl ? [post.imageUrl] : [])} 
                alt={post.title} 
              />
            </div>
          )}
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
            {(post.imageUrl || (post.imageUrls && post.imageUrls.length > 0)) && (
              <div className="flex items-center gap-1">
                <ImageIcon size={16} />
                <span>
                  {post.imageUrls && post.imageUrls.length > 1 
                    ? `${post.imageUrls.length} Bilder` 
                    : 'Bild'}
                </span>
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
