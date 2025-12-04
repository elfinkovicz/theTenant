import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Save, Eye, EyeOff, CreditCard } from 'lucide-react'
import { shopService } from '../services/shop.service'

interface ShopSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type PaymentProvider = 'paypal' | 'stripe' | 'mollie'

export const ShopSettingsModal = ({ isOpen, onClose, onSuccess }: ShopSettingsModalProps) => {
  const [loading, setLoading] = useState(false)
  const [showSecrets, setShowSecrets] = useState({
    paypal: false,
    stripe: false,
    mollie: false
  })
  const [activeProvider, setActiveProvider] = useState<PaymentProvider>('paypal')
  const [formData, setFormData] = useState({
    // PayPal
    paypalClientId: '',
    paypalClientSecret: '',
    paypalMode: 'live' as 'sandbox' | 'live',
    paypalEnabled: true,
    
    // Stripe
    stripePublishableKey: '',
    stripeSecretKey: '',
    stripeWebhookSecret: '',
    stripeEnabled: false,
    
    // Mollie
    mollieApiKey: '',
    mollieEnabled: false,
    
    // General
    sellerEmail: '',
    sellerName: ''
  })

  useEffect(() => {
    if (isOpen) {
      loadSettings()
    }
  }, [isOpen])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const settings = await shopService.getSettings()
      
      // Don't load masked secrets (starting with ***)
      const isMasked = (value: string | undefined) => value?.startsWith('***')
      
      setFormData({
        paypalClientId: settings.paypalClientId || '',
        paypalClientSecret: isMasked(settings.paypalClientSecret) ? '' : (settings.paypalClientSecret || ''),
        paypalMode: (settings.paypalMode as 'sandbox' | 'live') || 'live',
        paypalEnabled: settings.paypalEnabled || false,
        stripePublishableKey: settings.stripePublishableKey || '',
        stripeSecretKey: isMasked(settings.stripeSecretKey) ? '' : (settings.stripeSecretKey || ''),
        stripeWebhookSecret: isMasked(settings.stripeWebhookSecret) ? '' : (settings.stripeWebhookSecret || ''),
        stripeEnabled: settings.stripeEnabled || false,
        mollieApiKey: isMasked(settings.mollieApiKey) ? '' : (settings.mollieApiKey || ''),
        mollieEnabled: settings.mollieEnabled || false,
        sellerEmail: settings.sellerEmail || '',
        sellerName: settings.sellerName || ''
      })
    } catch (error) {
      console.error('Failed to load settings:', error)
      alert('Fehler beim Laden der Einstellungen')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await shopService.updateSettings(formData)
      alert('Einstellungen erfolgreich gespeichert!')
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Failed to save settings:', error)
      alert(error.message || 'Fehler beim Speichern der Einstellungen')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto card"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6 pb-6 border-b border-dark-700">
              <h2 className="text-2xl font-bold">Shop Einstellungen</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Payment Provider Tabs */}
              <div className="flex gap-2 border-b border-dark-700 pb-4">
                <button
                  type="button"
                  onClick={() => setActiveProvider('paypal')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    activeProvider === 'paypal'
                      ? 'bg-primary-600 text-white'
                      : 'bg-dark-800 text-dark-400 hover:text-white'
                  }`}
                >
                  <CreditCard size={18} />
                  PayPal
                </button>
                <button
                  type="button"
                  onClick={() => setActiveProvider('stripe')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    activeProvider === 'stripe'
                      ? 'bg-primary-600 text-white'
                      : 'bg-dark-800 text-dark-400 hover:text-white'
                  }`}
                >
                  <CreditCard size={18} />
                  Stripe
                </button>
                <button
                  type="button"
                  onClick={() => setActiveProvider('mollie')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    activeProvider === 'mollie'
                      ? 'bg-primary-600 text-white'
                      : 'bg-dark-800 text-dark-400 hover:text-white'
                  }`}
                >
                  <CreditCard size={18} />
                  Mollie
                </button>
              </div>

              {/* PayPal Settings */}
              {activeProvider === 'paypal' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">PayPal Konfiguration</h3>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.paypalEnabled}
                        onChange={(e) => setFormData({ ...formData, paypalEnabled: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Aktiviert</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Client ID
                    </label>
                    <input
                      type="text"
                      value={formData.paypalClientId}
                      onChange={(e) => setFormData({ ...formData, paypalClientId: e.target.value })}
                      className="input w-full"
                      placeholder="AXxxx..."
                      disabled={!formData.paypalEnabled}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Client Secret
                    </label>
                    <div className="relative">
                      <input
                        type={showSecrets.paypal ? 'text' : 'password'}
                        value={formData.paypalClientSecret}
                        onChange={(e) => setFormData({ ...formData, paypalClientSecret: e.target.value })}
                        className="input w-full pr-12"
                        placeholder="EXxxx..."
                        disabled={!formData.paypalEnabled}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecrets({ ...showSecrets, paypal: !showSecrets.paypal })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white"
                      >
                        {showSecrets.paypal ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Stripe Settings */}
              {activeProvider === 'stripe' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Stripe Konfiguration</h3>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.stripeEnabled}
                        onChange={(e) => setFormData({ ...formData, stripeEnabled: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Aktiviert</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Publishable Key
                    </label>
                    <input
                      type="text"
                      value={formData.stripePublishableKey}
                      onChange={(e) => setFormData({ ...formData, stripePublishableKey: e.target.value })}
                      className="input w-full"
                      placeholder="pk_live_xxx..."
                      disabled={!formData.stripeEnabled}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Secret Key
                    </label>
                    <div className="relative">
                      <input
                        type={showSecrets.stripe ? 'text' : 'password'}
                        value={formData.stripeSecretKey}
                        onChange={(e) => setFormData({ ...formData, stripeSecretKey: e.target.value })}
                        className="input w-full pr-12"
                        placeholder="sk_live_xxx..."
                        disabled={!formData.stripeEnabled}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecrets({ ...showSecrets, stripe: !showSecrets.stripe })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white"
                      >
                        {showSecrets.stripe ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Webhook Secret
                    </label>
                    <div className="relative">
                      <input
                        type={showSecrets.stripe ? 'text' : 'password'}
                        value={formData.stripeWebhookSecret}
                        onChange={(e) => setFormData({ ...formData, stripeWebhookSecret: e.target.value })}
                        className="input w-full pr-12"
                        placeholder="whsec_xxx..."
                        disabled={!formData.stripeEnabled}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Mollie Settings */}
              {activeProvider === 'mollie' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Mollie Konfiguration</h3>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.mollieEnabled}
                        onChange={(e) => setFormData({ ...formData, mollieEnabled: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Aktiviert</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      API Key
                    </label>
                    <div className="relative">
                      <input
                        type={showSecrets.mollie ? 'text' : 'password'}
                        value={formData.mollieApiKey}
                        onChange={(e) => setFormData({ ...formData, mollieApiKey: e.target.value })}
                        className="input w-full pr-12"
                        placeholder="live_xxx..."
                        disabled={!formData.mollieEnabled}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecrets({ ...showSecrets, mollie: !showSecrets.mollie })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white"
                      >
                        {showSecrets.mollie ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* General Settings */}
              <div className="border-t border-dark-700 pt-6 space-y-4">
                <h3 className="text-lg font-semibold">Allgemeine Einstellungen</h3>
                
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Verkäufer E-Mail
                  </label>
                  <input
                    type="email"
                    value={formData.sellerEmail}
                    onChange={(e) => setFormData({ ...formData, sellerEmail: e.target.value })}
                    className="input w-full"
                    placeholder="shop@example.com"
                    required
                  />
                  <p className="text-xs text-dark-400 mt-1">
                    An diese E-Mail werden Bestellbenachrichtigungen gesendet
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Shop Name
                  </label>
                  <input
                    type="text"
                    value={formData.sellerName}
                    onChange={(e) => setFormData({ ...formData, sellerName: e.target.value })}
                    className="input w-full"
                    placeholder="Mein Shop"
                    required
                  />
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-primary-900/20 border border-primary-500/20 rounded-lg p-4">
                <p className="text-sm text-dark-300">
                  <strong>Hinweis:</strong> Alle Zugangsdaten werden sicher verschlüsselt gespeichert.
                  Aktiviere nur die Zahlungsanbieter, die du verwenden möchtest.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Wird gespeichert...
                    </>
                  ) : (
                    <>
                      <Save size={20} />
                      Speichern
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary flex-1"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
