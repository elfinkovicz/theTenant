import { useState, useEffect, useMemo } from 'react'
import { Save, X, MessageCircle, Send, Mail, Hash, Link, Info, AtSign, Youtube, Cloud, Globe, Music2 } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { useAuthStore } from '../store/authStore'
import { useTenant } from '../providers/TenantProvider'
import { crosspostService, WhatsAppSettings, TelegramSettings, EmailSettings, DiscordSettings, SlackSettings, FacebookSettings, InstagramSettings, SignalSettings, XTwitterSettings, LinkedInSettings, ThreadsSettings, YouTubeSettings, BlueskySettings, MastodonSettings, TikTokSettings, SnapchatSettings } from '../services/crosspost.service'
import { awsConfig } from '../config/aws-config'
import { toast } from '../utils/toast-alert'
import { autoChannelService } from '../services/autoChannel.service'

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

const InfoBox = ({ items }: { items: string[] }) => (
  <div className="mt-6 p-4 bg-dark-800/50 border border-dark-700 rounded-xl">
    <div className="flex items-center gap-2 text-dark-400 mb-2">
      <Info size={16} />
      <span className="text-sm font-medium">So bekommst du die Daten</span>
    </div>
    <ul className="text-xs text-dark-500 space-y-1">
      {items.map((item, i) => (
        <li key={i}>• {item}</li>
      ))}
    </ul>
  </div>
)

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
          const clearedXTwitter = { ...xTwitterSettings, oauth2AccessToken: '', oauth2RefreshToken: '', userId: '', accountName: '' } as any
          setXTwitterSettings(clearedXTwitter)
          await crosspostService.updateXTwitterSettings(clearedXTwitter, accessToken)
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
            {enabledChannels.map((channel, index) => {
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
              const pos = positions[index % positions.length]
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
                  <input type="checkbox" checked={telegramSettings.enabled} onChange={(e) => setTelegramSettings({ ...telegramSettings, enabled: e.target.checked })} className="w-5 h-5 rounded accent-primary-500" />
                  <span className="font-medium">Telegram aktivieren</span>
                </label>
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
                <InfoBox items={[
                  'Öffne Telegram und suche @BotFather',
                  'Sende /newbot und folge den Anweisungen',
                  'Bot Token wird dir nach Erstellung angezeigt',
                  'Füge den Bot zu deinem Kanal/Gruppe hinzu (als Admin)',
                  'Chat-ID: Sende eine Nachricht an @userinfobot oder @getidsbot'
                ]} />
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
                  <input type="checkbox" checked={discordSettings.enabled} onChange={(e) => setDiscordSettings({ ...discordSettings, enabled: e.target.checked })} className="w-5 h-5 rounded accent-primary-500" />
                  <span className="font-medium">Discord aktivieren</span>
                </label>
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
                <InfoBox items={[
                  'Rechtsklick auf den Discord-Kanal → Kanal bearbeiten',
                  'Integrationen → Webhooks → Neuer Webhook',
                  'Namen und Avatar anpassen (optional)',
                  'Webhook-URL kopieren und hier einfügen'
                ]} />
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
                  <input type="checkbox" checked={slackSettings.enabled} onChange={(e) => setSlackSettings({ ...slackSettings, enabled: e.target.checked })} className="w-5 h-5 rounded accent-primary-500" />
                  <span className="font-medium">Slack aktivieren</span>
                </label>
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
                <InfoBox items={[
                  'Gehe zu api.slack.com/apps → Create New App',
                  'Wähle "From scratch" und deinen Workspace',
                  'Incoming Webhooks aktivieren',
                  'Add New Webhook to Workspace → Kanal wählen',
                  'Webhook URL kopieren und hier einfügen'
                ]} />
              </div>
            )}

            {/* X Twitter */}
            {activeTab === 'xtwitter' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-2">X (Twitter)</h3>
                  <p className="text-dark-400">Poste automatisch auf X (Text, Bilder & Videos)</p>
                </div>

                {/* Setup-Anleitung */}
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
                  <h4 className="font-medium text-blue-400 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Kurzanleitung zur Einrichtung
                  </h4>
                  <div className="text-sm text-dark-300 space-y-1">
                    <p className="text-yellow-400/80 text-xs mb-2">⚠️ Voraussetzung: X Account muss mind. 30 Tage alt sein (kein Premium nötig)</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                      <li><a href="https://developer.x.com" target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">developer.x.com</a> öffnen und anmelden</li>
                      <li>"Create Project" → Namen vergeben</li>
                      <li>Im Projekt eine neue App anlegen</li>
                      <li>"User authentication settings" → "Read and write" aktivieren</li>
                      <li>Callback URL: <code className="bg-dark-700 px-1 rounded">https://viraltenant.com</code></li>
                      <li>Unter "Keys and Tokens" alle 4 Keys generieren</li>
                      <li>Keys hier unten eintragen</li>
                      <li>"Verbindung testen" klicken</li>
                    </ol>
                    <p className="text-dark-400 text-xs mt-2">📊 Free Tier: 1.500 Posts/Monat (ca. 50/Tag)</p>
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer p-4 bg-dark-800 rounded-xl">
                  <input type="checkbox" checked={xTwitterSettings.enabled} onChange={(e) => setXTwitterSettings({ ...xTwitterSettings, enabled: e.target.checked })} className="w-5 h-5 rounded accent-primary-500" />
                  <span className="font-medium">X aktivieren</span>
                </label>

                {/* Connection Status */}
                <div className="p-4 bg-gray-800/30 border border-gray-600/30 rounded-xl">
                  {xTwitterSettings.accessToken ? (
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
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
                        <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-400" fill="currentColor">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-dark-400">Nicht verbunden</p>
                        <p className="text-sm text-dark-500">API Keys eingeben und verbinden</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* API Keys */}
                <div className="bg-dark-800/50 rounded-xl p-4 space-y-4">
                  <div>
                    <h4 className="font-medium text-white mb-2">X API Keys</h4>
                    <p className="text-xs text-dark-400 mb-4">
                      Erstelle eine App im <a href="https://developer.x.com/en/portal/dashboard" target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">X Developer Portal</a>. 
                      Unter "Keys and Tokens" findest du alle 4 benötigten Keys.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">API Key (Consumer Key)</label>
                      <input 
                        type="text" 
                        value={xTwitterSettings.apiKey} 
                        onChange={(e) => setXTwitterSettings({ ...xTwitterSettings, apiKey: e.target.value })} 
                        placeholder="z.B. xvz1evFS4wEEPTGEFPHBog" 
                        className="input w-full font-mono text-sm" 
                        disabled={!xTwitterSettings.enabled} 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">API Secret (Consumer Secret)</label>
                      <input 
                        type="password" 
                        value={xTwitterSettings.apiSecret} 
                        onChange={(e) => setXTwitterSettings({ ...xTwitterSettings, apiSecret: e.target.value })} 
                        placeholder="Dein API Secret" 
                        className="input w-full font-mono text-sm" 
                        disabled={!xTwitterSettings.enabled} 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Access Token</label>
                      <input 
                        type="text" 
                        value={xTwitterSettings.accessToken} 
                        onChange={(e) => setXTwitterSettings({ ...xTwitterSettings, accessToken: e.target.value })} 
                        placeholder="Dein Access Token" 
                        className="input w-full font-mono text-sm" 
                        disabled={!xTwitterSettings.enabled} 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Access Token Secret</label>
                      <input 
                        type="password" 
                        value={xTwitterSettings.accessTokenSecret} 
                        onChange={(e) => setXTwitterSettings({ ...xTwitterSettings, accessTokenSecret: e.target.value })} 
                        placeholder="Dein Access Token Secret" 
                        className="input w-full font-mono text-sm" 
                        disabled={!xTwitterSettings.enabled} 
                      />
                    </div>
                  </div>
                  
                  {/* Test Connection Button */}
                  {xTwitterSettings.apiKey && xTwitterSettings.apiSecret && xTwitterSettings.accessToken && xTwitterSettings.accessTokenSecret && (
                    <button
                      onClick={async () => {
                        try {
                          setSaving(true)
                          // First save the settings
                          await crosspostService.updateXTwitterSettings(xTwitterSettings, accessToken!)
                          // Then test the connection
                          const result = await crosspostService.testXTwitterConnection(accessToken!)
                          if (result.success) {
                            toast.success(result.message || 'X Verbindung erfolgreich!')
                            if (result.username) {
                              setXTwitterSettings({ ...xTwitterSettings, accountName: result.username })
                            }
                          } else {
                            toast.error(result.error || 'Verbindung fehlgeschlagen')
                          }
                        } catch (error: any) {
                          toast.error(error.message || 'Verbindungstest fehlgeschlagen')
                        } finally {
                          setSaving(false)
                        }
                      }}
                      disabled={!xTwitterSettings.enabled || saving}
                      className="w-full btn-primary py-3 flex items-center justify-center gap-2"
                    >
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                      {saving ? 'Teste...' : 'Verbindung testen'}
                    </button>
                  )}
                  
                  {/* Send Test Message Button - only show when connected */}
                  {xTwitterSettings.accountName && (
                    <button
                      onClick={async () => {
                        try {
                          setSaving(true)
                          await crosspostService.sendXTwitterTestMessage(accessToken!)
                          toast.success('Test-Tweet gesendet! 🎉')
                        } catch (error: any) {
                          toast.error(error.response?.data?.error || error.message || 'Fehler beim Senden')
                        } finally {
                          setSaving(false)
                        }
                      }}
                      disabled={!xTwitterSettings.enabled || saving}
                      className="w-full btn-secondary py-3 flex items-center justify-center gap-2"
                    >
                      <Send size={18} />
                      {saving ? 'Sende...' : 'Test-Tweet senden'}
                    </button>
                  )}
                </div>

                {/* Important Notice */}
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <p className="text-yellow-400 text-sm font-medium mb-1">⚠️ Wichtig</p>
                  <p className="text-dark-300 text-sm">Dein X Account muss mindestens 30 Tage alt sein und eine verifizierte Telefonnummer haben. X Premium ist nicht erforderlich.</p>
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
                  <input type="checkbox" checked={linkedInSettings.enabled} onChange={(e) => setLinkedInSettings({ ...linkedInSettings, enabled: e.target.checked })} className="w-5 h-5 rounded accent-primary-500" />
                  <span className="font-medium">LinkedIn aktivieren</span>
                </label>

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
                            const state = encodeURIComponent(tenantId)
                            const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`
                            
                            // Open popup and poll for close
                            const popup = window.open(authUrl, 'linkedin-oauth', 'width=600,height=700')
                            const pollTimer = setInterval(async () => {
                              if (popup?.closed) {
                                clearInterval(pollTimer)
                                // Reload settings after popup closes
                                const settings = await crosspostService.getLinkedInSettings(accessToken!)
                                setLinkedInSettings(settings)
                              }
                            }, 500)
                          } catch (err: any) {
                            toast.error(err.message || 'Fehler beim Verbinden')
                          }
                        }}
                        className="px-4 py-2 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 transition-all hover:scale-105"
                        disabled={!linkedInSettings.enabled}
                      >
                        Mit LinkedIn verbinden
                      </button>
                    </div>
                  )}
                </div>

                <InfoBox items={[
                  'Klicke auf "Mit LinkedIn verbinden"',
                  'Melde dich mit deinem LinkedIn-Account an',
                  'Access Token ist 60 Tage gültig, dann erneut verbinden'
                ]} />
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
                  <input type="checkbox" checked={threadsSettings.enabled} onChange={(e) => setThreadsSettings({ ...threadsSettings, enabled: e.target.checked })} className="w-5 h-5 rounded accent-primary-500" />
                  <span className="font-medium">Threads aktivieren</span>
                </label>

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
                            const token = localStorage.getItem('accessToken') || ''
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
                                setThreadsSettings(settings)
                              }
                            }, 500)
                          } catch (err: any) {
                            toast.error(err.message || 'Fehler beim Verbinden')
                          }
                        }}
                        className="px-4 py-2 rounded-lg font-medium text-white bg-gray-800 hover:bg-gray-700 transition-all hover:scale-105 border border-gray-600"
                        disabled={!threadsSettings.enabled}
                      >
                        Mit Threads verbinden
                      </button>
                    </div>
                  )}
                </div>

                <InfoBox items={[
                  'Threads Account erforderlich',
                  'Nutzt die gleiche Meta App wie Instagram',
                  'Token ist 60 Tage gültig, dann erneut verbinden'
                ]} />
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
                  <input type="checkbox" checked={youtubeSettings.enabled} onChange={(e) => setYoutubeSettings({ ...youtubeSettings, enabled: e.target.checked })} className="w-5 h-5 rounded accent-primary-500" />
                  <span className="font-medium">YouTube Shorts aktivieren</span>
                </label>

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
                            
                            const state = btoa(JSON.stringify({ tenantId, redirectUri }))
                            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${encodeURIComponent(state)}&response_type=code&access_type=offline&prompt=consent`
                            
                            // Open popup and poll for close
                            const popup = window.open(authUrl, 'youtube-oauth', 'width=600,height=700')
                            const pollTimer = setInterval(async () => {
                              if (popup?.closed) {
                                clearInterval(pollTimer)
                                const settings = await crosspostService.getYouTubeSettings(accessToken!)
                                setYoutubeSettings(settings)
                              }
                            }, 500)
                          } catch (err: any) {
                            toast.error(err.message || 'Fehler beim Verbinden')
                          }
                        }}
                        className="px-4 py-2 rounded-lg font-medium text-white bg-red-600 hover:bg-red-700 transition-all hover:scale-105"
                        disabled={!youtubeSettings.enabled}
                      >
                        Mit YouTube verbinden
                      </button>
                    </div>
                  )}
                </div>

                <InfoBox items={[
                  'Klicke auf "Mit YouTube verbinden"',
                  'Wähle deinen Google Account und YouTube-Kanal',
                  'Refresh Token wird automatisch gespeichert (kein Ablauf)'
                ]} />

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
                      <input type="checkbox" checked={tiktokSettings.enabled} onChange={(e) => setTiktokSettings({ ...tiktokSettings, enabled: e.target.checked })} className="w-5 h-5 rounded accent-primary-500" />
                      <span className="font-medium">TikTok aktivieren</span>
                    </label>

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
                              const state = encodeURIComponent(tenantId)
                              
                              const authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}&response_type=code&code_challenge=${codeChallenge}&code_challenge_method=S256`
                              
                              // Open popup and poll for close
                              const popup = window.open(authUrl, 'tiktok-oauth', 'width=600,height=700')
                              const pollTimer = setInterval(async () => {
                                if (popup?.closed) {
                                  clearInterval(pollTimer)
                                  const settings = await crosspostService.getTikTokSettings(accessToken!)
                                  setTiktokSettings(settings)
                                }
                              }, 500)
                            } catch (err: any) {
                              toast.error(err.message || 'Fehler beim Verbinden')
                            }
                          }}
                          className="px-4 py-2 rounded-lg font-medium text-white bg-gradient-to-r from-pink-500 to-cyan-500 hover:from-pink-600 hover:to-cyan-600 transition-all hover:scale-105"
                          disabled={!tiktokSettings.enabled}
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

                {/* Settings */}
                {tiktokSettings.accessToken && (
                  <div className="space-y-4">
                    {/* Posting Counter */}
                    <div className="p-4 bg-dark-800 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Posts heute</span>
                        <span className={`text-lg font-bold ${tiktokSettings.postsToday >= 10 ? 'text-red-400' : tiktokSettings.postsToday >= 7 ? 'text-yellow-400' : 'text-green-400'}`}>
                          {tiktokSettings.postsToday || 0} / 10
                        </span>
                      </div>
                      <div className="w-full bg-dark-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${tiktokSettings.postsToday >= 10 ? 'bg-red-500' : tiktokSettings.postsToday >= 7 ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${Math.min((tiktokSettings.postsToday || 0) / 10 * 100, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-dark-400 mt-2">TikTok erlaubt max. 10 Posts pro Tag pro Account</p>
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer p-4 bg-dark-800 rounded-xl">
                      <input 
                        type="checkbox" 
                        checked={tiktokSettings.postAsDraft} 
                        onChange={(e) => setTiktokSettings({ ...tiktokSettings, postAsDraft: e.target.checked })} 
                        className="w-5 h-5 rounded accent-primary-500" 
                      />
                      <div>
                        <span className="font-medium">Als Entwurf senden</span>
                        <p className="text-xs text-dark-400">Video wird in TikTok-Inbox gesendet, du musst es manuell veröffentlichen</p>
                      </div>
                    </label>
                  </div>
                )}

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
                    onChange={(e) => setSnapchatSettings({ ...snapchatSettings, enabled: e.target.checked })} 
                    className="w-5 h-5 rounded accent-primary-500" 
                  />
                  <span className="font-medium">Snapchat aktivieren</span>
                </label>

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
                            const state = encodeURIComponent(tenantId)
                            
                            const authUrl = `https://accounts.snapchat.com/login/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}`
                            
                            const popup = window.open(authUrl, 'snapchat-oauth', 'width=600,height=700')
                            const pollTimer = setInterval(async () => {
                              if (popup?.closed) {
                                clearInterval(pollTimer)
                                const settings = await crosspostService.getSnapchatSettings(accessToken!)
                                setSnapchatSettings(settings)
                              }
                            }, 500)
                          } catch (err: any) {
                            toast.error(err.message || 'Fehler beim Verbinden')
                          }
                        }}
                        className="px-4 py-2 rounded-lg font-medium text-white bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 transition-all hover:scale-105"
                        disabled={!snapchatSettings.enabled}
                      >
                        Mit Snapchat verbinden
                      </button>
                    </div>
                  )}
                </div>

                {snapchatSettings.accessToken && (
                  <div className="space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer p-4 bg-dark-800 rounded-xl">
                      <input 
                        type="checkbox" 
                        checked={snapchatSettings.postAsStory} 
                        onChange={(e) => setSnapchatSettings({ ...snapchatSettings, postAsStory: e.target.checked })} 
                        className="w-5 h-5 rounded accent-primary-500" 
                      />
                      <div>
                        <p className="font-medium">Als Story veröffentlichen</p>
                        <p className="text-sm text-dark-400">Posts werden als Snapchat Story veröffentlicht</p>
                      </div>
                    </label>
                  </div>
                )}

                <InfoBox items={[
                  'Klicke auf "Mit Snapchat verbinden"',
                  'Melde dich bei Snapchat an und erlaube den Zugriff',
                  'Benötigt Snapchat Business Account',
                  'Videos sollten im Hochformat (9:16) sein'
                ]} />

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
            )}

            {/* Email */}
            {activeTab === 'email' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-2">E-Mail Newsletter</h3>
                  <p className="text-dark-400">Sende Posts per E-Mail an alle registrierten Benutzer</p>
                </div>
                <label className="flex items-center gap-3 cursor-pointer p-4 bg-dark-800 rounded-xl">
                  <input type="checkbox" checked={emailSettings.enabled} onChange={(e) => setEmailSettings({ ...emailSettings, enabled: e.target.checked })} className="w-5 h-5 rounded accent-primary-500" />
                  <span className="font-medium">E-Mail aktivieren</span>
                </label>
                <div className="grid gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">E-Mail Betreff</label>
                    <input type="text" value={emailSettings.senderName} onChange={(e) => setEmailSettings({ ...emailSettings, senderName: e.target.value })} placeholder="Neuer Beitrag von..." className="input w-full" disabled={!emailSettings.enabled} />
                    <p className="text-xs text-dark-500 mt-1">Wird als Betreffzeile der E-Mail verwendet</p>
                  </div>
                </div>
                <InfoBox items={[
                  'E-Mail-Versand ist bereits integriert',
                  'Absender-Adresse: [dein-tenant]@viraltenant.com',
                  'Empfänger: Alle registrierten Benutzer deines Tenants',
                  'Benutzer können sich über Link in der E-Mail abmelden'
                ]} />
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
                  <input type="checkbox" checked={facebookSettings.enabled} onChange={(e) => setFacebookSettings({ ...facebookSettings, enabled: e.target.checked })} className="w-5 h-5 rounded accent-primary-500" />
                  <span className="font-medium">Facebook aktivieren</span>
                </label>

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
                            const token = localStorage.getItem('accessToken') || ''
                            const encodedToken = btoa(token)
                            const state = encodeURIComponent(`facebook|${tenantId}|${window.location.origin}|${encodedToken}`)
                            
                            const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}&response_type=code`
                            
                            // Open popup and poll for close
                            const popup = window.open(authUrl, 'facebook-oauth', 'width=600,height=700')
                            const pollTimer = setInterval(async () => {
                              if (popup?.closed) {
                                clearInterval(pollTimer)
                                const settings = await crosspostService.getFacebookSettings(accessToken!)
                                setFacebookSettings(settings)
                              }
                            }, 500)
                          } catch (err: any) {
                            toast.error(err.message || 'Fehler beim Verbinden')
                          }
                        }}
                        className="px-4 py-2 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 transition-all hover:scale-105"
                        disabled={!facebookSettings.enabled}
                      >
                        Mit Facebook verbinden
                      </button>
                    </div>
                  )}
                </div>

                {/* Meta API Verification Button - for App Review */}
                {(facebookSettings.pageAccessToken || instagramSettings.accessToken || threadsSettings.accessToken) && (
                  <div className="p-4 bg-purple-600/10 border border-purple-500/30 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-white">🔧 Meta API Verification</h4>
                        <p className="text-sm text-dark-400">Für Meta App Review - testet alle Berechtigungen</p>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            toast.success('Starte API Verification...')
                            const result = await crosspostService.verifyMetaApiPermissions(accessToken!)
                            if (result.success) {
                              toast.success(`✅ ${result.results.filter((r: any) => r.status === 'success').length}/${result.results.length} Berechtigungen verifiziert!`)
                            } else {
                              toast.error(`⚠️ ${result.results.filter((r: any) => r.status === 'success').length}/${result.results.length} Berechtigungen erfolgreich`)
                            }
                            // Show detailed results
                            console.log('Meta API Verification Results:', result.results)
                            alert(result.results.map((r: any) => `${r.status === 'success' ? '✅' : '❌'} ${r.permission}: ${r.message}`).join('\n'))
                          } catch (err: any) {
                            toast.error(err.message || 'Verification fehlgeschlagen')
                          }
                        }}
                        className="px-4 py-2 rounded-lg font-medium text-white bg-purple-600 hover:bg-purple-700 transition-all hover:scale-105"
                      >
                        API Verifizieren
                      </button>
                    </div>
                  </div>
                )}

                <InfoBox items={[
                  'Du musst Admin einer Facebook-Seite sein',
                  'Token ist 60 Tage gültig, dann erneut verbinden',
                  'Posts erscheinen auf deiner Facebook-Seite'
                ]} />
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
                  <input type="checkbox" checked={instagramSettings.enabled} onChange={(e) => setInstagramSettings({ ...instagramSettings, enabled: e.target.checked })} className="w-5 h-5 rounded accent-primary-500" />
                  <span className="font-medium">Instagram aktivieren</span>
                </label>

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
                            const token = localStorage.getItem('accessToken') || ''
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
                                setInstagramSettings(settings)
                              }
                            }, 500)
                          } catch (err: any) {
                            toast.error(err.message || 'Fehler beim Verbinden')
                          }
                        }}
                        className="px-4 py-2 rounded-lg font-medium text-white transition-all hover:scale-105"
                        style={{ background: 'linear-gradient(45deg, #833AB4, #E1306C, #F77737)' }}
                        disabled={!instagramSettings.enabled}
                      >
                        Mit Instagram verbinden
                      </button>
                    </div>
                  )}
                </div>

                <InfoBox items={[
                  'Instagram Business oder Creator Account erforderlich',
                  'Keine Facebook-Seite nötig - direkt mit Instagram einloggen!',
                  'Nur Bilder/Videos möglich, kein reiner Text',
                  'Token ist 60 Tage gültig, dann erneut verbinden'
                ]} />

                {/* Info Box - What gets posted (nach InfoBox positioniert) */}
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
            )}

            {/* WhatsApp */}
            {activeTab === 'whatsapp' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-2">WhatsApp Broadcast</h3>
                  <p className="text-dark-400">Sende Posts automatisch an deine WhatsApp-Abonnenten</p>
                </div>
                
                <label className="flex items-center gap-3 cursor-pointer p-4 bg-dark-800 rounded-xl">
                  <input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} className="w-5 h-5 rounded accent-primary-500" />
                  <span className="font-medium">WhatsApp Broadcast aktivieren</span>
                </label>

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

                <InfoBox items={[
                  'Nutzer abonnieren per WhatsApp-Nachricht an die zentrale Nummer',
                  `Subscribe-Code: START ${effectiveSubscribeCode}`,
                  'Bei jedem neuen Post werden alle Abonnenten benachrichtigt',
                  'Bilder und Videos werden automatisch mitgesendet',
                  `Abbestellen mit: STOP ${effectiveSubscribeCode}`
                ]} />
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
                  <input type="checkbox" checked={signalSettings.enabled} onChange={(e) => setSignalSettings({ ...signalSettings, enabled: e.target.checked })} className="w-5 h-5 rounded accent-primary-500" />
                  <span className="font-medium">Signal aktivieren</span>
                </label>
                <div className="grid gap-4">
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
                <InfoBox items={[
                  'Signal hat keine offizielle Bot-API',
                  'Erfordert self-hosted signal-cli-rest-api',
                  'GitHub: bbernhard/signal-cli-rest-api',
                  'Separate Telefonnummer für den Bot nötig',
                  'Group ID: Über signal-cli listGroups abrufen'
                ]} />
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
                  <input type="checkbox" checked={blueskySettings.enabled} onChange={(e) => setBlueskySettings({ ...blueskySettings, enabled: e.target.checked })} className="w-5 h-5 rounded accent-primary-500" />
                  <span className="font-medium">Bluesky aktivieren</span>
                </label>
                <div className="grid gap-4">
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
                <InfoBox items={[
                  'Gehe zu bsky.app → Einstellungen → App Passwords',
                  'Erstelle ein neues App Password',
                  'Handle ist dein Benutzername (z.B. user.bsky.social)',
                  'App Password ist NICHT dein Login-Passwort',
                  'Bluesky Posts sind auf 300 Zeichen begrenzt'
                ]} />
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
                  <input type="checkbox" checked={mastodonSettings.enabled} onChange={(e) => setMastodonSettings({ ...mastodonSettings, enabled: e.target.checked })} className="w-5 h-5 rounded accent-primary-500" />
                  <span className="font-medium">Mastodon aktivieren</span>
                </label>
                <div className="grid gap-4">
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
                <InfoBox items={[
                  'Gehe zu deiner Mastodon-Instanz → Einstellungen → Entwicklung',
                  'Erstelle eine neue Anwendung',
                  'Berechtigungen: read, write (für Posts)',
                  'Kopiere den Access Token',
                  'Instanz URL ist die Adresse deiner Mastodon-Instanz'
                ]} />
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
