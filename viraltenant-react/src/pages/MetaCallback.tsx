import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle, XCircle, Instagram, Facebook, AtSign } from 'lucide-react'
import { awsConfig } from '../config/aws-config'
import { useAuthStore } from '../store/authStore'
import { autoChannelService } from '../services/autoChannel.service'

// Platform configurations
const platformConfig: Record<string, { name: string, icon: any, color: string, gradient: string }> = {
  instagram: { 
    name: 'Instagram', 
    icon: Instagram, 
    color: '#E1306C',
    gradient: 'linear-gradient(45deg, #833AB4, #E1306C, #F77737)'
  },
  facebook: { 
    name: 'Facebook', 
    icon: Facebook, 
    color: '#1877F2',
    gradient: 'linear-gradient(45deg, #1877F2, #42A5F5)'
  },
  threads: { 
    name: 'Threads', 
    icon: AtSign, 
    color: '#000000',
    gradient: 'linear-gradient(45deg, #000000, #333333)'
  },
  'instagram-live': { 
    name: 'Instagram Live', 
    icon: Instagram, 
    color: '#E1306C',
    gradient: 'linear-gradient(45deg, #833AB4, #E1306C, #F77737)'
  },
  'facebook-live': { 
    name: 'Facebook Live', 
    icon: Facebook, 
    color: '#1877F2',
    gradient: 'linear-gradient(45deg, #1877F2, #42A5F5)'
  }
}

interface FacebookPage {
  id: string
  name: string
  picture?: string
}

