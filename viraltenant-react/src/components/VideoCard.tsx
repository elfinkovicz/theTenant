import { Video } from '../services/video.service';
import { useAdmin } from '../hooks/useAdmin';
import { usePremium } from '../hooks/usePremium';
import { Pencil, Trash2, Play, Eye, Lock, Users, Twitter, Instagram, Youtube, Twitch, Linkedin, Facebook, Globe } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

// TikTok Icon
const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

// Discord Icon
const DiscordIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

// Spotify Icon
const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

const detectPlatform = (url: string): string => {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) return 'twitter';
  if (lowerUrl.includes('instagram.com')) return 'instagram';
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'youtube';
  if (lowerUrl.includes('twitch.tv')) return 'twitch';
  if (lowerUrl.includes('tiktok.com')) return 'tiktok';
  if (lowerUrl.includes('linkedin.com')) return 'linkedin';
  if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.com')) return 'facebook';
  if (lowerUrl.includes('discord.gg') || lowerUrl.includes('discord.com')) return 'discord';
  if (lowerUrl.includes('spotify.com') || lowerUrl.includes('open.spotify')) return 'spotify';
  return 'website';
};

const getPlatformIcon = (platform: string) => {
  switch (platform) {
    case 'twitter': return <Twitter className="w-3.5 h-3.5" />;
    case 'instagram': return <Instagram className="w-3.5 h-3.5" />;
    case 'youtube': return <Youtube className="w-3.5 h-3.5" />;
    case 'twitch': return <Twitch className="w-3.5 h-3.5" />;
    case 'tiktok': return <TikTokIcon />;
    case 'linkedin': return <Linkedin className="w-3.5 h-3.5" />;
    case 'facebook': return <Facebook className="w-3.5 h-3.5" />;
    case 'discord': return <DiscordIcon />;
    case 'spotify': return <SpotifyIcon />;
    default: return <Globe className="w-3.5 h-3.5" />;
  }
};

const getPlatformColor = (platform: string): string => {
  switch (platform) {
    case 'twitter': return 'hover:bg-sky-500';
    case 'instagram': return 'hover:bg-pink-500';
    case 'youtube': return 'hover:bg-red-600';
    case 'twitch': return 'hover:bg-purple-600';
    case 'tiktok': return 'hover:bg-black';
    case 'linkedin': return 'hover:bg-blue-700';
    case 'facebook': return 'hover:bg-blue-600';
    case 'discord': return 'hover:bg-indigo-600';
    case 'spotify': return 'hover:bg-green-600';
    default: return 'hover:bg-primary-600';
  }
};

interface VideoCardProps {
  video: Video;
  onEdit?: (video: Video) => void;
  onDelete?: (video: Video) => void;
  onClick?: (video: Video) => void;
}

