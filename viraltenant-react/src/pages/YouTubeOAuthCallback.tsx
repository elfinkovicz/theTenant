import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { awsConfig } from '../config/aws-config'

export const YouTubeOAuthCallback = () => {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')
  const [channelName, setChannelName] = useState('')

  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error')

  useEffect(() => {
    if (errorParam) {
      setStatus('error')
      setError(searchParams.get('error_description') || 'YouTube Autorisierung abgelehnt')
      return
    }

    if (code && state) {
      handleCallback()
    } else {
      setStatus('error')
      setError('Fehlende Parameter: code oder state')
    }
  }, [code, state, errorParam])

  const handleCallback = async () => {
    setStatus('loading')
    try {
      // Parse state to get tenantId and redirectUri
      let stateData: { tenantId?: string; redirectUri?: string } = {}
      try {
        const decoded = atob(decodeURIComponent(state || ''))
        stateData = JSON.parse(decoded)
      } catch (e) {
        console.log('Could not parse state as JSON, trying as plain tenantId')
        stateData = { tenantId: decodeURIComponent(state || '') }
      }

      // Get tenantId from multiple sources
      let tenantId = stateData.tenantId
      if (!tenantId || tenantId === 'null' || tenantId === '') {
        tenantId = localStorage.getItem('resolvedTenantId') || undefined
      }
      if (!tenantId || tenantId === 'null' || tenantId === '') {
        tenantId = localStorage.getItem('tenantId') || undefined
      }
      if (!tenantId || tenantId === 'null' || tenantId === '') {
        tenantId = 'platform'
      }
      
      const redirectUri = stateData.redirectUri || 'https://viraltenant.com/youtube/oauth/callback'

      console.log('YouTube OAuth Callback - tenantId:', tenantId, 'redirectUri:', redirectUri)

      // Exchange code for token via Lambda API (no auth required)
      const response = await fetch(`${awsConfig.api.user}/youtube/oauth/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code,
          redirectUri,
          tenantId
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || errorData.error || `Fehler ${response.status}`)
      }

      const data = await response.json()
      setChannelName(data.channelName || 'YouTube Kanal')
      setStatus('success')
      
      // Notify parent window
      if (window.opener) {
        window.opener.postMessage({ type: 'youtube-oauth-success', channelName: data.channelName }, '*')
      }
      
      // Close popup after 2 seconds
      setTimeout(() => {
        window.close()
      }, 2000)
    } catch (err: any) {
      console.error('YouTube OAuth error:', err)
      setStatus('error')
      setError(err.message)
      
      if (window.opener) {
        window.opener.postMessage({ type: 'youtube-oauth-error', error: err.message }, '*')
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-dark-900">
      <div className="bg-dark-800 rounded-2xl p-8 max-w-lg w-full shadow-xl border border-dark-700">
        
        {status === 'loading' && (
          <div className="text-center">
            <Loader2 size={48} className="animate-spin text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">YouTube wird verbunden...</h2>
            <p className="text-dark-400">Bitte warten</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2 text-green-400">Erfolgreich verbunden!</h2>
            <p className="text-dark-400 mb-6">
              Kanal: <strong>{channelName}</strong>
            </p>
            <p className="text-sm text-dark-500">
              Dieses Fenster schließt sich automatisch...
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <XCircle size={48} className="text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2 text-red-400">Verbindung fehlgeschlagen</h2>
            <p className="text-dark-400 mb-4">{error}</p>
            <button onClick={() => window.close()} className="px-6 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg">
              Fenster schließen
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