export const MetaCallback = () => {
  const [searchParams] = useSearchParams()
  const { accessToken: storedAccessToken } = useAuthStore()
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'select-page'>('loading')
  const [connectedAccount, setConnectedAccount] = useState('')
  const [error, setError] = useState('')
  const [pages, setPages] = useState<FacebookPage[]>([])
  const [selectingPage, setSelectingPage] = useState(false)

  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error')

  // Parse state
  const delimiter = state?.includes('|') ? '|' : ':'
  const stateParts = (state || '|||').split(delimiter)
  const platform = stateParts[0]
  const tenantId = stateParts[1]
  
  let accessToken = storedAccessToken
  if (stateParts[3]) {
    try {
      accessToken = atob(stateParts[3])
    } catch {
      accessToken = stateParts[3] || storedAccessToken
    }
  }
  const config = platformConfig[platform] || platformConfig.instagram

  useEffect(() => {
    if (errorParam) {
      setStatus('error')
      setError(searchParams.get('error_description') || 'Autorisierung abgelehnt')
      return
    }

    if (code && state) {
      exchangeCodeForToken()
    } else {
      setStatus('error')
      setError('Ungültige Callback-Parameter')
    }
  }, [code, state, errorParam])

  const exchangeCodeForToken = async (selectedPageId?: string) => {
    try {
      setStatus('loading')
      const redirectUri = `https://viraltenant.com/meta-callback`
      
      const response = await fetch(`${awsConfig.api.user}/meta/oauth/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'X-Creator-ID': tenantId || '319190e1-0791-43b0-bd04-506f959c1471'
        },
        body: JSON.stringify({
          code,
          platform,
          tenantId,
          redirectUri,
          selectedPageId
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Token-Austausch fehlgeschlagen')
      }

      // Check if page selection is required
      if (data.requiresPageSelection && data.pages) {
        setPages(data.pages)
        setStatus('select-page')
        return
      }

      setConnectedAccount(data.accountName || data.pageName || data.username || 'Verbunden')
      setStatus('success')
      
      // Auto-add channel to Channels page (only for non-live platforms)
      if (!platform.includes('-live')) {
        await autoChannelService.addOrUpdateChannel({
          platform: platform,
          accountName: data.accountName || data.pageName || data.username,
          accountId: data.accountId || data.pageId,
          username: data.username
        })
        
        // Notify parent window that channels were updated
        if (window.opener) {
          window.opener.postMessage({ type: 'channel-updated', platform }, '*')
        }
        localStorage.setItem('channels-updated', Date.now().toString())
      }
      
      // For livestreaming platforms, store data and notify parent window
      if (platform === 'facebook-live' || platform === 'instagram-live') {
        localStorage.setItem(`meta_live_${platform}`, JSON.stringify({
          accountId: data.accountId || data.pageId,
          accountName: data.accountName || data.pageName,
          accessToken: data.accessToken || data.pageAccessToken,
          pageId: data.pageId
        }))
        
        if (window.opener) {
          window.opener.postMessage({
            type: 'meta-oauth-success',
            platform,
            accountId: data.accountId || data.pageId,
            accountName: data.accountName || data.pageName,
            accessToken: data.accessToken || data.pageAccessToken
          }, '*')
        }
      }
      
      setTimeout(() => window.close(), 3000)
    } catch (err: any) {
      setStatus('error')
      setError(err.message)
      
      if (window.opener) {
        window.opener.postMessage({
          type: 'meta-oauth-error',
          platform,
          error: err.message
        }, '*')
      }
    }
  }

  const handlePageSelect = async (page: FacebookPage) => {
    setSelectingPage(true)
    
    // For facebook-live, we need to get the page access token
    // We'll call the API again with the selected page ID
    try {
      const redirectUri = `https://viraltenant.com/meta-callback`
      
      const response = await fetch(`${awsConfig.api.user}/meta/oauth/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'X-Creator-ID': tenantId || '319190e1-0791-43b0-bd04-506f959c1471'
        },
        body: JSON.stringify({
          code,
          platform,
          tenantId,
          redirectUri,
          selectedPageId: page.id
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Seiten-Auswahl fehlgeschlagen')
      }

      setConnectedAccount(data.pageName || page.name)
      setStatus('success')
      
      // Auto-add channel to Channels page (for non-live Facebook)
      if (!platform.includes('-live')) {
        await autoChannelService.addOrUpdateChannel({
          platform: 'facebook',
          pageName: data.pageName || page.name,
          pageId: data.pageId || page.id
        })
        
        // Notify parent window that channels were updated
        if (window.opener) {
          window.opener.postMessage({ type: 'channel-updated', platform: 'facebook' }, '*')
        }
        localStorage.setItem('channels-updated', Date.now().toString())
      }
      
      // Store and notify
      if (platform === 'facebook-live') {
        localStorage.setItem(`meta_live_${platform}`, JSON.stringify({
          accountId: data.pageId,
          accountName: data.pageName,
          accessToken: data.pageAccessToken,
          pageId: data.pageId
        }))
        
        if (window.opener) {
          window.opener.postMessage({
            type: 'meta-oauth-success',
            platform,
            accountId: data.pageId,
            accountName: data.pageName,
            accessToken: data.pageAccessToken
          }, '*')
        }
      }
      
      setTimeout(() => window.close(), 3000)
    } catch (err: any) {
      setStatus('error')
      setError(err.message)
    } finally {
      setSelectingPage(false)
    }
  }

  const Icon = config.icon

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-dark-900">
      <div className="bg-dark-800 rounded-2xl p-8 max-w-md w-full shadow-xl border border-dark-700">
        
        {/* Platform Icon */}
        <div 
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ background: config.gradient }}
        >
          <Icon className="w-8 h-8 text-white" />
        </div>

        {/* Loading State */}
        {status === 'loading' && (
          <div className="text-center">
            <Loader2 size={32} className="animate-spin mx-auto mb-4" style={{ color: config.color }} />
            <h2 className="text-xl font-semibold mb-2">{config.name} wird verbunden...</h2>
            <p className="text-dark-400">Bitte warten</p>
          </div>
        )}

        {/* Page Selection State */}
        {status === 'select-page' && (
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Seite auswählen</h2>
            <p className="text-dark-400 mb-6">Wähle die Facebook-Seite für Live-Streaming:</p>
            
            <div className="space-y-3">
              {pages.map(page => (
                <button
                  key={page.id}
                  onClick={() => handlePageSelect(page)}
                  disabled={selectingPage}
                  className="w-full flex items-center gap-4 p-4 bg-dark-700 hover:bg-dark-600 rounded-xl transition-all border border-dark-600 hover:border-blue-500 disabled:opacity-50"
                >
                  {page.picture ? (
                    <img src={page.picture} alt={page.name} className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-blue-600 flex items-center justify-center">
                      <Facebook size={24} className="text-white" />
                    </div>
                  )}
                  <div className="flex-1 text-left">
                    <div className="font-medium text-white">{page.name}</div>
                    <div className="text-sm text-dark-400">ID: {page.id}</div>
                  </div>
                  {selectingPage && (
                    <Loader2 size={20} className="animate-spin text-blue-500" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Success State */}
        {status === 'success' && (
          <div className="text-center">
            <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">{config.name} verbunden!</h2>
            {connectedAccount && (
              <p className="text-dark-400 mb-4">
                Verbunden mit <span className="font-medium" style={{ color: config.color }}>{connectedAccount}</span>
              </p>
            )}
            <p className="text-sm text-dark-500">Dieses Fenster schließt sich automatisch...</p>
            <button onClick={() => window.close()} className="btn-secondary mt-4">
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
            <button onClick={() => window.close()} className="btn-primary">
              Schließen
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
