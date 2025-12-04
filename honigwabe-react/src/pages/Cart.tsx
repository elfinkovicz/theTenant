import { useState } from 'react'
import { motion } from 'framer-motion'
import { ShoppingCart, Trash2, Plus, Minus, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCartStore } from '../store/cartStore'
import { PayPalCheckout } from '../components/PayPalCheckout'
import { useHydration } from '../hooks/useHydration'

export const Cart = () => {
  const navigate = useNavigate()
  const hydrated = useHydration()
  const { items, removeItem, updateQuantity, clearCart, getTotalPrice } = useCartStore()
  const [showCheckout, setShowCheckout] = useState(false)

  // Wait for hydration to complete
  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <ShoppingCart size={64} className="mx-auto mb-4 text-dark-600" />
          <h2 className="text-2xl font-bold mb-2">Dein Warenkorb ist leer</h2>
          <p className="text-dark-400 mb-6">Füge Produkte hinzu, um fortzufahren</p>
          <button
            onClick={() => navigate('/shop')}
            className="btn-primary flex items-center gap-2 mx-auto"
          >
            <ArrowLeft size={20} />
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
          <h1 className="text-4xl md:text-5xl font-bold mb-2">
            <span className="glow-text">Warenkorb</span>
          </h1>
          <p className="text-dark-400 text-lg">
            {items.length} {items.length === 1 ? 'Artikel' : 'Artikel'}
          </p>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => (
              <motion.div
                key={item.productId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                className="card flex gap-4"
              >
                {/* Product Image */}
                <div className="w-24 h-24 bg-dark-800 rounded-lg overflow-hidden flex-shrink-0">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">
                      📦
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-1">{item.name}</h3>
                  <p className="text-primary-400 font-bold">€{item.price.toFixed(2)}</p>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                    className="p-2 rounded-lg bg-dark-800 hover:bg-dark-700 transition-colors"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-8 text-center font-semibold">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                    className="p-2 rounded-lg bg-dark-800 hover:bg-dark-700 transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => removeItem(item.productId)}
                  className="p-2 rounded-lg bg-dark-800 hover:bg-red-600 transition-colors self-start"
                >
                  <Trash2 size={20} />
                </button>
              </motion.div>
            ))}

            {/* Clear Cart */}
            <button
              onClick={clearCart}
              className="text-red-400 hover:text-red-300 text-sm flex items-center gap-2"
            >
              <Trash2 size={16} />
              Warenkorb leeren
            </button>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="card sticky top-4">
              <h2 className="text-xl font-bold mb-4">Bestellübersicht</h2>

              <div className="space-y-3 mb-6">
                {items.map((item) => (
                  <div key={item.productId} className="flex justify-between text-sm">
                    <span className="text-dark-400">
                      {item.name} x{item.quantity}
                    </span>
                    <span>€{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dark-700 pt-4 mb-6">
                <div className="flex justify-between text-lg font-bold">
                  <span>Gesamt</span>
                  <span className="text-primary-400">€{getTotalPrice().toFixed(2)}</span>
                </div>
              </div>

              {showCheckout ? (
                <div className="space-y-4">
                  <PayPalCheckout
                    onSuccess={() => console.log('Payment successful')}
                    onError={(error) => console.error('Payment failed:', error)}
                  />
                  <button
                    onClick={() => setShowCheckout(false)}
                    className="btn-secondary w-full"
                  >
                    Zurück
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowCheckout(true)}
                  className="btn-primary w-full"
                >
                  Zur Kasse
                </button>
              )}

              <button
                onClick={() => navigate('/shop')}
                className="btn-secondary w-full mt-3 flex items-center justify-center gap-2"
              >
                <ArrowLeft size={20} />
                Weiter einkaufen
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
