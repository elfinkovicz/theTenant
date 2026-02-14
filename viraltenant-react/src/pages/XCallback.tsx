import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { awsConfig } from '../config/aws-config'
import { useAuthStore } from '../store/authStore'
import { autoChannelService } from '../services/autoChannel.service'

export const XCallback = () => {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const { accessToken } = useAuthStore()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')
  const [userName, setUserName] = useState('')

  // OAuth 1.0a params (from X redirect)
  const oauthToken = searchParams.get('oauth_token')
  const oauthVerifier = searchParams.get('oauth_verifier')
  
  // OAuth 2.0 params (legacy fallback)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  
  // Error
  const errorParam = searchParams.get('error') || searchParams.get('denied')

  useEffect(() => {
    if (errorParam) {
      setStatus('error')
      setError(t('pages.xCallback.authDenied'))
      return
    }

    if (oauthToken && oauthVerifier) {
      // OAuth 1.0a flow
      handleOAuth1Callback()
    } else if (code && state) {
      // OAuth 2.0 flow (legacy fallback)
      exchangeCodeForToken()
    } else {
      setStatus('error')
      setError(t('pages.xCallback.noAuthData'))
    }
  }, [oauthToken, oauthVerifier, code, state, errorParam])

  const handleOAuth1Callback = async () => {
    setStatus('loading')
    try {
      const tenantId = sessionStorage.getItem('x_oauth1_tenant_id') || ''
      
      const response = await fetch(`${awsConfig.api.user}/xtwitter/oauth/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'X-Creator-ID': tenantId
        },
        body: JSON.stringify({
          oauthToken,
          oauthVerifier
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || t('pages.xCallback.tokenExchangeFailed'))
      }

      setUserName(data.username || data.accountName || 'X User')
      setStatus('success')

      await autoChannelService.addOrUpdateChannel({
        platform: 'xtwitter',
        username: data.username,
        accountName: data.username
      })

      if (window.opener) {
        window.opener.postMessage({ type: 'channel-updated', platform: 'xtwitter' }, '*')
      }
      localStorage.setItem('channels-updated', Date.now().toString())
      sessionStorage.removeItem('x_oauth1_tenant_id')

      setTimeout(() => { window.close() }, 1500)
    } catch (err: any) {
      setStatus('error')
      setError(err.message)
    }
  }

  const exchangeCodeForToken = async () => {
    setStatus('loading')
    try {
      const codeVerifier = sessionStorage.getItem('x_code_verifier')

      const response = await fetch(`${awsConfig.api.user}/xtwitter/oauth/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'X-Creator-ID': state || ''
        },
        body: JSON.stringify({
          code,
          tenantId: state,
          redirectUri: `https://viraltenant.com/x-callback`,
          codeVerifier
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || t('pages.xCallback.tokenExchangeFailed'))
      }

      setUserName(data.username || data.accountName || 'X User')
      setStatus('success')

      await autoChannelService.addOrUpdateChannel({
        platform: 'xtwitter',
        username: data.username,
        accountName: data.username
      })

      if (window.opener) {
        window.opener.postMessage({ type: 'channel-updated', platform: 'xtwitter' }, '*')
      }
      localStorage.setItem('channels-updated', Date.now().toString())
      sessionStorage.removeItem('x_code_verifier')

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
            <Loader2 size={48} className="animate-spin text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t('pages.xCallback.connecting')}</h2>
            <p className="text-dark-400">{t('pages.xCallback.pleaseWait')}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2 text-green-400">{t('pages.xCallback.xConnected')}</h2>
            <p className="text-dark-400 mb-2">{t('pages.xCallback.connectedAs', { name: userName })}</p>
            <p className="text-dark-500 text-sm">{t('pages.xCallback.autoClose')}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle size={48} className="text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2 text-red-400">{t('pages.xCallback.errorTitle')}</h2>
            <p className="text-dark-400 mb-4">{error}</p>
            <button onClick={() => window.close()} className="btn-secondary">{t('pages.xCallback.closeWindow')}</button>
          </>
        )}
      </div>
    </div>
  )
}
