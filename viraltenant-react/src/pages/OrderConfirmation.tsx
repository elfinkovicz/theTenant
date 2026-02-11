import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, Package, Mail, ArrowLeft, Loader2, XCircle } from 'lucide-react'
import { useCartStore } from '../store/cartStore'
import { cartService } from '../services/cart.service'

// Currency symbol mapping
const currencySymbols: Record<string, string> = {
  EUR: '€',
  USD: '$',
  CHF: 'CHF',
  GBP: '£'
}

export const OrderConfirmation = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { clearCart, getCurrencySymbol } = useCartStore()
  const currencySymbol = getCurrencySymbol()
  const [orderDetails, setOrderDetails] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const orderId = searchParams.get('orderId')
  const token = searchParams.get('token') // PayPal token
  const PayerID = searchParams.get('PayerID') // PayPal payer ID

  useEffect(() => {
    const verifyPayment = async () => {
      if (!orderId || !token) {
        setError('Fehlende Bestellinformationen')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        
        // Verify payment with backend
        await cartService.verifyPayment({
          orderId,
          paypalOrderId: token
        })

        // Get order details
        const order = await cartService.getOrder(orderId)
        setOrderDetails(order)

        // Clear cart after successful payment
        clearCart()
        
        setLoading(false)
      } catch (err: any) {
        console.error('Payment verification failed:', err)
        setError(err.response?.data?.error || 'Zahlungsverifizierung fehlgeschlagen')
        setLoading(false)
      }
    }

    verifyPayment()
  }, [orderId, token, PayerID, clearCart])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin text-primary-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Zahlung wird verifiziert...</h2>
          <p className="text-dark-400">Bitte warten Sie einen Moment</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Zahlung fehlgeschlagen</h2>
          <p className="text-dark-400 mb-6">{error}</p>
          <button
            onClick={() => navigate('/cart')}
            className="btn-primary flex items-center gap-2 mx-auto"
          >
            <ArrowLeft size={20} />
            Zurück zum Warenkorb
          </button>
        </div>
      </div>
    )
  }

  if (!orderDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-dark-400">Keine Bestelldetails gefunden</p>
          <button
            onClick={() => navigate('/shop')}
            className="btn-primary mt-4"
          >
            Zum Shop
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="relative py-12 overflow-hidden bg-gradient-to-br from-primary-900/20 via-dark-950 to-dark-950">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
            <h1 className="text-4xl md:text-5xl font-bold mb-2">
              <span className="glow-text">Vielen Dank!</span>
            </h1>
            <p className="text-dark-400 text-lg">
              Deine Bestellung wurde erfolgreich aufgegeben
            </p>
          </motion.div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Order Details Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card mb-8"
          >
            <h2 className="text-2xl font-bold mb-6">Bestelldetails</h2>
            
            <div className="space-y-4">
              <div className="flex justify-between py-3 border-b border-dark-700">
                <span className="text-dark-400">Bestellnummer</span>
                <span className="font-mono font-semibold">{orderDetails.orderId}</span>
              </div>
              
              <div className="flex justify-between py-3 border-b border-dark-700">
                <span className="text-dark-400">Status</span>
                <span className="px-3 py-1 rounded-full bg-green-900/20 text-green-400 text-sm">
                  Bezahlt
                </span>
              </div>
              
              <div className="flex justify-between py-3 border-b border-dark-700">
                <span className="text-dark-400">Gesamtbetrag</span>
                <span className="text-2xl font-bold text-primary-400">
                  {orderDetails.currency ? (currencySymbols[orderDetails.currency] || orderDetails.currency) : currencySymbol}{orderDetails.totalAmount?.toFixed(2)}
                </span>
              </div>

              {orderDetails.items && (
                <div className="pt-4">
                  <h3 className="font-semibold mb-3">Bestellte Artikel</h3>
                  <div className="space-y-2">
                    {orderDetails.items.map((item: any, index: number) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>{item.name} x{item.quantity}</span>
                        <span>{orderDetails.currency ? (currencySymbols[orderDetails.currency] || orderDetails.currency) : currencySymbol}{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="card text-center"
            >
              <Mail className="w-12 h-12 text-primary-500 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Bestätigungs-E-Mail</h3>
              <p className="text-sm text-dark-400">
                Du erhältst in Kürze eine Bestätigung per E-Mail
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="card text-center"
            >
              <Package className="w-12 h-12 text-primary-500 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Versand</h3>
              <p className="text-sm text-dark-400">
                Deine Bestellung wird in Kürze bearbeitet
              </p>
            </motion.div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/shop')}
              className="btn-primary flex items-center justify-center gap-2"
            >
              Weiter einkaufen
            </button>
            <button
              onClick={() => navigate('/')}
              className="btn-secondary flex items-center justify-center gap-2"
            >
              <ArrowLeft size={20} />
              Zur Startseite
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
