import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { awsConfig } from '../config/aws-config'
import { useAuthStore } from '../store/authStore'

export const SnapchatCallback = () => {
  const [searchParams] = useSearchParams()
  const { accessToken } = useAuthStore()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')
  const [userName, setUserName] = useState('')

  const code = searchParams.get('code')
  const state = searchParams.get('state') // Contains tenantId
  const errorParam = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  useEffect(() => {
    if (errorParam) {
      setStatus('error')
      setError(errorDescription || 'Snapchat Autorisierung abgelehnt')
      return
    }

    if (code && state) {
      exchangeCodeForToken()
    } else if (!code) {
      setStatus('error')
      setError('Kein Autorisierungscode erhalten')
    }
  }, [code, state, errorParam])

  const exchangeCodeForToken = async () => {
    setStatus('loading')
    try {
      const response = await fetch(`${awsConfig.api.user}/snapchat/oauth/callback`, {
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
          redirectUri: `https://viraltenant.com/snapchat-callback`
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Token-Austausch fehlgeschlagen')
      }

      setUserName(data.displayName || 'Snapchat User')
      setStatus('success')
      
      // Close popup after 1.5 seconds
      setTimeout(() => {
        window.close()
      }, 1500)
    } catch (err: any) {
      setStatus('error')
      setError(err.message)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-dark-900">
      <div className="bg-dark-800 rounded-2xl p-8 max-w-md w-full shadow-xl border border-dark-700 text-center">
        
        {/* Loading State */}
        {status === 'loading' && (
          <>
            <Loader2 size={48} className="animate-spin text-yellow-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Verbindung wird hergestellt...</h2>
            <p className="text-dark-400">Bitte warten</p>
          </>
        )}

        {/* Success State */}
        {status === 'success' && (
          <>
            <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2 text-green-400">Snapchat verbunden!</h2>
            <p className="text-dark-400 mb-2">Verbunden als {userName}</p>
            <p className="text-dark-500 text-sm">Dieses Fenster schließt sich automatisch...</p>
          </>
        )}

        {/* Error State */}
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
