import axios from 'axios'
import { awsConfig } from '../config/aws-config'

// Helper to get current tenant ID - same logic as other services
function getCurrentTenantId(): string {
  // 1. Priority: currentTenantId (set by TenantProvider after domain resolution)
  const currentTenantId = localStorage.getItem('currentTenantId')
  if (currentTenantId) {
    console.log('[CrosspostService] Using currentTenantId:', currentTenantId)
    return currentTenantId
  }
  
  // 2. Try to get from subdomain (e.g., "tenant1" from "tenant1.viraltenant.com")
  const hostname = window.location.hostname
  const parts = hostname.split('.')
  
  if (parts.length >= 3 && parts[0] !== 'www') {
    const subdomain = parts[0]
    console.log('[CrosspostService] Using subdomain as tenant ID:', subdomain)
    return subdomain
  }
  
  // 3. Try to get from URL path (e.g., /creator/tenant-id/...)
  const pathMatch = window.location.pathname.match(/\/creator\/([^\/]+)/)
  if (pathMatch) {
    console.log('[CrosspostService] Using path tenant ID:', pathMatch[1])
    return pathMatch[1]
  }
  
  // 4. Fallback to platform (should rarely happen)
  console.warn('[CrosspostService] No tenant ID found - using platform tenant')
  return '319190e1-0791-43b0-bd04-506f959c1471'
}

export interface WhatsAppSettings {
  enabled: boolean
  // New broadcast system fields
  subscriberCount?: number
  subscribeCode?: string
  welcomeMessage?: string
  whatsappNumber?: string
  whatsappDisplayName?: string
  subscribeInstructions?: string
  unsubscribeInstructions?: string
  tenantSubdomain?: string
  // Legacy fields (deprecated)
  phoneNumberId?: string
  groupId?: string
  groupName?: string
}

export interface TelegramSettings {
  enabled: boolean
  botToken: string
  chatId: string
  chatName: string
}

export interface EmailSettings {
  enabled: boolean
  senderPrefix: string
  senderDomain: string
  senderName: string
}

export interface DiscordSettings {
  enabled: boolean
  webhookUrl: string
  channelName: string
}

export interface SlackSettings {
  enabled: boolean
  webhookUrl: string
  channelName: string
}

export interface FacebookSettings {
  enabled: boolean
  pageAccessToken: string
  pageId: string
  pageName: string
}

export interface InstagramSettings {
  enabled: boolean
  accessToken: string
  accountId: string
  accountName: string
}

export interface SignalSettings {
  enabled: boolean
  apiUrl: string
  phoneNumber: string
  groupId: string
}

export interface XTwitterSettings {
  enabled: boolean
  apiKey: string
  apiSecret: string
  accessToken: string
  accessTokenSecret: string
  accountName: string
  // OAuth 2.0 fields
  clientId?: string
  clientSecret?: string
  oauth2AccessToken?: string
  oauth2RefreshToken?: string
  userId?: string
}

export interface LinkedInSettings {
  enabled: boolean
  accessToken: string
  organizationId: string
  organizationName: string
  clientId: string
  clientSecret: string
  personUrn?: string
}

export interface ThreadsSettings {
  enabled: boolean
  accessToken: string
  userId: string
  username: string
}

export interface YouTubeSettings {
  enabled: boolean
  accessToken: string
  refreshToken: string
  channelId: string
  channelName: string
  clientId: string
  clientSecret: string
}

export interface BlueskySettings {
  enabled: boolean
  handle: string
  appPassword: string
  displayName: string
}

export interface MastodonSettings {
  enabled: boolean
  instanceUrl: string
  accessToken: string
  username: string
}

