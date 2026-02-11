import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Save, CreditCard, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { shopService } from '../services/shop.service'
import { toast } from '../utils/toast-alert'

interface PaymentConfig {
  paypal: {
    enabled: boolean
    clientId: string
    clientSecret: string
    sandbox: boolean
  }
  mollie: {
    enabled: boolean
    apiKey: string
    profileId: string
  }
}

interface ShopSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const ShopSettingsModal = ({ isOpen, onClose, onSuccess }: ShopSettingsModalProps) => {
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'payment'>('general')
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
  
  const [formData, setFormData] = useState({
    currency: 'EUR',
    taxRate: 19,
    shippingEnabled: true,
    orderNotificationEmail: ''
  })
  
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>({
    paypal: { enabled: false, clientId: '', clientSecret: '', sandbox: true },
    mollie: { enabled: false, apiKey: '', profileId: '' }
  })

  const [shopData, setShopData] = useState<any>(null)

  useEffect(() => {
    if (isOpen) {
      loadSettings()
    }
  }, [isOpen])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const data = await shopService.getShop()
      setShopData(data)
      setFormData({
        currency: data.settings.currency || 'EUR',
        taxRate: data.settings.taxRate || 19,
        shippingEnabled: data.settings.shippingEnabled !== false,
        orderNotificationEmail: (data.settings as any).orderNotificationEmail || ''
      })
      