export function VideoCard({ video, onEdit, onDelete, onClick }: VideoCardProps) {
  const { isAdmin } = useAdmin();
  const { isPremium } = usePremium();
  const { isAuthenticated } = useAuthStore();
  
  // User hat Zugang wenn: nicht exklusiv ODER (eingeloggt UND (Premium ODER Admin))
  const hasAccess = !video.isExclusive || (isAuthenticated && (isPremium || isAdmin));
  
  // Debug logging
  console.log('VideoCard render:', {
    title: video.title,
    isExclusive: video.isExclusive,
    isAuthenticated,
    isPremium,
    isAdmin,
    hasAccess,
    thumbnailKey: video.thumbnailKey,
    thumbnailUrl: video.thumbnailUrl,
    hasThumbnail: !!video.thumbnailUrl
  });

  const handleCardClick = () => {
    // If video is exclusive and user doesn't have access
    if (video.isExclusive && !hasAccess) {
      if (!isAuthenticated) {
        // Nicht eingeloggt -> Login
        const hostname = window.location.hostname;
        const parts = hostname.split('.');
        const subdomain = parts.length >= 3 && parts[0] !== 'www' ? parts[0] : 'platform';
        window.location.href = `https://${subdomain}.viraltenant.com/login`;
      } else {
        // Eingeloggt aber kein Premium -> Membership-Seite (TODO: implementieren)
        // Vorerst: Toast oder Modal zeigen
        console.log('User needs premium membership to access this content');
      }
      return;
    }
    onClick?.(video);
  };

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
    <div 
      className={`group relative overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-lg ${
        video.isExclusive 
          ? 'shadow-[0_0_40px_rgba(234,179,8,0.6),0_0_80px_rgba(234,179,8,0.3)]' 
          : ''
      }`}
      style={{
        backgroundColor: 'rgba(var(--color-card-background), 0.9)',
        border: video.isExclusive 
          ? '1px solid rgba(234, 179, 8, 0.5)' 
          : '1px solid rgba(var(--color-primary), 0.3)',
        boxShadow: video.isExclusive 
          ? '0 0 40px rgba(234,179,8,0.6), 0 0 80px rgba(234,179,8,0.3)' 
          : 'none'
      }}
      onMouseEnter={(e) => {
        if (!video.isExclusive) {
          e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(var(--color-primary), 0.2)';
        }
      }}
      onMouseLeave={(e) => {
        if (!video.isExclusive) {
          e.currentTarget.style.boxShadow = 'none';
        }
      }}
    >
      {/* Thumbnail */}
      <div 
        className="relative aspect-video bg-dark-800 cursor-pointer overflow-hidden"
        onClick={handleCardClick}
      >
        {/* Admin Actions - small icon buttons in top right corner */}
        {isAdmin && (
          <div className="absolute top-2 right-2 flex gap-1.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(video);
              }}
              className="p-2 rounded-lg bg-dark-800/90 hover:bg-primary-600 transition-colors backdrop-blur-sm"
              title="Bearbeiten"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(video);
              }}
              className="p-2 rounded-lg bg-dark-800/90 hover:bg-red-600 transition-colors backdrop-blur-sm"
              title="Löschen"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
        
        {/* Exclusive Badge - immer sichtbar für eingeloggte und nicht-eingeloggte User */}
        {video.isExclusive && (
          <div className="absolute -top-1 -left-1 z-20 bg-gradient-to-r from-yellow-500 to-amber-500 text-black px-3 py-1 rounded-br-xl text-xs font-bold flex items-center gap-1.5 shadow-lg">
            <Lock size={12} fill="currentColor" />
            Exklusiv
          </div>
        )}
        
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

        {/* Exclusive Content Lock Overlay */}
        {video.isExclusive && !hasAccess && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="flex flex-col items-center gap-2">
              <Lock className="w-12 h-12 text-yellow-400" />
              <p className="text-xs font-medium text-white">
                {isAuthenticated ? 'Nur für Premium-Mitglieder' : 'Nur für Mitglieder'}
              </p>
            </div>
          </div>
        )}

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
            <span 
              className="px-2 py-0.5 rounded text-xs"
              style={{ 
                backgroundColor: 'rgba(var(--color-primary), 0.2)',
                color: 'rgb(var(--color-primary))'
              }}
            >
              {video.category}
            </span>
          )}
        </div>

        {/* Guests */}
        {video.guests && video.guests.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mt-3">
            <Users className="w-4 h-4 text-dark-400" />
            {video.guests.slice(0, 3).map((guest) => (
              <div 
                key={guest.id} 
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg border"
                style={{ 
                  backgroundColor: 'rgb(var(--color-secondary))',
                  borderColor: 'rgb(var(--color-border))'
                }}
              >
                {guest.imageUrl && (
                  <img src={guest.imageUrl} alt={guest.name} className="w-5 h-5 rounded-full object-cover" />
                )}
                <span className="text-sm font-semibold" style={{ color: 'rgb(var(--color-text))' }}>{guest.name}</span>
                {guest.links?.slice(0, 7).map((url, idx) => {
                  const platform = detectPlatform(url);
                  return (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className={`p-1 rounded transition-colors ${getPlatformColor(platform)}`}
                    >
                      {getPlatformIcon(platform)}
                    </a>
                  );
                })}
              </div>
            ))}
            {video.guests.length > 3 && (
              <span className="text-sm text-dark-400">+{video.guests.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