export interface TikTokSettings {
  enabled: boolean
  accessToken: string
  refreshToken: string
  openId: string
  displayName: string
  avatarUrl: string
  expiresAt: number
  postAsDraft: boolean
  defaultPrivacy: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'FOLLOWER_OF_CREATOR' | 'SELF_ONLY'
  // Interaction Settings (TikTok Compliance)
  allowComment: boolean
  allowDuet: boolean
  allowStitch: boolean
  // Commercial Content (TikTok Compliance)
  commercialContentEnabled: boolean
  brandOrganic: boolean      // "Your Brand" - Promotional content
  brandedContent: boolean    // "Branded Content" - Paid partnership
  // Posting Stats
  postsToday: number
  postsLastReset: string     // ISO date when counter was last reset
  // Terms Acceptance (TikTok Compliance)
  termsAccepted: boolean
  termsAcceptedAt: string    // ISO date when terms were accepted
  // Creator Info from TikTok API (dynamic, stored per tenant)
  privacyLevelOptions?: string[]           // Available privacy options from creator_info
  maxVideoDuration?: number                // Max video duration in seconds (max_video_post_duration_sec)
  commentDisabledByCreator?: boolean       // Creator disabled comments in TikTok settings
  duetDisabledByCreator?: boolean          // Creator disabled duet in TikTok settings
  stitchDisabledByCreator?: boolean        // Creator disabled stitch in TikTok settings
  // Creator Info - Posting Limits (from creator_info API)
  creatorNickname?: string                 // Creator's TikTok nickname for display
  canPostVideo?: boolean                   // Whether creator can post videos right now
  canPostPhoto?: boolean                   // Whether creator can post photos right now  
  postingLimitMessage?: string             // Message to show when posting is limited
}

export interface SnapchatSettings {
  enabled: boolean
  accessToken: string
  refreshToken: string
  organizationId: string
  displayName: string
  expiresAt: number
  postAsStory: boolean
}

class CrosspostService {
  private apiUrl = awsConfig.api.user

  private getHeaders(token: string) {
    return {
      'Authorization': `Bearer ${token}`,
      'X-Creator-ID': getCurrentTenantId()
    }
  }

  async getSettings(token: string): Promise<WhatsAppSettings> {
    try {
      const tenantId = getCurrentTenantId()
      const response = await axios.get(`${this.apiUrl}/tenants/${tenantId}/whatsapp/settings`, {
        headers: this.getHeaders(token)
      })
      return response.data
    } catch (error: any) {
      console.error('Failed to load WhatsApp settings:', error)
      return {
        enabled: false,
        subscriberCount: 0,
        subscribeCode: '',
        welcomeMessage: '',
        whatsappNumber: '+41772356998',
        whatsappDisplayName: 'TheTenant'
      }
    }
  }

  async updateSettings(settings: WhatsAppSettings, token: string): Promise<void> {
    const tenantId = getCurrentTenantId()
    await axios.put(
      `${this.apiUrl}/tenants/${tenantId}/whatsapp/settings`,
      settings,
      { headers: this.getHeaders(token) }
    )
  }

  async sendTestMessage(token: string): Promise<void> {
    const tenantId = getCurrentTenantId()
    await axios.post(
      `${this.apiUrl}/tenants/${tenantId}/whatsapp/test`,
      {},
      { headers: this.getHeaders(token) }
    )
  }

  async getWhatsAppSubscribers(token: string): Promise<{ subscribers: any[]; total: number }> {
    try {
      const tenantId = getCurrentTenantId()
      const response = await axios.get(`${this.apiUrl}/tenants/${tenantId}/whatsapp/subscribers`, {
        headers: this.getHeaders(token)
      })
      return response.data
    } catch (error: any) {
      console.error('Failed to load WhatsApp subscribers:', error)
      return { subscribers: [], total: 0 }
    }
  }

  // Telegram methods
  async getTelegramSettings(token: string): Promise<TelegramSettings> {
    try {
      const response = await axios.get(`${this.apiUrl}/telegram/settings`, {
        headers: this.getHeaders(token)
      })
      return response.data
    } catch (error: any) {
      console.error('Failed to load Telegram settings:', error)
      return {
        enabled: false,
        botToken: '',
        chatId: '',
        chatName: ''
      }
    }
  }

