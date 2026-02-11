import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle, XCircle, Twitch } from 'lucide-react'
import { awsConfig } from '../config/aws-config'
import { useAuthStore } from '../store/authStore'
import { autoChannelService } from '../services/autoChannel.service'

export const TwitchCallback = () => {
  const [searchParams] = useSearchParams()
  const { accessToken } = useAuthStore()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [connectedAccount, setConnectedAccount] = useState('')
  const [error, setError] = useState('')

  const code = searchParams.get('code')
  const state = searchParams.get('state') // tenantId
  const errorParam = searchParams.get('error')

  useEffect(() => {
    if (errorParam) {
      setStatus('error')
      setError(searchParams.get('error_description') || 'Autorisierung abgelehnt')
      notifyParent('error', errorParam)
      return
    }

    if (code && state) {
      exchangeCodeForToken()
    } else {
      setStatus('error')
      setError('Ungültige Callback-Parameter')
    }
  }, [code, state, errorParam])

  const notifyParent = (type: 'success' | 'error', data?: any) => {
    if (window.opener) {
      window.opener.postMessage({
        type: type === 'success' ? 'twitch-oauth-success' : 'twitch-oauth-error',
        ...data
      }, window.location.origin)
    }
  }

  const exchangeCodeForToken = async () => {
    try {
      const response = await fetch(`${awsConfig.api.user}/twitch/oauth/callback`, {
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
          redirectUri: `https://viraltenant.com/twitch-callback`
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Token-Austausch fehlgeschlagen')
      }

      setConnectedAccount(data.displayName || data.username || 'Verbunden')
      setStatus('success')
      
      // Auto-add channel to Channels page
      await autoChannelService.addOrUpdateChannel({
        platform: 'twitch',
        username: data.username,
        accountName: data.displayName || data.username
      })
      
      // Notify parent window that channels were updated
      if (window.opener) {
        window.opener.postMessage({ type: 'channel-updated', platform: 'twitch' }, '*')
      }
      localStorage.setItem('channels-updated', Date.now().toString())
      
      // Notify parent window
      notifyParent('success', {
        userId: data.userId,
        username: data.username,
        displayName: data.displayName,
        profileImageUrl: data.profileImageUrl,
        streamKey: data.streamKey
      })
      
      // Auto-close after 3 seconds
      setTimeout(() => {
        window.close()
      }, 3000)
    } catch (err: any) {
      setStatus('error')
      setError(err.message)
      notifyParent('error', { error: err.message })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-dark-900">
      <div className="bg-dark-800 rounded-2xl p-8 max-w-md w-full shadow-xl border border-dark-700">
        
        {/* Twitch Icon */}
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 bg-purple-600">
          <Twitch className="w-8 h-8 text-white" />
        </div>

        {/* Loading State */}
        {status === 'loading' && (
          <div className="text-center">
            <Loader2 size={32} className="animate-spin mx-auto mb-4 text-purple-500" />
            <h2 className="text-xl font-semibold mb-2">Twitch wird verbunden...</h2>
            <p className="text-dark-400">Bitte warten</p>
          </div>
        )}

        {/* Success State */}
        {status === 'success' && (
          <div className="text-center">
            <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Twitch verbunden!</h2>
            {connectedAccount && (
              <p className="text-dark-400 mb-4">
                Verbunden mit <span className="font-medium text-purple-400">{connectedAccount}</span>
              </p>
            )}
            <p className="text-sm text-dark-500">Dieses Fenster schließt sich automatisch...</p>
            <button 
              onClick={() => window.close()} 
              className="btn-secondary mt-4"
            >
              Fenster schließen
            </button>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="text-center">
            <XCircle size={48} className="text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Verbindung fehlgeschlagen</h2>
            <p className="text-dark-400 mb-6">{error}</p>
            <button 
              onClick={() => window.close()} 
              className="btn-primary"
            >
              Schließen
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
