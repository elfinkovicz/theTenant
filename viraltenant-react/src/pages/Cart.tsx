import { motion } from 'framer-motion'
import { ShoppingCart, Trash2, Plus, Minus, ArrowLeft, Mail, MapPin, Phone, AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCartStore } from '../store/cartStore'
import { CheckoutButton } from '../components/CheckoutButton'
import { PageBanner } from '../components/PageBanner'
import { usePageTitle } from '../hooks/usePageTitle'
import { useState, useEffect } from 'react'
import { shopService } from '../services/shop.service'

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

export const Cart = () => {
  const navigate = useNavigate()
  const { title: pageTitle, subtitle: pageSubtitle } = usePageTitle('/cart')
  const { items, removeItem, updateQuantity, clearCart, getTotalPrice, getCurrencySymbol, setCurrency } = useCartStore()
  const [showCheckout, setShowCheckout] = useState(false)
  const [stockWarning, setStockWarning] = useState<string | null>(null)
  const currencySymbol = getCurrencySymbol()
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    street: '',
    city: '',
    postalCode: '',
    country: 'Deutschland'
  })
  const [formErrors, setFormErrors] = useState<Partial<ShippingAddress>>({})

  // Load currency from shop settings
  useEffect(() => {
    const loadCurrency = async () => {
      try {
        const shopData = await shopService.getShop()
        if (shopData.settings?.currency) {
          setCurrency(shopData.settings.currency)
        }
      } catch (error) {
        console.error('Failed to load shop currency:', error)
      }
    }
    loadCurrency()
  }, [setCurrency])

  const validateForm = (): boolean => {
    const errors: Partial<ShippingAddress> = {}
    
    if (!shippingAddress.firstName.trim()) errors.firstName = 'Vorname erforderlich'
    if (!shippingAddress.lastName.trim()) errors.lastName = 'Nachname erforderlich'
    if (!shippingAddress.email.trim()) {
      errors.email = 'E-Mail erforderlich'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shippingAddress.email)) {
      errors.email = 'Ungültige E-Mail-Adresse'
    }
    if (!shippingAddress.street.trim()) errors.street = 'Straße erforderlich'
    if (!shippingAddress.city.trim()) errors.city = 'Stadt erforderlich'
    if (!shippingAddress.postalCode.trim()) errors.postalCode = 'PLZ erforderlich'
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleProceedToPayment = () => {
    if (validateForm()) {
      // Store shipping address for checkout
      localStorage.setItem('checkoutShippingAddress', JSON.stringify(shippingAddress))
      setShowCheckout(true)
    }
  }

  // Show empty cart message
  if (items.length === 0) {
    return (
      <div className="min-h-screen">
        <PageBanner pageId="cart">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold mb-2" style={{ color: 'rgb(var(--color-text))' }}>
              <span className="glow-text">{pageTitle}</span>
            </h1>
            <p className="text-lg" style={{ color: 'rgb(var(--color-text-secondary))' }}>
              {pageSubtitle}
            </p>
          </div>
        </PageBanner>
        <div className="flex items-center justify-center py-20">
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
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Stock Warning Toast */}
      {stockWarning && (
        <div className="fixed top-4 right-4 z-50 bg-yellow-500/90 text-black px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-pulse">
          <AlertTriangle size={20} />
          <span className="font-medium">{stockWarning}</span>
        </div>
      )}

      {/* Page Banner */}
      <PageBanner pageId="cart">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold mb-2" style={{ color: 'rgb(var(--color-text))' }}>
            <span className="glow-text">{pageTitle}</span>
          </h1>
          <p className="text-lg" style={{ color: 'rgb(var(--color-text-secondary))' }}>
            {items.length} {items.length === 1 ? 'Artikel' : 'Artikel'}
          </p>
        </div>
      </PageBanner>

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
                  <p className="text-primary-400 font-bold">{currencySymbol}{item.price.toFixed(2)}</p>
                </div>

                {/* Quantity Controls */}
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      className="p-2 rounded-lg bg-dark-800 hover:bg-dark-700 transition-colors"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-8 text-center font-semibold">{item.quantity}</span>
                    <button
                      onClick={() => {
                        const success = updateQuantity(item.productId, item.quantity + 1)
                        if (!success) {
                          setStockWarning(`Maximale Stückzahl für "${item.name}" erreicht (${item.stock} verfügbar)`)
                          setTimeout(() => setStockWarning(null), 3000)
                        }
                      }}
                      disabled={item.stock !== undefined && item.quantity >= item.stock}
                      className={`p-2 rounded-lg transition-colors ${
                        item.stock !== undefined && item.quantity >= item.stock
                          ? 'bg-dark-800 text-dark-600 cursor-not-allowed'
                          : 'bg-dark-800 hover:bg-dark-700'
                      }`}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  {item.stock !== undefined && (
                    <span className={`text-xs ${item.quantity >= item.stock ? 'text-yellow-500' : 'text-dark-500'}`}>
                      {item.quantity >= item.stock ? 'Max. erreicht' : `${item.stock} verfügbar`}
                    </span>
                  )}
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

          {/* Order Summary & Checkout Form */}
          <div className="lg:col-span-1">
            <div className="card sticky top-4">
              <h2 className="text-xl font-bold mb-4">Bestellübersicht</h2>

              <div className="space-y-3 mb-6">
                {items.map((item) => (
                  <div key={item.productId} className="flex justify-between text-sm">
                    <span className="text-dark-400">
                      {item.name} x{item.quantity}
                    </span>
                    <span>{currencySymbol}{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dark-700 pt-4 mb-6">
                <div className="flex justify-between text-lg font-bold">
                  <span>Gesamt</span>
                  <span className="text-primary-400">{currencySymbol}{getTotalPrice().toFixed(2)}</span>
                </div>
              </div>

              {showCheckout ? (
                <div className="space-y-4">
                  <CheckoutButton
                    customerEmail={shippingAddress.email}
                    shippingAddress={shippingAddress}
                    onSuccess={(orderId) => {
                      console.log('Payment successful:', orderId)
                      navigate('/shop/success')
                    }}
                    onError={(error) => {
                      console.error('Payment failed:', error)
                      alert(error)
                    }}
                  />
                  <button
                    onClick={() => setShowCheckout(false)}
                    className="btn-secondary w-full"
                  >
                    Zurück
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Shipping Address Form */}
                  <div className="border-t border-dark-700 pt-4">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <MapPin size={20} className="text-primary-400" />
                      Lieferadresse
                    </h3>
                    
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm text-dark-400 mb-1">Vorname *</label>
                          <input
                            type="text"
                            value={shippingAddress.firstName}
                            onChange={(e) => setShippingAddress({ ...shippingAddress, firstName: e.target.value })}
                            className={`input w-full ${formErrors.firstName ? 'border-red-500' : ''}`}
                            placeholder="Max"
                          />
                          {formErrors.firstName && <p className="text-red-500 text-xs mt-1">{formErrors.firstName}</p>}
                        </div>
                        <div>
                          <label className="block text-sm text-dark-400 mb-1">Nachname *</label>
                          <input
                            type="text"
                            value={shippingAddress.lastName}
                            onChange={(e) => setShippingAddress({ ...shippingAddress, lastName: e.target.value })}
                            className={`input w-full ${formErrors.lastName ? 'border-red-500' : ''}`}
                            placeholder="Mustermann"
                          />
                          {formErrors.lastName && <p className="text-red-500 text-xs mt-1">{formErrors.lastName}</p>}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm text-dark-400 mb-1 flex items-center gap-1">
                          <Mail size={14} />
                          E-Mail *
                        </label>
                        <input
                          type="email"
                          value={shippingAddress.email}
                          onChange={(e) => setShippingAddress({ ...shippingAddress, email: e.target.value })}
                          className={`input w-full ${formErrors.email ? 'border-red-500' : ''}`}
                          placeholder="max@beispiel.de"
                        />
                        {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
                        <p className="text-xs text-dark-500 mt-1">Für die Bestellbestätigung</p>
                      </div>

                      <div>
                        <label className="block text-sm text-dark-400 mb-1 flex items-center gap-1">
                          <Phone size={14} />
                          Telefon (optional)
                        </label>
                        <input
                          type="tel"
                          value={shippingAddress.phone}
                          onChange={(e) => setShippingAddress({ ...shippingAddress, phone: e.target.value })}
                          className="input w-full"
                          placeholder="+49 123 456789"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-dark-400 mb-1">Straße & Hausnummer *</label>
                        <input
                          type="text"
                          value={shippingAddress.street}
                          onChange={(e) => setShippingAddress({ ...shippingAddress, street: e.target.value })}
                          className={`input w-full ${formErrors.street ? 'border-red-500' : ''}`}
                          placeholder="Musterstraße 123"
                        />
                        {formErrors.street && <p className="text-red-500 text-xs mt-1">{formErrors.street}</p>}
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm text-dark-400 mb-1">PLZ *</label>
                          <input
                            type="text"
                            value={shippingAddress.postalCode}
                            onChange={(e) => setShippingAddress({ ...shippingAddress, postalCode: e.target.value })}
                            className={`input w-full ${formErrors.postalCode ? 'border-red-500' : ''}`}
                            placeholder="12345"
                          />
                          {formErrors.postalCode && <p className="text-red-500 text-xs mt-1">{formErrors.postalCode}</p>}
                        </div>
                        <div className="col-span-2">
                          <label className="block text-sm text-dark-400 mb-1">Stadt *</label>
                          <input
                            type="text"
                            value={shippingAddress.city}
                            onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                            className={`input w-full ${formErrors.city ? 'border-red-500' : ''}`}
                            placeholder="Berlin"
                          />
                          {formErrors.city && <p className="text-red-500 text-xs mt-1">{formErrors.city}</p>}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm text-dark-400 mb-1">Land</label>
                        <select
                          value={shippingAddress.country}
                          onChange={(e) => setShippingAddress({ ...shippingAddress, country: e.target.value })}
                          className="input w-full"
                        >
                          <option value="Deutschland">Deutschland</option>
                          <option value="Österreich">Österreich</option>
                          <option value="Schweiz">Schweiz</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleProceedToPayment}
                    className="btn-primary w-full"
                  >
                    Weiter zur Zahlung
                  </button>
                </div>
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