  async updateTelegramSettings(settings: TelegramSettings, token: string): Promise<void> {
    await axios.put(
      `${this.apiUrl}/telegram/settings`,
      settings,
      { headers: this.getHeaders(token) }
    )
  }

  async sendTelegramTestMessage(token: string): Promise<void> {
    await axios.post(
      `${this.apiUrl}/telegram/test`,
      {},
      { headers: this.getHeaders(token) }
    )
  }

  async getEmailSettings(token: string): Promise<EmailSettings> {
    try {
      const response = await axios.get(`${this.apiUrl}/email/settings`, {
        headers: this.getHeaders(token)
      })
      return response.data
    } catch (error: any) {
      console.error('Failed to load Email settings:', error)
      return {
        enabled: false,
        senderPrefix: 'newsfeed',
        senderDomain: '',
        senderName: 'Newsfeed'
      }
    }
  }

  async updateEmailSettings(settings: EmailSettings, token: string): Promise<void> {
    await axios.put(
      `${this.apiUrl}/email/settings`,
      settings,
      { headers: this.getHeaders(token) }
    )
  }

  async sendEmailTestMessage(token: string): Promise<void> {
    await axios.post(
      `${this.apiUrl}/email/test`,
      {},
      { headers: this.getHeaders(token) }
    )
  }

  // Discord methods
  async getDiscordSettings(token: string): Promise<DiscordSettings> {
    try {
      const response = await axios.get(`${this.apiUrl}/discord/settings`, {
        headers: this.getHeaders(token)
      })
      return response.data
    } catch (error: any) {
      console.error('Failed to load Discord settings:', error)
      return { enabled: false, webhookUrl: '', channelName: '' }
    }
  }

  async updateDiscordSettings(settings: DiscordSettings, token: string): Promise<void> {
    await axios.put(`${this.apiUrl}/discord/settings`, settings, {
      headers: this.getHeaders(token)
    })
  }

  async sendDiscordTestMessage(token: string): Promise<void> {
    await axios.post(`${this.apiUrl}/discord/test`, {}, {
      headers: this.getHeaders(token)
    })
  }

  // Slack methods
  async getSlackSettings(token: string): Promise<SlackSettings> {
    try {
      const response = await axios.get(`${this.apiUrl}/slack/settings`, {
        headers: this.getHeaders(token)
      })
      return response.data
    } catch (error: any) {
      console.error('Failed to load Slack settings:', error)
      return { enabled: false, webhookUrl: '', channelName: '' }
    }
  }

  async updateSlackSettings(settings: SlackSettings, token: string): Promise<void> {
    await axios.put(`${this.apiUrl}/slack/settings`, settings, {
      headers: this.getHeaders(token)
    })
  }

  async sendSlackTestMessage(token: string): Promise<void> {
    await axios.post(`${this.apiUrl}/slack/test`, {}, {
      headers: this.getHeaders(token)
    })
  }

  // Facebook methods
  async getFacebookSettings(token: string): Promise<FacebookSettings> {
    try {
      const response = await axios.get(`${this.apiUrl}/facebook/settings`, {
        headers: this.getHeaders(token)
      })
      return response.data
    } catch (error: any) {
      console.error('Failed to load Facebook settings:', error)
      return { enabled: false, pageAccessToken: '', pageId: '', pageName: '' }
    }
  }

  async updateFacebookSettings(settings: FacebookSettings, token: string): Promise<void> {
    await axios.put(`${this.apiUrl}/facebook/settings`, settings, {
      headers: this.getHeaders(token)
    })
  }

  async sendFacebookTestMessage(token: string): Promise<void> {
    await axios.post(`${this.apiUrl}/facebook/test`, {}, {
      headers: this.getHeaders(token)
    })
  }

