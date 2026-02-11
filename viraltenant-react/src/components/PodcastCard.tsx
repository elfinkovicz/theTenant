import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Edit, Trash2, Users, Twitter, Instagram, Youtube, Twitch, Linkedin, Facebook, Globe, Lock, ChevronDown, ChevronUp, Loader2, Volume2, VolumeX } from 'lucide-react';
import { Podcast } from '../services/podcast.service';
import { useAdmin } from '../hooks/useAdmin';
import { usePremium } from '../hooks/usePremium';
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

interface PodcastCardProps {
  podcast: Podcast;
  onEdit?: (podcast: Podcast) => void;
  onDelete?: (podcast: Podcast) => void;
}

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

export function PodcastCard({ podcast, onEdit, onDelete }: PodcastCardProps) {
  const { isAdmin } = useAdmin();
  const { isPremium } = usePremium();
  const { isAuthenticated } = useAuthStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(podcast.duration || 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isLoadingWaveform, setIsLoadingWaveform] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // User hat Zugang wenn: nicht exklusiv ODER (eingeloggt UND (Premium ODER Admin))
  const hasAccess = !podcast.isExclusive || (isAuthenticated && (isPremium || isAdmin));
  const isLocked = podcast.isExclusive && !hasAccess;

  const handleLockedClick = () => {
    if (!isAuthenticated) {
      // Nicht eingeloggt -> Login
      const hostname = window.location.hostname;
      const parts = hostname.split('.');
      const subdomain = parts.length >= 3 && parts[0] !== 'www' ? parts[0] : 'platform';
      window.location.href = `https://${subdomain}.viraltenant.com/login`;
    } else {
      // Eingeloggt aber kein Premium -> Exclusive-Seite
      window.location.href = '/exclusive';
    }
  };

  // Generate waveform (300 bars)
  useEffect(() => {
    if (!podcast.audioUrl) return;

    const generateWaveform = async () => {
      setIsLoadingWaveform(true);
      try {
        const response = await fetch(podcast.audioUrl!);
        const arrayBuffer = await response.arrayBuffer();
        
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;
        
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const channelData = audioBuffer.getChannelData(0);
        
        const samples = 300;
        const blockSize = Math.floor(channelData.length / samples);
        const waveform: number[] = [];
        
        for (let i = 0; i < samples; i++) {
          let sum = 0;
          let max = 0;
          for (let j = 0; j < blockSize; j++) {
            const val = Math.abs(channelData[i * blockSize + j]);
            sum += val;
            if (val > max) max = val;
          }
          const avg = sum / blockSize;
          const combined = (avg * 0.3 + max * 0.7);
          const normalized = Math.pow(Math.min(1, combined * 5), 0.8);
          waveform.push(8 + normalized * 92);
        }
        
        setWaveformData(waveform);
        if (audioContext.state !== 'closed') {
          await audioContext.close();
        }
        audioContextRef.current = null;
      } catch (error) {
        console.error('Error generating waveform:', error);
        const fallback = Array.from({ length: 300 }, (_, i) => {
          const base = 15 + Math.sin(i * 0.05) * 25;
          return base + Math.random() * 45;
        });
        setWaveformData(fallback);
      } finally {
        setIsLoadingWaveform(false);
      }
    };

    generateWaveform();

    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [podcast.audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (isLocked) {
      handleLockedClick();
      return;
    }
    
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isLocked) return;
    const audio = audioRef.current;
    const progress = progressRef.current;
    if (!audio || !progress) return;

    const rect = progress.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    audio.currentTime = percentage * duration;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume || 0.5;
        setIsMuted(false);
      } else {
        audioRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const getGuestLinks = (guest: any): { url: string; platform: string }[] => {
    const links: { url: string; platform: string }[] = [];
    
    if (guest.socials) {
      Object.entries(guest.socials).forEach(([_, url]) => {
        if (url && typeof url === 'string') {
          links.push({ url, platform: detectPlatform(url) });
        }
      });
    }
    
    if (guest.links && Array.isArray(guest.links)) {
      guest.links.forEach((url: string) => {
        if (url) links.push({ url, platform: detectPlatform(url) });
      });
    }
    
    if (guest.link) {
      links.push({ url: guest.link, platform: detectPlatform(guest.link) });
    }
    
    return links.slice(0, 7);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={togglePlay}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer ${
        podcast.isExclusive 
          ? 'shadow-[0_0_40px_rgba(234,179,8,0.6),0_0_80px_rgba(234,179,8,0.3)]' 
          : ''
      }`}
      style={{ 
        background: `linear-gradient(135deg, 
          rgb(var(--color-primary) / 0.15) 0%, 
          rgb(var(--color-card-background)) 50%, 
          rgb(var(--color-primary) / 0.1) 100%)`,
        border: '2px solid',
        borderColor: podcast.isExclusive 
          ? 'rgba(234, 179, 8, 0.5)' 
          : `rgb(var(--color-primary) / 0.4)`,
        boxShadow: podcast.isExclusive 
          ? '0 0 40px rgba(234,179,8,0.6), 0 0 80px rgba(234,179,8,0.3)'
          : isPlaying 
            ? `0 0 40px rgb(var(--color-primary) / 0.8), 
               0 0 80px rgb(var(--color-primary) / 0.5)` 
            : 'none'
      }}
    >
      <audio ref={audioRef} src={isLocked ? undefined : podcast.audioUrl} preload="metadata" />
      
      {/* Exclusive Badge - immer sichtbar für eingeloggte und nicht-eingeloggte User */}
      {podcast.isExclusive && (
        <div className="absolute top-0 left-0 z-30 bg-gradient-to-r from-yellow-500 to-amber-500 text-black px-3 py-1 rounded-br-xl text-xs font-bold flex items-center gap-1.5 shadow-lg">
          <Lock size={12} fill="currentColor" />
          Exklusiv
        </div>
      )}
      
      {/* Exclusive Content Lock Overlay */}
      {isLocked && (
        <div 
          className="absolute inset-0 z-20 bg-black/80 flex items-center justify-center cursor-pointer"
          onClick={handleLockedClick}
        >
          <div className="flex flex-col items-center gap-2">
            <Lock className="w-10 h-10 text-yellow-400" />
            <p className="text-sm font-medium text-white">
              {isAuthenticated ? 'Nur für Premium-Mitglieder' : 'Nur für Mitglieder'}
            </p>
            <p className="text-xs text-dark-400">
              {isAuthenticated ? 'Klicke um Mitglied zu werden' : 'Klicke zum Einloggen'}
            </p>
          </div>
        </div>
      )}
      
      {/* Main Container - Height expands when description is expanded */}
      <div className="flex flex-row" style={{ minHeight: '230px' }}>
        {/* Left: Thumbnail - fixed size 230px */}
        <div className="relative flex-shrink-0" style={{ width: '230px', minHeight: '230px' }}>
          {podcast.thumbnailUrl ? (
            <img
              src={podcast.thumbnailUrl}
              alt={podcast.title}
              className={`w-full h-full object-cover ${isLocked ? 'blur-sm' : ''}`}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/50 to-dark-900">
              <span className="text-5xl">🎙️</span>
            </div>
          )}
          
          {/* Small Play/Pause indicator - bottom left, appears on hover or when playing */}
          <div 
            className={`absolute bottom-2 left-2 transition-all duration-200 ${
              isHovered || isPlaying ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
            }`}
          >
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm"
              style={{ 
                background: isLocked 
                  ? 'rgb(80 80 80 / 0.8)' 
                  : 'rgb(var(--color-primary) / 0.9)',
              }}
            >
              {isLocked ? (
                <Lock className="w-3.5 h-3.5 text-white/70" />
              ) : isPlaying ? (
                <Pause className="w-3.5 h-3.5 text-white" />
              ) : (
                <Play className="w-3.5 h-3.5 text-white ml-0.5" />
              )}
            </div>
          </div>
          
          {/* Volume Control - only visible when playing */}
          {isPlaying && !isLocked && (
            <div 
              className="absolute bottom-2 left-12 flex items-center gap-2 bg-black/70 rounded-lg px-2 py-1.5 backdrop-blur-sm"
              style={{ width: 'calc(230px - 48px - 16px)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                className="p-1 hover:bg-white/10 rounded transition-colors flex-shrink-0"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-white" />
                ) : (
                  <Volume2 className="w-4 h-4 text-white" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                onClick={(e) => e.stopPropagation()}
                className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
                style={{
                  background: `linear-gradient(to right, rgb(var(--color-primary)) ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.3) ${(isMuted ? 0 : volume) * 100}%)`,
                  maxWidth: '100px'
                }}
              />
            </div>
          )}
        </div>

        {/* Right: Content */}
        <div className="flex-1 p-4 min-w-0 flex flex-col gap-3">
          {/* Header: Title + Admin */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold truncate text-white">{podcast.title}</h3>
              <div className="flex items-center gap-2 text-xs mt-0.5 text-gray-400">
                <span>{new Date(podcast.uploadedAt).toLocaleDateString('de-DE')}</span>
                <span>•</span>
                <span>{formatTime(duration)}</span>
                {podcast.category && (
                  <>
                    <span>•</span>
                    <span 
                      className="px-2 py-0.5 rounded text-xs"
                      style={{ 
                        backgroundColor: 'rgb(var(--color-primary) / 0.2)',
                        color: 'rgb(var(--color-primary))'
                      }}
                    >
                      {podcast.category}
                    </span>
                  </>
                )}
              </div>
            </div>
            
            {isAdmin && (
              <div className="flex gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit?.(podcast); }}
                  className="p-2 rounded-lg bg-dark-800 transition-colors"
                  style={{ '--hover-bg': 'rgb(var(--color-primary))' } as React.CSSProperties}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(var(--color-primary))'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete?.(podcast); }}
                  className="p-2 rounded-lg bg-dark-800 hover:bg-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Waveform - 300 bars */}
          <div 
            ref={progressRef}
            onClick={(e) => { e.stopPropagation(); handleProgressClick(e); }}
            className="relative h-16 cursor-pointer flex items-end bg-black/20 rounded-lg px-1"
            style={{ gap: '1px' }}
          >
            {isLoadingWaveform ? (
              Array.from({ length: 150 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm animate-pulse"
                  style={{ 
                    height: '40%',
                    backgroundColor: 'rgb(120 120 120 / 0.3)'
                  }}
                />
              ))
            ) : (
              waveformData.map((height, i) => {
                const barProgress = (i / waveformData.length) * 100;
                const isActive = barProgress <= progress;
                
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t-sm transition-all duration-75"
                    style={{
                      height: `${height}%`,
                      minHeight: '8px',
                      background: isActive 
                        ? `linear-gradient(to top, 
                            rgb(var(--color-primary)) 0%, 
                            rgb(var(--color-secondary)) 100%)`
                        : `linear-gradient(to top, 
                            rgb(120 120 120 / 0.3) 0%, 
                            rgb(120 120 120 / 0.5) 50%, 
                            rgb(120 120 120 / 0.3) 100%)`,
                      boxShadow: isActive && isPlaying 
                        ? `0 0 10px rgb(var(--color-primary)), 0 -3px 15px rgb(var(--color-secondary) / 0.8)` 
                        : 'none',
                      filter: isActive ? 'brightness(1.3) saturate(1.2)' : 'none'
                    }}
                  />
                );
              })
            )}
            
            {/* Time overlays */}
            <div 
              className="absolute bottom-0 left-0 text-xs font-semibold px-1.5 py-0.5 rounded bg-black/80"
              style={{ color: 'rgb(var(--color-primary))' }}
            >
              {formatTime(currentTime)}
            </div>
            <div className="absolute bottom-0 right-0 text-xs px-1.5 py-0.5 rounded bg-black/80 text-gray-400">
              {formatTime(duration)}
            </div>
          </div>

          {/* Description - expandable */}
          {podcast.description ? (
            <div onClick={(e) => e.stopPropagation()}>
              <p className={`text-sm leading-relaxed text-gray-300 ${!isExpanded ? 'line-clamp-2' : ''}`}>
                {isExpanded ? podcast.description.substring(0, 3000) : podcast.description}
              </p>
              {podcast.description.length > 100 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                  className="flex items-center gap-1 text-sm font-medium mt-1 hover:opacity-80 transition-opacity"
                  style={{ color: 'rgb(var(--color-primary))' }}
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {isExpanded ? 'Weniger' : 'Mehr'}
                </button>
              )}
            </div>
          ) : (podcast as any).aiStatus && (podcast as any).aiStatus !== 'completed' ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: 'rgb(var(--color-primary))' }}>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>KI-Beschreibung wird generiert...</span>
            </div>
          ) : null}

          {/* Guests */}
          {podcast.guests && podcast.guests.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
              <Users className="w-4 h-4 text-gray-400" />
              {podcast.guests.slice(0, 3).map((guest) => {
                const guestLinks = getGuestLinks(guest);
                
                return (
                  <div 
                    key={guest.id} 
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg border"
                    style={{ 
                      backgroundColor: 'rgb(var(--color-secondary))',
                      borderColor: 'rgb(var(--color-border))',
                      color: 'rgb(var(--color-text))'
                    }}
                  >
                    {guest.imageUrl && (
                      <img src={guest.imageUrl} alt={guest.name} className="w-5 h-5 rounded-full object-cover" />
                    )}
                    <span className="text-sm font-semibold">{guest.name}</span>
                    {guestLinks.map((link, idx) => (
                      <a
                        key={idx}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`p-1 rounded transition-colors ${getPlatformColor(link.platform)}`}
                      >
                        {getPlatformIcon(link.platform)}
                      </a>
                    ))}
                  </div>
                );
              })}
              {podcast.guests.length > 3 && (
                <span className="text-sm text-gray-400">+{podcast.guests.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
