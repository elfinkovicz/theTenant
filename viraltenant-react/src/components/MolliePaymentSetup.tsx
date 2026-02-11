import { useState, useEffect } from 'react'
import { CreditCard, Building2, CheckCircle, AlertCircle, Loader2, Trash2 } from 'lucide-react'
import { billingService } from '../services/billing.service'
import { toast } from '../utils/toast-alert'

interface MolliePaymentSetupProps {
  tenantId: string
  onSuccess?: () => void
}

interface MollieCustomerInfo {
  hasCustomer: boolean
  customerId?: string
  customerName?: string
  customerEmail?: string
  hasMandate: boolean
  mandate?: {
    id: string
    method: string
    status: string
    details?: {
      // SEPA details
      consumerName?: string
      consumerAccount?: string
      consumerBic?: string
      // Card details
      cardNumber?: string
      cardHolder?: string
      cardLabel?: string
      cardFingerprint?: string
      cardExpiryDate?: string
    }
    createdAt: string
  }
}

export const MolliePaymentSetup = ({ tenantId }: MolliePaymentSetupProps) => {
  const [loading, setLoading] = useState(true)
  const [customerInfo, setCustomerInfo] = useState<MollieCustomerInfo | null>(null)
  const [setupLoading, setSetupLoading] = useState(false)
  const [revokeLoading, setRevokeLoading] = useState(false)

  // Form state for new customer
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    loadCustomerInfo()
  }, [tenantId])

  // Listen for Mollie setup completion from popup window
  useEffect(() => {
    // Check localStorage for setup completion
    const checkSetupComplete = () => {
      const setupComplete = localStorage.getItem('mollie_setup_complete')
      if (setupComplete) {
        // Reload customer info to show updated payment method
        loadCustomerInfo()
      }
    }

    // Listen for storage events (when popup updates localStorage)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'mollie_setup_complete' && e.newValue) {
        loadCustomerInfo()
      }
      if (e.key === 'mollie_mandate_revoked' && e.newValue) {
        loadCustomerInfo()
      }
    }

    // Listen for postMessage from popup
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'MOLLIE_SETUP_COMPLETE') {
        loadCustomerInfo()
      }
    }

    // Listen for custom events from other components
    const handleStatusChanged = () => {
      loadCustomerInfo()
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('message', handleMessage)
    window.addEventListener('mollieStatusChanged', handleStatusChanged)

    // Also poll periodically in case storage event doesn't fire
    const interval = setInterval(checkSetupComplete, 2000)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('message', handleMessage)
      window.removeEventListener('mollieStatusChanged', handleStatusChanged)
      clearInterval(interval)
    }
  }, [tenantId])

  const loadCustomerInfo = async () => {
    setLoading(true)
    try {
      const info = await billingService.getMollieCustomer(tenantId)
      setCustomerInfo(info)
    } catch (error) {
      console.error('Failed to load Mollie customer:', error)
      toast.error('Fehler beim Laden der Zahlungsinformationen')
    } finally {
      setLoading(false)
    }
  }

  const handleSetupMandate = async () => {
    setSetupLoading(true)
    try {
      // Create customer if needed
      if (!customerInfo?.hasCustomer && (name || email)) {
        await billingService.createMollieCustomer(tenantId, { name, email })
      }

      // Create first payment to establish mandate
      // Include tenantId in redirect URL for callback
      const redirectUrl = `${window.location.origin}/billing/mollie-callback?tenantId=${encodeURIComponent(tenantId)}`
      const result = await billingService.createMollieFirstPayment(tenantId, redirectUrl)

      if (result.checkoutUrl) {
        // Open Mollie checkout in new tab
        window.open(result.checkoutUrl, '_blank')
        toast.success('Mollie-Checkout wurde in einem neuen Tab geöffnet')
      } else {
        toast.error('Fehler beim Erstellen der Zahlung')
      }
    } catch (error: any) {
      console.error('Failed to setup mandate:', error)
      toast.error(error.message || 'Fehler beim Einrichten der Zahlungsmethode')
    } finally {
      setSetupLoading(false)
    }
  }

  const handleRevokeMandate = async () => {
    if (!confirm('Möchtest du die Zahlungsmethode wirklich widerrufen? Dein Abonnement wird damit ebenfalls gekündigt.')) {
      return
    }

    setRevokeLoading(true)
    try {
      await billingService.revokeMollieMandate(tenantId)
      toast.success('Mandat und Abonnement erfolgreich gekündigt')
      await loadCustomerInfo()
      
      // Notify other components about the status change
      localStorage.setItem('mollie_mandate_revoked', Date.now().toString())
      window.dispatchEvent(new CustomEvent('mollieStatusChanged', { detail: { type: 'revoked' } }))
    } catch (error: any) {
      console.error('Failed to revoke mandate:', error)
      toast.error(error.message || 'Fehler beim Widerrufen des Mandats')
    } finally {
      setRevokeLoading(false)
    }
  }

  // Helper to get payment method display info
  const getPaymentMethodInfo = (method: string) => {
    switch (method) {
      case 'directdebit':
        return { icon: Building2, label: 'SEPA-Lastschrift', color: 'text-blue-400' }
      case 'creditcard':
        return { icon: CreditCard, label: 'Kreditkarte', color: 'text-purple-400' }
      case 'ideal':
        return { icon: Building2, label: 'iDEAL', color: 'text-pink-400' }
      case 'bancontact':
        return { icon: Building2, label: 'Bancontact', color: 'text-blue-400' }
      case 'paypal':
        return { icon: CreditCard, label: 'PayPal', color: 'text-blue-500' }
      default:
        return { icon: CreditCard, label: 'Zahlungsmethode', color: 'text-dark-400' }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    )
  }

  // Has valid mandate - show status
  if (customerInfo?.hasMandate && customerInfo.mandate) {
    const methodInfo = getPaymentMethodInfo(customerInfo.mandate.method)
    const MethodIcon = methodInfo.icon
    const isCard = customerInfo.mandate.method === 'creditcard'
    const isSEPA = customerInfo.mandate.method === 'directdebit'

    return (
      <div className="space-y-6">
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-green-400">Zahlungsmethode aktiv</h3>
              <p className="text-sm text-dark-300 mt-1">
                Deine monatlichen Kosten werden automatisch abgebucht.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-dark-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <MethodIcon className={`w-5 h-5 ${methodInfo.color}`} />
            <span className="font-medium">{methodInfo.label}</span>
          </div>
          
          {/* Card details */}
          {isCard && customerInfo.mandate.details && (
            <div className="space-y-2 text-sm">
              {customerInfo.mandate.details.cardLabel && (
                <div className="flex justify-between">
                  <span className="text-dark-400">Karte:</span>
                  <span className="font-semibold">{customerInfo.mandate.details.cardLabel}</span>
                </div>
              )}
              {customerInfo.mandate.details.cardNumber && (
                <div className="flex justify-between">
                  <span className="text-dark-400">Kartennummer:</span>
                  <span className="font-mono">**** **** **** {customerInfo.mandate.details.cardNumber.slice(-4)}</span>
                </div>
              )}
              {customerInfo.mandate.details.cardHolder && (
                <div className="flex justify-between">
                  <span className="text-dark-400">Karteninhaber:</span>
                  <span>{customerInfo.mandate.details.cardHolder}</span>
                </div>
              )}
              {customerInfo.mandate.details.cardExpiryDate && (
                <div className="flex justify-between">
                  <span className="text-dark-400">Gültig bis:</span>
                  <span>{customerInfo.mandate.details.cardExpiryDate}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-dark-400">Eingerichtet am:</span>
                <span>{new Date(customerInfo.mandate.createdAt).toLocaleDateString('de-DE')}</span>
              </div>
            </div>
          )}

          {/* SEPA details */}
          {isSEPA && customerInfo.mandate.details && (
            <div className="space-y-2 text-sm">
              {customerInfo.mandate.details.consumerName && (
                <div className="flex justify-between">
                  <span className="text-dark-400">Kontoinhaber:</span>
                  <span>{customerInfo.mandate.details.consumerName}</span>
                </div>
              )}
              {customerInfo.mandate.details.consumerAccount && (
                <div className="flex justify-between">
                  <span className="text-dark-400">IBAN:</span>
                  <span className="font-mono">
                    ****{customerInfo.mandate.details.consumerAccount.slice(-4)}
                  </span>
                </div>
              )}
              {customerInfo.mandate.details.consumerBic && (
                <div className="flex justify-between">
                  <span className="text-dark-400">BIC:</span>
                  <span className="font-mono">{customerInfo.mandate.details.consumerBic}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-dark-400">Eingerichtet am:</span>
                <span>{new Date(customerInfo.mandate.createdAt).toLocaleDateString('de-DE')}</span>
              </div>
            </div>
          )}

          {/* Other methods - basic info */}
          {!isCard && !isSEPA && (
            <div className="space-y-2 text-sm">
              {/* PayPal specific details */}
              {customerInfo.mandate.method === 'paypal' && customerInfo.mandate.details && (
                <>
                  {customerInfo.mandate.details.consumerName && (
                    <div className="flex justify-between">
                      <span className="text-dark-400">Name:</span>
                      <span>{customerInfo.mandate.details.consumerName}</span>
                    </div>
                  )}
                  {customerInfo.mandate.details.consumerAccount && (
                    <div className="flex justify-between">
                      <span className="text-dark-400">PayPal-Konto:</span>
                      <span>{customerInfo.mandate.details.consumerAccount}</span>
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-between">
                <span className="text-dark-400">Methode:</span>
                <span>{methodInfo.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">Eingerichtet am:</span>
                <span>{new Date(customerInfo.mandate.createdAt).toLocaleDateString('de-DE')}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSetupMandate}
            disabled={setupLoading}
            className="btn-secondary flex items-center gap-2"
          >
            {setupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            Andere Zahlungsmethode
          </button>
          <button
            onClick={handleRevokeMandate}
            disabled={revokeLoading}
            className="btn-secondary text-red-500 hover:bg-red-500/10 flex items-center gap-2"
          >
            {revokeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Widerrufen
          </button>
        </div>
      </div>
    )
  }

  // No mandate - show setup form
  return (
    <div className="space-y-6">
      <div className="bg-dark-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold">Zahlungsmethode einrichten</h3>
            <p className="text-sm text-dark-400 mt-1">
              Richte eine Zahlungsmethode ein (SEPA, Kreditkarte, PayPal, etc.), damit wir deine monatlichen Kosten 
              (30€ Grundgebühr + Nutzungskosten) automatisch abbuchen können.
            </p>
          </div>
        </div>
      </div>

      {!customerInfo?.hasCustomer && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Name / Firma</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Max Mustermann oder Firma GmbH"
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">E-Mail für Rechnungen</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="billing@example.com"
              className="input w-full"
            />
          </div>
        </div>
      )}

      <div className="bg-dark-800/50 rounded-lg p-4 text-sm text-dark-400">
        <p className="mb-2">
          <strong className="text-white">So funktioniert's:</strong>
        </p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Du wirst zu Mollie weitergeleitet</li>
          <li>Wähle deine Bank und autorisiere das Mandat</li>
          <li>Ein kleiner Betrag (0,01€) wird zur Verifizierung abgebucht</li>
          <li>Ab sofort werden deine Kosten automatisch eingezogen</li>
        </ol>
      </div>

      <p className="text-xs text-dark-500">
        Powered by Mollie. Deine Bankdaten werden sicher bei Mollie gespeichert und 
        nicht auf unseren Servern.
      </p>
    </div>
  )
}