  // Instagram methods
  async getInstagramSettings(token: string): Promise<InstagramSettings> {
    try {
      const response = await axios.get(`${this.apiUrl}/instagram/settings`, {
        headers: this.getHeaders(token)
      })
      return response.data
    } catch (error: any) {
      console.error('Failed to load Instagram settings:', error)
      return { enabled: false, accessToken: '', accountId: '', accountName: '' }
    }
  }

  async updateInstagramSettings(settings: InstagramSettings, token: string): Promise<void> {
    await axios.put(`${this.apiUrl}/instagram/settings`, settings, {
      headers: this.getHeaders(token)
    })
  }

  async sendInstagramTestMessage(token: string): Promise<void> {
    await axios.post(`${this.apiUrl}/instagram/test`, {}, {
      headers: this.getHeaders(token)
    })
  }

  // Signal methods
  async getSignalSettings(token: string): Promise<SignalSettings> {
    try {
      const response = await axios.get(`${this.apiUrl}/signal/settings`, {
        headers: this.getHeaders(token)
      })
      return response.data
    } catch (error: any) {
      console.error('Failed to load Signal settings:', error)
      return { enabled: false, apiUrl: '', phoneNumber: '', groupId: '' }
    }
  }

  async updateSignalSettings(settings: SignalSettings, token: string): Promise<void> {
    await axios.put(`${this.apiUrl}/signal/settings`, settings, {
      headers: this.getHeaders(token)
    })
  }

  async sendSignalTestMessage(token: string): Promise<void> {
    await axios.post(`${this.apiUrl}/signal/test`, {}, {
      headers: this.getHeaders(token)
    })
  }

  // X (Twitter) methods
  async getXTwitterSettings(token: string): Promise<XTwitterSettings> {
    try {
      const response = await axios.get(`${this.apiUrl}/xtwitter/settings`, {
        headers: this.getHeaders(token)
      })
      return response.data
    } catch (error: any) {
      console.error('Failed to load X settings:', error)
      return { enabled: false, apiKey: '', apiSecret: '', accessToken: '', accessTokenSecret: '', accountName: '' }
    }
  }

  async updateXTwitterSettings(settings: XTwitterSettings, token: string): Promise<void> {
    await axios.put(`${this.apiUrl}/xtwitter/settings`, settings, {
      headers: this.getHeaders(token)
    })
  }

  async sendXTwitterTestMessage(token: string): Promise<void> {
    await axios.post(`${this.apiUrl}/xtwitter/test`, { sendTweet: true }, {
      headers: this.getHeaders(token)
    })
  }

  async testXTwitterConnection(token: string): Promise<{ success: boolean; message?: string; error?: string; username?: string }> {
    try {
      // Don't send a tweet, just verify credentials
      const response = await axios.post(`${this.apiUrl}/xtwitter/test`, { sendTweet: false }, {
        headers: this.getHeaders(token)
      })
      return response.data
    } catch (error: any) {
      const errorData = error.response?.data
      return { 
        success: false, 
        error: errorData?.error || error.message || 'Verbindungstest fehlgeschlagen' 
      }
    }
  }

  // LinkedIn methods
  async getLinkedInSettings(token: string): Promise<LinkedInSettings> {
    try {
      const response = await axios.get(`${this.apiUrl}/linkedin/settings`, {
        headers: this.getHeaders(token)
      })
      return response.data
    } catch (error: any) {
      console.error('Failed to load LinkedIn settings:', error)
      return { enabled: false, accessToken: '', organizationId: '', organizationName: '', clientId: '', clientSecret: '' }
    }
  }

  async updateLinkedInSettings(settings: LinkedInSettings, token: string): Promise<void> {
    await axios.put(`${this.apiUrl}/linkedin/settings`, settings, {
      headers: this.getHeaders(token)
    })
  }

  async sendLinkedInTestMessage(token: string): Promise<void> {
    await axios.post(`${this.apiUrl}/linkedin/test`, {}, {
      headers: this.getHeaders(token)
    })
  }

