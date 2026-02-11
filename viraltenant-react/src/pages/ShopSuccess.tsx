import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle, Loader2, ShoppingBag } from 'lucide-react'
import { shopService } from '../services/shop.service'
import { useCartStore } from '../store/cartStore'

export const ShopSuccess = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const { clearCart } = useCartStore()

  useEffect(() => {
    handlePaymentSuccess()
  }, [])

  const handlePaymentSuccess = async () => {
    const orderId = localStorage.getItem('pendingOrderId')
    const providerOrderId = localStorage.getItem('pendingProviderOrderId')
    
    // PayPal returns token in URL
    const paypalToken = searchParams.get('token')
    
    try {
      // Handle PayPal capture
      if (providerOrderId || paypalToken) {
        const captureOrderId = providerOrderId || paypalToken
        if (captureOrderId && orderId) {
          await shopService.capturePayPalPayment(orderId, captureOrderId)
        }
      }
      
      // Clear cart and pending order data
      clearCart()
      localStorage.removeItem('pendingOrderId')
      localStorage.removeItem('pendingProviderOrderId')
      localStorage.removeItem('checkoutShippingAddress')
      
      setStatus('success')
      setMessage('Deine Bestellung wurde erfolgreich aufgegeben!')
    } catch (error: any) {
      console.error('Payment verification error:', error)
      // Even if verification fails, the payment might have succeeded via webhook
      // So we still show success but with a note
      setStatus('success')
      setMessage('Deine Bestellung wird verarbeitet. Du erhältst eine Bestätigung per E-Mail.')
      clearCart()
      localStorage.removeItem('pendingOrderId')
      localStorage.removeItem('pendingProviderOrderId')
      localStorage.removeItem('checkoutShippingAddress')
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={48} className="animate-spin mx-auto mb-4 text-primary-500" />
          <p className="text-lg">Zahlung wird verarbeitet...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card max-w-md w-full text-center">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={48} className="text-green-500" />
        </div>
        
        <h1 className="text-2xl font-bold mb-2">Vielen Dank!</h1>
        <p className="text-dark-400 mb-6">{message}</p>
        
        <div className="space-y-3">
          <button
            onClick={() => navigate('/shop')}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <ShoppingBag size={20} />
            Weiter einkaufen
          </button>
          <button
            onClick={() => navigate('/')}
            className="btn-secondary w-full"
          >
            Zur Startseite
          </button>
        </div>
      </div>
    </div>
  )
}
