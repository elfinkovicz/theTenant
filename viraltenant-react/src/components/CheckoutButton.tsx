import { useState, useEffect } from 'react'
import { CreditCard, Loader2 } from 'lucide-react'
import { shopService, PaymentConfig, CartItem } from '../services/shop.service'
import { useCartStore } from '../store/cartStore'

interface ShippingAddress {
  firstName: string
  lastName: string
  email: string
  phone: string
  street: string
  city: string
  postalCode: string
  country: string
}

interface CheckoutButtonProps {
  customerEmail?: string
  shippingAddress?: ShippingAddress
  onSuccess?: (orderId: string) => void
  onError?: (error: string) => void
}

export const CheckoutButton = ({ customerEmail, shippingAddress, onError }: CheckoutButtonProps) => {
  const [loading, setLoading] = useState<string | null>(null)
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null)
  const [configLoading, setConfigLoading] = useState(true)
  const { items } = useCartStore()

  useEffect(() => {
    loadPaymentConfig()
  }, [])

  const loadPaymentConfig = async () => {
    try {
      const config = await shopService.getPaymentConfig()
      setPaymentConfig(config)
    } catch (error) {
      console.error('Failed to load payment config:', error)
    } finally {
      setConfigLoading(false)
    }
  }

  const getEnabledProviders = (): string[] => {
    if (!paymentConfig) return []
    const providers: string[] = []
    if (paymentConfig.paypal?.enabled) providers.push('paypal')
    if (paymentConfig.mollie?.enabled) providers.push('mollie')
    return providers
  }

  const handleCheckout = async (provider: string) => {
    setLoading(provider)

    try {
      const cartItems: CartItem[] = items.map(item => ({
        productId: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        imageUrl: item.imageUrl || undefined
      }))

      const baseUrl = window.location.origin
      const returnUrl = `${baseUrl}/shop/success`
      const cancelUrl = `${baseUrl}/shop/cancel`

      const result = await shopService.createCheckout(cartItems, returnUrl, cancelUrl, customerEmail, shippingAddress, undefined, provider)

      // Redirect to payment provider
      const checkoutUrl = result.checkoutUrl || result.approvalUrl
      if (checkoutUrl) {
        // Store order ID for success page
        localStorage.setItem('pendingOrderId', result.orderId)
        if (result.providerOrderId) {
          localStorage.setItem('pendingProviderOrderId', result.providerOrderId)
        }
        window.location.href = checkoutUrl
      } else {
        throw new Error('Keine Checkout-URL erhalten')
      }
    } catch (error: any) {
      console.error('Checkout error:', error)
      onError?.(error.response?.data?.message || error.message || 'Checkout fehlgeschlagen')
    } finally {
      setLoading(null)
    }
  }

  if (configLoading) {
    return (
      <button disabled className="btn-primary w-full opacity-50">
        <Loader2 size={20} className="animate-spin mr-2" />
        Lade Zahlungsoptionen...
      </button>
    )
  }

  const enabledProviders = getEnabledProviders()

  if (enabledProviders.length === 0) {
    return (
      <div className="text-center p-4 bg-yellow-900/20 border border-yellow-500/20 rounded-lg">
        <p className="text-yellow-500 text-sm">
          Checkout nicht verfügbar. Bitte kontaktiere den Shop-Betreiber.
        </p>
      </div>
    )
  }

  const getProviderLabel = (provider: string) => {
    switch (provider) {
      case 'paypal': return 'Mit PayPal bezahlen'
      case 'mollie': return 'Jetzt bezahlen'
      default: return 'Zur Kasse'
    }
  }

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'paypal':
        return <img src="https://www.paypalobjects.com/webstatic/icon/pp258.png" alt="PayPal" className="w-5 h-5" />
      case 'mollie':
        return <CreditCard size={20} />
      default:
        return <CreditCard size={20} />
    }
  }

  const getProviderButtonStyle = (provider: string) => {
    switch (provider) {
      case 'paypal':
        return 'bg-[#0070ba] hover:bg-[#005ea6] text-white'
      case 'mollie':
        return 'bg-[#00a1e0] hover:bg-[#008bc4] text-white'
      default:
        return 'btn-primary'
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-dark-400 text-center mb-2">Zahlungsmethode wählen</p>
      {enabledProviders.map((provider) => (
        <button
          key={provider}
          onClick={() => handleCheckout(provider)}
          disabled={loading !== null || items.length === 0}
          className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 ${getProviderButtonStyle(provider)}`}
        >
          {loading === provider ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Wird verarbeitet...
            </>
          ) : (
            <>
              {getProviderIcon(provider)}
              {getProviderLabel(provider)}
            </>
          )}
        </button>
      ))}
    </div>
  )
}
