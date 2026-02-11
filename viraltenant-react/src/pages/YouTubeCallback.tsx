import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Loader2, CheckCircle, XCircle, Youtube } from 'lucide-react'
import { awsConfig } from '../config/aws-config'
import { useAuthStore } from '../store/authStore'
import { autoChannelService } from '../services/autoChannel.service'

export const YouTubeCallback = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { accessToken } = useAuthStore()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [channelInfo, setChannelInfo] = useState<{ name: string; id: string } | null>(null)
  const [error, setError] = useState('')

  const code = searchParams.get('code')
  const state = searchParams.get('state') // Contains tenantId
  const errorParam = searchParams.get('error')

  useEffect(() => {
    if (errorParam) {
      setStatus('error')
      setError(searchParams.get('error_description') || 'YouTube Autorisierung abgelehnt')
      return
    }

    if (code && state) {
      exchangeCodeForToken()
    } else {
      setStatus('error')
      setError('Kein Autorisierungscode erhalten')
    }
  }, [code, state, errorParam])

  const exchangeCodeForToken = async () => {
    setStatus('loading')
    try {
      const response = await fetch(`${awsConfig.api.user}/youtube/oauth/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'X-Creator-ID': state || '319190e1-0791-43b0-bd04-506f959c1471'
        },
        body: JSON.stringify({
          code,
          tenantId: state,
          // Zentrale Redirect-URI über viraltenant.com (für alle Tenants)
          redirectUri: `https://viraltenant.com/youtube-callback`
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Token-Austausch fehlgeschlagen')
      }

      setChannelInfo({
        name: data.channelName || 'YouTube Kanal',
        id: data.channelId
      })
      setStatus('success')

      // Auto-add channel to Channels page
      await autoChannelService.addOrUpdateChannel({
        platform: 'youtube',
        channelId: data.channelId,
        channelTitle: data.channelName || data.channelTitle
      })
      
      // Notify parent window that channels were updated
      if (window.opener) {
        window.opener.postMessage({ type: 'channel-updated', platform: 'youtube' }, '*')
      }
      // Also trigger storage event for other tabs
      localStorage.setItem('channels-updated', Date.now().toString())

      // Auto-close after 3 seconds
      setTimeout(() => {
        window.close()
      }, 3000)
    } catch (err: any) {
      setStatus('error')
      setError(err.message)
    }
  }

  const goToSettings = () => {
    navigate('/newsfeed')
    window.close()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-dark-900">
      <div className="bg-dark-800 rounded-2xl p-8 max-w-lg w-full shadow-xl border border-dark-700">
        
        {/* Loading State */}
        {status === 'loading' && (
          <div className="text-center">
            <Loader2 size={48} className="animate-spin text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">YouTube wird verbunden...</h2>
            <p className="text-dark-400">Bitte warten</p>
          </div>
        )}

        {/* Success State */}
        {status === 'success' && (
          <div className="text-center">
            <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Youtube size={32} className="text-white" />
            </div>
            <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Erfolgreich verbunden!</h2>
            <p className="text-dark-400 mb-4">
              Dein YouTube-Kanal wurde erfolgreich verbunden.
            </p>

            {channelInfo && (
              <div className="bg-dark-700 rounded-xl p-4 mb-6">
                <p className="text-sm text-dark-400 mb-1">Verbundener Kanal:</p>
                <p className="font-medium text-lg">{channelInfo.name}</p>
              </div>
            )}

            <p className="text-sm text-dark-500 mb-4">
              Dieses Fenster schließt sich automatisch in 3 Sekunden...
            </p>

            <button onClick={goToSettings} className="btn-primary w-full">
              Zu den Einstellungen
            </button>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="text-center">
            <XCircle size={48} className="text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Verbindung fehlgeschlagen</h2>
            <p className="text-dark-400 mb-6">{error}</p>
            
            <div className="bg-dark-700/50 rounded-xl p-4 mb-6 text-left">
              <h3 className="font-medium mb-2 text-sm">Mögliche Ursachen:</h3>
              <ul className="text-sm text-dark-400 space-y-1">
                <li>• Client ID oder Secret falsch</li>
                <li>• Redirect URI nicht korrekt konfiguriert</li>
                <li>• YouTube Data API v3 nicht aktiviert</li>
                <li>• Autorisierung wurde abgelehnt</li>
              </ul>
            </div>

            <button onClick={() => window.close()} className="btn-secondary w-full">
              Fenster schließen
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
