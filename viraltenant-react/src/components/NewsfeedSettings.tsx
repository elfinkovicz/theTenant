import { useState, useEffect, useMemo } from 'react'
import { Save, X, MessageCircle, Send, Mail, Hash, Link, AtSign, Youtube, Cloud, Globe, Music2 } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { useAuthStore } from '../store/authStore'
import { useTenant } from '../providers/TenantProvider'
import { crosspostService, WhatsAppSettings, TelegramSettings, EmailSettings, DiscordSettings, SlackSettings, FacebookSettings, InstagramSettings, SignalSettings, XTwitterSettings, LinkedInSettings, ThreadsSettings, YouTubeSettings, BlueskySettings, MastodonSettings, TikTokSettings, SnapchatSettings } from '../services/crosspost.service'
import { awsConfig } from '../config/aws-config'
import { toast } from '../utils/toast-alert'
import { autoChannelService } from '../services/autoChannel.service'
import { PostCounter } from './ui/PostCounter'

// WhatsApp QR Code Component
const WhatsAppQRCode = ({ phoneNumber, subscribeCode }: { phoneNumber: string, subscribeCode: string }) => {
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '')
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`START ${subscribeCode}`)}`
  
  return (
    <div id="whatsapp-qr-code">
      <QRCodeCanvas 
        value={whatsappUrl}
        size={160}
        level="H"
        includeMargin={false}
        bgColor="#ffffff"
        fgColor="#25D366"
      />
    </div>
  )
}

interface NewsfeedSettingsProps {
  onClose: () => void
  onSave?: () => void
}

// Order: OAuth platforms by size, then Email, then rest
type TabType = 'youtube' | 'tiktok' | 'snapchat' | 'facebook' | 'instagram' | 'xtwitter' | 'linkedin' | 'threads' | 'email' | 'telegram' | 'discord' | 'slack' | 'whatsapp' | 'signal' | 'bluesky' | 'mastodon'

export const NewsfeedSettings = ({ onClose, onSave }: NewsfeedSettingsProps) => {
  const { accessToken } = useAuthStore()
  const { subdomain, tenantId } = useTenant()
  const [activeTab, setActiveTab] = useState<TabType>('youtube')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [settings, setSettings] = useState<WhatsAppSettings>({ enabled: false, phoneNumberId: '', groupId: '', groupName: '' })
  const [telegramSettings, setTelegramSettings] = useState<TelegramSettings>({ enabled: false, botToken: '', chatId: '', chatName: '' })
  const [emailSettings, setEmailSettings] = useState<EmailSettings>({ enabled: false, senderPrefix: 'newsfeed', senderDomain: awsConfig.platform.domain || 'viraltenant.live', senderName: 'Newsfeed' })
  const [discordSettings, setDiscordSettings] = useState<DiscordSettings>({ enabled: false, webhookUrl: '', channelName: '' })
  const [slackSettings, setSlackSettings] = useState<SlackSettings>({ enabled: false, webhookUrl: '', channelName: '' })
  const [facebookSettings, setFacebookSettings] = useState<FacebookSettings>({ enabled: false, pageAccessToken: '', pageId: '', pageName: '' })
  const [instagramSettings, setInstagramSettings] = useState<InstagramSettings>({ enabled: false, accessToken: '', accountId: '', accountName: '' })
  const [signalSettings, setSignalSettings] = useState<SignalSettings>({ enabled: false, apiUrl: '', phoneNumber: '', groupId: '' })
  const [xTwitterSettings, setXTwitterSettings] = useState<XTwitterSettings>({ enabled: false, apiKey: '', apiSecret: '', accessToken: '', accessTokenSecret: '', accountName: '' })
  const [linkedInSettings, setLinkedInSettings] = useState<LinkedInSettings>({ enabled: false, accessToken: '', organizationId: '', organizationName: '', clientId: '', clientSecret: '' })
  const [threadsSettings, setThreadsSettings] = useState<ThreadsSettings>({ enabled: false, accessToken: '', userId: '', username: '' })
  const [youtubeSettings, setYoutubeSettings] = useState<YouTubeSettings>({ enabled: false, accessToken: '', refreshToken: '', channelId: '', channelName: '', clientId: '', clientSecret: '' })
  const [blueskySettings, setBlueskySettings] = useState<BlueskySettings>({ enabled: false, handle: '', appPassword: '', displayName: '' })
  const [mastodonSettings, setMastodonSettings] = useState<MastodonSettings>({ enabled: false, instanceUrl: '', accessToken: '', username: '' })
  const [tiktokSettings, setTiktokSettings] = useState<TikTokSettings>({ 
    enabled: false, accessToken: '', refreshToken: '', openId: '', displayName: '', avatarUrl: '', expiresAt: 0, 
    postAsDraft: false, defaultPrivacy: 'PUBLIC_TO_EVERYONE',
    allowComment: false, allowDuet: false, allowStitch: false,
    commercialContentEnabled: false, brandOrganic: false, brandedContent: false,
    postsToday: 0, postsLastReset: '',
    termsAccepted: false, termsAcceptedAt: '',
    privacyLevelOptions: [], maxVideoDuration: 600,
    commentDisabledByCreator: false, duetDisabledByCreator: false, stitchDisabledByCreator: false
  })
  const [snapchatSettings, setSnapchatSettings] = useState<SnapchatSettings>({ enabled: false, accessToken: '', refreshToken: '', organizationId: '', displayName: '', expiresAt: 0, postAsStory: false })

  // Use subscribeCode from API response - the backend handles the logic:
  // - Platform tenant (www): VIRALTENANT
  // - Other tenants: their subdomain
  // - Fallback: first 8 chars of tenantId
  const effectiveSubscribeCode = useMemo(() => {
    // First priority: subscribeCode from API (backend handles the logic)
    if (settings.subscribeCode && settings.subscribeCode.trim() !== '') {
      return settings.subscribeCode
    }
    // Fallback for before API response loads
    if (subdomain === 'www') {
      return 'VIRALTENANT'
    }
    if (subdomain) {
      return subdomain
    }
    return tenantId?.substring(0, 8) || 'creator'
  }, [settings.subscribeCode, subdomain, tenantId])

  // Auto-save settings for a specific platform (used by toggles and OAuth callbacks)
  const autoSavePlatformSettings = async (platform: string, newSettings: any) => {
    if (!accessToken) return
    try {
      switch (platform) {
        case 'whatsapp': await crosspostService.updateSettings(newSettings, accessToken); break
        case 'telegram': await crosspostService.updateTelegramSettings(newSettings, accessToken); break
        case 'email': await crosspostService.updateEmailSettings(newSettings, accessToken); break
        case 'discord': await crosspostService.updateDiscordSettings(newSettings, accessToken); break
        case 'slack': await crosspostService.updateSlackSettings(newSettings, accessToken); break
        case 'facebook': await crosspostService.updateFacebookSettings(newSettings, accessToken); break
        case 'instagram': await crosspostService.updateInstagramSettings(newSettings, accessToken); break
        case 'signal': await crosspostService.updateSignalSettings(newSettings, accessToken); break
        case 'xtwitter': await crosspostService.updateXTwitterSettings(newSettings, accessToken); break
        case 'linkedin': await crosspostService.updateLinkedInSettings(newSettings, accessToken); break
        case 'threads': await crosspostService.updateThreadsSettings(newSettings, accessToken); break
        case 'youtube': await crosspostService.updateYouTubeSettings(newSettings, accessToken); break
        case 'bluesky': await crosspostService.updateBlueskySettings(newSettings, accessToken); break
        case 'mastodon': await crosspostService.updateMastodonSettings(newSettings, accessToken); break
        case 'tiktok': await crosspostService.updateTikTokSettings(newSettings, accessToken); break
        case 'snapchat': await crosspostService.updateSnapchatSettings(newSettings, accessToken); break
      }
    } catch (error) {
      console.error(`Auto-save ${platform} failed:`, error)
    }
  }

  useEffect(() => { loadSettings() }, [])

  const loadSettings = async () => {
    if (!accessToken) { setLoading(false); return }
    try {
      const results = await Promise.all([
        crosspostService.getSettings(accessToken), crosspostService.getTelegramSettings(accessToken),
        crosspostService.getEmailSettings(accessToken), crosspostService.getDiscordSettings(accessToken),
        crosspostService.getSlackSettings(accessToken), crosspostService.getFacebookSettings(accessToken),
        crosspostService.getInstagramSettings(accessToken), crosspostService.getSignalSettings(accessToken),
        crosspostService.getXTwitterSettings(accessToken), crosspostService.getLinkedInSettings(accessToken),
        crosspostService.getThreadsSettings(accessToken), crosspostService.getYouTubeSettings(accessToken),
        crosspostService.getBlueskySettings(accessToken), crosspostService.getMastodonSettings(accessToken),
        crosspostService.getTikTokSettings(accessToken), crosspostService.getSnapchatSettings(accessToken)
      ])
      setSettings(results[0]); setTelegramSettings(results[1]); setEmailSettings(results[2])
      setDiscordSettings(results[3]); setSlackSettings(results[4]); setFacebookSettings(results[5])
      setInstagramSettings(results[6]); setSignalSettings(results[7]); setXTwitterSettings(results[8])
      setLinkedInSettings(results[9]); setThreadsSettings(results[10]); setYoutubeSettings(results[11])
      setBlueskySettings(results[12]); setMastodonSettings(results[13]); setTiktokSettings(results[14])
      setSnapchatSettings(results[15])
    } catch (error) { console.error('Failed to load settings:', error) }
    finally { setLoading(false) }
  }

  const handleSave = async () => {
    if (!accessToken) return
    setSaving(true)
    try {
      switch (activeTab) {
        case 'whatsapp': 
          await crosspostService.updateSettings(settings, accessToken)
          // Auto-add WhatsApp channel if enabled
          if (settings.enabled && settings.whatsappNumber) {
            await autoChannelService.addOrUpdateChannel({
              platform: 'whatsapp',
              accountName: settings.whatsappDisplayName || 'WhatsApp Channel',
              username: settings.whatsappNumber.replace(/[^0-9]/g, '')
            })
          }
          break
        case 'telegram': 
          await crosspostService.updateTelegramSettings(telegramSettings, accessToken)
          // Auto-add Telegram channel if enabled
          if (telegramSettings.enabled && telegramSettings.chatName) {
            await autoChannelService.addOrUpdateChannel({
              platform: 'telegram',
              accountName: telegramSettings.chatName,
              username: telegramSettings.chatName.replace('@', '')
            })
          }
          break
        case 'email': 
          await crosspostService.updateEmailSettings(emailSettings, accessToken)
          // Auto-add Newsletter channel if enabled
          if (emailSettings.enabled && emailSettings.senderName) {
            await autoChannelService.addOrUpdateChannel({
              platform: 'email',
              accountName: emailSettings.senderName || 'Newsletter',
              username: `${emailSettings.senderPrefix}@${emailSettings.senderDomain}`
            })
          }
          break
        case 'discord': 
          await crosspostService.updateDiscordSettings(discordSettings, accessToken)
          // Auto-add Discord channel if enabled
          if (discordSettings.enabled && discordSettings.channelName) {
            await autoChannelService.addOrUpdateChannel({
              platform: 'discord',
              accountName: discordSettings.channelName,
              username: discordSettings.channelName
            })
          }
          break
        case 'slack': 
          await crosspostService.updateSlackSettings(slackSettings, accessToken)
          // Auto-add Slack channel if enabled
          if (slackSettings.enabled && slackSettings.channelName) {
            await autoChannelService.addOrUpdateChannel({
              platform: 'slack',
              accountName: slackSettings.channelName,
              username: slackSettings.channelName
            })
          }
          break
        case 'facebook': 
          await crosspostService.updateFacebookSettings(facebookSettings, accessToken)
          // Auto-add Facebook channel if enabled
          if (facebookSettings.enabled && facebookSettings.pageName) {
            await autoChannelService.addOrUpdateChannel({
              platform: 'facebook',
              accountName: facebookSettings.pageName,
              pageId: facebookSettings.pageId,
              pageName: facebookSettings.pageName
            })
          }
          break
        case 'instagram': 
          await crosspostService.updateInstagramSettings(instagramSettings, accessToken)
          // Auto-add Instagram channel if enabled
          if (instagramSettings.enabled && instagramSettings.accountName) {
            await autoChannelService.addOrUpdateChannel({
              platform: 'instagram',
              accountName: instagramSettings.accountName,
              username: instagramSettings.accountName,
              accountId: instagramSettings.accountId
            })
          }
          break
        case 'signal': 
          await crosspostService.updateSignalSettings(signalSettings, accessToken)
          // Signal doesn't have public profiles, skip auto-channel
          break
        case 'xtwitter': 
          await crosspostService.updateXTwitterSettings(xTwitterSettings, accessToken)
          // Auto-add X/Twitter channel if connected
          if (xTwitterSettings.enabled && xTwitterSettings.accountName) {
            await autoChannelService.addOrUpdateChannel({
              platform: 'xtwitter',
              accountName: xTwitterSettings.accountName,
              username: xTwitterSettings.accountName
            })
          }
          break
        case 'linkedin': 
          await crosspostService.updateLinkedInSettings(linkedInSettings, accessToken)
          // Auto-add LinkedIn channel if enabled
          if (linkedInSettings.enabled && linkedInSettings.organizationName) {
            await autoChannelService.addOrUpdateChannel({
              platform: 'linkedin',
              accountName: linkedInSettings.organizationName,
              username: linkedInSettings.organizationId
            })
          }
          break
        case 'threads': 
          await crosspostService.updateThreadsSettings(threadsSettings, accessToken)
          // Auto-add Threads channel if enabled
          if (threadsSettings.enabled && threadsSettings.username) {
            await autoChannelService.addOrUpdateChannel({
              platform: 'threads',
              accountName: threadsSettings.username,
              username: threadsSettings.username
            })
          }
          break
        case 'youtube': 
          await crosspostService.updateYouTubeSettings(youtubeSettings, accessToken)
          // Auto-add YouTube channel if configured
          if (youtubeSettings.enabled && youtubeSettings.channelId) {
            await autoChannelService.addOrUpdateChannel({
              platform: 'youtube',
              channelId: youtubeSettings.channelId,
              channelTitle: youtubeSettings.channelName
            })
          }
          break
        case 'bluesky': 
          await crosspostService.updateBlueskySettings(blueskySettings, accessToken)
          // Auto-add Bluesky channel if enabled and configured
          if (blueskySettings.enabled && blueskySettings.handle) {
            await autoChannelService.addOrUpdateChannel({
              platform: 'bluesky',
              username: blueskySettings.handle,
              accountName: blueskySettings.displayName || blueskySettings.handle
            })
          }
          break
        case 'mastodon': 
          await crosspostService.updateMastodonSettings(mastodonSettings, accessToken)
          // Auto-add Mastodon channel if enabled and configured
          if (mastodonSettings.enabled && mastodonSettings.username && mastodonSettings.instanceUrl) {
            await autoChannelService.addOrUpdateChannel({
              platform: 'mastodon',
              username: mastodonSettings.username,
              accountName: mastodonSettings.username,
              profileUrl: `${mastodonSettings.instanceUrl.replace(/\/$/, '')}/@${mastodonSettings.username}`
            })
          }
          break
        case 'tiktok': 
          await crosspostService.updateTikTokSettings(tiktokSettings, accessToken)
          // Auto-add TikTok channel if connected
          if (tiktokSettings.enabled && tiktokSettings.displayName) {
            await autoChannelService.addOrUpdateChannel({
              platform: 'tiktok',
              username: tiktokSettings.displayName,
              accountName: tiktokSettings.creatorNickname || tiktokSettings.displayName
            })
          }
          break
        case 'snapchat': 
          await crosspostService.updateSnapchatSettings(snapchatSettings, accessToken)
          // Auto-add Snapchat channel if connected
          if (snapchatSettings.enabled && snapchatSettings.displayName) {
            await autoChannelService.addOrUpdateChannel({
              platform: 'snapchat',
              username: snapchatSettings.displayName,
              accountName: snapchatSettings.displayName
            })
          }
          break
      }
      toast.success('Einstellungen erfolgreich gespeichert')
      // Notify other tabs that channels may have been updated
      localStorage.setItem('channels-updated', Date.now().toString())
      onSave?.()
    } catch (error: any) {
      toast.error(`Fehler: ${error.response?.data?.message || error.message}`)
    }
    finally { setSaving(false) }
  }

  // Disconnect OAuth and save to backend
  const handleDisconnect = async (provider: string) => {
    if (!accessToken) return
    if (!confirm(`${provider}-Verbindung trennen?`)) return
    
    try {
      switch (provider) {
        case 'xtwitter':
          await crosspostService.disconnectXTwitter(accessToken)
          setXTwitterSettings({ enabled: false, apiKey: '', apiSecret: '', accessToken: '', accessTokenSecret: '', accountName: '' })
          await autoChannelService.removeChannel('xtwitter')
          break
        case 'linkedin':
          const clearedLinkedIn = { ...linkedInSettings, accessToken: '', organizationId: '', organizationName: '', personUrn: '' }
          setLinkedInSettings(clearedLinkedIn)
          await crosspostService.updateLinkedInSettings(clearedLinkedIn, accessToken)
          break
        case 'threads':
          const clearedThreads = { ...threadsSettings, accessToken: '', userId: '', username: '' }
          setThreadsSettings(clearedThreads)
          await crosspostService.updateThreadsSettings(clearedThreads, accessToken)
          break
        case 'youtube':
          const clearedYouTube = { ...youtubeSettings, accessToken: '', refreshToken: '', channelId: '', channelName: '' }
          setYoutubeSettings(clearedYouTube)
          await crosspostService.updateYouTubeSettings(clearedYouTube, accessToken)
          break
        case 'facebook':
          const clearedFacebook = { ...facebookSettings, pageAccessToken: '', pageId: '', pageName: '' }
          setFacebookSettings(clearedFacebook)
          await crosspostService.updateFacebookSettings(clearedFacebook, accessToken)
          break
        case 'instagram':
          const clearedInstagram = { ...instagramSettings, accessToken: '', accountId: '', accountName: '' }
          setInstagramSettings(clearedInstagram)
          await crosspostService.updateInstagramSettings(clearedInstagram, accessToken)
          break
        case 'bluesky':
          const clearedBluesky = { ...blueskySettings, appPassword: '', handle: '' }
          setBlueskySettings(clearedBluesky)
          await crosspostService.updateBlueskySettings(clearedBluesky, accessToken)
          break
        case 'mastodon':
          const clearedMastodon = { ...mastodonSettings, accessToken: '', instanceUrl: '' }
          setMastodonSettings(clearedMastodon)
          await crosspostService.updateMastodonSettings(clearedMastodon, accessToken)
          break
        case 'tiktok':
          const clearedTikTok = { ...tiktokSettings, accessToken: '', refreshToken: '', openId: '', displayName: '', avatarUrl: '', expiresAt: 0 }
          setTiktokSettings(clearedTikTok)
          await crosspostService.updateTikTokSettings(clearedTikTok, accessToken)
          break
        case 'snapchat':
          const clearedSnapchat = { ...snapchatSettings, accessToken: '', refreshToken: '', organizationId: '', displayName: '', expiresAt: 0 }
          setSnapchatSettings(clearedSnapchat)
          await crosspostService.updateSnapchatSettings(clearedSnapchat, accessToken)
          break
      }
      toast.success(`${provider}-Verbindung getrennt`)
    } catch (error: any) {
      toast.error(`Fehler beim Trennen: ${error.message}`)
    }
  }

  // Used in Test Button section below
  const handleTest = async () => {
    if (!accessToken) return
    try {
      switch (activeTab) {
        case 'whatsapp': await crosspostService.sendTestMessage(accessToken); break
        case 'telegram': await crosspostService.sendTelegramTestMessage(accessToken); break
        case 'email': await crosspostService.sendEmailTestMessage(accessToken); break
        case 'discord': await crosspostService.sendDiscordTestMessage(accessToken); break
        case 'slack': await crosspostService.sendSlackTestMessage(accessToken); break
        case 'facebook': await crosspostService.sendFacebookTestMessage(accessToken); break
        case 'instagram': await crosspostService.sendInstagramTestMessage(accessToken); break
        case 'signal': await crosspostService.sendSignalTestMessage(accessToken); break
        case 'xtwitter': await crosspostService.sendXTwitterTestMessage(accessToken); break
        case 'linkedin': await crosspostService.sendLinkedInTestMessage(accessToken); break
        case 'threads': await crosspostService.sendThreadsTestMessage(accessToken); break
        case 'youtube': await crosspostService.sendYouTubeTestMessage(accessToken); break
        case 'bluesky': await crosspostService.sendBlueskyTestMessage(accessToken); break
        case 'mastodon': await crosspostService.sendMastodonTestMessage(accessToken); break
        case 'tiktok': await crosspostService.sendTikTokTestMessage(accessToken); break
      }
      toast.success('Test-Nachricht gesendet!')
    } catch (error: any) { 
      toast.error(`Fehler: ${error.response?.data?.error || error.message}`)
    }
  }

  if (loading) return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-900 rounded-xl p-8"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div></div>
    </div>
  )

  const tabs: { id: TabType; label: string; icon: any; color: string }[] = [
    // OAuth platforms by size
    { id: 'youtube', label: 'YouTube', icon: Youtube, color: 'bg-red-600' },
    { id: 'tiktok', label: 'TikTok', icon: Music2, color: 'bg-black' },
    { id: 'snapchat', label: 'Snapchat', icon: Music2, color: 'bg-yellow-400' },
    { id: 'facebook', label: 'Facebook', icon: MessageCircle, color: 'bg-blue-600' },
    { id: 'instagram', label: 'Instagram', icon: MessageCircle, color: 'bg-gradient-to-r from-purple-500 to-pink-500' },
    { id: 'xtwitter', label: 'X (Twitter)', icon: Send, color: 'bg-gray-600' },
    { id: 'linkedin', label: 'LinkedIn', icon: Link, color: 'bg-blue-600' },
    { id: 'threads', label: 'Threads', icon: AtSign, color: 'bg-gray-800' },
    // Email
    { id: 'email', label: 'E-Mail', icon: Mail, color: 'bg-primary-500' },
    // Rest
    { id: 'telegram', label: 'Telegram', icon: Send, color: 'bg-blue-500' },
    { id: 'discord', label: 'Discord', icon: Hash, color: 'bg-indigo-500' },
    { id: 'slack', label: 'Slack', icon: Hash, color: 'bg-emerald-500' },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'bg-green-500' },
    { id: 'signal', label: 'Signal', icon: MessageCircle, color: 'bg-blue-400' },
    { id: 'bluesky', label: 'Bluesky', icon: Cloud, color: 'bg-sky-500' },
    { id: 'mastodon', label: 'Mastodon', icon: Globe, color: 'bg-purple-600' },
  ]

  const isCurrentEnabled = () => {
    switch (activeTab) {
      case 'youtube': return youtubeSettings.enabled
      case 'tiktok': return tiktokSettings.enabled
      case 'snapchat': return snapchatSettings.enabled
      case 'telegram': return telegramSettings.enabled
      case 'discord': return discordSettings.enabled
      case 'slack': return slackSettings.enabled
      case 'xtwitter': return xTwitterSettings.enabled
      case 'linkedin': return linkedInSettings.enabled
      case 'threads': return threadsSettings.enabled
      case 'email': return emailSettings.enabled
      case 'facebook': return facebookSettings.enabled
      case 'instagram': return instagramSettings.enabled
      case 'whatsapp': return settings.enabled
      case 'signal': return signalSettings.enabled
      case 'bluesky': return blueskySettings.enabled
      case 'mastodon': return mastodonSettings.enabled
      default: return false
    }
  }

  // Get enabled channels for neon background
  const enabledChannels = tabs.filter(tab => {
    switch (tab.id) {
      case 'youtube': return youtubeSettings.enabled
      case 'tiktok': return tiktokSettings.enabled
      case 'snapchat': return snapchatSettings.enabled
      case 'telegram': return telegramSettings.enabled
      case 'discord': return discordSettings.enabled
      case 'slack': return slackSettings.enabled
      case 'xtwitter': return xTwitterSettings.enabled
      case 'linkedin': return linkedInSettings.enabled
      case 'threads': return threadsSettings.enabled
      case 'email': return emailSettings.enabled
      case 'facebook': return facebookSettings.enabled
      case 'instagram': return instagramSettings.enabled
      case 'whatsapp': return settings.enabled
      case 'signal': return signalSettings.enabled
      case 'bluesky': return blueskySettings.enabled
      case 'mastodon': return mastodonSettings.enabled
      default: return false
    }
  })

  // Neon color mapping for channels
  const getNeonColor = (color: string) => {
    if (color.includes('red-600')) return '#dc2626'
    if (color.includes('black')) return '#ff0050' // TikTok pink
    if (color.includes('yellow-400')) return '#facc15' // Snapchat yellow
    if (color.includes('blue-500')) return '#3b82f6'
    if (color.includes('indigo-500')) return '#6366f1'
    if (color.includes('emerald-500')) return '#10b981'
    if (color.includes('gray-600') || color.includes('gray-800')) return '#9ca3af'
    if (color.includes('blue-600')) return '#2563eb'
    if (color.includes('primary-500')) return '#8b5cf6'
    if (color.includes('purple-500') || color.includes('pink-500')) return '#ec4899'
    if (color.includes('green-500')) return '#22c55e'
    if (color.includes('blue-400')) return '#60a5fa'
    if (color.includes('sky-500')) return '#0ea5e9'
    if (color.includes('purple-600')) return '#9333ea'
    return '#8b5cf6'
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl border border-dark-700 relative">
        {/* Neon Background Icons for enabled channels */}
        {enabledChannels.length > 0 && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {enabledChannels.slice(0, 10).map((channel, index) => {
              const Icon = channel.icon
              const neonColor = getNeonColor(channel.color)
              const positions = [
                { top: '10%', right: '5%', rotate: '15deg', size: 80 },
                { top: '60%', right: '8%', rotate: '-20deg', size: 60 },
                { bottom: '15%', right: '3%', rotate: '25deg', size: 70 },
                { top: '25%', right: '12%', rotate: '-10deg', size: 50 },
                { bottom: '40%', right: '6%', rotate: '30deg', size: 55 },
                { top: '45%', right: '2%', rotate: '-5deg', size: 65 },
                { bottom: '5%', right: '10%', rotate: '20deg', size: 45 },
                { top: '75%', right: '15%', rotate: '-15deg', size: 50 },
                { top: '5%', right: '18%', rotate: '10deg', size: 40 },
                { bottom: '25%', right: '18%', rotate: '-25deg', size: 55 },
              ]
              const pos = positions[index]
              return (
                <div
                  key={channel.id}
                  className="absolute opacity-[0.15] transition-all duration-500"
                  style={{
                    top: pos.top,
                    right: pos.right,
                    bottom: pos.bottom,
                    transform: `rotate(${pos.rotate})`,
                    filter: `drop-shadow(0 0 20px ${neonColor}) drop-shadow(0 0 40px ${neonColor}) drop-shadow(0 0 60px ${neonColor})`,
                  }}
                >
                  <Icon size={pos.size} style={{ color: neonColor }} />
                </div>
              )
            })}
          </div>
        )}
        <div className="p-6 border-b border-dark-700 flex items-center justify-between bg-dark-800/50 relative z-10">
          <h2 className="text-2xl font-bold">Crossposting</h2>
          <button onClick={onClose} className="text-theme-secondary hover:text-theme transition-colors p-2 hover:bg-dark-700 rounded-lg"><X size={24} /></button>
        </div>

        <div className="flex h-[calc(90vh-180px)] relative z-10">
          <div className="w-56 bg-dark-800/30 border-r border-dark-700 p-3 overflow-y-auto">
            <div className="space-y-1">
              {tabs.map(tab => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20' : 'text-dark-300 hover:bg-dark-700 hover:text-white'}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isActive ? 'bg-white/20' : tab.color}`}>
                      <Icon size={18} className="text-white" />
                    </div>
                    <span className="font-medium">{tab.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex-1 p-6 overflow-y-auto">

            {/* Telegram */}
            {activeTab === 'telegram' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-2">Telegram Bot</h3>
                  <p className="text-dark-400">Sende Posts automatisch an einen Telegram-Kanal oder Gruppe</p>
                </div>
                <label className="flex items-center gap-3 cursor-pointer p-4 bg-dark-800 rounded-xl">
                  <input type="checkbox" checked={telegramSettings.enabled} onChange={(e) => { const s = { ...telegramSettings, enabled: e.target.checked }; setTelegramSettings(s); autoSavePlatformSettings('telegram', s) }} className="sr-only peer" />
                  <div className="relative w-10 h-5 bg-dark-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-500"></div>
                  <span className="font-medium">Telegram aktivieren</span>
                </label>
                {telegramSettings.enabled && <PostCounter platform="telegram" postsToday={telegramSettings.postsToday} postsLastReset={telegramSettings.postsLastReset} />}
                <div className="relative space-y-4">
                  {!telegramSettings.enabled && <div className="absolute -inset-2 bg-dark-900/70 backdrop-blur-sm rounded-xl z-10" />}
                  <div className="grid gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Bot Token</label>
                      <input type="password" value={telegramSettings.botToken} onChange={(e) => setTelegramSettings({ ...telegramSettings, botToken: e.target.value })} placeholder="1234567890:ABCdefGHI..." className="input w-full font-mono" disabled={!telegramSettings.enabled} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Chat/Channel ID</label>
                      <input type="text" value={telegramSettings.chatId} onChange={(e) => setTelegramSettings({ ...telegramSettings, chatId: e.target.value })} placeholder="-1001234567890" className="input w-full font-mono" disabled={!telegramSettings.enabled} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Name (optional)</label>
                      <input type="text" value={telegramSettings.chatName} onChange={(e) => setTelegramSettings({ ...telegramSettings, chatName: e.target.value })} placeholder="Mein Kanal" className="input w-full" disabled={!telegramSettings.enabled} />
                    </div>
                  </div>

                  {/* Info Box - What gets posted */}
                  <div className="p-4 bg-blue-400/10 border border-blue-400/30 rounded-xl">
                    <div className="flex items-start gap-3">
                      <Send className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-white mb-2">Was wird auf Telegram gepostet?</h4>
                        <ul className="text-sm text-dark-300 space-y-1">
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Text</strong> → wird als Telegram-Nachricht gesendet</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Bilder</strong> → werden als Foto mit Caption gesendet</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Videos</strong> → werden als Video mit Caption gesendet</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Mehrere Medien</strong> → werden als Media-Group gesendet</span>
                          </li>
                        </ul>
                        <p className="text-xs text-dark-400 mt-2">
                          Telegram unterstützt alle Content-Typen. Der Bot muss Admin im Kanal/Gruppe sein.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Discord */}
            {activeTab === 'discord' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-2">Discord Webhook</h3>
                  <p className="text-dark-400">Sende Posts automatisch an einen Discord-Kanal</p>
                </div>
                <label className="flex items-center gap-3 cursor-pointer p-4 bg-dark-800 rounded-xl">
                  <input type="checkbox" checked={discordSettings.enabled} onChange={(e) => { const s = { ...discordSettings, enabled: e.target.checked }; setDiscordSettings(s); autoSavePlatformSettings('discord', s) }} className="sr-only peer" />
                  <div className="relative w-10 h-5 bg-dark-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-500"></div>
                  <span className="font-medium">Discord aktivieren</span>
                </label>
                {discordSettings.enabled && <PostCounter platform="discord" postsToday={discordSettings.postsToday} postsLastReset={discordSettings.postsLastReset} />}
                <div className="relative space-y-4">
                  {!discordSettings.enabled && <div className="absolute -inset-2 bg-dark-900/70 backdrop-blur-sm rounded-xl z-10" />}
                  <div className="grid gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Webhook URL</label>
                      <input type="text" value={discordSettings.webhookUrl} onChange={(e) => setDiscordSettings({ ...discordSettings, webhookUrl: e.target.value })} placeholder="https://discord.com/api/webhooks/..." className="input w-full font-mono" disabled={!discordSettings.enabled} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Kanal-Name (optional)</label>
                      <input type="text" value={discordSettings.channelName} onChange={(e) => setDiscordSettings({ ...discordSettings, channelName: e.target.value })} placeholder="#announcements" className="input w-full" disabled={!discordSettings.enabled} />
                    </div>
                  </div>

                  {/* Info Box - What gets posted */}
                  <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
                    <div className="flex items-start gap-3">
                      <svg viewBox="0 0 24 24" className="w-6 h-6 text-indigo-400 flex-shrink-0 mt-0.5" fill="currentColor">
                        <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286z"/>
                      </svg>
                      <div>
                        <h4 className="font-medium text-white mb-2">Was wird auf Discord gepostet?</h4>
                        <ul className="text-sm text-dark-300 space-y-1">
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Text</strong> → wird als Embed-Nachricht gesendet</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Bilder</strong> → werden als Galerie gepostet (max. 10 Bilder)</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Videos</strong> → werden als Datei hochgeladen (max. 25MB) + Bilder</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-yellow-400">⚠</span>
                            <span><strong>Video &gt; 25MB</strong> → Thumbnail + Link zum Video</span>
                          </li>
                        </ul>
                        <p className="text-xs text-dark-400 mt-2">
                          Discord Webhooks unterstützen Rich Embeds mit Farben, Galerie-Ansicht und Datei-Uploads.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Slack */}
            {activeTab === 'slack' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-2">Slack Webhook</h3>
                  <p className="text-dark-400">Sende Posts automatisch an einen Slack-Kanal</p>
                </div>
                <label className="flex items-center gap-3 cursor-pointer p-4 bg-dark-800 rounded-xl">
                  <input type="checkbox" checked={slackSettings.enabled} onChange={(e) => { const s = { ...slackSettings, enabled: e.target.checked }; setSlackSettings(s); autoSavePlatformSettings('slack', s) }} className="sr-only peer" />
                  <div className="relative w-10 h-5 bg-dark-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-500"></div>
                  <span className="font-medium">Slack aktivieren</span>
                </label>
                {slackSettings.enabled && <PostCounter platform="slack" postsToday={slackSettings.postsToday} postsLastReset={slackSettings.postsLastReset} />}
                <div className="relative space-y-4">
                  {!slackSettings.enabled && <div className="absolute -inset-2 bg-dark-900/70 backdrop-blur-sm rounded-xl z-10" />}
                  <div className="grid gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Webhook URL</label>
                      <input type="text" value={slackSettings.webhookUrl} onChange={(e) => setSlackSettings({ ...slackSettings, webhookUrl: e.target.value })} placeholder="https://hooks.slack.com/services/..." className="input w-full font-mono" disabled={!slackSettings.enabled} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Kanal-Name (optional)</label>
                      <input type="text" value={slackSettings.channelName} onChange={(e) => setSlackSettings({ ...slackSettings, channelName: e.target.value })} placeholder="#general" className="input w-full" disabled={!slackSettings.enabled} />
                    </div>
                  </div>

                  {/* Info Box - What gets posted */}
                  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                    <div className="flex items-start gap-3">
                      <svg viewBox="0 0 24 24" className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" fill="currentColor">
                        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                      </svg>
                      <div>
                        <h4 className="font-medium text-white mb-2">Was wird auf Slack gepostet?</h4>
                        <ul className="text-sm text-dark-300 space-y-1">
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Text</strong> → wird als Rich-Text-Nachricht gesendet</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Bilder</strong> → alle Bilder werden als Vorschau angezeigt (unbegrenzt)</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Videos</strong> → Bilder + Link-Button zum Video</span>
                          </li>
                        </ul>
                        <p className="text-xs text-dark-400 mt-2">
                          Slack Webhooks senden Nachrichten im Block Kit Format. Kein direkter Video-Upload möglich.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* X Twitter */}
            {activeTab === 'xtwitter' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-2">X (Twitter)</h3>
                  <p className="text-dark-400">Poste automatisch auf X (Text, Bilder & Videos)</p>
                </div>

                <label className="flex items-center gap-3 cursor-pointer p-4 bg-dark-800 rounded-xl">
                  <input type="checkbox" checked={xTwitterSettings.enabled} onChange={(e) => { const s = { ...xTwitterSettings, enabled: e.target.checked }; setXTwitterSettings(s); autoSavePlatformSettings('xtwitter', s) }} className="sr-only peer" />
                  <div className="relative w-10 h-5 bg-dark-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-500"></div>
                  <span className="font-medium">X aktivieren</span>
                </label>
                {xTwitterSettings.enabled && <PostCounter platform="xtwitter" postsToday={xTwitterSettings.postsToday} postsLastReset={xTwitterSettings.postsLastReset} />}

                <div className="relative">
                  {!xTwitterSettings.enabled && <div className="absolute -inset-2 bg-dark-900/70 backdrop-blur-sm rounded-xl z-10" />}
                  <div className="space-y-4">
                    {/* Connection Status */}
                    {xTwitterSettings.accessToken && (
                    <div className="p-4 bg-gray-800/30 border border-gray-600/30 rounded-xl">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
                              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                              </svg>
                            </div>
                            <div>
                              <p className="font-medium text-green-400">✓ Verbunden</p>
                              <p className="text-sm text-dark-400">{xTwitterSettings.accountName || 'X Account verbunden'}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDisconnect('xtwitter')}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            Trennen
                          </button>
                        </div>
                    </div>
                    )}

                    {/* OAuth Connect */}
                    {!xTwitterSettings.accessToken && (
                    <div className="p-4 bg-dark-800/50 rounded-xl">
                        <div>
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-white">Mit X verbinden</h4>
                              <p className="text-sm text-dark-400">Ein Klick - fertig!</p>
                            </div>
                            <button
                              onClick={async () => {
                                try {
                                  const tenantId = localStorage.getItem('resolvedTenantId') || 'platform'
                                  sessionStorage.setItem('x_oauth_tenant_id', tenantId)
                                  // Store access token for popup callback (sessionStorage not shared across windows)
                                  localStorage.setItem('x_oauth_access_token', accessToken || '')

                                  const data = await crosspostService.requestXTwitterOAuthToken(
                                    accessToken!,
                                    'https://viraltenant.com/x-callback'
                                  )

                                  const popup = window.open(data.authorizeUrl, 'x-oauth', 'width=600,height=700')
                                  const pollTimer = setInterval(async () => {
                                    if (popup?.closed) {
                                      clearInterval(pollTimer)
                                      const settings = await crosspostService.getXTwitterSettings(accessToken!)
                                      const s = { ...settings, enabled: true }
                                      setXTwitterSettings(s)
                                      autoSavePlatformSettings('xtwitter', s)
                                    }
                                  }, 500)
                                } catch (err: any) {
                                  toast.error(err.response?.data?.message || err.message || 'Fehler beim Verbinden')
                                }
                              }}
                              className="px-4 py-2 rounded-lg font-medium text-white bg-black hover:bg-gray-900 transition-all hover:scale-105 border border-gray-700"
                            >
                              Mit X verbinden
                            </button>
                          </div>
                        </div>
                    </div>
                    )}

                    {/* Info Box - What gets posted */}
                    <div className="p-4 bg-gray-800/30 border border-gray-600/30 rounded-xl">
                      <div className="flex items-start gap-3">
                        <svg viewBox="0 0 24 24" className="w-6 h-6 text-white flex-shrink-0 mt-0.5" fill="currentColor">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        <div>
                          <h4 className="font-medium text-white mb-2">Was wird auf X veröffentlicht?</h4>
                          <ul className="text-sm text-dark-300 space-y-1">
                            <li className="flex items-center gap-2">
                              <span className="text-green-400">✓</span>
                              <span><strong>Text</strong> → wird als Tweet gepostet (max. 280 Zeichen)</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <span className="text-green-400">✓</span>
                              <span><strong>Bilder</strong> → werden als Tweet mit Bild gepostet (max. 4 Bilder)</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <span className="text-green-400">✓</span>
                              <span><strong>Videos</strong> → werden als Tweet mit Video gepostet (max. 512MB)</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <span className="text-green-400">✓</span>
                              <span><strong>Text + Medien</strong> → Text wird als Tweet-Text verwendet</span>
                            </li>
                          </ul>
                          <p className="text-xs text-dark-400 mt-2">
                            Längere Texte werden automatisch auf 280 Zeichen gekürzt. Videos werden von X verarbeitet.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Important Notice */}
                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                      <p className="text-yellow-400 text-sm font-medium mb-1">⚠️ Wichtig</p>
                      <p className="text-dark-300 text-sm">Dein X Account muss mindestens 30 Tage alt sein und eine verifizierte Telefonnummer haben. X Premium ist nicht erforderlich.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* LinkedIn */}
            {activeTab === 'linkedin' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-2">LinkedIn</h3>
                  <p className="text-dark-400">Poste automatisch auf deinem persönlichen LinkedIn-Profil</p>
                </div>
                <label className="flex items-center gap-3 cursor-pointer p-4 bg-dark-800 rounded-xl">
                  <input type="checkbox" checked={linkedInSettings.enabled} onChange={(e) => { const s = { ...linkedInSettings, enabled: e.target.checked }; setLinkedInSettings(s); autoSavePlatformSettings('linkedin', s) }} className="sr-only peer" />
                  <div className="relative w-10 h-5 bg-dark-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-500"></div>
                  <span className="font-medium">LinkedIn aktivieren</span>
                </label>
                {linkedInSettings.enabled && <PostCounter platform="linkedin" postsToday={linkedInSettings.postsToday} postsLastReset={linkedInSettings.postsLastReset} />}

                <div className="relative space-y-4">
                  {!linkedInSettings.enabled && <div className="absolute -inset-2 bg-dark-900/70 backdrop-blur-sm rounded-xl z-10" />}
                  {/* OAuth Connect Button */}
                  <div className="p-4 bg-blue-600/10 border border-blue-500/30 rounded-xl">
                  {linkedInSettings.accessToken ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                          <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
                            <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-green-400">✓ Verbunden</p>
                          <p className="text-sm text-dark-400">{linkedInSettings.organizationName || 'LinkedIn Profil'}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDisconnect('linkedin')}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Trennen
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-white">Mit LinkedIn verbinden</h4>
                        <p className="text-sm text-dark-400">Ein Klick - fertig!</p>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            const configResponse = await fetch(`${awsConfig.api.user}/linkedin/oauth/config`)
                            if (!configResponse.ok) throw new Error('LinkedIn OAuth nicht verfügbar')
                            const { clientId } = await configResponse.json()
                            
                            // Zentrale Redirect-URI über viraltenant.com (für alle Tenants)
                            const redirectUri = encodeURIComponent(`https://viraltenant.com/linkedin-callback`)
                            const scope = encodeURIComponent('w_member_social openid profile')
                            const tenantId = localStorage.getItem('resolvedTenantId') || 'platform'
                            const encodedToken = btoa(accessToken || '')
                            const state = encodeURIComponent(`linkedin|${tenantId}|${window.location.origin}|${encodedToken}`)
                            const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`
                            
                            // Open popup and poll for close
                            const popup = window.open(authUrl, 'linkedin-oauth', 'width=600,height=700')
                            const pollTimer = setInterval(async () => {
                              if (popup?.closed) {
                                clearInterval(pollTimer)
                                // Reload settings after popup closes
                                const settings = await crosspostService.getLinkedInSettings(accessToken!)
                                const s = { ...settings, enabled: true }
                                setLinkedInSettings(s)
                                autoSavePlatformSettings('linkedin', s)
                              }
                            }, 500)
                          } catch (err: any) {
                            toast.error(err.message || 'Fehler beim Verbinden')
                          }
                        }}
                        className="px-4 py-2 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 transition-all hover:scale-105"
                      >
                        Mit LinkedIn verbinden
                      </button>
                    </div>
                  )}
                  </div>

                  {/* Info Box - What gets posted */}
                  <div className="p-4 bg-blue-600/10 border border-blue-500/30 rounded-xl">
                    <div className="flex items-start gap-3">
                      <svg viewBox="0 0 24 24" className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5" fill="currentColor">
                        <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
                      </svg>
                      <div>
                        <h4 className="font-medium text-white mb-2">Was wird auf LinkedIn veröffentlicht?</h4>
                        <ul className="text-sm text-dark-300 space-y-1">
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Text</strong> → wird als LinkedIn-Post veröffentlicht</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Text + Bilder</strong> → Post mit Bild-Anhang</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Text + Link</strong> → Post mit Link-Vorschau</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-red-400">✗</span>
                            <span><strong>Videos</strong> → werden NICHT gepostet (API-Einschränkung)</span>
                          </li>
                        </ul>
                        <p className="text-xs text-dark-400 mt-2">
                          LinkedIn Posts haben kein Zeichenlimit, aber kürzere Posts performen besser.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Threads */}
            {activeTab === 'threads' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-2">Threads</h3>
                  <p className="text-dark-400">Poste automatisch auf Threads (Meta)</p>
                </div>
                <label className="flex items-center gap-3 cursor-pointer p-4 bg-dark-800 rounded-xl">
                  <input type="checkbox" checked={threadsSettings.enabled} onChange={(e) => { const s = { ...threadsSettings, enabled: e.target.checked }; setThreadsSettings(s); autoSavePlatformSettings('threads', s) }} className="sr-only peer" />
                  <div className="relative w-10 h-5 bg-dark-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-500"></div>
                  <span className="font-medium">Threads aktivieren</span>
                </label>
                {threadsSettings.enabled && <PostCounter platform="threads" postsToday={threadsSettings.postsToday} postsLastReset={threadsSettings.postsLastReset} />}

                <div className="relative space-y-4">
                  {!threadsSettings.enabled && <div className="absolute -inset-2 bg-dark-900/70 backdrop-blur-sm rounded-xl z-10" />}
                  {/* OAuth Connect Button */}
                  <div className="p-4 bg-gray-800/30 border border-gray-600/30 rounded-xl">
                  {threadsSettings.accessToken ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center border border-gray-600">
                          <svg viewBox="0 0 192 192" className="w-5 h-5 text-white" fill="currentColor">
                            <path d="M141.537 88.9883C140.71 88.5919 139.87 88.2104 139.019 87.8451C137.537 60.5382 122.616 44.905 97.5619 44.745C97.4484 44.7443 97.3355 44.7443 97.222 44.7443C82.2364 44.7443 69.7731 51.1409 62.102 62.7807L75.881 72.2328C81.6116 63.5383 90.6052 61.6848 97.2286 61.6848C97.3051 61.6848 97.3819 61.6848 97.4576 61.6855C105.707 61.7381 111.932 64.1366 115.961 68.814C118.893 72.2193 120.854 76.925 121.825 82.8638C114.511 81.6207 106.601 81.2385 98.145 81.7233C74.3247 83.0954 59.0111 96.9879 60.0396 116.292C60.5615 126.084 65.4397 134.508 73.775 140.011C80.8224 144.663 89.899 146.938 99.3323 146.423C111.79 145.74 121.563 140.987 128.381 132.296C133.559 125.696 136.834 117.143 138.28 106.366C144.217 109.949 148.617 114.664 151.047 120.332C155.179 129.967 155.42 145.8 142.501 158.708C131.182 170.016 117.576 174.908 97.0135 175.059C74.2042 174.89 56.9538 167.575 45.7381 153.317C35.2355 139.966 29.8077 120.682 29.6052 96C29.8077 71.3175 35.2355 52.0339 45.7381 38.683C56.9538 24.4249 74.2039 17.11 97.0132 16.9405C120.004 17.1113 137.552 24.4614 149.184 38.788C154.894 45.8136 159.199 54.6488 162.037 64.9503L178.184 60.6422C174.744 47.9622 169.331 37.0357 161.965 27.974C147.036 9.60668 125.202 0.195148 97.0695 0H96.9569C68.8816 0.19447 47.2921 9.6418 32.7883 28.0793C19.8819 44.4864 13.2244 67.3157 13.0007 95.9325L13 96L13.0007 96.0675C13.2244 124.684 19.8819 147.514 32.7883 163.921C47.2921 182.358 68.8816 191.806 96.9569 192H97.0695C122.03 191.827 139.624 185.292 154.118 170.811C173.081 151.866 172.51 128.119 166.26 113.541C161.776 103.087 153.227 94.5962 141.537 88.9883ZM98.4405 129.507C88.0005 130.095 77.1544 125.409 76.6196 115.372C76.2232 107.93 81.9158 99.626 99.0812 98.6368C101.047 98.5234 102.976 98.468 104.871 98.468C111.106 98.468 116.939 99.0737 122.242 100.233C120.264 124.935 108.662 128.946 98.4405 129.507Z"/>
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-green-400">✓ Verbunden</p>
                          <p className="text-sm text-dark-400">{threadsSettings.username || 'Threads Account'}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDisconnect('threads')}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Trennen
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-white">Mit Threads verbinden</h4>
                        <p className="text-sm text-dark-400">Ein Klick - fertig!</p>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            // Threads has its own App credentials
                            const configResponse = await fetch(`${awsConfig.api.user}/threads/oauth/config`)
                            if (!configResponse.ok) throw new Error('Threads OAuth nicht verfügbar')
                            const { appId } = await configResponse.json()
                            
                            // Zentrale Redirect-URI über viraltenant.com (für alle Tenants)
                            const redirectUri = encodeURIComponent(`https://viraltenant.com/meta-callback`)
                            const scope = encodeURIComponent('threads_basic,threads_content_publish')
                            const tenantId = localStorage.getItem('resolvedTenantId') || 'platform'
                            // Include access token in state for cross-origin callback (base64 encoded)
                            const token = accessToken || ''
                            const encodedToken = btoa(token)
                            const state = encodeURIComponent(`threads|${tenantId}|${window.location.origin}|${encodedToken}`)
                            
                            // Threads uses its own OAuth endpoint
                            const authUrl = `https://threads.net/oauth/authorize?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}&response_type=code`
                            
                            // Open popup and poll for close
                            const popup = window.open(authUrl, 'threads-oauth', 'width=600,height=700')
                            const pollTimer = setInterval(async () => {
                              if (popup?.closed) {
                                clearInterval(pollTimer)
                                const settings = await crosspostService.getThreadsSettings(accessToken!)
                                const s = { ...settings, enabled: true }
                                setThreadsSettings(s)
                                autoSavePlatformSettings('threads', s)
                              }
                            }, 500)
                          } catch (err: any) {
                            toast.error(err.message || 'Fehler beim Verbinden')
                          }
                        }}
                        className="px-4 py-2 rounded-lg font-medium text-white bg-gray-800 hover:bg-gray-700 transition-all hover:scale-105 border border-gray-600"
                      >
                        Mit Threads verbinden
                      </button>
                    </div>
                  )}
                  </div>

                  {/* Info Box - What gets posted */}
                  <div className="p-4 bg-gray-800/30 border border-gray-600/30 rounded-xl">
                    <div className="flex items-start gap-3">
                      <svg viewBox="0 0 192 192" className="w-6 h-6 text-white flex-shrink-0 mt-0.5" fill="currentColor">
                        <path d="M141.537 88.9883C140.71 88.5919 139.87 88.2104 139.019 87.8451C137.537 60.5382 122.616 44.905 97.5619 44.745C97.4484 44.7443 97.3355 44.7443 97.222 44.7443C82.2364 44.7443 69.7731 51.1409 62.102 62.7807L75.881 72.2328C81.6116 63.5383 90.6052 61.6848 97.2286 61.6848C97.3051 61.6848 97.3819 61.6848 97.4576 61.6855C105.707 61.7381 111.932 64.1366 115.961 68.814C118.893 72.2193 120.854 76.925 121.825 82.8638C114.511 81.6207 106.601 81.2385 98.145 81.7233C74.3247 83.0954 59.0111 96.9879 60.0396 116.292C60.5615 126.084 65.4397 134.508 73.775 140.011C80.8224 144.663 89.899 146.938 99.3323 146.423C111.79 145.74 121.563 140.987 128.381 132.296C133.559 125.696 136.834 117.143 138.28 106.366C144.217 109.949 148.617 114.664 151.047 120.332C155.179 129.967 155.42 145.8 142.501 158.708C131.182 170.016 117.576 174.908 97.0135 175.059C74.2042 174.89 56.9538 167.575 45.7381 153.317C35.2355 139.966 29.8077 120.682 29.6052 96C29.8077 71.3175 35.2355 52.0339 45.7381 38.683C56.9538 24.4249 74.2039 17.11 97.0132 16.9405C120.004 17.1113 137.552 24.4614 149.184 38.788C154.894 45.8136 159.199 54.6488 162.037 64.9503L178.184 60.6422C174.744 47.9622 169.331 37.0357 161.965 27.974C147.036 9.60668 125.202 0.195148 97.0695 0H96.9569C68.8816 0.19447 47.2921 9.6418 32.7883 28.0793C19.8819 44.4864 13.2244 67.3157 13.0007 95.9325L13 96L13.0007 96.0675C13.2244 124.684 19.8819 147.514 32.7883 163.921C47.2921 182.358 68.8816 191.806 96.9569 192H97.0695C122.03 191.827 139.624 185.292 154.118 170.811C173.081 151.866 172.51 128.119 166.26 113.541C161.776 103.087 153.227 94.5962 141.537 88.9883ZM98.4405 129.507C88.0005 130.095 77.1544 125.409 76.6196 115.372C76.2232 107.93 81.9158 99.626 99.0812 98.6368C101.047 98.5234 102.976 98.468 104.871 98.468C111.106 98.468 116.939 99.0737 122.242 100.233C120.264 124.935 108.662 128.946 98.4405 129.507Z"/>
                      </svg>
                      <div>
                        <h4 className="font-medium text-white mb-2">Was wird auf Threads veröffentlicht?</h4>
                        <ul className="text-sm text-dark-300 space-y-1">
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Text</strong> → wird als Threads-Post veröffentlicht (max. 500 Zeichen)</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Bilder</strong> → werden als Bild-Post veröffentlicht</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Videos</strong> → werden als Video-Post veröffentlicht (max. 5 Min.)</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-yellow-400">⚠</span>
                            <span><strong>Carousels</strong> → max. 20 Bilder/Videos pro Post</span>
                          </li>
                        </ul>
                        <p className="text-xs text-dark-400 mt-2">
                          Threads nutzt die Instagram-Login-API. Ein Instagram Business/Creator Account ist erforderlich.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* YouTube */}
            {activeTab === 'youtube' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-2">YouTube Shorts</h3>
                  <p className="text-dark-400">Veröffentliche Shorts automatisch auf YouTube</p>
                </div>

                <label className="flex items-center gap-3 cursor-pointer p-4 bg-dark-800 rounded-xl">
                  <input type="checkbox" checked={youtubeSettings.enabled} onChange={(e) => { const s = { ...youtubeSettings, enabled: e.target.checked }; setYoutubeSettings(s); autoSavePlatformSettings('youtube', s) }} className="sr-only peer" />
                  <div className="relative w-10 h-5 bg-dark-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-500"></div>
                  <span className="font-medium">YouTube Shorts aktivieren</span>
                </label>
                {youtubeSettings.enabled && <PostCounter platform="youtube" postsToday={youtubeSettings.postsToday} postsLastReset={youtubeSettings.postsLastReset} />}

                <div className="relative space-y-4">
                  {!youtubeSettings.enabled && <div className="absolute -inset-2 bg-dark-900/70 backdrop-blur-sm rounded-xl z-10" />}
                  {/* OAuth Connect Button */}
                  <div className="p-4 bg-red-900/20 border border-red-600/30 rounded-xl">
                  {youtubeSettings.accessToken ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
                          <Youtube className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-green-400">✓ Verbunden</p>
                          <p className="text-sm text-dark-400">{youtubeSettings.channelName || 'YouTube Kanal'}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDisconnect('youtube')}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Trennen
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-white">Mit YouTube verbinden</h4>
                        <p className="text-sm text-dark-400">Ein Klick - fertig!</p>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            const configResponse = await fetch(`${awsConfig.api.user}/google/oauth/config`)
                            if (!configResponse.ok) throw new Error('Google OAuth nicht verfügbar')
                            const { clientId } = await configResponse.json()
                            
                            // Zentrale Redirect-URI über viraltenant.com (für alle Tenants)
                            const redirectUri = 'https://viraltenant.com/youtube/oauth/callback'
                            const scope = encodeURIComponent('https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.force-ssl')
                            
                            // Get tenant ID from multiple sources
                            let tenantId = localStorage.getItem('resolvedTenantId')
                            if (!tenantId || tenantId === 'null') {
                              tenantId = localStorage.getItem('tenantId')
                            }
                            if (!tenantId || tenantId === 'null') {
                              // Try to get from URL
                              const pathMatch = window.location.pathname.match(/\/tenants\/([^\/]+)/)
                              tenantId = pathMatch ? pathMatch[1] : 'platform'
                            }
                            
                            console.log('YouTube OAuth - using tenantId:', tenantId)
                            
                            const encodedToken = btoa(accessToken || '')
                            const state = btoa(JSON.stringify({ tenantId, redirectUri, token: encodedToken }))
                            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${encodeURIComponent(state)}&response_type=code&access_type=offline&prompt=consent`
                            
                            // Open popup and poll for close
                            const popup = window.open(authUrl, 'youtube-oauth', 'width=600,height=700')
                            const pollTimer = setInterval(async () => {
                              if (popup?.closed) {
                                clearInterval(pollTimer)
                                const settings = await crosspostService.getYouTubeSettings(accessToken!)
                                const s = { ...settings, enabled: true }
                                setYoutubeSettings(s)
                                autoSavePlatformSettings('youtube', s)
                              }
                            }, 500)
                          } catch (err: any) {
                            toast.error(err.message || 'Fehler beim Verbinden')
                          }
                        }}
                        className="px-4 py-2 rounded-lg font-medium text-white bg-red-600 hover:bg-red-700 transition-all hover:scale-105"
                      >
                        Mit YouTube verbinden
                      </button>
                    </div>
                  )}
                </div>

                  {/* Info Box - What gets posted */}
                  <div className="p-4 bg-red-600/10 border border-red-500/30 rounded-xl">
                    <div className="flex items-start gap-3">
                      <Youtube className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-white mb-2">Was wird auf YouTube veröffentlicht?</h4>
                        <ul className="text-sm text-dark-300 space-y-1">
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Shorts</strong> (9:16 Videos bis 90 Sek.) → werden als YouTube Shorts hochgeladen</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-red-400">✗</span>
                            <span><strong>Normale Posts</strong> (Text, Bilder, 16:9 Videos) → werden NICHT gepostet</span>
                          </li>
                        </ul>
                        <p className="text-xs text-dark-400 mt-2">
                          Die YouTube Community Posts API ist nicht öffentlich verfügbar. Nur Video-Uploads sind möglich.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TikTok */}
            {activeTab === 'tiktok' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-2">TikTok</h3>
                  <p className="text-dark-400">Veröffentliche Videos automatisch auf TikTok</p>
                </div>

                {/* TikTok Terms Consent - Must accept before enabling */}
                {!tiktokSettings.termsAccepted ? (
                  <div className="p-4 bg-gradient-to-r from-pink-500/10 to-cyan-500/10 border border-pink-500/30 rounded-xl">
                    <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                      <Music2 className="w-5 h-5 text-pink-500" />
                      TikTok Nutzungsbedingungen
                    </h4>
                    <p className="text-sm text-dark-300 mb-4">
                      Um TikTok-Crossposting zu nutzen, musst du den folgenden Bedingungen zustimmen:
                    </p>
                    <ul className="text-sm text-dark-300 space-y-2 mb-4">
                      <li className="flex items-start gap-2">
                        <span className="text-pink-400 mt-0.5">♪</span>
                        <span>
                          <a href="https://www.tiktok.com/legal/music-usage-confirmation" target="_blank" rel="noopener noreferrer" className="text-pink-400 underline hover:text-pink-300">
                            TikTok Music Usage Confirmation
                          </a>
                          {' '}- Bestätigung zur Musiknutzung
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-cyan-400 mt-0.5">📋</span>
                        <span>
                          <a href="https://www.tiktok.com/legal/page/global/bc-policy/en" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300">
                            TikTok Branded Content Policy
                          </a>
                          {' '}- Richtlinien für gesponserte Inhalte
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-400 mt-0.5">📜</span>
                        <span>
                          <a href="https://www.tiktok.com/legal/terms-of-service" target="_blank" rel="noopener noreferrer" className="text-green-400 underline hover:text-green-300">
                            TikTok Terms of Service
                          </a>
                          {' '}- Allgemeine Nutzungsbedingungen
                        </span>
                      </li>
                    </ul>
                    <div className="p-3 bg-dark-800/50 rounded-lg mb-4">
                      <p className="text-xs text-dark-400">
                        ⚠️ Mit der Aktivierung bestätigst du, dass du die oben genannten Bedingungen gelesen und akzeptiert hast. 
                        Videos werden nach dem Posten von TikTok verarbeitet - dies kann einige Minuten dauern.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setTiktokSettings({ 
                          ...tiktokSettings, 
                          termsAccepted: true, 
                          termsAcceptedAt: new Date().toISOString(),
                          enabled: true
                        })
                        toast.success('TikTok-Bedingungen akzeptiert')
                      }}
                      className="w-full px-4 py-3 rounded-lg font-medium text-white bg-gradient-to-r from-pink-500 to-cyan-500 hover:from-pink-600 hover:to-cyan-600 transition-all"
                    >
                      Ich stimme zu und möchte TikTok aktivieren
                    </button>
                  </div>
                ) : (
                  <>
                    <label className="flex items-center gap-3 cursor-pointer p-4 bg-dark-800 rounded-xl">
                      <input type="checkbox" checked={tiktokSettings.enabled} onChange={(e) => { const s = { ...tiktokSettings, enabled: e.target.checked }; setTiktokSettings(s); autoSavePlatformSettings('tiktok', s) }} className="sr-only peer" />
                      <div className="relative w-10 h-5 bg-dark-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-500"></div>
                      <span className="font-medium">TikTok aktivieren</span>
                    </label>
                    {tiktokSettings.enabled && <PostCounter platform="tiktok" postsToday={tiktokSettings.postsToday} postsLastReset={tiktokSettings.postsLastReset} />}

                    <div className="relative space-y-4">
                      {!tiktokSettings.enabled && <div className="absolute -inset-2 bg-dark-900/70 backdrop-blur-sm rounded-xl z-10" />}
                      {/* OAuth Connect Button */}
                      <div className="p-4 bg-gradient-to-r from-pink-500/10 to-cyan-500/10 border border-pink-500/30 rounded-xl">
                        {tiktokSettings.accessToken ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
                          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                            <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" fill="url(#tiktok-gradient)"/>
                            <defs>
                              <linearGradient id="tiktok-gradient" x1="5" y1="2" x2="19" y2="22" gradientUnits="userSpaceOnUse">
                                <stop stopColor="#00f2ea"/>
                                <stop offset="1" stopColor="#ff0050"/>
                              </linearGradient>
                            </defs>
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-green-400">✓ Verbunden</p>
                          <p className="text-sm text-dark-400">{tiktokSettings.displayName || 'TikTok Account'}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDisconnect('tiktok')}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Trennen
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-white">Mit TikTok verbinden</h4>
                          <p className="text-sm text-dark-400">Ein Klick - fertig!</p>
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              const configResponse = await fetch(`${awsConfig.api.user}/tiktok/oauth/config`)
                              if (!configResponse.ok) throw new Error('TikTok OAuth nicht verfügbar')
                              const { clientKey } = await configResponse.json()
                              
                              // Generate PKCE code verifier and challenge
                              const codeVerifier = Array.from(crypto.getRandomValues(new Uint8Array(32)))
                                .map(b => b.toString(16).padStart(2, '0')).join('')
                              const encoder = new TextEncoder()
                              const data = encoder.encode(codeVerifier)
                              const digest = await crypto.subtle.digest('SHA-256', data)
                              const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
                                .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
                              
                              // Store code verifier for callback
                              sessionStorage.setItem('tiktok_code_verifier', codeVerifier)
                              
                              // Zentrale Redirect-URI über viraltenant.com (für alle Tenants)
                              const redirectUri = encodeURIComponent(`https://viraltenant.com/tiktok-callback`)
                              const scope = encodeURIComponent('user.info.basic,video.upload,video.publish')
                              const tenantId = localStorage.getItem('resolvedTenantId') || 'platform'
                              const encodedToken = btoa(accessToken || '')
                              const state = encodeURIComponent(`tiktok|${tenantId}|${window.location.origin}|${encodedToken}`)
                              
                              const authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}&response_type=code&code_challenge=${codeChallenge}&code_challenge_method=S256`
                              
                              // Open popup and poll for close
                              const popup = window.open(authUrl, 'tiktok-oauth', 'width=600,height=700')
                              const pollTimer = setInterval(async () => {
                                if (popup?.closed) {
                                  clearInterval(pollTimer)
                                  const settings = await crosspostService.getTikTokSettings(accessToken!)
                                  const s = { ...settings, enabled: true }
                                  setTiktokSettings(s)
                                  autoSavePlatformSettings('tiktok', s)
                                }
                              }, 500)
                            } catch (err: any) {
                              toast.error(err.message || 'Fehler beim Verbinden')
                            }
                          }}
                          className="px-4 py-2 rounded-lg font-medium text-white bg-gradient-to-r from-pink-500 to-cyan-500 hover:from-pink-600 hover:to-cyan-600 transition-all hover:scale-105"
                        >
                          Mit TikTok verbinden
                        </button>
                      </div>
                      <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                        <p className="text-xs text-yellow-400 flex items-start gap-2">
                          <span className="mt-0.5">⚠️</span>
                          <span><strong>Business- oder Creator-Account erforderlich!</strong> Persönliche Accounts können nicht posten. In der TikTok-App: Einstellungen → Account → Zu Business-Account wechseln.</span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                  {/* Info Box - What gets posted */}
                  <div className="p-4 bg-gradient-to-r from-pink-500/10 to-cyan-500/10 border border-pink-500/30 rounded-xl">
                    <div className="flex items-start gap-3">
                      <Music2 className="w-6 h-6 text-pink-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-white mb-2">TikTok Crossposting</h4>
                        <ul className="text-sm text-dark-300 space-y-1">
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Videos</strong> (Shorts 9:16, normale Videos 16:9)</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Foto-Carousels</strong> (2-35 Bilder, 9:16 empfohlen)</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-yellow-400">⚠</span>
                            <span><strong>Einzelne Bilder</strong> → werden NICHT gepostet (min. 2 nötig)</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-red-400">✗</span>
                            <span><strong>Nur Text</strong> → wird NICHT gepostet</span>
                          </li>
                        </ul>
                        <div className="mt-3 pt-3 border-t border-dark-700 space-y-2">
                          <div className="p-2 bg-cyan-500/10 rounded-lg">
                            <p className="text-xs text-cyan-300 flex items-start gap-2">
                              <span className="mt-0.5">📸</span>
                              <span><strong>Foto-Post Anforderungen:</strong> Min. 2 Bilder, max. 35 Bilder. Format: JPEG/WebP. Empfohlene Auflösung: 1080×1920px (9:16 vertikal). Max. 20MB pro Bild.</span>
                            </p>
                          </div>
                          <p className="text-xs text-dark-400 flex items-center gap-2">
                            <span className="text-cyan-400">ℹ</span>
                            Verarbeitung kann einige Minuten dauern
                          </p>
                          <p className="text-xs text-green-400 flex items-center gap-2">
                            <span>✓</span>
                            Du hast den TikTok-Bedingungen am {tiktokSettings.termsAcceptedAt ? new Date(tiktokSettings.termsAcceptedAt).toLocaleDateString('de-DE') : '-'} zugestimmt
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Snapchat */}
            {activeTab === 'snapchat' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Snapchat</h3>
                  <p className="text-dark-400">Veröffentliche Videos und Bilder automatisch auf Snapchat</p>
                </div>

                <label className="flex items-center gap-3 cursor-pointer p-4 bg-dark-800 rounded-xl">
                  <input 
                    type="checkbox" 
                    checked={snapchatSettings.enabled} 
                    onChange={(e) => { const s = { ...snapchatSettings, enabled: e.target.checked }; setSnapchatSettings(s); autoSavePlatformSettings('snapchat', s) }} 
                    className="sr-only peer" 
                  />
                  <div className="relative w-10 h-5 bg-dark-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-500"></div>
                  <span className="font-medium">Snapchat aktivieren</span>
                </label>
                {snapchatSettings.enabled && <PostCounter platform="snapchat" postsToday={snapchatSettings.postsToday} postsLastReset={snapchatSettings.postsLastReset} />}

                <div className="relative space-y-4">
                  {!snapchatSettings.enabled && <div className="absolute -inset-2 bg-dark-900/70 backdrop-blur-sm rounded-xl z-10" />}
                  {/* OAuth Connect Button */}
                  <div className="p-4 bg-gradient-to-r from-yellow-400/10 to-yellow-600/10 border border-yellow-400/30 rounded-xl">
                    {snapchatSettings.accessToken ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-yellow-400 rounded-lg flex items-center justify-center">
                          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="white">
                            <path d="M12.206 2.175c-1.405.025-2.784.593-3.814 1.623-1.03 1.03-1.598 2.409-1.623 3.814-.025 1.405.543 2.784 1.573 3.814 1.03 1.03 2.409 1.598 3.814 1.623 1.405.025 2.784-.543 3.814-1.573 1.03-1.03 1.598-2.409 1.623-3.814.025-1.405-.543-2.784-1.573-3.814-1.03-1.03-2.409-1.598-3.814-1.623zm0 18.65c-1.405-.025-2.784-.593-3.814-1.623-1.03-1.03-1.598-2.409-1.623-3.814-.025-1.405.543-2.784 1.573-3.814 1.03-1.03 2.409-1.598 3.814-1.623 1.405-.025 2.784.543 3.814 1.573 1.03 1.03 1.598 2.409 1.623 3.814.025 1.405-.543 2.784-1.573 3.814-1.03 1.03-2.409 1.598-3.814 1.623z"/>
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-green-400">✓ Verbunden</p>
                          <p className="text-sm text-dark-400">{snapchatSettings.displayName || 'Snapchat Account'}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDisconnect('snapchat')}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Trennen
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-white">Mit Snapchat verbinden</h4>
                        <p className="text-sm text-dark-400">Ein Klick - fertig!</p>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            const configResponse = await fetch(`${awsConfig.api.user}/snapchat/oauth/config`)
                            if (!configResponse.ok) throw new Error('Snapchat OAuth nicht verfügbar')
                            const { clientId } = await configResponse.json()
                            
                            // Zentrale Redirect-URI über viraltenant.com (für alle Tenants)
                            const redirectUri = encodeURIComponent(`https://viraltenant.com/snapchat-callback`)
                            // Snapchat Login Kit scopes - see https://developers.snap.com/snap-kit/login-kit/overview
                            const scope = encodeURIComponent('https://auth.snapchat.com/oauth2/api/user.display_name https://auth.snapchat.com/oauth2/api/user.external_id')
                            const tenantId = localStorage.getItem('resolvedTenantId') || 'platform'
                            const encodedToken = btoa(accessToken || '')
                            const state = encodeURIComponent(`snapchat|${tenantId}|${window.location.origin}|${encodedToken}`)
                            
                            const authUrl = `https://accounts.snapchat.com/login/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}`
                            
                            const popup = window.open(authUrl, 'snapchat-oauth', 'width=600,height=700')
                            const pollTimer = setInterval(async () => {
                              if (popup?.closed) {
                                clearInterval(pollTimer)
                                const settings = await crosspostService.getSnapchatSettings(accessToken!)
                                const s = { ...settings, enabled: true }
                                setSnapchatSettings(s)
                                autoSavePlatformSettings('snapchat', s)
                              }
                            }, 500)
                          } catch (err: any) {
                            toast.error(err.message || 'Fehler beim Verbinden')
                          }
                        }}
                        className="px-4 py-2 rounded-lg font-medium text-white bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 transition-all hover:scale-105"
                      >
                        Mit Snapchat verbinden
                      </button>
                    </div>
                  )}
                </div>

                  <div className="p-4 bg-gradient-to-r from-yellow-400/10 to-yellow-600/10 border border-yellow-400/30 rounded-xl">
                    <div className="flex items-start gap-3">
                      <Music2 className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-white mb-2">Was wird auf Snapchat veröffentlicht?</h4>
                        <ul className="text-sm text-dark-300 space-y-1">
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Shorts</strong> (9:16 Videos) → werden als Snapchat Stories hochgeladen</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Bilder</strong> → werden als Snapchat Stories hochgeladen</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-red-400">✗</span>
                            <span><strong>Nur Text</strong> → wird NICHT gepostet</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Email */}
            {activeTab === 'email' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-2">E-Mail Newsletter</h3>
                  <p className="text-dark-400">Sende Posts per E-Mail an alle registrierten Benutzer</p>
                </div>
                <label className="flex items-center gap-3 cursor-pointer p-4 bg-dark-800 rounded-xl">
                  <input type="checkbox" checked={emailSettings.enabled} onChange={(e) => { const s = { ...emailSettings, enabled: e.target.checked }; setEmailSettings(s); autoSavePlatformSettings('email', s) }} className="sr-only peer" />
                  <div className="relative w-10 h-5 bg-dark-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-500"></div>
                  <span className="font-medium">E-Mail aktivieren</span>
                </label>
                <div className="relative">
                  {!emailSettings.enabled && <div className="absolute -inset-2 bg-dark-900/70 backdrop-blur-sm rounded-xl z-10" />}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">E-Mail Betreff</label>
                      <input type="text" value={emailSettings.senderName} onChange={(e) => setEmailSettings({ ...emailSettings, senderName: e.target.value })} placeholder="Neuer Beitrag von..." className="input w-full" disabled={!emailSettings.enabled} />
                      <p className="text-xs text-dark-500 mt-1">Wird als Betreffzeile der E-Mail verwendet</p>
                    </div>
                  </div>

                  {/* Info Box - What gets posted */}
                  <div className="p-4 bg-primary-500/10 border border-primary-500/30 rounded-xl">
                    <div className="flex items-start gap-3">
                      <Mail className="w-6 h-6 text-primary-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-white mb-2">Was wird per E-Mail gesendet?</h4>
                        <ul className="text-sm text-dark-300 space-y-1">
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Text</strong> → wird als HTML-E-Mail formatiert</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Bilder</strong> → werden in der E-Mail eingebettet</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-yellow-400">⚠</span>
                            <span><strong>Videos</strong> → Link zum Video (kein Inline-Video in E-Mails)</span>
                          </li>
                        </ul>
                        <p className="text-xs text-dark-400 mt-2">
                          E-Mails werden an alle registrierten Benutzer deines Tenants gesendet.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}


            {/* Facebook */}
            {activeTab === 'facebook' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-2">Facebook Page</h3>
                  <p className="text-dark-400">Poste automatisch auf deiner Facebook-Seite</p>
                </div>
                <label className="flex items-center gap-3 cursor-pointer p-4 bg-dark-800 rounded-xl">
                  <input type="checkbox" checked={facebookSettings.enabled} onChange={(e) => { const s = { ...facebookSettings, enabled: e.target.checked }; setFacebookSettings(s); autoSavePlatformSettings('facebook', s) }} className="sr-only peer" />
                  <div className="relative w-10 h-5 bg-dark-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-500"></div>
                  <span className="font-medium">Facebook aktivieren</span>
                </label>
                {facebookSettings.enabled && <PostCounter platform="facebook" postsToday={facebookSettings.postsToday} postsLastReset={facebookSettings.postsLastReset} />}

                <div className="relative">
                  {!facebookSettings.enabled && <div className="absolute -inset-2 bg-dark-900/70 backdrop-blur-sm rounded-xl z-10" />}
                  <div className="space-y-4">
                  {/* OAuth Connect Button */}
                  <div className="p-4 bg-blue-600/10 border border-blue-500/30 rounded-xl">
                    {facebookSettings.pageAccessToken ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                          <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-green-400">✓ Verbunden</p>
                          <p className="text-sm text-dark-400">{facebookSettings.pageName || 'Facebook Page'}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDisconnect('facebook')}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Trennen
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-white">Mit Facebook verbinden</h4>
                        <p className="text-sm text-dark-400">Ein Klick - fertig!</p>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            const configResponse = await fetch(`${awsConfig.api.user}/meta/oauth/config`)
                            if (!configResponse.ok) throw new Error('Meta OAuth nicht verfügbar')
                            const { appId } = await configResponse.json()
                            
                            // Zentrale Redirect-URI über viraltenant.com (für alle Tenants)
                            const redirectUri = encodeURIComponent(`https://viraltenant.com/meta-callback`)
                            const scope = encodeURIComponent('pages_show_list,pages_read_engagement,pages_manage_posts,publish_video')
                            const tenantId = localStorage.getItem('resolvedTenantId') || 'platform'
                            // Include access token in state for cross-origin callback (base64 encoded)
                            const token = accessToken || ''
                            const encodedToken = btoa(token)
                            const state = encodeURIComponent(`facebook|${tenantId}|${window.location.origin}|${encodedToken}`)
                            
                            const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}&response_type=code`
                            
                            // Open popup and poll for close
                            const popup = window.open(authUrl, 'facebook-oauth', 'width=600,height=700')
                            const pollTimer = setInterval(async () => {
                              if (popup?.closed) {
                                clearInterval(pollTimer)
                                const settings = await crosspostService.getFacebookSettings(accessToken!)
                                const s = { ...settings, enabled: true }
                                setFacebookSettings(s)
                                autoSavePlatformSettings('facebook', s)
                              }
                            }, 500)
                          } catch (err: any) {
                            toast.error(err.message || 'Fehler beim Verbinden')
                          }
                        }}
                        className="px-4 py-2 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 transition-all hover:scale-105"
                      >
                        Mit Facebook verbinden
                      </button>
                    </div>
                  )}
                  </div>

                  {/* Info Box - What gets posted */}
                  <div className="p-4 bg-blue-600/10 border border-blue-500/30 rounded-xl">
                    <div className="flex items-start gap-3">
                      <svg viewBox="0 0 24 24" className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5" fill="currentColor">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                      <div>
                        <h4 className="font-medium text-white mb-2">Was wird auf Facebook veröffentlicht?</h4>
                        <ul className="text-sm text-dark-300 space-y-1">
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Text</strong> → wird als Facebook-Post veröffentlicht</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Bilder</strong> → werden als Foto-Post veröffentlicht</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Videos</strong> → werden als Video-Post hochgeladen</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Links</strong> → werden mit Vorschau gepostet</span>
                          </li>
                        </ul>
                        <p className="text-xs text-dark-400 mt-2">
                          Es wird auf deiner Facebook-Seite gepostet, nicht auf deinem persönlichen Profil.
                        </p>
                      </div>
                    </div>
                  </div>
                  </div>
                </div>
              </div>
            )}

            {/* Instagram */}
            {activeTab === 'instagram' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-2">Instagram</h3>
                  <p className="text-dark-400">Poste automatisch auf Instagram (Business/Creator Account)</p>
                </div>
                <label className="flex items-center gap-3 cursor-pointer p-4 bg-dark-800 rounded-xl">
                  <input type="checkbox" checked={instagramSettings.enabled} onChange={(e) => { const s = { ...instagramSettings, enabled: e.target.checked }; setInstagramSettings(s); autoSavePlatformSettings('instagram', s) }} className="sr-only peer" />
                  <div className="relative w-10 h-5 bg-dark-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-500"></div>
                  <span className="font-medium">Instagram aktivieren</span>
                </label>
                {instagramSettings.enabled && <PostCounter platform="instagram" postsToday={instagramSettings.postsToday} postsLastReset={instagramSettings.postsLastReset} />}

                <div className="relative">
                  {!instagramSettings.enabled && <div className="absolute -inset-2 bg-dark-900/70 backdrop-blur-sm rounded-xl z-10" />}
                  <div className="space-y-4">
                  {/* OAuth Connect Button */}
                  <div className="p-4 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-400/10 border border-pink-500/30 rounded-xl">
                    {instagramSettings.accessToken ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(45deg, #833AB4, #E1306C, #F77737)' }}>
                          <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-green-400">✓ Verbunden</p>
                          <p className="text-sm text-dark-400">{instagramSettings.accountName || 'Instagram Account'}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDisconnect('instagram')}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Trennen
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-white">Mit Instagram verbinden</h4>
                        <p className="text-sm text-dark-400">Direkt mit Instagram einloggen - keine Facebook-Seite nötig!</p>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            const configResponse = await fetch(`${awsConfig.api.user}/instagram/oauth/config`)
                            if (!configResponse.ok) throw new Error('Instagram OAuth nicht verfügbar')
                            const { appId } = await configResponse.json()
                            
                            // Zentrale Redirect-URI über viraltenant.com (für alle Tenants)
                            const redirectUri = encodeURIComponent(`https://viraltenant.com/meta-callback`)
                            // Instagram Login API scopes (no Facebook required!)
                            const scope = encodeURIComponent('instagram_business_basic,instagram_business_content_publish,instagram_business_manage_comments')
                            const tenantId = localStorage.getItem('resolvedTenantId') || 'platform'
                            // Include access token in state for cross-origin callback (base64 encoded)
                            const token = accessToken || ''
                            const encodedToken = btoa(token)
                            const state = encodeURIComponent(`instagram|${tenantId}|${window.location.origin}|${encodedToken}`)
                            
                            // Use Instagram OAuth directly (not Facebook!)
                            const authUrl = `https://www.instagram.com/oauth/authorize?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}&response_type=code`
                            
                            // Open popup and poll for close
                            const popup = window.open(authUrl, 'instagram-oauth', 'width=600,height=700')
                            const pollTimer = setInterval(async () => {
                              if (popup?.closed) {
                                clearInterval(pollTimer)
                                const settings = await crosspostService.getInstagramSettings(accessToken!)
                                const s = { ...settings, enabled: true }
                                setInstagramSettings(s)
                                autoSavePlatformSettings('instagram', s)
                              }
                            }, 500)
                          } catch (err: any) {
                            toast.error(err.message || 'Fehler beim Verbinden')
                          }
                        }}
                        className="px-4 py-2 rounded-lg font-medium text-white transition-all hover:scale-105"
                        style={{ background: 'linear-gradient(45deg, #833AB4, #E1306C, #F77737)' }}
                      >
                        Mit Instagram verbinden
                      </button>
                    </div>
                  )}
                  </div>

                  {/* Info Box - What gets posted */}
                  <div className="p-4 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-400/10 border border-pink-500/30 rounded-xl">
                    <div className="flex items-start gap-3">
                      <svg viewBox="0 0 24 24" className="w-6 h-6 flex-shrink-0 mt-0.5" fill="url(#instagram-gradient-info)">
                        <defs>
                          <linearGradient id="instagram-gradient-info" x1="0%" y1="100%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#833AB4" />
                            <stop offset="50%" stopColor="#E1306C" />
                            <stop offset="100%" stopColor="#F77737" />
                          </linearGradient>
                        </defs>
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                      <div>
                        <h4 className="font-medium text-white mb-2">Was wird auf Instagram veröffentlicht?</h4>
                        <ul className="text-sm text-dark-300 space-y-1">
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Shorts</strong> (9:16 Videos) → werden als Instagram Reels hochgeladen</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Bilder</strong> → werden als Feed-Posts veröffentlicht</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-yellow-400">⚠</span>
                            <span><strong>16:9 Videos</strong> → werden als Reels mit Letterboxing gepostet</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-red-400">✗</span>
                            <span><strong>Reine Text-Posts</strong> → werden NICHT gepostet (Instagram erfordert Medien)</span>
                          </li>
                        </ul>
                        <p className="text-xs text-dark-400 mt-2">
                          Instagram optimiert alle Videos für Mobile. 9:16 (vertikal) wird empfohlen für beste Darstellung.
                        </p>
                      </div>
                    </div>
                  </div>
                  </div>
                </div>
              </div>
            )}

            {/* WhatsApp */}
            {activeTab === 'whatsapp' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-2">WhatsApp Broadcast</h3>
                  <p className="text-dark-400">Sende Posts automatisch an deine WhatsApp-Abonnenten</p>
                </div>
                
                <label className="flex items-center gap-3 cursor-pointer p-4 bg-dark-800 rounded-xl">
                  <input type="checkbox" checked={settings.enabled} onChange={(e) => { const s = { ...settings, enabled: e.target.checked }; setSettings(s); autoSavePlatformSettings('whatsapp', s) }} className="sr-only peer" />
                  <div className="relative w-10 h-5 bg-dark-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-500"></div>
                  <span className="font-medium">WhatsApp Broadcast aktivieren</span>
                </label>
                {settings.enabled && <PostCounter platform="whatsapp" postsToday={settings.postsToday} postsLastReset={settings.postsLastReset} />}

                <div className="relative">
                  {!settings.enabled && <div className="absolute -inset-2 bg-dark-900/70 backdrop-blur-sm rounded-xl z-10" />}
                  <div className="space-y-4">
                  {/* Subscriber Stats */}
                  <div className="p-4 bg-dark-800 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-dark-400">Aktuelle Abonnenten</span>
                    <span className="text-2xl font-bold text-green-500">{settings.subscriberCount || 0}</span>
                  </div>
                  <p className="text-sm text-dark-500">Nutzer, die deine Updates per WhatsApp erhalten</p>
                </div>

                {/* QR Code Section */}
                <div className="p-6 bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-xl">
                  <h4 className="font-medium text-green-400 mb-4 flex items-center gap-2">
                    <MessageCircle size={20} />
                    QR-Code für deine Fans
                  </h4>
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    {/* QR Code */}
                    <div className="bg-white p-4 rounded-xl shadow-lg">
                      <WhatsAppQRCode 
                        phoneNumber={settings.whatsappNumber || '+41772356998'} 
                        subscribeCode={effectiveSubscribeCode} 
                      />
                    </div>
                    {/* Instructions */}
                    <div className="flex-1 space-y-3">
                      <p className="text-sm text-dark-300">
                        Teile diesen QR-Code mit deinen Fans! Beim Scannen öffnet sich WhatsApp mit einer vorausgefüllten Nachricht.
                      </p>
                      <div className="bg-dark-900/50 p-3 rounded-lg">
                        <p className="text-xs text-dark-500 mb-1">Nachricht:</p>
                        <p className="font-mono text-green-400">START {effectiveSubscribeCode}</p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            const phone = (settings.whatsappNumber || '+41772356998').replace(/[^0-9]/g, '')
                            const url = `https://wa.me/${phone}?text=${encodeURIComponent(`START ${effectiveSubscribeCode}`)}`
                            navigator.clipboard.writeText(url)
                            toast.success('Link kopiert!')
                          }}
                          className="btn-secondary text-sm"
                        >
                          Link kopieren
                        </button>
                        <button 
                          onClick={() => {
                            const canvas = document.querySelector('#whatsapp-qr-code canvas') as HTMLCanvasElement
                            if (canvas) {
                              const link = document.createElement('a')
                              link.download = `whatsapp-subscribe-${effectiveSubscribeCode}.png`
                              link.href = canvas.toDataURL('image/png')
                              link.click()
                              toast.success('QR-Code heruntergeladen!')
                            }
                          }}
                          className="btn-secondary text-sm"
                        >
                          QR herunterladen
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subscribe Instructions */}
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                  <h4 className="font-medium text-green-400 mb-3">📱 Manuelle Anmeldung:</h4>
                  <div className="space-y-2 text-sm">
                    <p className="font-mono bg-dark-900 p-2 rounded">
                      Sende <span className="text-green-400 font-bold">START {effectiveSubscribeCode}</span> an
                    </p>
                    <p className="font-mono bg-dark-900 p-2 rounded text-lg">
                      📞 {settings.whatsappNumber || '+41772356998'}
                    </p>
                    <p className="text-dark-400 mt-2">
                      ({settings.whatsappDisplayName || 'Viral Tenant'})
                    </p>
                  </div>
                </div>

                {/* Subscribe Code - Auto-generated from tenant subdomain */}
                <div>
                  <label className="block text-sm font-medium mb-2">Subscribe-Code</label>
                  <input 
                    type="text" 
                    value={effectiveSubscribeCode} 
                    readOnly
                    placeholder="(wird automatisch gesetzt)" 
                    className="input w-full font-mono bg-dark-700 cursor-not-allowed" 
                  />
                  <p className="text-xs text-dark-500 mt-1">Wird automatisch aus deiner Subdomain generiert</p>
                </div>

                {/* Custom Welcome Message */}
                <div>
                  <label className="block text-sm font-medium mb-2">Willkommensnachricht (optional)</label>
                  <textarea 
                    value={settings.welcomeMessage || ''} 
                    onChange={(e) => setSettings({ ...settings, welcomeMessage: e.target.value })} 
                    placeholder="Wird gesendet wenn jemand abonniert..." 
                    className="input w-full h-24 resize-none" 
                    disabled={!settings.enabled} 
                  />
                </div>

                  {/* Info Box - What gets posted */}
                  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                    <div className="flex items-start gap-3">
                      <MessageCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-white mb-2">Was wird per WhatsApp gesendet?</h4>
                        <ul className="text-sm text-dark-300 space-y-1">
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Text</strong> → wird als WhatsApp-Nachricht gesendet</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Bilder</strong> → werden als Foto mit Caption gesendet</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Videos</strong> → werden als Video mit Caption gesendet</span>
                          </li>
                        </ul>
                        <p className="text-xs text-dark-400 mt-2">
                          Nachrichten werden an alle Abonnenten gesendet, die sich per QR-Code oder START-Nachricht angemeldet haben.
                        </p>
                      </div>
                    </div>
                  </div>
                  </div>
                </div>
              </div>
            )}

            {/* Signal */}
            {activeTab === 'signal' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-2">Signal</h3>
                  <p className="text-dark-400">Sende Posts an Signal-Gruppen (Self-hosted API)</p>
                </div>
                <label className="flex items-center gap-3 cursor-pointer p-4 bg-dark-800 rounded-xl">
                  <input type="checkbox" checked={signalSettings.enabled} onChange={(e) => { const s = { ...signalSettings, enabled: e.target.checked }; setSignalSettings(s); autoSavePlatformSettings('signal', s) }} className="sr-only peer" />
                  <div className="relative w-10 h-5 bg-dark-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-500"></div>
                  <span className="font-medium">Signal aktivieren</span>
                </label>
                {signalSettings.enabled && <PostCounter platform="signal" postsToday={signalSettings.postsToday} postsLastReset={signalSettings.postsLastReset} />}
                <div className="relative">
                  {!signalSettings.enabled && <div className="absolute -inset-2 bg-dark-900/70 backdrop-blur-sm rounded-xl z-10" />}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">API URL</label>
                      <input type="text" value={signalSettings.apiUrl} onChange={(e) => setSignalSettings({ ...signalSettings, apiUrl: e.target.value })} placeholder="http://localhost:8080" className="input w-full font-mono" disabled={!signalSettings.enabled} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Absender-Nummer</label>
                      <input type="text" value={signalSettings.phoneNumber} onChange={(e) => setSignalSettings({ ...signalSettings, phoneNumber: e.target.value })} placeholder="+491234567890" className="input w-full font-mono" disabled={!signalSettings.enabled} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Group ID</label>
                      <input type="text" value={signalSettings.groupId} onChange={(e) => setSignalSettings({ ...signalSettings, groupId: e.target.value })} placeholder="group.XXX==" className="input w-full font-mono" disabled={!signalSettings.enabled} />
                    </div>
                  </div>

                  {/* Info Box - What gets posted */}
                  <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                    <div className="flex items-start gap-3">
                      <svg viewBox="0 0 24 24" className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-4-4 1.41-1.41L11 14.17l6.59-6.59L19 9l-8 8z"/>
                      </svg>
                      <div>
                        <h4 className="font-medium text-white mb-2">Was wird auf Signal gepostet?</h4>
                        <ul className="text-sm text-dark-300 space-y-1">
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Text</strong> → wird als Gruppennachricht gesendet</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Bilder</strong> → werden als Attachment gesendet</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-yellow-400">⚠</span>
                            <span><strong>Videos</strong> → Link zum Video (große Dateien nicht empfohlen)</span>
                          </li>
                        </ul>
                        <p className="text-xs text-dark-400 mt-2">
                          Erfordert eine selbst-gehostete Signal-CLI REST API. Der Bot muss Mitglied der Gruppe sein.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bluesky */}
            {activeTab === 'bluesky' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-2">Bluesky</h3>
                  <p className="text-dark-400">Poste automatisch auf Bluesky (AT Protocol)</p>
                </div>
                <label className="flex items-center gap-3 cursor-pointer p-4 bg-dark-800 rounded-xl">
                  <input type="checkbox" checked={blueskySettings.enabled} onChange={(e) => { const s = { ...blueskySettings, enabled: e.target.checked }; setBlueskySettings(s); autoSavePlatformSettings('bluesky', s) }} className="sr-only peer" />
                  <div className="relative w-10 h-5 bg-dark-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-500"></div>
                  <span className="font-medium">Bluesky aktivieren</span>
                </label>
                {blueskySettings.enabled && <PostCounter platform="bluesky" postsToday={blueskySettings.postsToday} postsLastReset={blueskySettings.postsLastReset} />}
                <div className="relative">
                  {!blueskySettings.enabled && <div className="absolute -inset-2 bg-dark-900/70 backdrop-blur-sm rounded-xl z-10" />}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Handle</label>
                      <input type="text" value={blueskySettings.handle} onChange={(e) => setBlueskySettings({ ...blueskySettings, handle: e.target.value })} placeholder="username.bsky.social" className="input w-full font-mono" disabled={!blueskySettings.enabled} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">App Password</label>
                      <input type="password" value={blueskySettings.appPassword} onChange={(e) => setBlueskySettings({ ...blueskySettings, appPassword: e.target.value })} placeholder="xxxx-xxxx-xxxx-xxxx" className="input w-full font-mono" disabled={!blueskySettings.enabled} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Anzeigename (optional)</label>
                      <input type="text" value={blueskySettings.displayName} onChange={(e) => setBlueskySettings({ ...blueskySettings, displayName: e.target.value })} placeholder="Mein Account" className="input w-full" disabled={!blueskySettings.enabled} />
                    </div>
                  </div>

                  {/* Info Box - What gets posted */}
                  <div className="p-4 bg-sky-500/10 border border-sky-500/30 rounded-xl">
                    <div className="flex items-start gap-3">
                      <svg viewBox="0 0 24 24" className="w-6 h-6 text-sky-400 flex-shrink-0 mt-0.5" fill="currentColor">
                        <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.785 2.627 3.6 3.476 6.158 3.226-4.477.753-8.4 2.559-3.158 8.964C8.65 28.267 11.202 21.1 12 18.9c.798 2.2 3.35 9.367 8.376 3.537 5.242-6.405 1.319-8.211-3.158-8.964 2.558.25 5.373-.599 6.158-3.226.246-.828.624-5.789.624-6.478 0-.69-.139-1.861-.902-2.204-.659-.299-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8z"/>
                      </svg>
                      <div>
                        <h4 className="font-medium text-white mb-2">Was wird auf Bluesky veröffentlicht?</h4>
                        <ul className="text-sm text-dark-300 space-y-1">
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Text</strong> → wird als Bluesky-Post veröffentlicht (max. 300 Zeichen)</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Bilder</strong> → werden als Post mit Bildern veröffentlicht (max. 4 Bilder, je max. 976KB)</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Videos</strong> → werden als Video-Post hochgeladen (max. 50MB)</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Links</strong> → werden mit Vorschau-Card eingebettet</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-yellow-400">⚠</span>
                            <span><strong>Video-Fallback</strong> → bei Fehler werden Thumbnails als Bilder gepostet</span>
                          </li>
                        </ul>
                        <p className="text-xs text-dark-400 mt-2">
                          Bluesky nutzt das AT Protocol. Authentifizierung erfolgt über App Password (nicht dein Login-Passwort).
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Mastodon */}
            {activeTab === 'mastodon' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-2">Mastodon</h3>
                  <p className="text-dark-400">Poste automatisch auf Mastodon (ActivityPub)</p>
                </div>
                <label className="flex items-center gap-3 cursor-pointer p-4 bg-dark-800 rounded-xl">
                  <input type="checkbox" checked={mastodonSettings.enabled} onChange={(e) => { const s = { ...mastodonSettings, enabled: e.target.checked }; setMastodonSettings(s); autoSavePlatformSettings('mastodon', s) }} className="sr-only peer" />
                  <div className="relative w-10 h-5 bg-dark-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-500"></div>
                  <span className="font-medium">Mastodon aktivieren</span>
                </label>
                {mastodonSettings.enabled && <PostCounter platform="mastodon" postsToday={mastodonSettings.postsToday} postsLastReset={mastodonSettings.postsLastReset} />}
                <div className="relative">
                  {!mastodonSettings.enabled && <div className="absolute -inset-2 bg-dark-900/70 backdrop-blur-sm rounded-xl z-10" />}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Instanz URL</label>
                      <input type="text" value={mastodonSettings.instanceUrl} onChange={(e) => setMastodonSettings({ ...mastodonSettings, instanceUrl: e.target.value })} placeholder="https://mastodon.social" className="input w-full font-mono" disabled={!mastodonSettings.enabled} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Access Token</label>
                      <input type="password" value={mastodonSettings.accessToken} onChange={(e) => setMastodonSettings({ ...mastodonSettings, accessToken: e.target.value })} placeholder="Dein Access Token" className="input w-full font-mono" disabled={!mastodonSettings.enabled} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Benutzername (optional)</label>
                      <input type="text" value={mastodonSettings.username} onChange={(e) => setMastodonSettings({ ...mastodonSettings, username: e.target.value })} placeholder="@user@mastodon.social" className="input w-full" disabled={!mastodonSettings.enabled} />
                    </div>
                  </div>

                  {/* Info Box - What gets posted */}
                  <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                    <div className="flex items-start gap-3">
                      <svg viewBox="0 0 24 24" className="w-6 h-6 text-purple-400 flex-shrink-0 mt-0.5" fill="currentColor">
                        <path d="M23.268 5.313c-.35-2.578-2.617-4.61-5.304-5.004C17.51.242 15.792 0 11.813 0h-.03c-3.98 0-4.835.242-5.288.309C3.882.692 1.496 2.518.917 5.127.64 6.412.61 7.837.661 9.143c.074 1.874.088 3.745.26 5.611.118 1.24.325 2.47.62 3.68.55 2.237 2.777 4.098 4.96 4.857 2.336.792 4.849.923 7.256.38.265-.061.527-.132.786-.213.585-.184 1.27-.39 1.774-.753a.057.057 0 0 0 .023-.043v-1.809a.052.052 0 0 0-.02-.041.053.053 0 0 0-.046-.01 20.282 20.282 0 0 1-4.709.545c-2.73 0-3.463-1.284-3.674-1.818a5.593 5.593 0 0 1-.319-1.433.053.053 0 0 1 .066-.054 19.648 19.648 0 0 0 4.636.528c.164 0 .329 0 .494-.003 1.897-.048 3.89-.156 5.751-.617 .046-.011.09-.024.132-.038 2.42-.62 4.73-2.545 4.96-7.312.009-.178.019-1.86.019-2.042.001-.627.194-4.452-.205-6.793z"/>
                      </svg>
                      <div>
                        <h4 className="font-medium text-white mb-2">Was wird auf Mastodon veröffentlicht?</h4>
                        <ul className="text-sm text-dark-300 space-y-1">
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Text</strong> → wird als Toot veröffentlicht (max. 500 Zeichen)</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Bilder</strong> → werden als Medien-Attachments angehängt (max. 4 Bilder)</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Videos</strong> → werden als Video-Attachment hochgeladen (max. 40MB)</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span><strong>Video + Bilder</strong> → Video und bis zu 3 Bilder zusammen</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-yellow-400">⚠</span>
                            <span><strong>Video-Fallback</strong> → bei Fehler werden Thumbnails als Bilder gepostet</span>
                          </li>
                        </ul>
                        <p className="text-xs text-dark-400 mt-2">
                          Mastodon nutzt ActivityPub. Zeichenlimit und Medien-Limits können je nach Instanz variieren.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Test Button */}
            {isCurrentEnabled() && (
              <div className="mt-8 p-4 bg-dark-800 rounded-xl">
                <button onClick={handleTest} className="btn-secondary flex items-center gap-2">
                  <Send size={18} />
                  Test-Nachricht senden
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-dark-700 bg-dark-800/50 flex gap-3 relative z-10">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {saving ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <Save size={18} />}
            {saving ? 'Speichern...' : 'Speichern'}
          </button>
          <button onClick={onClose} disabled={saving} className="btn-secondary px-8">Abbrechen</button>
        </div>
      </div>
    </div>
  )
}
