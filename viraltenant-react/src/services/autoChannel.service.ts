/**
 * Auto-Channel Service
 * Automatically creates/updates channels on the Channels page after successful OAuth connection
 */

import { channelService, SocialChannel } from './channel.service'

// Platform configurations for auto-channel creation
const PLATFORM_CONFIGS: Record<string, {
  platform: string
  color: string
  iconType: string
  category: string
  urlTemplate: (identifier: string) => string
  description: string
}> = {
  youtube: {
    platform: 'YouTube',
    color: '#FF0000',
    iconType: 'youtube',
    category: 'Video',
    urlTemplate: (channelId) => `https://youtube.com/channel/${channelId}`,
    description: 'Videos & Live Streams'
  },
  instagram: {
    platform: 'Instagram',
    color: '#E4405F',
    iconType: 'instagram',
    category: 'Social',
    urlTemplate: (username) => `https://instagram.com/${username}`,
    description: 'Photos & Reels'
  },
  facebook: {
    platform: 'Facebook',
    color: '#1877F2',
    iconType: 'facebook',
    category: 'Social',
    urlTemplate: (pageId) => `https://facebook.com/${pageId}`,
    description: 'Community & Updates'
  },
  tiktok: {
    platform: 'TikTok',
    color: '#ff0050',
    iconType: 'tiktok',
    category: 'Social',
    urlTemplate: (username) => `https://tiktok.com/@${username}`,
    description: 'Short Videos'
  },
  linkedin: {
    platform: 'LinkedIn',
    color: '#0A66C2',
    iconType: 'linkedin',
    category: 'Social',
    urlTemplate: (profileId) => `https://linkedin.com/in/${profileId}`,
    description: 'Professional Network'
  },
  twitter: {
    platform: 'X (Twitter)',
    color: '#1DA1F2',
    iconType: 'twitter',
    category: 'Social',
    urlTemplate: (username) => `https://x.com/${username}`,
    description: 'News & Updates'
  },
  xtwitter: {
    platform: 'X (Twitter)',
    color: '#000000',
    iconType: 'twitter',
    category: 'Social',
    urlTemplate: (username) => `https://x.com/${username}`,
    description: 'News & Updates'
  },
  threads: {
    platform: 'Threads',
    color: '#000000',
    iconType: 'message',
    category: 'Social',
    urlTemplate: (username) => `https://threads.net/@${username}`,
    description: 'Text Updates'
  },
  twitch: {
    platform: 'Twitch',
    color: '#9146FF',
    iconType: 'twitch',
    category: 'Video',
    urlTemplate: (username) => `https://twitch.tv/${username}`,
    description: 'Live Streams'
  },
  discord: {
    platform: 'Discord',
    color: '#5865F2',
    iconType: 'discord',
    category: 'Community',
    urlTemplate: (inviteCode) => `https://discord.gg/${inviteCode}`,
    description: 'Join the Community'
  },
  slack: {
    platform: 'Slack',
    color: '#4A154B',
    iconType: 'hash',
    category: 'Community',
    urlTemplate: (workspace) => workspace, // Slack uses full URL
    description: 'Team Communication'
  },
  telegram: {
    platform: 'Telegram',
    color: '#0088cc',
    iconType: 'send',
    category: 'Community',
    urlTemplate: (username) => `https://t.me/${username}`,
    description: 'Telegram Channel'
  },
  whatsapp: {
    platform: 'WhatsApp',
    color: '#25D366',
    iconType: 'message',
    category: 'Community',
    urlTemplate: (phone) => `https://wa.me/${phone}`,
    description: 'WhatsApp Channel'
  },
  signal: {
    platform: 'Signal',
    color: '#3A76F0',
    iconType: 'message',
    category: 'Community',
    urlTemplate: (groupLink) => groupLink, // Signal uses full URL
    description: 'Secure Messaging'
  },
  bluesky: {
    platform: 'Bluesky',
    color: '#0085FF',
    iconType: 'cloud',
    category: 'Social',
    urlTemplate: (handle) => `https://bsky.app/profile/${handle}`,
    description: 'Decentralized Social'
  },
  mastodon: {
    platform: 'Mastodon',
    color: '#6364FF',
    iconType: 'globe',
    category: 'Social',
    urlTemplate: (username) => `https://mastodon.social/@${username}`,
    description: 'Federated Social Network'
  },
  snapchat: {
    platform: 'Snapchat',
    color: '#FFFC00',
    iconType: 'message',
    category: 'Social',
    urlTemplate: (username) => `https://snapchat.com/add/${username}`,
    description: 'Stories & Snaps'
  },
  email: {
    platform: 'Newsletter',
    color: '#EA4335',
    iconType: 'mail',
    category: 'Newsletter',
    urlTemplate: (email) => `mailto:${email}`,
    description: 'Email Newsletter'
  }
}

