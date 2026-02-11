import { useState, useEffect } from 'react'
import { CreditCard, DollarSign, TrendingUp, Calendar, Download, Loader2, CheckCircle, X, AlertTriangle } from 'lucide-react'
import { billingService, Invoice, CurrentMonthEstimate } from '../services/billing.service'
import { useAuthStore } from '../store/authStore'
import { toast } from '../utils/toast-alert'
import { motion, AnimatePresence } from 'framer-motion'
import { MolliePaymentSetup } from './MolliePaymentSetup'

// Trial Status Banner Component - Shows when no subscription is active
const TrialStatusBanner = ({ hasSubscription }: { hasSubscription: boolean }) => {
  // Don't show if tenant has subscription
  if (hasSubscription) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="text-yellow-500 flex-shrink-0 mt-0.5" size={24} />
        <div>
          <h4 className="font-semibold text-yellow-400 mb-1">Kein aktives Abonnement</h4>
          <p className="text-dark-300 text-sm">
            Bitte buche das Viral Tenant Monthly Fee Paket und richte eine Zahlungsmethode ein,
            um alle Features nutzen zu können.
          </p>
        </div>
      </div>
    </motion.div>
  )
}

// Success Modal Component
const PaymentSuccessModal = ({ 
  isOpen, 
  onClose, 
  amount 
}: { 
  isOpen: boolean
  onClose: () => void
  amount: string 
}) => {
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(onClose, 5000) // Auto-close after 5 seconds
      return () => clearTimeout(timer)
    }
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative bg-dark-800 border border-dark-700 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-dark-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
            
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', damping: 15 }}
                className="w-20 h-20 mx-auto mb-6 bg-green-500/20 rounded-full flex items-center justify-center"
              >
                <CheckCircle className="text-green-500" size={48} />
              </motion.div>
              
              <motion.h3
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-2xl font-bold text-white mb-2"
              >
                Zahlung erfolgreich!
              </motion.h3>
              
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-dark-400 mb-4"
              >
                Vielen Dank für Ihre Zahlung
              </motion.p>
              
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-3xl font-bold text-primary-500 mb-6"
              >
                {amount}
              </motion.div>
              
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                onClick={onClose}
                className="btn-primary px-8 py-3"
              >
                Schließen
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

interface BillingManagementProps {
  tenantId?: string
}

