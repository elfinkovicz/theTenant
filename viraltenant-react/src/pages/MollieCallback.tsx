import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { billingService } from '../services/billing.service'

// Helper to get payment method display name
const getPaymentMethodLabel = (method: string): string => {
  switch (method) {
    case 'directdebit':
      return 'SEPA-Lastschrift'
    case 'creditcard':
      return 'Kreditkarte'
    case 'ideal':
      return 'iDEAL'
    case 'bancontact':
      return 'Bancontact'
    case 'paypal':
      return 'PayPal'
    default:
      return 'Zahlungsmethode'
  }
}

export const MollieCallback = () => {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const checkPaymentStatus = async () => {
      // Get tenantId from URL params or localStorage
      let tenantId = searchParams.get('tenantId')
      if (!tenantId) {
        tenantId = localStorage.getItem('resolvedTenantId')
      }
      
      if (!tenantId) {
        setStatus('error')
        setMessage('Keine Tenant-ID gefunden')
        return
      }

      try {
        // Check if mandate was created successfully
        const customerInfo = await billingService.getMollieCustomer(tenantId)
        
        if (customerInfo.hasMandate) {
          const methodLabel = getPaymentMethodLabel(customerInfo.mandate?.method || '')
          setStatus('success')
          setMessage(`${methodLabel} erfolgreich eingerichtet!`)
          // Notify opener window to refresh
          notifyOpenerAndClose()
        } else {
          // Payment might still be processing
          setStatus('loading')
          setMessage('Zahlung wird verarbeitet...')
          
          // Wait a bit and check again
          setTimeout(async () => {
            try {
              const updatedInfo = await billingService.getMollieCustomer(tenantId!)
              if (updatedInfo.hasMandate) {
                const methodLabel = getPaymentMethodLabel(updatedInfo.mandate?.method || '')
                setStatus('success')
                setMessage(`${methodLabel} erfolgreich eingerichtet!`)
                // Notify opener window to refresh
                notifyOpenerAndClose()
              } else {
                setStatus('error')
                setMessage('Mandat konnte nicht erstellt werden. Bitte versuche es erneut.')
              }
            } catch {
              setStatus('error')
              setMessage('Fehler beim Prüfen des Zahlungsstatus')
            }
          }, 3000)
        }
      } catch (error) {
        console.error('Error checking payment status:', error)
        setStatus('error')
        setMessage('Fehler beim Prüfen des Zahlungsstatus')
      }
    }

    checkPaymentStatus()
  }, [searchParams])

  // Notify the opener window to refresh and prepare to close
  const notifyOpenerAndClose = () => {
    // Set a flag in localStorage that the opener can detect
    localStorage.setItem('mollie_setup_complete', Date.now().toString())
    
    // Try to notify opener via postMessage
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: 'MOLLIE_SETUP_COMPLETE' }, '*')
    }
  }

  // Close this window/tab
  const handleClose = () => {
    // Update localStorage flag before closing
    localStorage.setItem('mollie_setup_complete', Date.now().toString())
    
    // Try to close the window
    window.close()
    
    // If window.close() doesn't work (some browsers block it), 
    // show a message to close manually
    setTimeout(() => {
      setMessage('Bitte schließe diesen Tab manuell und kehre zum vorherigen Tab zurück.')
    }, 500)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-16 h-16 text-primary-500 animate-spin mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Wird verarbeitet...</h1>
            <p className="text-dark-400">{message || 'Bitte warten...'}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Erfolgreich!</h1>
            <p className="text-dark-400 mb-6">{message}</p>
            <button onClick={handleClose} className="btn-primary">
              Fenster schließen
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Fehler</h1>
            <p className="text-dark-400 mb-6">{message}</p>
            <button onClick={handleClose} className="btn-primary">
              Fenster schließen
            </button>
          </>
        )}
      </div>
    </div>
  )
}