  // Threads methods
  async getThreadsSettings(token: string): Promise<ThreadsSettings> {
    try {
      const response = await axios.get(`${this.apiUrl}/threads/settings`, {
        headers: this.getHeaders(token)
      })
      return response.data
    } catch (error: any) {
      console.error('Failed to load Threads settings:', error)
      return { enabled: false, accessToken: '', userId: '', username: '' }
    }
  }

  async updateThreadsSettings(settings: ThreadsSettings, token: string): Promise<void> {
    await axios.put(`${this.apiUrl}/threads/settings`, settings, {
      headers: this.getHeaders(token)
    })
  }

  async sendThreadsTestMessage(token: string): Promise<void> {
    await axios.post(`${this.apiUrl}/threads/test`, {}, {
      headers: this.getHeaders(token)
    })
  }

  // YouTube methods
  async getYouTubeSettings(token: string): Promise<YouTubeSettings> {
    try {
      const response = await axios.get(`${this.apiUrl}/youtube/settings`, {
        headers: this.getHeaders(token)
      })
      return response.data
    } catch (error: any) {
      console.error('Failed to load YouTube settings:', error)
      return { 
        enabled: false, 
        accessToken: '', 
        refreshToken: '',
        channelId: '', 
        channelName: '',
        clientId: '',
        clientSecret: ''
      }
    }
  }

  async updateYouTubeSettings(settings: YouTubeSettings, token: string): Promise<void> {
    await axios.put(`${this.apiUrl}/youtube/settings`, settings, {
      headers: this.getHeaders(token)
    })
  }

  async sendYouTubeTestMessage(token: string): Promise<void> {
    await axios.post(`${this.apiUrl}/youtube/test`, {}, {
      headers: this.getHeaders(token)
    })
  }

  // Bluesky methods
  async getBlueskySettings(token: string): Promise<BlueskySettings> {
    try {
      const response = await axios.get(`${this.apiUrl}/bluesky/settings`, {
        headers: this.getHeaders(token)
      })
      return response.data
    } catch (error: any) {
      console.error('Failed to load Bluesky settings:', error)
      return { enabled: false, handle: '', appPassword: '', displayName: '' }
    }
  }

  async updateBlueskySettings(settings: BlueskySettings, token: string): Promise<void> {
    await axios.put(`${this.apiUrl}/bluesky/settings`, settings, {
      headers: this.getHeaders(token)
    })
  }

  async sendBlueskyTestMessage(token: string): Promise<void> {
    await axios.post(`${this.apiUrl}/bluesky/test`, {}, {
      headers: this.getHeaders(token)
    })
  }

  // Mastodon methods
  async getMastodonSettings(token: string): Promise<MastodonSettings> {
    try {
      const response = await axios.get(`${this.apiUrl}/mastodon/settings`, {
        headers: this.getHeaders(token)
      })
      return response.data
    } catch (error: any) {
      console.error('Failed to load Mastodon settings:', error)
      return { enabled: false, instanceUrl: '', accessToken: '', username: '' }
    }
  }

  async updateMastodonSettings(settings: MastodonSettings, token: string): Promise<void> {
    await axios.put(`${this.apiUrl}/mastodon/settings`, settings, {
      headers: this.getHeaders(token)
    })
  }

  async sendMastodonTestMessage(token: string): Promise<void> {
    await axios.post(`${this.apiUrl}/mastodon/test`, {}, {
      headers: this.getHeaders(token)
    })
  }