      if (data.settings.paymentConfig) {
        setPaymentConfig({
          paypal: { 
            enabled: false, 
            clientId: '', 
            clientSecret: '', 
            sandbox: true,
            ...data.settings.paymentConfig.paypal 
          },
          mollie: { 
            enabled: false, 
            apiKey: '', 
            profileId: '',
            ...data.settings.paymentConfig.mollie 
          }
        })
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const settings = {
        ...formData,
        paymentConfig
      }
      const products = shopData?.products || []
      const categories = shopData?.categories || []
      await shopService.updateShop(products, categories, settings)
      toast.success('Shop-Einstellungen erfolgreich gespeichert!')
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Failed to save settings:', error)
      toast.error('Fehler beim Speichern der Einstellungen')
    } finally {
      setLoading(false)
    }
  }

  const toggleSecret = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const updatePaymentProvider = (provider: keyof PaymentConfig, field: string, value: any) => {
    setPaymentConfig(prev => ({
      ...prev,
      [provider]: { ...prev[provider], [field]: value }
    }))
  }

  const getActiveProviderCount = () => {
    return [paymentConfig.paypal.enabled, paymentConfig.mollie.enabled].filter(Boolean).length
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
            className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto card"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6 pb-6 border-b border-dark-700">
              <h2 className="text-2xl font-bold">Shop Einstellungen</h2>
              <button 
                type="button"
                onClick={onClose} 
                className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setActiveTab('general')}
                className={`px-4 py-2 rounded-lg transition-colors ${activeTab === 'general' ? 'bg-primary-600 text-white' : 'bg-dark-800 hover:bg-dark-700'}`}
              >
                Allgemein
              </button>
              <button
                onClick={() => setActiveTab('payment')}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${activeTab === 'payment' ? 'bg-primary-600 text-white' : 'bg-dark-800 hover:bg-dark-700'}`}
              >
                <CreditCard size={18} />
                Zahlungsanbieter
                {getActiveProviderCount() > 0 && (
                  <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {getActiveProviderCount()}
                  </span>
                )}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {activeTab === 'general' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Allgemeine Einstellungen</h3>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Währung</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="input w-full"
                    >
                      <option value="EUR">Euro (EUR)</option>
                      <option value="USD">US Dollar (USD)</option>
                      <option value="GBP">British Pound (GBP)</option>
                      <option value="CHF">Swiss Franc (CHF)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Steuersatz (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={formData.taxRate}
                      onChange={(e) => setFormData({ ...formData, taxRate: parseFloat(e.target.value) })}
                      className="input w-full"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.shippingEnabled}
                        onChange={(e) => setFormData({ ...formData, shippingEnabled: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium">Versand aktivieren</span>
                    </label>
                  </div>

                  <div className="pt-4 border-t border-dark-700">
                    <h4 className="text-md font-semibold mb-3">Bestellbenachrichtigungen</h4>
                    <div>
                      <label className="block text-sm font-medium mb-2">E-Mail für Bestellbenachrichtigungen</label>
                      <input
                        type="email"
                        value={formData.orderNotificationEmail}
                        onChange={(e) => setFormData({ ...formData, orderNotificationEmail: e.target.value })}
                        placeholder="shop@example.com"
                        className="input w-full"
                      />
                      <p className="text-xs text-dark-400 mt-1">
                        An diese Adresse werden Bestellbestätigungen gesendet
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'payment' && (
                <div className="space-y-6">
                  {/* PayPal */}
                  <div className="border border-dark-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <img src="https://www.paypalobjects.com/webstatic/icon/pp258.png" alt="PayPal" className="w-8 h-8" />
                        <div>
                          <h4 className="font-semibold">PayPal</h4>
                          <p className="text-sm text-dark-400">Akzeptiere PayPal-Zahlungen</p>
                        </div>
                      </div>
                      <div 
                        onClick={() => updatePaymentProvider('paypal', 'enabled', !paymentConfig.paypal.enabled)}
                        className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors cursor-pointer ${
                          paymentConfig.paypal.enabled ? 'bg-green-500' : 'bg-dark-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                            paymentConfig.paypal.enabled ? 'translate-x-8' : 'translate-x-1'
                          }`}
                        />
                      </div>
                    </div>
                    
                    {paymentConfig.paypal.enabled && (
                      <div className="space-y-3 pt-4 border-t border-dark-700">
                        <div>
                          <label className="block text-sm font-medium mb-1">Client ID</label>
                          <input
                            type="text"
                            value={paymentConfig.paypal.clientId}
                            onChange={(e) => updatePaymentProvider('paypal', 'clientId', e.target.value)}
                            placeholder="PayPal Client ID"
                            className="input w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Client Secret</label>
                          <div className="relative">
                            <input
                              type={showSecrets['paypal-secret'] ? 'text' : 'password'}
                              value={paymentConfig.paypal.clientSecret}
                              onChange={(e) => updatePaymentProvider('paypal', 'clientSecret', e.target.value)}
                              placeholder="PayPal Client Secret"
                              className="input w-full pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => toggleSecret('paypal-secret')}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white"
                            >
                              {showSecrets['paypal-secret'] ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </div>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={paymentConfig.paypal.sandbox}
                            onChange={(e) => updatePaymentProvider('paypal', 'sandbox', e.target.checked)}
                            className="w-4 h-4"
                          />
                          <span className="text-sm">Sandbox-Modus (Testumgebung)</span>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Mollie */}
                  <div className="border border-dark-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-black rounded flex items-center justify-center text-white font-bold text-sm">M</div>
                        <div>
                          <h4 className="font-semibold">Mollie</h4>
                          <p className="text-sm text-dark-400">Kreditkarten, iDEAL, SOFORT & mehr</p>
                        </div>
                      </div>
                      <div 
                        onClick={() => updatePaymentProvider('mollie', 'enabled', !paymentConfig.mollie.enabled)}
                        className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors cursor-pointer ${
                          paymentConfig.mollie.enabled ? 'bg-green-500' : 'bg-dark-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                            paymentConfig.mollie.enabled ? 'translate-x-8' : 'translate-x-1'
                          }`}
                        />
                      </div>
                    </div>
                    
                    {paymentConfig.mollie.enabled && (
                      <div className="space-y-3 pt-4 border-t border-dark-700">
                        <div>
                          <label className="block text-sm font-medium mb-1">API Key</label>
                          <div className="relative">
                            <input
                              type={showSecrets['mollie-api'] ? 'text' : 'password'}
                              value={paymentConfig.mollie.apiKey}
                              onChange={(e) => updatePaymentProvider('mollie', 'apiKey', e.target.value)}
                              placeholder="live_... oder test_..."
                              className="input w-full pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => toggleSecret('mollie-api')}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white"
                            >
                              {showSecrets['mollie-api'] ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Profile ID (optional)</label>
                          <input
                            type="text"
                            value={paymentConfig.mollie.profileId}
                            onChange={(e) => updatePaymentProvider('mollie', 'profileId', e.target.value)}
                            placeholder="pfl_..."
                            className="input w-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Info Box */}
                  <div className="bg-yellow-900/20 border border-yellow-500/20 rounded-lg p-4 flex gap-3">
                    <AlertCircle size={20} className="text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-yellow-500 mb-1">Sicherheitshinweis</p>
                      <p className="text-dark-300">
                        Deine API-Schlüssel werden verschlüsselt gespeichert. Verwende im Produktivbetrieb 
                        immer Live-Keys und teste vorher mit Sandbox/Test-Keys.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-dark-700">
                <button type="button" onClick={onClose} className="btn-secondary flex-1">
                  Abbrechen
                </button>
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
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
