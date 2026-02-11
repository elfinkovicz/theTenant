/**
 * MembershipSettingsModal - Admin-Einstellungen für Mitgliedschaften
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, Save, Loader2, Euro, Plus, Trash2, 
  CheckCircle, AlertCircle, Settings, Gift
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { 
  getMembershipSettings, 
  saveMembershipSettings,
  MembershipSettings 
} from '../services/membership.service'

interface MembershipSettingsModalProps {
  tenantId: string
  isOpen: boolean
  onClose: () => void
  onSaved?: () => void
}

export function MembershipSettingsModal({ 
  tenantId, 
  isOpen, 
  onClose,
  onSaved 
}: MembershipSettingsModalProps) {
  const { accessToken } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [settings, setSettings] = useState<MembershipSettings>({
    tenant_id: tenantId,
    enabled: false,
    monthly_price: 9.99,
    currency: 'EUR',
    title: 'Mitgliedschaft',
    description: '',
    benefits: [],
    platform_fee_percent: 10
  })

  const [newBenefit, setNewBenefit] = useState('')

  useEffect(() => {
    if (isOpen && accessToken) {
      loadSettings()
    }
  }, [isOpen, tenantId, accessToken])

  const loadSettings = async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)

    try {
      const data = await getMembershipSettings(tenantId, accessToken)
      setSettings(data)
    } catch (err: any) {
      console.error('Error loading settings:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!accessToken) return
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      await saveMembershipSettings(tenantId, accessToken, settings)
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        onSaved?.()
      }, 1500)
    } catch (err: any) {
      console.error('Error saving settings:', err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const addBenefit = () => {
    if (newBenefit.trim()) {
      setSettings(prev => ({
        ...prev,
        benefits: [...prev.benefits, newBenefit.trim()]
      }))
      setNewBenefit('')
    }
  }

  const removeBenefit = (index: number) => {
    setSettings(prev => ({
      ...prev,
      benefits: prev.benefits.filter((_, i) => i !== index)
    }))
  }

  // Berechnung der Auszahlung
  const platformFee = settings.monthly_price * (settings.platform_fee_percent / 100)
  const netPayout = settings.monthly_price - platformFee

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-dark-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-dark-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center">
                <Settings className="w-5 h-5 text-primary-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Mitgliedschaft einrichten</h2>
                <p className="text-sm text-dark-400">Biete deinen Fans eine Premium-Mitgliedschaft an</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Aktivieren */}
                <div className="flex items-center justify-between p-4 bg-dark-900 rounded-xl">
                  <div>
                    <h3 className="font-medium">Mitgliedschaft aktivieren</h3>
                    <p className="text-sm text-dark-400">Nutzer können sich als zahlende Mitglieder anmelden</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enabled}
                      onChange={e => setSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                  </label>
                </div>

                {/* Titel */}
                <div>
                  <label className="block text-sm font-medium mb-2">Titel</label>
                  <input
                    type="text"
                    value={settings.title}
                    onChange={e => setSettings(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="z.B. Premium Mitgliedschaft"
                    className="w-full px-4 py-3 bg-dark-900 border border-dark-700 rounded-xl focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                {/* Preis */}
                <div>
                  <label className="block text-sm font-medium mb-2">Monatlicher Preis</label>
                  <div className="relative">
                    <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={settings.monthly_price}
                      onChange={e => setSettings(prev => ({ ...prev, monthly_price: parseFloat(e.target.value) || 0 }))}
                      className="w-full pl-12 pr-4 py-3 bg-dark-900 border border-dark-700 rounded-xl focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  
                  {/* Gebühren-Übersicht */}
                  <div className="mt-3 p-4 bg-dark-900/50 rounded-xl text-sm">
                    <div className="flex justify-between text-dark-400">
                      <span>Mitgliedsbeitrag</span>
                      <span>€{settings.monthly_price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-dark-400 mt-1">
                      <span>Plattform-Gebühr ({settings.platform_fee_percent}%)</span>
                      <span>-€{platformFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-medium text-green-400 mt-2 pt-2 border-t border-dark-700">
                      <span>Deine Auszahlung</span>
                      <span>€{netPayout.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Beschreibung */}
                <div>
                  <label className="block text-sm font-medium mb-2">Beschreibung</label>
                  <textarea
                    value={settings.description}
                    onChange={e => setSettings(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Beschreibe, was Mitglieder erwartet..."
                    rows={3}
                    className="w-full px-4 py-3 bg-dark-900 border border-dark-700 rounded-xl focus:border-primary-500 focus:ring-1 focus:ring-primary-500 resize-none"
                  />
                </div>

                {/* Benefits */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    <Gift className="w-4 h-4 inline mr-1" />
                    Vorteile für Mitglieder
                  </label>
                  
                  {/* Bestehende Benefits */}
                  <div className="space-y-2 mb-3">
                    {settings.benefits.map((benefit, index) => (
                      <div 
                        key={index}
                        className="flex items-center gap-2 p-3 bg-dark-900 rounded-lg"
                      >
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="flex-1">{benefit}</span>
                        <button
                          onClick={() => removeBenefit(index)}
                          className="p-1 hover:bg-dark-700 rounded transition-colors text-dark-400 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Neuen Benefit hinzufügen */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newBenefit}
                      onChange={e => setNewBenefit(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && addBenefit()}
                      placeholder="Neuen Vorteil hinzufügen..."
                      className="flex-1 px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    />
                    <button
                      onClick={addBenefit}
                      disabled={!newBenefit.trim()}
                      className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Error/Success Messages */}
                {error && (
                  <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {success && (
                  <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400">
                    <CheckCircle className="w-5 h-5 flex-shrink-0" />
                    <span>Einstellungen gespeichert!</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-dark-700">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-dark-700 hover:bg-dark-600 rounded-xl transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="px-6 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center gap-2"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              Speichern
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