  // TikTok methods
  async getTikTokSettings(token: string): Promise<TikTokSettings> {
    try {
      const response = await axios.get(`${this.apiUrl}/tiktok/settings`, {
        headers: this.getHeaders(token)
      })
      return response.data
    } catch (error: any) {
      console.error('Failed to load TikTok settings:', error)
      return { 
        enabled: false, 
        accessToken: '', 
        refreshToken: '',
        openId: '', 
        displayName: '',
        avatarUrl: '',
        expiresAt: 0,
        postAsDraft: false,
        defaultPrivacy: 'PUBLIC_TO_EVERYONE',
        allowComment: false,
        allowDuet: false,
        allowStitch: false,
        commercialContentEnabled: false,
        brandOrganic: false,
        brandedContent: false,
        postsToday: 0,
        postsLastReset: '',
        termsAccepted: false,
        termsAcceptedAt: '',
        privacyLevelOptions: [],
        maxVideoDuration: 600,
        commentDisabledByCreator: false,
        duetDisabledByCreator: false,
        stitchDisabledByCreator: false
      }
    }
  }

  async updateTikTokSettings(settings: TikTokSettings, token: string): Promise<void> {
    await axios.put(`${this.apiUrl}/tiktok/settings`, settings, {
      headers: this.getHeaders(token)
    })
  }

  async sendTikTokTestMessage(token: string): Promise<void> {
    await axios.post(`${this.apiUrl}/tiktok/test`, {}, {
      headers: this.getHeaders(token)
    })
  }

  // Snapchat methods
  async getSnapchatSettings(token: string): Promise<SnapchatSettings> {
    try {
      const response = await axios.get(`${this.apiUrl}/snapchat/settings`, {
        headers: this.getHeaders(token)
      })
      return response.data
    } catch (error: any) {
      console.error('Failed to load Snapchat settings:', error)
      return { 
        enabled: false, 
        accessToken: '', 
        refreshToken: '',
        organizationId: '', 
        displayName: '',
        expiresAt: 0,
        postAsStory: false
      }
    }
  }

  async updateSnapchatSettings(settings: SnapchatSettings, token: string): Promise<void> {
    await axios.put(`${this.apiUrl}/snapchat/settings`, settings, {
      headers: this.getHeaders(token)
    })
  }

  async sendSnapchatTestMessage(token: string): Promise<void> {
    await axios.post(`${this.apiUrl}/snapchat/test`, {}, {
      headers: this.getHeaders(token)
    })
  }

