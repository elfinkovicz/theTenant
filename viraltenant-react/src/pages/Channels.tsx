import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ExternalLink, Youtube, Twitch, Instagram, Facebook, Twitter, Linkedin, Music, Radio, Mic, Video, DollarSign, Gamepad2, MessageCircle, Mail, ShoppingBag, Settings, Send, Hash, Link as LinkIcon } from 'lucide-react'
import { SocialChannel } from '../services/channel.service'
import { prefetchService } from '../services/prefetch.service'
import { ChannelManagementModal } from '../components/ChannelManagementModal'
import { PageBanner } from '../components/PageBanner'
import { useAdmin } from '../hooks/useAdmin'
import { usePageTitle } from '../hooks/usePageTitle'
import { heroService } from '../services/hero.service'

// Crossposting channel definitions for animated neon background
const crosspostingChannels = [
  { id: 'telegram', icon: Send, color: '#3b82f6' },
  { id: 'discord', icon: Hash, color: '#6366f1' },
  { id: 'slack', icon: Hash, color: '#10b981' },
  { id: 'xtwitter', icon: Send, color: '#9ca3af' },
  { id: 'linkedin', icon: LinkIcon, color: '#2563eb' },
  { id: 'email', icon: Mail, color: '#8b5cf6' },
  { id: 'facebook', icon: MessageCircle, color: '#2563eb' },
  { id: 'instagram', icon: MessageCircle, color: '#ec4899' },
  { id: 'whatsapp', icon: MessageCircle, color: '#22c55e' },
  { id: 'signal', icon: MessageCircle, color: '#60a5fa' },
];

// Animation presets for different styles
const animationPresets = {
  subtle: {
    y: [0, -15, 0, 15, 0],
    x: [0, 8, 0, -8, 0],
    rotate: [0, 3, 0, -3, 0],
    scale: [1, 1.02, 1, 0.98, 1],
    baseDuration: 20,
    opacity: 0.05,
  },
  elegant: {
    y: [0, -25, 0, 25, 0],
    x: [0, 12, 0, -12, 0],
    rotate: [0, 5, 0, -5, 0],
    scale: [1, 1.08, 1, 0.95, 1],
    baseDuration: 18,
    opacity: 0.07,
  },
  dynamic: {
    y: [0, -40, 0, 40, 0],
    x: [0, 20, 0, -20, 0],
    rotate: [0, 15, 0, -15, 0],
    scale: [1, 1.15, 1, 0.9, 1],
    baseDuration: 12,
    opacity: 0.1,
  },
  minimal: {
    y: [0, -8, 0, 8, 0],
    x: [0, 4, 0, -4, 0],
    rotate: [0, 1, 0, -1, 0],
    scale: [1, 1.01, 1, 0.99, 1],
    baseDuration: 25,
    opacity: 0.03,
  },
};

// Floating icon component with configurable animation style
const FloatingIcon = ({ 
  channel, 
  index, 
  animationType = 'elegant' 
}: { 
  channel: typeof crosspostingChannels[0], 
  index: number,
  animationType?: 'subtle' | 'elegant' | 'dynamic' | 'minimal'
}) => {
  const Icon = channel.icon;
  const preset = animationPresets[animationType];
  
  // More varied positions for elegant look
  const positions = [
    { left: '5%', top: '12%', size: 75 },
    { right: '8%', top: '22%', size: 55 },
    { left: '15%', top: '42%', size: 65 },
    { right: '5%', top: '58%', size: 50 },
    { left: '3%', top: '78%', size: 60 },
    { right: '18%', top: '72%', size: 45 },
    { left: '22%', top: '28%', size: 40 },
    { right: '3%', top: '88%', size: 55 },
    { left: '10%', top: '92%', size: 50 },
    { right: '12%', top: '38%', size: 45 },
  ];
  const pos = positions[index % positions.length];
  const duration = preset.baseDuration + (index * 1.5);
  const delay = index * 0.8;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: pos.left,
        right: pos.right,
        top: pos.top,
        opacity: preset.opacity,
        filter: `drop-shadow(0 0 25px ${channel.color}) drop-shadow(0 0 50px ${channel.color})`,
      }}
      animate={{
        y: preset.y,
        x: preset.x,
        rotate: preset.rotate,
        scale: preset.scale,
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      <Icon size={pos.size} style={{ color: channel.color }} />
    </motion.div>
  );
};

