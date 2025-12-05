import { useState, useEffect } from 'react'
import { CreditCard, DollarSign, TrendingUp, Calendar, CheckCircle, XCircle, Download } from 'lucide-react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { billingService, Invoice, CurrentMonthEstimate } from '../services/billing.service'
import { useAuthStore } from '../store/authStore'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

interface PaymentSetupFormProps {
  clientSecret: string
  onSuccess: () => void
}

const PaymentSetupForm = ({ onSuccess }: PaymentSetupFormProps) => {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { error: submitError } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: window.location.href
        },
        redirect: 'if_required'
      })

      if (submitError) {
        setError(submitError.message || 'Ein Fehler ist aufgetreten')
      } else {
        onSuccess()
      }
    } catch (err: any) {
      setError(err.message || 'Ein Fehler ist aufgetreten')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || loading}
        className="btn-primary w-full"
      >
        {loading ? 'Wird gespeichert...' : 'Zahlungsmethode speichern'}
      </button>
    </form>
  )
}

export const BillingManagement = () => {
  const { accessToken } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [currentMonth, setCurrentMonth] = useState<CurrentMonthEstimate | null>(null)
  const [showPaymentSetup, setShowPaymentSetup] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [hasPaymentMethod, setHasPaymentMethod] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    if (!accessToken) {
      console.warn('BillingManagement: No access token available')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      console.log('BillingManagement: Loading billing data...')
      
      const [billingData, paymentStatus] = await Promise.all([
        billingService.getInvoices(accessToken),
        billingService.getPaymentMethodStatus(accessToken)
      ])

      console.log('BillingManagement: Billing data loaded:', billingData)
      console.log('BillingManagement: Payment status:', paymentStatus)

      setInvoices(billingData.invoices)
      setCurrentMonth(billingData.currentMonth)
      setHasPaymentMethod(paymentStatus.hasPaymentMethod)
    } catch (error: any) {
      console.error('BillingManagement: Failed to load billing data:', error)
      console.error('BillingManagement: Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSetupPayment = async () => {
    if (!accessToken) return

    try {
      const response = await billingService.createSetupIntent(accessToken)
      setClientSecret(response.clientSecret)
      setShowPaymentSetup(true)
    } catch (error) {
      console.error('Failed to create setup intent:', error)
      alert('Fehler beim Einrichten der Zahlungsmethode')
    }
  }

  const handlePaymentSetupSuccess = () => {
    setShowPaymentSetup(false)
    setClientSecret(null)
    setHasPaymentMethod(true)
    alert('Zahlungsmethode erfolgreich hinzugefügt!')
    loadData()
  }

  const handleManualCharge = async () => {
    if (!accessToken) return
    
    if (!confirm('Möchtest du jetzt eine Testrechnung erstellen? Dies wird die aktuellen AWS-Kosten berechnen und eine Rechnung in Stripe erstellen.')) {
      return
    }

    try {
      setLoading(true)
      const result = await billingService.createManualCharge(accessToken)
      alert(`Rechnung erfolgreich erstellt!\n\nBetrag: ${billingService.formatCurrency(result.amount)}\nStatus: ${result.status}\n\nRechnung ID: ${result.invoiceId}`)
      loadData() // Reload to show new invoice
    } catch (error: any) {
      console.error('Failed to create manual charge:', error)
      alert(`Fehler beim Erstellen der Rechnung: ${error.response?.data?.error || error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPDF = async (invoiceId: string) => {
    if (!accessToken) return

    try {
      const downloadUrl = await billingService.downloadInvoicePDF(accessToken, invoiceId)
      window.open(downloadUrl, '_blank')
    } catch (error: any) {
      console.error('Failed to download PDF:', error)
      alert(`Fehler beim Herunterladen der Rechnung: ${error.response?.data?.error || error.message}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Rechnungen & Abrechnung</h2>
          <p className="text-dark-400">
            Monatliche Infrastrukturkosten + 20€ Grundgebühr
          </p>
        </div>
        
        <div className="flex gap-3">
          {!hasPaymentMethod && (
            <button
              onClick={handleSetupPayment}
              className="btn-primary flex items-center gap-2"
            >
              <CreditCard size={18} />
              Zahlungsmethode hinzufügen
            </button>
          )}
          
          {/* Show button always for testing - will check payment method in backend */}
          <button
            onClick={handleManualCharge}
            disabled={loading}
            className="btn-secondary flex items-center gap-2"
          >
            <DollarSign size={18} />
            {loading ? 'Wird erstellt...' : 'Testrechnung erstellen'}
          </button>
        </div>
      </div>

      {/* Payment Method Status */}
      <div className={`card ${hasPaymentMethod ? 'border-green-500' : 'border-yellow-500'}`}>
        <div className="flex items-center gap-3">
          {hasPaymentMethod ? (
            <>
              <CheckCircle className="text-green-500" size={24} />
              <div>
                <p className="font-semibold">Zahlungsmethode hinterlegt</p>
                <p className="text-sm text-dark-400">
                  Rechnungen werden automatisch abgebucht
                </p>
              </div>
            </>
          ) : (
            <>
              <XCircle className="text-yellow-500" size={24} />
              <div>
                <p className="font-semibold">Keine Zahlungsmethode</p>
                <p className="text-sm text-dark-400">
                  Bitte füge eine Zahlungsmethode hinzu
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Payment Setup Modal */}
      {showPaymentSetup && clientSecret && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-900 rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Zahlungsmethode hinzufügen</h3>
            
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <PaymentSetupForm
                clientSecret={clientSecret}
                onSuccess={handlePaymentSetupSuccess}
              />
            </Elements>

            <button
              onClick={() => setShowPaymentSetup(false)}
              className="btn-secondary w-full mt-4"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Current Month Estimate */}
      {currentMonth && (
        <div className="card bg-gradient-to-br from-primary-500/10 to-primary-600/5 border-primary-500/30">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold mb-1">Aktueller Monat (Vorschau)</h3>
              <p className="text-sm text-dark-400">
                {new Date(currentMonth.period.start).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
              </p>
            </div>
            <TrendingUp className="text-primary-500" size={24} />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-dark-400">Grundgebühr</span>
              <span className="font-semibold">{billingService.formatCurrency(currentMonth.baseFee)}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-dark-400">Infrastruktur</span>
              <span className="font-semibold">{billingService.formatCurrency(currentMonth.awsCosts)}</span>
            </div>

            <div className="border-t border-dark-700 pt-3">
              <div className="flex justify-between items-center text-lg">
                <span className="font-bold">Geschätzte Summe</span>
                <span className="font-bold text-primary-500">
                  {billingService.formatCurrency(currentMonth.estimatedTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* Infrastructure Breakdown */}
          {Object.keys(currentMonth.awsBreakdown).length > 0 && (
            <div className="mt-4 pt-4 border-t border-dark-700">
              <p className="text-sm font-semibold mb-2 text-dark-400">Infrastruktur Details:</p>
              <div className="space-y-1">
                {Object.entries(currentMonth.awsBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .map(([service, cost]) => (
                    <div key={service} className="flex justify-between text-sm">
                      <span className="text-dark-400 truncate">{service}</span>
                      <span className="text-dark-300 ml-2">{billingService.formatCurrency(cost)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Invoices List */}
      <div>
        <h3 className="text-xl font-bold mb-4">Rechnungshistorie</h3>
        
        {invoices.length === 0 ? (
          <div className="card text-center py-8">
            <DollarSign size={48} className="mx-auto mb-3 text-dark-600" />
            <p className="text-dark-400">Noch keine Rechnungen vorhanden</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <div key={invoice.invoiceId} className="card hover:border-primary-500/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Calendar size={18} className="text-dark-400" />
                      <span className="font-semibold">
                        {new Date(invoice.period.start).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
                      </span>
                      <span className={`text-sm font-medium ${billingService.getStatusColor(invoice.status)}`}>
                        {billingService.getStatusText(invoice.status)}
                      </span>
                      {invoice.invoiceNumber && (
                        <span className="font-mono text-xs text-dark-400 bg-dark-800 px-2 py-1 rounded">
                          {invoice.invoiceNumber}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-dark-400">Grundgebühr: </span>
                        <span>{billingService.formatCurrency(invoice.baseFee)}</span>
                      </div>
                      <div>
                        <span className="text-dark-400">Infrastruktur: </span>
                        <span>{billingService.formatCurrency(invoice.awsCosts)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end gap-2">
                    <div className="text-2xl font-bold text-primary-500">
                      {billingService.formatCurrency(invoice.amount)}
                    </div>
                    <div className="text-xs text-dark-400">
                      {billingService.formatDate(invoice.createdAt)}
                    </div>
                    <button
                      onClick={() => handleDownloadPDF(invoice.invoiceId)}
                      className="btn-secondary text-sm flex items-center gap-2 px-3 py-1.5"
                    >
                      <Download size={14} />
                      PDF
                    </button>
                  </div>
                </div>

                {/* Infrastructure Breakdown */}
                {invoice.awsBreakdown && Object.keys(invoice.awsBreakdown).length > 0 && (
                  <details className="mt-4 pt-4 border-t border-dark-700">
                    <summary className="cursor-pointer text-sm text-dark-400 hover:text-white">
                      Infrastruktur Details anzeigen
                    </summary>
                    <div className="mt-3 space-y-1">
                      {Object.entries(invoice.awsBreakdown)
                        .sort(([, a], [, b]) => b - a)
                        .map(([service, cost]) => (
                          <div key={service} className="flex justify-between text-sm">
                            <span className="text-dark-400">{service}</span>
                            <span className="text-dark-300">{billingService.formatCurrency(cost)}</span>
                          </div>
                        ))}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
