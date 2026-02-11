import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { awsConfig } from '../config/aws-config'

/**
 * Mollie Connect OAuth Callback Page
 * 
 * Diese Seite wird von Mollie nach der OAuth-Autorisierung aufgerufen.
 * Sie leitet den Code an das Backend weiter und zeigt den Status an.
 */
export function MollieConnectCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code')
      const state = searchParams.get('state')
      const error = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')

      // Fehler von Mollie
      if (error) {
        setStatus('error')
        setMessage(errorDescription || error)
        return
      }

      if (!code || !state) {
        setStatus('error')
        setMessage('Ungültige Callback-Parameter')
        return
      }

      try {
        // State dekodieren um tenantId und redirectUrl zu bekommen
        let stateData: { tenantId: string; redirectUrl: string }
        try {
          stateData = JSON.parse(atob(state))
        } catch {
          setStatus('error')
          setMessage('Ungültiger State-Parameter')
          return
        }

        const { tenantId, redirectUrl } = stateData

        // Backend-Callback aufrufen um Token zu tauschen
        const apiUrl = awsConfig.api.user
        const response = await fetch(
          `${apiUrl}/billing/mollie/connect/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`
        )

        const data = await response.json()

        if (response.ok && data.success) {
          setStatus('success')
          setMessage('Mollie erfolgreich verbunden!')
          
          // LocalStorage Flag setzen für andere Komponenten
          localStorage.setItem('mollie_connect_complete', Date.now().toString())
          
          // Nach 2 Sekunden zur Tenant-Seite weiterleiten
          setTimeout(() => {
            // Bestimme die Ziel-URL basierend auf dem Tenant
            let targetUrl = '/tenant'
            const finalRedirectUrl = data.redirectUrl || redirectUrl
            
            if (finalRedirectUrl) {
              if (finalRedirectUrl.startsWith('http')) {
                window.location.href = `${finalRedirectUrl}${finalRedirectUrl.includes('?') ? '&' : '?'}mollie_connected=true`
                return
              }
              targetUrl = finalRedirectUrl
            } else if (tenantId) {
              // Wenn wir auf einer Subdomain sind, bleiben wir dort
              const hostname = window.location.hostname
              if (hostname.includes('.viraltenant.com') && !hostname.startsWith('www.')) {
                targetUrl = '/tenant?mollie_connected=true'
              } else {
                // Redirect zur Subdomain des Tenants
                window.location.href = `https://${tenantId}.viraltenant.com/tenant?mollie_connected=true`
                return
              }
            }
            
            navigate(`${targetUrl}${targetUrl.includes('?') ? '&' : '?'}mollie_connected=true`)
          }, 2000)
        } else {
          setStatus('error')
          setMessage(data.error || 'Verbindung fehlgeschlagen')
        }
      } catch (err: any) {
        console.error('Callback error:', err)
        setStatus('error')
        setMessage(err.message || 'Ein Fehler ist aufgetreten')
      }
    }

    handleCallback()
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-16 h-16 animate-spin text-primary-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Verbinde mit Mollie...</h1>
            <p className="text-dark-400">Bitte warten, während wir dein Konto verbinden.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2 text-green-400">Erfolgreich verbunden!</h1>
            <p className="text-dark-400">{message}</p>
            <p className="text-dark-500 text-sm mt-4">Du wirst gleich weitergeleitet...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2 text-red-400">Verbindung fehlgeschlagen</h1>
            <p className="text-dark-400 mb-6">{message}</p>
            <button
              onClick={() => navigate('/tenant')}
              className="btn-primary"
            >
              Zurück zum Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  )
}