  // Get all enabled channels with their display names (for showing in post modals)
  async getEnabledChannels(token: string): Promise<{ id: string; name: string; displayName: string }[]> {
    const enabledChannels: { id: string; name: string; displayName: string }[] = []
    
    try {
      const [
        youtube, tiktok, snapchat, facebook, instagram, 
        xtwitter, linkedin, threads, telegram, discord, 
        slack, bluesky, mastodon
      ] = await Promise.all([
        this.getYouTubeSettings(token),
        this.getTikTokSettings(token),
        this.getSnapchatSettings(token),
        this.getFacebookSettings(token),
        this.getInstagramSettings(token),
        this.getXTwitterSettings(token),
        this.getLinkedInSettings(token),
        this.getThreadsSettings(token),
        this.getTelegramSettings(token),
        this.getDiscordSettings(token),
        this.getSlackSettings(token),
        this.getBlueskySettings(token),
        this.getMastodonSettings(token)
      ])

      // Video platforms (for Shorts)
      if (youtube.enabled && youtube.accessToken) {
        enabledChannels.push({ id: 'youtube', name: 'YouTube', displayName: youtube.channelName || 'YouTube' })
      }
      if (tiktok.enabled && tiktok.accessToken) {
        enabledChannels.push({ id: 'tiktok', name: 'TikTok', displayName: tiktok.displayName ? `@${tiktok.displayName}` : 'TikTok' })
      }
      if (snapchat.enabled && snapchat.accessToken) {
        enabledChannels.push({ id: 'snapchat', name: 'Snapchat', displayName: snapchat.displayName || 'Snapchat' })
      }
      
      // Social platforms (for Posts)
      if (facebook.enabled && facebook.pageAccessToken) {
        enabledChannels.push({ id: 'facebook', name: 'Facebook', displayName: facebook.pageName || 'Facebook' })
      }
      if (instagram.enabled && instagram.accessToken) {
        enabledChannels.push({ id: 'instagram', name: 'Instagram', displayName: instagram.accountName || 'Instagram' })
      }
      if (xtwitter.enabled && (xtwitter.oauth2AccessToken || xtwitter.accessToken)) {
        enabledChannels.push({ id: 'xtwitter', name: 'X', displayName: xtwitter.accountName ? `@${xtwitter.accountName}` : 'X' })
      }
      if (linkedin.enabled && linkedin.accessToken) {
        enabledChannels.push({ id: 'linkedin', name: 'LinkedIn', displayName: linkedin.organizationName || 'LinkedIn' })
      }
      if (threads.enabled && threads.accessToken) {
        enabledChannels.push({ id: 'threads', name: 'Threads', displayName: threads.username ? `@${threads.username}` : 'Threads' })
      }
      if (telegram.enabled && telegram.botToken) {
        enabledChannels.push({ id: 'telegram', name: 'Telegram', displayName: telegram.chatName || 'Telegram' })
      }
      if (discord.enabled && discord.webhookUrl) {
        enabledChannels.push({ id: 'discord', name: 'Discord', displayName: discord.channelName || 'Discord' })
      }
      if (slack.enabled && slack.webhookUrl) {
        enabledChannels.push({ id: 'slack', name: 'Slack', displayName: slack.channelName || 'Slack' })
      }
      if (bluesky.enabled && bluesky.appPassword) {
        enabledChannels.push({ id: 'bluesky', name: 'Bluesky', displayName: bluesky.handle ? `@${bluesky.handle}` : 'Bluesky' })
      }
      if (mastodon.enabled && mastodon.accessToken) {
        enabledChannels.push({ id: 'mastodon', name: 'Mastodon', displayName: mastodon.username ? `@${mastodon.username}` : 'Mastodon' })
      }
    } catch (error) {
      console.error('Failed to load enabled channels:', error)
    }
    
    return enabledChannels
  }

  // Get only video-capable channels (for Shorts)
  async getEnabledVideoChannels(token: string): Promise<{ id: string; name: string; displayName: string }[]> {
    const allChannels = await this.getEnabledChannels(token)
    // Filter to only video platforms - includes all platforms that support video uploads
    const videoCapablePlatforms = [
      'youtube',    // YouTube Shorts
      'tiktok',     // TikTok Videos
      'snapchat',   // Snapchat Spotlight
      'instagram',  // Instagram Reels
      'threads',    // Threads Videos
      'facebook',   // Facebook Reels
      'xtwitter',   // X/Twitter Videos
      'linkedin',   // LinkedIn Videos
      'bluesky',    // Bluesky Videos
      'mastodon'    // Mastodon Videos
    ]
    return allChannels.filter(ch => videoCapablePlatforms.includes(ch.id))
  }

  /**
   * Verify Meta API Permissions
   * Calls all required Meta Graph API endpoints to satisfy Meta's app review requirements.
   * This triggers usage of: public_profile, pages_show_list, pages_read_engagement, 
   * pages_manage_posts, publish_video, Live Video API, instagram_basic, instagram_content_publish,
   * threads_basic, threads_content_publish
   */
  async verifyMetaApiPermissions(token: string): Promise<{
    success: boolean
    results: { permission: string; status: 'success' | 'error'; message: string }[]
  }> {
    try {
      const response = await axios.post(`${this.apiUrl}/meta/verify-permissions`, {}, {
        headers: this.getHeaders(token)
      })
      return response.data
    } catch (error: any) {
      console.error('Meta API verification failed:', error)
      return {
        success: false,
        results: [{ permission: 'all', status: 'error', message: error.message || 'Verification failed' }]
      }
    }
  }
}

export const crosspostService = new CrosspostService()

// Legacy alias for backward compatibility
export const whatsappService = crosspostService
