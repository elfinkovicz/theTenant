import { X, Calendar, Clock, MapPin, Ticket, ExternalLink, Users, Twitter, Instagram, Youtube, Twitch, Linkedin, Facebook, Globe } from 'lucide-react';
import { Event } from '../services/event.service';

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

interface EventDetailModalProps {
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EventDetailModal({ event, isOpen, onClose }: EventDetailModalProps) {
  if (!isOpen || !event) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const isUpcoming = (dateString: string) => {
    return new Date(dateString) >= new Date();
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

          {/* Event Image - 16:9 Format */}
          {event.imageUrl && (
            <div className="w-full aspect-[16/9] overflow-hidden rounded-t-lg">
              <img 
                src={event.imageUrl} 
                alt={event.title} 
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 md:p-8">
          {/* Title */}
          <h2 className="text-3xl md:text-4xl font-bold mb-6 glow-text">
            {event.title}
          </h2>

          {/* Event Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Date */}
            <div className="flex items-start gap-3 p-4 bg-dark-800 rounded-lg">
              <Calendar className="text-primary-400 flex-shrink-0 mt-1" size={24} />
              <div>
                <p className="text-sm text-dark-400 mb-1">Datum</p>
                <p className="font-semibold text-lg">{formatDate(event.eventDate)}</p>
              </div>
            </div>

            {/* Time */}
            {event.eventTime && (
              <div className="flex items-start gap-3 p-4 bg-dark-800 rounded-lg">
                <Clock className="text-primary-400 flex-shrink-0 mt-1" size={24} />
                <div>
                  <p className="text-sm text-dark-400 mb-1">Uhrzeit</p>
                  <p className="font-semibold text-lg">{event.eventTime} Uhr</p>
                </div>
              </div>
            )}

            {/* Location */}
            {event.location && (
              <div className="flex items-start gap-3 p-4 bg-dark-800 rounded-lg md:col-span-2">
                <MapPin className="text-primary-400 flex-shrink-0 mt-1" size={24} />
                <div className="flex-1">
                  <p className="text-sm text-dark-400 mb-1">Ort</p>
                  <p className="font-semibold text-lg mb-2">{event.location}</p>
                  {event.locationUrl && (
                    <a
                      href={event.locationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-primary-400 hover:text-primary-300 transition-colors"
                    >
                      <ExternalLink size={16} />
                      Wegbeschreibung anzeigen
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="mb-6">
            <h3 className="text-xl font-bold mb-3">Beschreibung</h3>
            <p className="text-dark-300 whitespace-pre-wrap leading-relaxed">
              {event.description}
            </p>
          </div>

          {/* Guests */}
          {event.guests && event.guests.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
                <Users size={20} />
                Gäste
              </h3>
              <div className="flex flex-wrap gap-3">
                {event.guests.map((guest) => (
                  <div 
                    key={guest.id} 
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-dark-800"
                  >
                    {guest.imageUrl && (
                      <img src={guest.imageUrl} alt={guest.name} className="w-8 h-8 rounded-full object-cover" />
                    )}
                    <span className="text-white font-medium">{guest.name}</span>
                    {guest.links?.slice(0, 7).map((url, idx) => {
                      const platform = detectPlatform(url);
                      return (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`p-1 rounded bg-dark-700 transition-colors ${getPlatformColor(platform)}`}
                        >
                          {getPlatformIcon(platform)}
                        </a>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ticket Button */}
          {event.ticketUrl && isUpcoming(event.eventDate) && (
            <div className="flex gap-3">
              <a
                href={event.ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary flex-1 flex items-center justify-center gap-2 text-lg py-4"
              >
                <Ticket size={20} />
                Tickets kaufen
              </a>
              <a
                href={event.ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary p-4"
                title="In neuem Tab öffnen"
              >
                <ExternalLink size={20} />
              </a>
            </div>
          )}

          {!isUpcoming(event.eventDate) && (
            <div className="text-center py-4 px-6 bg-dark-800 rounded-lg text-dark-400 text-lg">
              Dieses Event ist bereits vorbei
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