// Elegant floating orbs for additional ambiance
const FloatingOrb = ({ 
  index, 
  animationType = 'elegant' 
}: { 
  index: number,
  animationType?: 'subtle' | 'elegant' | 'dynamic' | 'minimal'
}) => {
  const preset = animationPresets[animationType];
  const colors = ['#8b5cf6', '#06b6d4', '#ec4899', '#10b981', '#f59e0b'];
  const color = colors[index % colors.length];
  
  const positions = [
    { left: '10%', top: '20%', size: 150 },
    { right: '15%', top: '35%', size: 120 },
    { left: '5%', top: '60%', size: 180 },
    { right: '8%', top: '75%', size: 100 },
    { left: '25%', top: '85%', size: 130 },
  ];
  const pos = positions[index % positions.length];
  const duration = preset.baseDuration + 10 + (index * 3);
  const delay = index * 1.2;

  return (
    <motion.div
      className="absolute rounded-full pointer-events-none blur-3xl"
      style={{
        left: pos.left,
        right: pos.right,
        top: pos.top,
        width: pos.size,
        height: pos.size,
        background: `radial-gradient(circle, ${color}20 0%, transparent 70%)`,
        opacity: preset.opacity * 3,
      }}
      animate={{
        y: preset.y.map(v => v * 2),
        x: preset.x.map(v => v * 1.5),
        scale: [1, 1.2, 1, 0.9, 1],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
};

// Custom Platform Icons as SVG components
const TikTokIcon = ({ size = 24 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
)

const SpotifyIcon = ({ size = 24 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
)

const DiscordIcon = ({ size = 24 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
)

// Function to get the appropriate icon for each platform
const getPlatformIcon = (iconType: string, size = 24) => {
  const iconProps = { size, strokeWidth: 1.5 }
  
  switch (iconType) {
    case 'youtube': return <Youtube {...iconProps} />
    case 'twitch': return <Twitch {...iconProps} />
    case 'instagram': return <Instagram {...iconProps} />
    case 'facebook': return <Facebook {...iconProps} />
    case 'twitter': return <Twitter {...iconProps} />
    case 'linkedin': return <Linkedin {...iconProps} />
    case 'tiktok': return <TikTokIcon size={size} />
    case 'spotify': return <SpotifyIcon size={size} />
    case 'discord': return <DiscordIcon size={size} />
    case 'music': return <Music {...iconProps} />
    case 'radio': return <Radio {...iconProps} />
    case 'mic': return <Mic {...iconProps} />
    case 'video': return <Video {...iconProps} />
    case 'dollar': return <DollarSign {...iconProps} />
    case 'gamepad': return <Gamepad2 {...iconProps} />
    case 'message': return <MessageCircle {...iconProps} />
    case 'mail': return <Mail {...iconProps} />
    case 'shopping': return <ShoppingBag {...iconProps} />
    default: return <Music {...iconProps} />
  }
}

export const Channels = () => {
  const { title: pageTitle, subtitle: pageSubtitle } = usePageTitle('/channels')
  const [channels, setChannels] = useState<SocialChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { isAdmin } = useAdmin()
  const [backgroundAnimationsEnabled, setBackgroundAnimationsEnabled] = useState(true)
  const [animationType, setAnimationType] = useState<'subtle' | 'elegant' | 'dynamic' | 'minimal'>('elegant')

  useEffect(() => {
    loadChannels()
    loadAnimationSettings()
    
    // Listen for OAuth channel updates from popup windows
    const handleOAuthSuccess = (event: MessageEvent) => {
      if (event.data?.type?.includes('oauth-success') || event.data?.type === 'channel-updated') {
        console.log('OAuth success detected, reloading channels...')
        // Invalidate cache and reload
        prefetchService.invalidate('channels')
        loadChannels()
      }
    }
    
    // Listen for storage changes (when OAuth popup updates channels)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'channels-updated') {
        console.log('Channels updated in another tab, reloading...')
        prefetchService.invalidate('channels')
        loadChannels()
      }
    }
    
    window.addEventListener('message', handleOAuthSuccess)
    window.addEventListener('storage', handleStorageChange)
    
    // Also check for focus to reload when user returns from OAuth popup
    const handleFocus = () => {
      // Small delay to allow OAuth popup to finish saving
      setTimeout(() => {
        prefetchService.invalidate('channels')
        loadChannels()
      }, 500)
    }
    window.addEventListener('focus', handleFocus)
    
    return () => {
      window.removeEventListener('message', handleOAuthSuccess)
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  const loadAnimationSettings = async () => {
    try {
      // Load from backend via heroService (tenant-specific)
      const heroContent = await heroService.getHeroContent()
      if (heroContent.designSettings?.animations) {
        setBackgroundAnimationsEnabled(heroContent.designSettings.animations.backgroundAnimations !== false)
        setAnimationType(heroContent.designSettings.animations.backgroundAnimationType || 'elegant')
      }
    } catch (error) {
      console.error('Error loading animation settings:', error)
      // Fallback: try localStorage cache
      try {
        const cached = localStorage.getItem('heroContent')
        if (cached) {
          const hero = JSON.parse(cached)
          if (hero.designSettings?.animations) {
            setBackgroundAnimationsEnabled(hero.designSettings.animations.backgroundAnimations !== false)
            setAnimationType(hero.designSettings.animations.backgroundAnimationType || 'elegant')
          }
        }
      } catch (e) {
        // Use defaults
      }
    }
  }

  const loadChannels = async () => {
    try {
      // Use prefetch cache if available
      const result = await prefetchService.getChannels()
      const channels = Array.isArray(result.channels) ? result.channels : []
      
      if (channels.length === 0) {
        setChannels(getDefaultChannels())
      } else {
        setChannels(channels)
      }
    } catch (error) {
      console.error('Failed to load channels:', error)
      setChannels(getDefaultChannels())
    } finally {
      setLoading(false)
    }
  }

  const getDefaultChannels = (): SocialChannel[] => [
    { id: 'youtube', name: '@YourChannel', platform: 'YouTube', url: 'https://youtube.com/@yourchannel', followers: '', description: 'Videos & Live Streams', color: '#FF0000', iconType: 'youtube', category: 'Video', enabled: true },
    { id: 'instagram', name: '@yourchannel', platform: 'Instagram', url: 'https://instagram.com/yourchannel', followers: '', description: 'Photos & Reels', color: '#E4405F', iconType: 'instagram', category: 'Social', enabled: true },
    { id: 'tiktok', name: '@yourchannel', platform: 'TikTok', url: 'https://tiktok.com/@yourchannel', followers: '', description: 'Short Videos', color: '#ff0050', iconType: 'tiktok', category: 'Social', enabled: true },
    { id: 'twitter', name: '@yourchannel', platform: 'X (Twitter)', url: 'https://x.com/yourchannel', followers: '', description: 'News & Updates', color: '#1DA1F2', iconType: 'twitter', category: 'Social', enabled: true },
    { id: 'twitch', name: 'YourChannel', platform: 'Twitch', url: 'https://twitch.tv/yourchannel', followers: '', description: 'Live Streams', color: '#9146FF', iconType: 'twitch', category: 'Video', enabled: true },
    { id: 'spotify', name: 'Your Artist', platform: 'Spotify', url: 'https://open.spotify.com/artist/yourchannel', followers: '', description: 'Music & Podcasts', color: '#1DB954', iconType: 'spotify', category: 'Music', enabled: true },
    { id: 'discord', name: 'Community', platform: 'Discord', url: 'https://discord.gg/yourchannel', followers: '', description: 'Join the Community', color: '#5865F2', iconType: 'discord', category: 'Community', enabled: true },
    { id: 'facebook', name: 'Your Page', platform: 'Facebook', url: 'https://facebook.com/yourchannel', followers: '', description: 'Community & Updates', color: '#1877F2', iconType: 'facebook', category: 'Social', enabled: true },
    { id: 'linkedin', name: 'Your Name', platform: 'LinkedIn', url: 'https://linkedin.com/in/yourchannel', followers: '', description: 'Professional Network', color: '#0A66C2', iconType: 'linkedin', category: 'Social', enabled: true },
  ]

  // Filter enabled channels
  const visibleChannels = Array.isArray(channels) 
    ? (isAdmin ? channels : channels.filter(c => c.enabled)) 
    : []

  return (
    <div className="min-h-screen relative">
      {/* Animated Neon Background - conditionally rendered */}
      {backgroundAnimationsEnabled && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          {/* Floating Orbs for elegant ambiance */}
          {[0, 1, 2, 3, 4].map((index) => (
            <FloatingOrb key={`orb-${index}`} index={index} animationType={animationType} />
          ))}
          {/* Floating Icons */}
          {crosspostingChannels.map((channel, index) => (
            <FloatingIcon key={channel.id} channel={channel} index={index} animationType={animationType} />
          ))}
        </div>
      )}

      {/* Page Banner */}
      <PageBanner pageId="channels">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold mb-2" style={{ color: 'rgb(var(--color-text))' }}>
            <span className="glow-text">{pageTitle}</span>
          </h1>
          <p className="text-lg" style={{ color: 'rgb(var(--color-text-secondary))' }}>
            {pageSubtitle}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Settings size={20} />
            Optionen
          </button>
        )}
      </PageBanner>

      {/* Linktree Style Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-lg mx-auto">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleChannels.map((channel, index) => (
                <motion.a
                  key={channel.id}
                  href={channel.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="group block w-full"
                >
                  <div 
                    className="relative flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-300 hover:shadow-lg"
                    style={{ 
                      borderColor: `${channel.color}40`,
                      backgroundColor: `${channel.color}10`,
                    }}
                  >
                    {/* Icon */}
                    <div 
                      className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                      style={{ 
                        backgroundColor: channel.color,
                        color: 'rgb(var(--color-text))',
                        boxShadow: `0 4px 14px ${channel.color}40`
                      }}
                    >
                      {getPlatformIcon(channel.iconType, 24)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg text-white group-hover:text-primary-400 transition-colors">
                        {channel.platform}
                      </h3>
                      <p className="text-dark-400 text-sm truncate">
                        {channel.name}
                      </p>
                    </div>

                    {/* Arrow */}
                    <ExternalLink 
                      size={20} 
                      className="flex-shrink-0 text-dark-500 group-hover:text-primary-400 transition-colors"
                    />

                    {/* Hover Glow Effect */}
                    <div 
                      className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                      style={{ 
                        boxShadow: `0 0 30px ${channel.color}30`,
                      }}
                    />
                  </div>
                </motion.a>
              ))}

              {visibleChannels.length === 0 && !loading && (
                <div className="text-center py-12 text-dark-400">
                  <p>Keine Channels konfiguriert.</p>
                  {isAdmin && (
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="btn-primary mt-4"
                    >
                      Channels hinzufügen
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <ChannelManagementModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadChannels}
        channels={channels}
      />
    </div>
  )
}