interface OAuthConnectionData {
  platform: string
  accountId?: string
  accountName?: string
  username?: string
  channelId?: string
  channelName?: string
  channelTitle?: string
  pageId?: string
  pageName?: string
  profileUrl?: string
}

class AutoChannelService {
  /**
   * Automatically add or update a channel after successful OAuth connection
   */
  async addOrUpdateChannel(connectionData: OAuthConnectionData): Promise<boolean> {
    try {
      const platformKey = connectionData.platform.toLowerCase().replace('-live', '')
      const config = PLATFORM_CONFIGS[platformKey]
      
      if (!config) {
        console.warn(`No platform config found for: ${connectionData.platform}`)
        return false
      }

      // Determine the display name and URL identifier
      const displayName = connectionData.channelTitle 
        || connectionData.channelName 
        || connectionData.pageName 
        || connectionData.accountName 
        || connectionData.username 
        || config.platform

      const urlIdentifier = connectionData.channelId 
        || connectionData.pageId 
        || connectionData.accountId 
        || connectionData.username 
        || ''

      // Get existing channels
      const { channels, settings } = await channelService.getChannels()
      
      // Check if channel for this platform already exists
      const existingIndex = channels.findIndex(c => 
        c.iconType === config.iconType || 
        c.platform.toLowerCase() === config.platform.toLowerCase()
      )

      const channelData: SocialChannel = {
        id: existingIndex >= 0 ? channels[existingIndex].id : `oauth-${platformKey}-${Date.now()}`,
        name: displayName.startsWith('@') ? displayName : `@${displayName}`,
        platform: config.platform,
        url: connectionData.profileUrl || config.urlTemplate(urlIdentifier),
        followers: existingIndex >= 0 ? channels[existingIndex].followers : '',
        description: config.description,
        color: config.color,
        iconType: config.iconType,
        category: config.category,
        enabled: true
      }

      let updatedChannels: SocialChannel[]
      
      if (existingIndex >= 0) {
        // Update existing channel
        updatedChannels = [...channels]
        updatedChannels[existingIndex] = {
          ...channels[existingIndex],
          ...channelData,
          // Keep existing custom settings
          followers: channels[existingIndex].followers || channelData.followers,
          description: channels[existingIndex].description || channelData.description
        }
        console.log(`Updated existing ${config.platform} channel`)
      } else {
        // Add new channel
        updatedChannels = [...channels, channelData]
        console.log(`Added new ${config.platform} channel`)
      }

      await channelService.updateChannels(updatedChannels, settings)
      return true
    } catch (error) {
      console.error('Error adding/updating channel:', error)
      return false
    }
  }

  /**
   * Remove a channel when OAuth is disconnected
   */
  async removeChannel(platform: string): Promise<boolean> {
    try {
      const platformKey = platform.toLowerCase().replace('-live', '')
      const config = PLATFORM_CONFIGS[platformKey]
      
      if (!config) {
        return false
      }

      const { channels, settings } = await channelService.getChannels()
      
      // Find and remove the channel
      const updatedChannels = channels.filter(c => 
        c.iconType !== config.iconType && 
        c.platform.toLowerCase() !== config.platform.toLowerCase()
      )

      if (updatedChannels.length < channels.length) {
        await channelService.updateChannels(updatedChannels, settings)
        console.log(`Removed ${config.platform} channel`)
        return true
      }

      return false
    } catch (error) {
      console.error('Error removing channel:', error)
      return false
    }
  }
}

export const autoChannelService = new AutoChannelService()