export const BillingManagement = ({ tenantId: propTenantId }: BillingManagementProps) => {
  const { accessToken } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [currentMonth, setCurrentMonth] = useState<CurrentMonthEstimate | null>(null)
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null)
  const [paypalLoading, setPaypalLoading] = useState(false)
  const [paddleLoading, setPaddleLoading] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successAmount, setSuccessAmount] = useState('')
  const [hasSubscription, setHasSubscription] = useState(false)
  
  // Use prop tenantId or fallback to localStorage
  const tenantId = propTenantId || localStorage.getItem('resolvedTenantId') || ''

  // Map technical service names to user-friendly German labels (no AWS branding)
  const getServiceLabel = (service: string): string => {
    const labels: Record<string, string> = {
      // New service-based keys
      dynamodb: 'Datenbank',
      s3: 'Speicher',
      lambda: 'Funktionen',
      cloudfront: 'CDN',
      apigateway: 'API',
      mediaconvert: 'Video-Verarbeitung',
      ses: 'E-Mail',
      other: 'Sonstige',
      // Legacy keys
      multistream: 'Multistreaming',
      videohost: 'Video Hosting',
      domain: 'Domain',
      crosspost: 'Crossposting'
    }
    return labels[service.toLowerCase()] || service
  }

  useEffect(() => {
    if (tenantId) {
      loadData()
    }
  }, [tenantId])

  const loadData = async () => {
    if (!accessToken) {
      console.warn('BillingManagement: No access token available')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      console.log('BillingManagement: Loading billing data...')
      
      const billingData = await billingService.getInvoices(accessToken)

      console.log('BillingManagement: Billing data loaded:', billingData)

      setInvoices(billingData.invoices)
      setCurrentMonth(billingData.currentMonth)
      
      // Check subscription status via Mollie mandate
      try {
        if (tenantId) {
          const mollieInfo = await billingService.getMollieCustomer(tenantId)
          setHasSubscription(mollieInfo.hasMandate)
        }
      } catch {
        setHasSubscription(false)
      }
    } catch (error: any) {
      console.error('BillingManagement: Failed to load billing data:', error)
      
      if (error.response?.status === 404 || error.code === 'ECONNREFUSED') {
        console.warn('BillingManagement: Billing API not available, showing placeholder')
        setInvoices([])
        setCurrentMonth({
          baseFee: 30,
          awsCosts: 0,
          awsBreakdown: {},
          estimatedTotal: 30,
          period: {
            start: new Date().toISOString(),
            end: new Date().toISOString()
          }
        })
      }
    } finally {
      setLoading(false)
    }
  }

  // PayPal payment handler - requires invoiceId
  const handlePayWithPayPal = async (invoiceId: string) => {
    if (!accessToken || !invoiceId) return

    setPaypalLoading(true)
    setPayingInvoiceId(invoiceId)

    try {
      const response = await billingService.createPayPalOrder(accessToken, invoiceId)
      
      if (response.approvalUrl) {
        localStorage.setItem('pendingPayPalBillingOrder', JSON.stringify({
          orderId: response.orderId,
          invoiceId: invoiceId,
          amount: response.amount
        }))
        window.location.href = response.approvalUrl
      }
    } catch (error: any) {
      console.error('PayPal order creation failed:', error)
      alert(`Fehler beim Erstellen der PayPal-Bestellung: ${error.response?.data?.error || error.message}`)
    } finally {
      setPaypalLoading(false)
      setPayingInvoiceId(null)
    }
  }

  // Paddle payment handler - requires invoiceId
  const handlePayWithPaddle = async (invoiceId: string) => {
    if (!accessToken || !invoiceId) return

    setPaddleLoading(true)
    setPayingInvoiceId(invoiceId)

    try {
      const response = await billingService.createPaddleTransaction(accessToken, invoiceId)
      
      if (response.checkoutUrl) {
        localStorage.setItem('pendingPaddleBillingTransaction', JSON.stringify({
          transactionId: response.transactionId,
          invoiceId: invoiceId,
          amount: response.amount
        }))
        window.location.href = response.checkoutUrl
      }
    } catch (error: any) {
      console.error('Paddle transaction creation failed:', error)
      const errorMsg = error.response?.data?.details || error.response?.data?.error || error.message
      alert(`Fehler beim Erstellen der Paddle-Zahlung: ${errorMsg}`)
    } finally {
      setPaddleLoading(false)
      setPayingInvoiceId(null)
    }
  }

  // Check for PayPal/Paddle return
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const payment = urlParams.get('payment')
    const provider = urlParams.get('provider')
    // Note: PayPal adds 'token' to URL but we use orderId from localStorage for capture

    if (payment === 'success' && provider === 'paypal' && accessToken) {
      const pendingOrder = localStorage.getItem('pendingPayPalBillingOrder')
      if (pendingOrder) {
        const { orderId, invoiceId } = JSON.parse(pendingOrder)
        
        // Use orderId from localStorage (not token from URL) - orderId is what PayPal capture API expects
        console.log('Capturing PayPal payment with orderId:', orderId, 'invoiceId:', invoiceId)
        
        billingService.capturePayPalPayment(accessToken, orderId, invoiceId)
          .then((result) => {
            localStorage.removeItem('pendingPayPalBillingOrder')
            setSuccessAmount(billingService.formatCurrency(result.amount))
            setShowSuccessModal(true)
            window.history.replaceState({}, '', window.location.pathname)
            loadData()
          })
          .catch((error) => {
            console.error('PayPal capture failed:', error)
            alert('Fehler beim Abschließen der Zahlung: ' + (error.response?.data?.error || error.message))
          })
      } else {
        console.warn('PayPal success redirect but no pending order in localStorage')
        alert('Zahlung konnte nicht verifiziert werden. Bitte prüfen Sie Ihre Rechnungen.')
        window.history.replaceState({}, '', window.location.pathname)
      }
    } else if (payment === 'success' && provider === 'paddle' && accessToken) {
      const pendingTransaction = localStorage.getItem('pendingPaddleBillingTransaction')
      if (pendingTransaction) {
        const { transactionId, invoiceId } = JSON.parse(pendingTransaction)
        
        console.log('Verifying Paddle payment with transactionId:', transactionId, 'invoiceId:', invoiceId)
        
        billingService.verifyPaddlePayment(accessToken, transactionId, invoiceId)
          .then((result) => {
            localStorage.removeItem('pendingPaddleBillingTransaction')
            if (result.success) {
              setSuccessAmount(billingService.formatCurrency(result.amount))
              setShowSuccessModal(true)
            } else if (result.isPending) {
              alert('Zahlung wird verarbeitet. Bitte warten Sie einen Moment.')
            } else {
              alert(`Zahlungsstatus: ${result.status}`)
            }
            window.history.replaceState({}, '', window.location.pathname)
            loadData()
          })
          .catch((error) => {
            console.error('Paddle verification failed:', error)
            alert('Fehler beim Prüfen der Zahlung: ' + (error.response?.data?.error || error.message))
          })
      } else {
        console.warn('Paddle success redirect but no pending transaction in localStorage')
        alert('Zahlung konnte nicht verifiziert werden. Bitte prüfen Sie Ihre Rechnungen.')
        window.history.replaceState({}, '', window.location.pathname)
      }
    } else if (payment === 'cancelled') {
      localStorage.removeItem('pendingPayPalBillingOrder')
      localStorage.removeItem('pendingPaddleBillingTransaction')
      alert('Zahlung abgebrochen')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [accessToken])

  const handleDownloadPDF = async (invoiceId: string) => {
    if (!accessToken) return

    try {
      const downloadUrl = await billingService.downloadInvoicePDF(accessToken, invoiceId)
      window.open(downloadUrl, '_blank')
    } catch (error: any) {
      console.error('Failed to download PDF:', error)
      // Check if it's a 404 - PDF not yet available
      if (error.message?.includes('404')) {
        toast.error('PDF noch nicht verfügbar. Die Rechnung wird gerade erstellt.')
      } else {
        toast.error(`Fehler beim Herunterladen: ${error.response?.data?.error || error.message}`)
      }
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
    <div className="space-y-8">
      {/* Trial Status Banner */}
      <TrialStatusBanner hasSubscription={hasSubscription} />

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Rechnungen & Abrechnung</h2>
        <p className="text-dark-400">
          Monatliche Infrastrukturkosten + 30€ Grundgebühr (Viral Fee)
        </p>
      </div>

      {/* Mollie Payment Setup */}
      <div className="card">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <CreditCard className="text-primary-500" size={24} />
          Zahlungsmethode
        </h3>
        <MolliePaymentSetup 
          tenantId={tenantId} 
          onSuccess={() => {
            // Reload data after successful setup
            loadData()
          }}
        />
      </div>

      {/* Divider */}
      <div className="border-t border-dark-700" />

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

          {Object.keys(currentMonth.awsBreakdown).length > 0 && (
            <div className="mt-4 pt-4 border-t border-dark-700">
              <p className="text-sm font-semibold mb-2 text-dark-400">Infrastruktur Details:</p>
              <div className="space-y-1">
                {Object.entries(currentMonth.awsBreakdown)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .slice(0, 5)
                  .map(([service, cost]) => (
                    <div key={service} className="flex justify-between text-sm">
                      <span className="text-dark-400 truncate">{getServiceLabel(service)}</span>
                      <span className="text-dark-300 ml-2">{billingService.formatCurrency(cost as number)}</span>
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
                    <div className="flex gap-2">
                      {invoice.status === 'open' && (
                        <>
                          <button
                            onClick={() => handlePayWithPayPal(invoice.invoiceId)}
                            disabled={paypalLoading && payingInvoiceId === invoice.invoiceId}
                            className="text-sm flex items-center gap-2 px-3 py-1.5 bg-[#0070ba] hover:bg-[#005ea6] text-white rounded-lg transition-colors disabled:opacity-50"
                          >
                            {paypalLoading && payingInvoiceId === invoice.invoiceId ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <img src="https://www.paypalobjects.com/webstatic/icon/pp258.png" alt="PayPal" className="w-4 h-4" />
                            )}
                            PayPal
                          </button>
                          <button
                            onClick={() => handlePayWithPaddle(invoice.invoiceId)}
                            disabled={paddleLoading && payingInvoiceId === invoice.invoiceId}
                            className="text-sm flex items-center gap-2 px-3 py-1.5 bg-[#3b7bbf] hover:bg-[#2d6299] text-white rounded-lg transition-colors disabled:opacity-50"
                          >
                            {paddleLoading && payingInvoiceId === invoice.invoiceId ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <CreditCard size={14} />
                            )}
                            Karte
                          </button>
                        </>
                      )}
                      {invoice.status === 'paid' && (
                        <span className="text-sm flex items-center gap-1 text-green-500">
                          <CheckCircle size={14} />
                          Bezahlt
                        </span>
                      )}
                      <button
                        onClick={() => handleDownloadPDF(invoice.invoiceId)}
                        className="btn-secondary text-sm flex items-center gap-2 px-3 py-1.5"
                      >
                        <Download size={14} />
                        PDF
                      </button>
                    </div>
                  </div>
                </div>

                {invoice.awsBreakdown && Object.keys(invoice.awsBreakdown).length > 0 && (
                  <details className="mt-4 pt-4 border-t border-dark-700">
                    <summary className="cursor-pointer text-sm text-dark-400 hover:text-white">
                      Infrastruktur Details anzeigen
                    </summary>
                    <div className="mt-3 space-y-1">
                      {Object.entries(invoice.awsBreakdown)
                        .sort(([, a], [, b]) => (b as number) - (a as number))
                        .map(([service, cost]) => (
                          <div key={service} className="flex justify-between text-sm">
                            <span className="text-dark-400">{getServiceLabel(service)}</span>
                            <span className="text-dark-300">{billingService.formatCurrency(cost as number)}</span>
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

      {/* Payment Success Modal */}
      <PaymentSuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        amount={successAmount}
      />
    </div>
  )
}
