import { motion } from 'framer-motion'
import { ExternalLink, Users, Youtube, Twitch, Instagram, Facebook, Twitter, Linkedin, Music, Radio, Mic, Video, DollarSign, Gamepad2, MessageCircle, Mail, ShoppingBag } from 'lucide-react'

// Custom Platform Icons as SVG components
const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
)

const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
)

const DiscordIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
)

const RedditIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12">
    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
  </svg>
)

const PinterestIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12">
    <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z"/>
  </svg>
)

const SnapchatIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12">
    <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.18-.015h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.15-.055-.225-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-1.107-.435-1.257-.93-1.197-1.273.09-.479.674-.793 1.168-.793.146 0 .27.029.383.074.42.194.789.3 1.104.3.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.727.807l.419-.015h.06z"/>
  </svg>
)

interface SocialChannel {
  id: string
  name: string
  platform: string
  url: string
  followers: string
  description: string
  color: string
  iconType: string
  category: string
}

// Function to get the appropriate icon for each platform
const getPlatformIcon = (iconType: string) => {
  const iconProps = { size: 48, strokeWidth: 1.5 }
  
  switch (iconType) {
    case 'youtube': return <Youtube {...iconProps} />
    case 'twitch': return <Twitch {...iconProps} />
    case 'instagram': return <Instagram {...iconProps} />
    case 'facebook': return <Facebook {...iconProps} />
    case 'twitter': return <Twitter {...iconProps} />
    case 'linkedin': return <Linkedin {...iconProps} />
    case 'tiktok': return <TikTokIcon />
    case 'spotify': return <SpotifyIcon />
    case 'discord': return <DiscordIcon />
    case 'reddit': return <RedditIcon />
    case 'pinterest': return <PinterestIcon />
    case 'snapchat': return <SnapchatIcon />
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
  const socialChannels: SocialChannel[] = [
    // 🎵 Musik-Streaming
    { id: 'spotify', name: '@yourchannel', platform: 'Spotify', url: 'https://open.spotify.com/artist/yourchannel', followers: '50K', description: 'Listen to our music and playlists', color: '#1DB954', iconType: 'spotify', category: 'Musik-Streaming' },
    { id: 'apple-music', name: 'Your Artist', platform: 'Apple Music', url: 'https://music.apple.com/artist/yourchannel', followers: '30K', description: 'Stream on Apple Music', color: '#FA243C', iconType: 'music', category: 'Musik-Streaming' },
    { id: 'youtube-music', name: '@yourchannel', platform: 'YouTube Music', url: 'https://music.youtube.com/channel/yourchannel', followers: '40K', description: 'Music videos and albums', color: '#FF0000', iconType: 'youtube', category: 'Musik-Streaming' },
    { id: 'amazon-music', name: 'Your Artist', platform: 'Amazon Music', url: 'https://music.amazon.com/artists/yourchannel', followers: '20K', description: 'Stream on Amazon Music', color: '#FF9900', iconType: 'music', category: 'Musik-Streaming' },
    { id: 'deezer', name: 'Your Artist', platform: 'Deezer', url: 'https://www.deezer.com/artist/yourchannel', followers: '15K', description: 'Listen on Deezer', color: '#FF0092', iconType: 'music', category: 'Musik-Streaming' },
    { id: 'tidal', name: 'Your Artist', platform: 'Tidal', url: 'https://tidal.com/browse/artist/yourchannel', followers: '10K', description: 'High-quality audio streaming', color: '#000000', iconType: 'music', category: 'Musik-Streaming' },
    { id: 'soundcloud', name: '@yourchannel', platform: 'SoundCloud', url: 'https://soundcloud.com/yourchannel', followers: '60K', description: 'Original tracks and remixes', color: '#FF5500', iconType: 'music', category: 'Musik-Streaming' },
    { id: 'audiomack', name: '@yourchannel', platform: 'Audiomack', url: 'https://audiomack.com/yourchannel', followers: '25K', description: 'Stream and download music', color: '#FFA200', iconType: 'music', category: 'Musik-Streaming' },
    
    // 🎤 Upload & Creator Portale
    { id: 'bandcamp', name: 'yourchannel', platform: 'Bandcamp', url: 'https://yourchannel.bandcamp.com', followers: '8K', description: 'Buy music and merch directly', color: '#629AA9', iconType: 'music', category: 'Upload & Creator Portale' },
    { id: 'reverbnation', name: 'yourchannel', platform: 'ReverbNation', url: 'https://www.reverbnation.com/yourchannel', followers: '12K', description: 'Music promotion and distribution', color: '#E43526', iconType: 'music', category: 'Upload & Creator Portale' },
    
    // 🎙️ Podcast-Plattformen
    { id: 'spotify-podcasts', name: 'Your Podcast', platform: 'Spotify Podcasts', url: 'https://open.spotify.com/show/yourchannel', followers: '35K', description: 'Listen to our podcast', color: '#1DB954', iconType: 'mic', category: 'Podcast-Plattformen' },
    { id: 'apple-podcasts', name: 'Your Podcast', platform: 'Apple Podcasts', url: 'https://podcasts.apple.com/podcast/yourchannel', followers: '28K', description: 'Subscribe on Apple Podcasts', color: '#9933CC', iconType: 'mic', category: 'Podcast-Plattformen' },
    { id: 'google-podcasts', name: 'Your Podcast', platform: 'YouTube Podcasts', url: 'https://podcasts.google.com/feed/yourchannel', followers: '22K', description: 'Listen on YouTube Podcasts', color: '#FF0000', iconType: 'radio', category: 'Podcast-Plattformen' },
    { id: 'amazon-podcasts', name: 'Your Podcast', platform: 'Amazon Podcasts', url: 'https://music.amazon.com/podcasts/yourchannel', followers: '15K', description: 'Stream on Amazon Music', color: '#FF9900', iconType: 'mic', category: 'Podcast-Plattformen' },
    { id: 'stitcher', name: 'Your Podcast', platform: 'Stitcher', url: 'https://www.stitcher.com/podcast/yourchannel', followers: '10K', description: 'Listen on Stitcher', color: '#000000', iconType: 'radio', category: 'Podcast-Plattformen' },
    
    // 🎥 Video & Livestreaming
    { id: 'youtube', name: '@YourChannel', platform: 'YouTube', url: 'https://youtube.com/@yourchannel', followers: '100K', description: 'Subscribe for videos and live streams', color: '#FF0000', iconType: 'youtube', category: 'Video & Livestreaming' },
    { id: 'vimeo', name: 'yourchannel', platform: 'Vimeo', url: 'https://vimeo.com/yourchannel', followers: '15K', description: 'High-quality video content', color: '#1AB7EA', iconType: 'video', category: 'Video & Livestreaming' },
    { id: 'twitch', name: 'YourChannel', platform: 'Twitch', url: 'https://twitch.tv/yourchannel', followers: '50K', description: 'Watch live streams', color: '#9146FF', iconType: 'twitch', category: 'Video & Livestreaming' },
    { id: 'youtube-live', name: '@YourChannel', platform: 'YouTube Live', url: 'https://youtube.com/@yourchannel/live', followers: '100K', description: 'Live streaming on YouTube', color: '#FF0000', iconType: 'youtube', category: 'Video & Livestreaming' },
    { id: 'tiktok-live', name: '@yourchannel', platform: 'TikTok Live', url: 'https://tiktok.com/@yourchannel/live', followers: '200K', description: 'Live broadcasts on TikTok', color: '#000000', iconType: 'tiktok', category: 'Video & Livestreaming' },
    { id: 'kick', name: 'yourchannel', platform: 'Kick', url: 'https://kick.com/yourchannel', followers: '30K', description: 'Live streaming platform', color: '#53FC18', iconType: 'video', category: 'Video & Livestreaming' },
    
    // 📸 Social Media
    { id: 'tiktok', name: '@yourchannel', platform: 'TikTok', url: 'https://tiktok.com/@yourchannel', followers: '200K', description: 'Short videos and trending content', color: '#000000', iconType: 'tiktok', category: 'Social Media' },
    { id: 'instagram', name: '@yourchannel', platform: 'Instagram', url: 'https://instagram.com/yourchannel', followers: '75K', description: 'Photos, Reels and Stories', color: '#E4405F', iconType: 'instagram', category: 'Social Media' },
    { id: 'instagram-reels', name: '@yourchannel', platform: 'Instagram Reels', url: 'https://instagram.com/yourchannel/reels', followers: '75K', description: 'Short-form video content', color: '#E4405F', iconType: 'instagram', category: 'Social Media' },
    { id: 'youtube-shorts', name: '@YourChannel', platform: 'YouTube Shorts', url: 'https://youtube.com/@yourchannel/shorts', followers: '100K', description: 'Short vertical videos', color: '#FF0000', iconType: 'youtube', category: 'Social Media' },
    { id: 'snapchat', name: '@yourchannel', platform: 'Snapchat', url: 'https://snapchat.com/add/yourchannel', followers: '20K', description: 'Daily snaps and Spotlight', color: '#FFFC00', iconType: 'snapchat', category: 'Social Media' },
    { id: 'pinterest', name: '@yourchannel', platform: 'Pinterest', url: 'https://pinterest.com/yourchannel', followers: '40K', description: 'Visual inspiration and ideas', color: '#E60023', iconType: 'pinterest', category: 'Social Media' },
    { id: 'behance', name: 'yourchannel', platform: 'Behance', url: 'https://behance.net/yourchannel', followers: '12K', description: 'Creative portfolio showcase', color: '#1769FF', iconType: 'video', category: 'Social Media' },
    { id: 'facebook', name: 'Your Channel', platform: 'Facebook', url: 'https://facebook.com/yourchannel', followers: '60K', description: 'Community and updates', color: '#1877F2', iconType: 'facebook', category: 'Social Media' },
    { id: 'twitter', name: '@yourchannel', platform: 'X (Twitter)', url: 'https://x.com/yourchannel', followers: '45K', description: 'Latest updates and news', color: '#000000', iconType: 'twitter', category: 'Social Media' },
    { id: 'threads', name: '@yourchannel', platform: 'Threads', url: 'https://threads.net/@yourchannel', followers: '25K', description: 'Text-based conversations', color: '#000000', iconType: 'message', category: 'Social Media' },
    { id: 'linkedin', name: 'Your Name', platform: 'LinkedIn', url: 'https://linkedin.com/in/yourchannel', followers: '10K', description: 'Professional network', color: '#0A66C2', iconType: 'linkedin', category: 'Social Media' },
    { id: 'reddit', name: 'r/yourchannel', platform: 'Reddit', url: 'https://reddit.com/r/yourchannel', followers: '15K', description: 'Community discussions', color: '#FF4500', iconType: 'reddit', category: 'Social Media' },
    
    // 💰 Creator-Monetarisierung
    { id: 'patreon', name: 'yourchannel', platform: 'Patreon', url: 'https://patreon.com/yourchannel', followers: '5K', description: 'Support with monthly subscriptions', color: '#FF424D', iconType: 'dollar', category: 'Creator-Monetarisierung' },
    { id: 'ko-fi', name: 'yourchannel', platform: 'Ko-fi', url: 'https://ko-fi.com/yourchannel', followers: '3K', description: 'Buy me a coffee', color: '#FF5E5B', iconType: 'dollar', category: 'Creator-Monetarisierung' },
    { id: 'buymeacoffee', name: 'yourchannel', platform: 'Buy Me A Coffee', url: 'https://buymeacoffee.com/yourchannel', followers: '2K', description: 'One-time support', color: '#FFDD00', iconType: 'dollar', category: 'Creator-Monetarisierung' },
    { id: 'substack', name: 'yourchannel', platform: 'Substack', url: 'https://yourchannel.substack.com', followers: '8K', description: 'Newsletter and paid content', color: '#FF6719', iconType: 'mail', category: 'Creator-Monetarisierung' },
    { id: 'gumroad', name: 'yourchannel', platform: 'Gumroad', url: 'https://gumroad.com/yourchannel', followers: '4K', description: 'Digital products and courses', color: '#FF90E8', iconType: 'shopping', category: 'Creator-Monetarisierung' },
    
    // 🎮 Gaming & Interactive
    { id: 'steam', name: 'yourchannel', platform: 'Steam', url: 'https://steamcommunity.com/id/yourchannel', followers: '18K', description: 'Gaming content and workshop', color: '#171A21', iconType: 'gamepad', category: 'Gaming & Interactive' },
    { id: 'discord', name: 'Your Server', platform: 'Discord', url: 'https://discord.gg/yourchannel', followers: '25K', description: 'Community chat and voice', color: '#5865F2', iconType: 'discord', category: 'Gaming & Interactive' },
    
    // 🧵 Community & Chat
    { id: 'telegram', name: '@yourchannel', platform: 'Telegram', url: 'https://t.me/yourchannel', followers: '30K', description: 'Exclusive updates and chat', color: '#26A5E4', iconType: 'message', category: 'Community & Chat' },
    { id: 'whatsapp', name: 'Channel', platform: 'WhatsApp Channels', url: 'https://whatsapp.com/channel/yourchannel', followers: '35K', description: 'Direct updates via WhatsApp', color: '#25D366', iconType: 'message', category: 'Community & Chat' },
    
    // 📰 Newsletter & Publishing
    { id: 'medium', name: '@yourchannel', platform: 'Medium', url: 'https://medium.com/@yourchannel', followers: '6K', description: 'Long-form articles and stories', color: '#000000', iconType: 'mail', category: 'Newsletter & Publishing' },
  ]

  // Group channels by category with custom order
  const categoryOrder = [
    'Social Media',
    'Video & Livestreaming',
    'Musik-Streaming',
    'Upload & Creator Portale',
    'Podcast-Plattformen',
    'Creator-Monetarisierung',
    'Gaming & Interactive',
    'Community & Chat',
    'Newsletter & Publishing'
  ]
  
  const channelsByCategory = categoryOrder
    .map(category => ({
      name: category,
      channels: socialChannels.filter(c => c.category === category)
    }))
    .filter(cat => cat.channels.length > 0)

  const categoryIcons: Record<string, string> = {
    'Social Media': '📸',
    'Video & Livestreaming': '🎥',
    'Musik-Streaming': '🎵',
    'Upload & Creator Portale': '🎤',
    'Podcast-Plattformen': '🎙️',
    'Creator-Monetarisierung': '💰',
    'Gaming & Interactive': '🎮',
    'Community & Chat': '🧵',
    'Newsletter & Publishing': '📰'
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="relative py-12 overflow-hidden bg-gradient-to-br from-primary-900/20 via-dark-950 to-dark-950">
        <div className="container mx-auto px-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold mb-2">
              <span className="glow-text">Social Media Channels</span>
            </h1>
            <p className="text-dark-400 text-lg">
              Connect with us on your favorite platforms. Follow, subscribe, and join our community!
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">
        {/* Categories */}
        {channelsByCategory.map((category) => (
          <div
            key={category.name}
            className="mb-12"
          >
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <span className="text-3xl">{categoryIcons[category.name]}</span>
              {category.name}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {category.channels.map((channel) => (
                <motion.a
                  key={channel.id}
                  href={channel.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ y: -5, scale: 1.02 }}
                  className="card group cursor-pointer relative overflow-hidden"
                  style={{
                    borderColor: `${channel.color}20`,
                  }}
                >
                  {/* Color accent bar */}
                  <div 
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{ backgroundColor: channel.color }}
                  />

                  {/* Icon */}
                  <div className="flex items-center justify-between mb-4">
                    <div 
                      className="transition-transform group-hover:scale-110"
                      style={{ 
                        color: channel.color,
                        filter: `drop-shadow(0 0 10px ${channel.color}40)`
                      }}
                    >
                      {getPlatformIcon(channel.iconType)}
                    </div>
                    <ExternalLink 
                      size={20} 
                      className="text-dark-500 group-hover:text-primary-500 transition-colors"
                    />
                  </div>

                  {/* Platform name */}
                  <h3 className="text-xl font-bold mb-1 group-hover:text-primary-400 transition-colors">
                    {channel.platform}
                  </h3>
                  
                  {/* Handle */}
                  <p className="text-dark-400 text-sm mb-3 font-mono">
                    {channel.name}
                  </p>

                  {/* Description */}
                  <p className="text-dark-500 text-sm mb-4 line-clamp-2">
                    {channel.description}
                  </p>

                  {/* Followers */}
                  <div className="flex items-center gap-2 text-sm">
                    <Users size={16} className="text-primary-500" />
                    <span className="text-dark-400">
                      <span className="font-semibold text-white">{channel.followers}</span> followers
                    </span>
                  </div>

                  {/* Hover effect */}
                  <div 
                    className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none"
                    style={{ backgroundColor: channel.color }}
                  />
                </motion.a>
              ))}
            </div>
          </div>
        ))}

        {/* CTA Section */}
        <div className="mt-16 card text-center bg-gradient-to-br from-primary-900/20 to-dark-900">
          <h2 className="text-3xl font-bold mb-4">
            Don't Miss Out!
          </h2>
          <p className="text-dark-400 text-lg mb-6 max-w-2xl mx-auto">
            Follow us on your favorite platforms to stay updated with the latest content, 
            exclusive announcements, and community events.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button className="btn-primary">
              Follow All Channels
            </button>
            <button className="btn-secondary">
              Get Notifications
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
