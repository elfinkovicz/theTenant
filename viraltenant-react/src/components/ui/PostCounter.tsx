import { InfoTooltip } from './InfoTooltip'

// Known daily API limits per platform (conservative estimates)
const PLATFORM_LIMITS: Record<string, { limit: number; label: string }> = {
  tiktok:    { limit: 10,   label: 'TikTok erlaubt max. 10 Posts pro Tag pro Account' },
  instagram: { limit: 15,   label: 'Instagram erlaubt max. 15 Posts pro Tag' },
  facebook:  { limit: 15,   label: 'Facebook erlaubt max. 15 Posts pro Tag pro Seite' },
  xtwitter:  { limit: 15,   label: 'X erlaubt max. 15 Posts pro Tag' },
  linkedin:  { limit: 10,   label: 'LinkedIn erlaubt max. 10 Posts pro Tag' },
  threads:   { limit: 15,   label: 'Threads erlaubt max. 15 Posts pro Tag' },
  bluesky:   { limit: 15,   label: 'Bluesky erlaubt max. 15 Posts pro Tag' },
  mastodon:  { limit: 15,   label: 'Mastodon erlaubt max. 15 Posts pro Tag' },
  youtube:   { limit: 10,   label: 'YouTube erlaubt max. 10 Uploads pro Tag' },
  snapchat:  { limit: 15,   label: 'Snapchat erlaubt max. 15 Posts pro Tag' },
  telegram:  { limit: 15,   label: 'Telegram erlaubt max. 15 Nachrichten pro Tag' },
  discord:   { limit: 15,   label: 'Discord erlaubt max. 15 Nachrichten pro Tag' },
  slack:     { limit: 15,   label: 'Slack erlaubt max. 15 Nachrichten pro Tag' },
  whatsapp:  { limit: 15,   label: 'WhatsApp erlaubt max. 15 Nachrichten pro Tag' },
}

interface PostCounterProps {
  platform: string
  postsToday?: number
  postsLastReset?: string
}

export const PostCounter = ({ platform, postsToday, postsLastReset }: PostCounterProps) => {
  const config = PLATFORM_LIMITS[platform]
  if (!config) return null

  const today = new Date().toISOString().split('T')[0]
  const count = postsLastReset === today ? (postsToday || 0) : 0
  const { limit, label } = config
  const pct = Math.min(count / limit * 100, 100)
  const warn = count >= limit * 0.9
  const danger = count >= limit

  return (
    <div className="p-3 bg-dark-800/30 border border-dark-700/50 rounded-lg">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium flex items-center gap-2">
          Posts heute
          <InfoTooltip text={label} size={13} />
        </span>
        <span className={`text-sm font-bold ${danger ? 'text-red-400' : warn ? 'text-yellow-400' : 'text-green-400'}`}>
          {count} / {limit}
        </span>
      </div>
      <div className="w-full bg-dark-700/50 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${danger ? 'bg-red-500' : warn ? 'bg-yellow-500' : 'bg-green-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
