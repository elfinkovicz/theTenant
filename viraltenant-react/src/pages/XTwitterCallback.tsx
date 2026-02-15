import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { awsConfig } from '../config/aws-config'
import { useAuthStore } from '../store/authStore'
import { autoChannelService } from '../services/autoChannel.service'

export const XTwitterCallback = () => {
  const [searchParams] = useSearchParams()
  const { accessToken } = useAuthStore()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')
  const [userName, setUserName] = useState('')

  const oauthToken = searchParams.get('oauth_token')
  const oauthVerifier = searchParams.get('oauth_verifier')
  const denied = searchParams.get('denied')

  useEffect(() => {
    if (denied) {
      setStatus('error')
      setError('X Autorisierung abgelehnt')
      return
    }

    if (oauthToken && oauthVerifier) {
      exchangeVerifier()
    } else {
      setStatus('error')
      setError('Keine OAuth-Parameter erhalten')
    }
  }, [oauthToken, oauthVerifier, denied])

  const exchangeVerifier = async () => {
    setStatus('loading')
    try {
      const tenantId = localStorage.getItem('resolvedTenantId') || sessionStorage.getItem('x_oauth_tenant_id') || ''
      // Get access token from localStorage (stored by NewsfeedSettings before opening popup)
      const storedToken = localStorage.getItem('x_oauth_access_token')
      const tokenToUse = storedToken || accessToken

      const response = await fetch(`${awsConfig.api.user}/xtwitter/oauth/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenToUse}`,
          'X-Creator-ID': tenantId
        },
        body: JSON.stringify({ oauthToken, oauthVerifier })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Token-Austausch fehlgeschlagen')
      }

      setUserName(data.accountName || data.username || 'X Account')
      setStatus('success')

      // Auto-add channel
      await autoChannelService.addOrUpdateChannel({
        platform: 'xtwitter',
        username: data.username,
        accountName: data.accountName
      })

      // Notify parent window
      if (window.opener) {
        window.opener.postMessage({ type: 'channel-updated', platform: 'xtwitter' }, '*')
      }
      localStorage.setItem('channels-updated', Date.now().toString())

      // Clean up
      sessionStorage.removeItem('x_oauth_tenant_id')
      localStorage.removeItem('x_oauth_access_token')

      setTimeout(() => { window.close() }, 1500)
    } catch (err: any) {
      setStatus('error')
      setError(err.message)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-dark-900">
      <div className="bg-dark-800 rounded-2xl p-8 max-w-md w-full shadow-xl border border-dark-700 text-center">
        {status === 'loading' && (
          <>
            <Loader2 size={48} className="animate-spin text-white mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Verbindung wird hergestellt...</h2>
            <p className="text-dark-400">Bitte warten</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2 text-green-400">X verbunden!</h2>
            <p className="text-dark-400 mb-2">Verbunden als {userName}</p>
            <p className="text-dark-500 text-sm">Dieses Fenster schließt sich automatisch...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle size={48} className="text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2 text-red-400">Fehler</h2>
            <p className="text-dark-400 mb-4">{error}</p>
            <button onClick={() => window.close()} className="btn-secondary">
              Fenster schließen
            </button>
          </>
        )}
      </div>
    </div>
  )
}
