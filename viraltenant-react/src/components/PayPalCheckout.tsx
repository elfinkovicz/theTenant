import { useState } from 'react'
import { useCartStore } from '../store/cartStore'
import { cartService } from '../services/cart.service'

interface PayPalCheckoutProps {
  onSuccess?: () => void
  onError?: (error: any) => void
}

type PaymentProvider = 'paypal' | 'mollie'

export const PayPalCheckout = ({ onError }: PayPalCheckoutProps) => {
  const { items, getTotalPrice, getCurrencySymbol } = useCartStore()
  const currencySymbol = getCurrencySymbol()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>('paypal')
  const [customerEmail, setCustomerEmail] = useState('')
  const [waitingForPayment, setWaitingForPayment] = useState(false)

  const handleCheckout = async () => {
    // Validate email for guest checkout
    if (!customerEmail || !customerEmail.includes('@')) {
      setError('Bitte gib eine gültige E-Mail-Adresse ein')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Backend Integration
      const orderData = {
        items: items.map(item => ({
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })),
        totalAmount: getTotalPrice(),
        paymentProvider: selectedProvider,
        customerEmail
      }

      console.log(`Creating ${selectedProvider} order:`, orderData)
      
      // Create order with backend
      const { orderId, paymentId, approvalUrl } = await cartService.createOrder(orderData)
      
      console.log('Order created:', { orderId, paymentId, approvalUrl })
      
      // Redirect to payment provider
      if (approvalUrl) {
        console.log('Opening payment provider in new tab:', approvalUrl)
        window.open(approvalUrl, '_blank', 'noopener,noreferrer')
        
        // Show waiting overlay
        console.log('Payment window opened, showing overlay')
        setLoading(false)
        setWaitingForPayment(true)
        return
      } else {
        throw new Error('No approval URL received from payment provider')
      }
    } catch (err: any) {
      console.error('Checkout failed:', err)
      const errorMessage = err.response?.data?.error || err.message || 'Checkout fehlgeschlagen'
      setError(errorMessage)
      onError?.(err)
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Email Input for Guest Checkout */}
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium">
          E-Mail-Adresse *
        </label>
        <input
          type="email"
          id="email"
          value={customerEmail}
          onChange={(e) => setCustomerEmail(e.target.value)}
          placeholder="deine@email.de"
          className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg focus:outline-none focus:border-primary-500"
          required
        />
        <p className="text-xs text-dark-400">
          Für die Bestellbestätigung und Versandbenachrichtigung
        </p>
      </div>

      {/* Payment Provider Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium mb-2">
          Zahlungsmethode wählen
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSelectedProvider('paypal')}
            className={`p-3 rounded-lg border-2 transition-all ${
              selectedProvider === 'paypal'
                ? 'border-primary-500 bg-primary-900/20'
                : 'border-dark-700 hover:border-dark-600'
            }`}
          >
            <div className="text-center">
              <svg className="w-8 h-8 mx-auto mb-1" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.77.77 0 0 1 .76-.633h8.78c2.857 0 4.812 1.885 4.812 4.643 0 3.431-2.146 5.852-5.232 5.852H10.5l-.937 5.755a.641.641 0 0 1-.633.74zm9.428-13.116c2.857 0 4.812 1.885 4.812 4.643 0 3.431-2.146 5.852-5.232 5.852h-3.564l-.937 5.755a.641.641 0 0 1-.633.74h-4.606a.641.641 0 0 1-.633-.74l3.107-16.877a.77.77 0 0 1 .76-.633h7.926z"/>
              </svg>
              <span className="text-xs">PayPal</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedProvider('mollie')}
            className={`p-3 rounded-lg border-2 transition-all ${
              selectedProvider === 'mollie'
                ? 'border-primary-500 bg-primary-900/20'
                : 'border-dark-700 hover:border-dark-600'
            }`}
          >
            <div className="text-center">
              <svg className="w-8 h-8 mx-auto mb-1" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 21.6c-5.302 0-9.6-4.298-9.6-9.6S6.698 2.4 12 2.4s9.6 4.298 9.6 9.6-4.298 9.6-9.6 9.6z"/>
              </svg>
              <span className="text-xs">Mollie</span>
            </div>
          </button>
        </div>
      </div>

      {/* Checkout Button */}
      <button
        onClick={handleCheckout}
        disabled={loading || items.length === 0}
        className="w-full btn-primary py-3 px-6 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            Wird geladen...
          </>
        ) : (
          <>
            Jetzt bezahlen ({currencySymbol}{getTotalPrice().toFixed(2)})
          </>
        )}
      </button>

      <p className="text-xs text-center text-dark-400">
        Sichere Zahlung über {selectedProvider === 'paypal' ? 'PayPal' : 'Mollie'}
      </p>

      {/* Waiting for Payment Overlay */}
      {waitingForPayment && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-dark-900 border border-primary-500/20 rounded-lg p-8 max-w-md mx-4 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-500 mx-auto mb-6"></div>
            <h3 className="text-2xl font-bold mb-3">Warte auf Zahlung...</h3>
            <p className="text-dark-400 mb-6">
              Bitte schließe die Zahlung im geöffneten {selectedProvider === 'paypal' ? 'PayPal' : 'Mollie'}-Tab ab.
            </p>
            <div className="space-y-3 text-sm text-dark-400">
              <p>✓ Neuer Tab wurde geöffnet</p>
              <p>✓ Schließe die Zahlung dort ab</p>
              <p>✓ Du wirst automatisch zurückgeleitet</p>
            </div>
            <button
              onClick={() => setWaitingForPayment(false)}
              className="mt-6 btn-secondary w-full"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
