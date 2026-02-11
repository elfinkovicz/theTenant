import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Users, Mail, User, Calendar, CheckCircle, XCircle, Loader2, Search, RefreshCw, Crown, CreditCard, Euro, Plus, Trash2, Gift, Save, AlertCircle } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { awsConfig } from '../config/aws-config'
import { MembershipMembersList } from './MembershipMembersList'
import { MollieConnectSetup } from './MollieConnectSetup'
import { getMembershipSettings, saveMembershipSettings, MembershipSettings } from '../services/membership.service'

interface TenantMember {
  user_id: string
  email: string
  name: string | null
  role: 'admin' | 'user'
  email_verified: boolean
  status: string
  joined_at: string
  last_login: string | null
}

interface TenantMembersProps {
  tenantId: string
}

export function TenantMembers({ tenantId }: TenantMembersProps) {
  const { accessToken } = useAuthStore()
  const [members, setMembers] = useState<TenantMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'mitglieder' | 'monetarisierung'>('mitglieder')
  const [memberSubTab, setMemberSubTab] = useState<'registriert' | 'zahlend'>('registriert')
  const [monetarisierungSubTab, setMonetarisierungSubTab] = useState<'zahlungsanbieter' | 'einstellungen'>('zahlungsanbieter')
  const [mollieConnected, setMollieConnected] = useState(false)
  
  // Membership Settings State
  const [membershipLoading, setMembershipLoading] = useState(false)
  const [membershipSaving, setMembershipSaving] = useState(false)
  const [membershipError, setMembershipError] = useState<string | null>(null)
  const [membershipSuccess, setMembershipSuccess] = useState(false)
  const [membershipSettings, setMembershipSettings] = useState<MembershipSettings>({
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

  const loadMembers = async () => {
    if (!accessToken || !tenantId) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${awsConfig.api.user}/tenants/${tenantId}/members`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Creator-ID': tenantId
        }
      })

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Keine Berechtigung. Nur Admins können Mitglieder sehen.')
        }
        throw new Error('Fehler beim Laden der Mitglieder')
      }

      const data = await response.json()
      setMembers(data.members || [])
    } catch (err: any) {
      console.error('Error loading members:', err)
      setError(err.message || 'Fehler beim Laden der Mitglieder')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMembers()
  }, [tenantId, accessToken])

  // Load membership settings when monetarisierung/einstellungen tab is active
  useEffect(() => {
    if (activeTab === 'monetarisierung' && monetarisierungSubTab === 'einstellungen' && accessToken) {
      loadMembershipSettings()
    }
  }, [activeTab, monetarisierungSubTab, tenantId, accessToken])

  const loadMembershipSettings = async () => {
    if (!accessToken) return
    setMembershipLoading(true)
    setMembershipError(null)

    try {
      const data = await getMembershipSettings(tenantId, accessToken)
      setMembershipSettings(data)
    } catch (err: any) {
      console.error('Error loading membership settings:', err)
      setMembershipError(err.message)
    } finally {
      setMembershipLoading(false)
    }
  }

  const handleSaveMembershipSettings = async () => {
    if (!accessToken) return
    setMembershipSaving(true)
    setMembershipError(null)
    setMembershipSuccess(false)

    try {
      await saveMembershipSettings(tenantId, accessToken, membershipSettings)
      setMembershipSuccess(true)
      setTimeout(() => setMembershipSuccess(false), 3000)
    } catch (err: any) {
      console.error('Error saving membership settings:', err)
      setMembershipError(err.message)
    } finally {
      setMembershipSaving(false)
    }
  }

  const addBenefit = () => {
    if (newBenefit.trim()) {
      setMembershipSettings(prev => ({
        ...prev,
        benefits: [...prev.benefits, newBenefit.trim()]
      }))
      setNewBenefit('')
    }
  }

  const removeBenefit = (index: number) => {
    setMembershipSettings(prev => ({
      ...prev,
      benefits: prev.benefits.filter((_, i) => i !== index)
    }))
  }

  // Berechnung der Auszahlung
  const platformFee = membershipSettings.monthly_price * (membershipSettings.platform_fee_percent / 100)
  const netPayout = membershipSettings.monthly_price - platformFee

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const filteredMembers = members.filter(member => {
    const search = searchTerm.toLowerCase()
    return (
      member.email.toLowerCase().includes(search) ||
      (member.name?.toLowerCase().includes(search) || false)
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        <span className="ml-3 text-dark-400">Lade Mitglieder...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
        <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-red-400">{error}</p>
        <button
          onClick={loadMembers}
          className="mt-4 btn-secondary flex items-center gap-2 mx-auto"
        >
          <RefreshCw size={16} />
          Erneut versuchen
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Haupt-Tabs */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex gap-2 p-1 bg-dark-900 rounded-xl w-fit flex-wrap">
          <button
            onClick={() => setActiveTab('mitglieder')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'mitglieder' 
                ? 'bg-primary-500 text-white' 
                : 'text-dark-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            Mitgliederverwaltung
          </button>
          <button
            onClick={() => setActiveTab('monetarisierung')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'monetarisierung' 
                ? 'bg-primary-500 text-white' 
                : 'text-dark-400 hover:text-white'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Monetarisierung
            {mollieConnected && (
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            )}
          </button>
        </div>
      </div>

      {/* Mitgliederverwaltung Tab */}
      {activeTab === 'mitglieder' ? (
        <div className="space-y-6">
          {/* Sub-Tabs */}
          <div className="flex gap-4 border-b border-dark-700">
            <button
              onClick={() => setMemberSubTab('registriert')}
              className={`pb-3 px-1 border-b-2 transition-colors flex items-center gap-2 ${
                memberSubTab === 'registriert'
                  ? 'border-primary-500 text-white'
                  : 'border-transparent text-dark-400 hover:text-white'
              }`}
            >
              <User className="w-4 h-4" />
              Registrierte Nutzer
              <span className="text-xs bg-dark-700 px-2 py-0.5 rounded-full">{members.length}</span>
            </button>
            <button
              onClick={() => setMemberSubTab('zahlend')}
              className={`pb-3 px-1 border-b-2 transition-colors flex items-center gap-2 ${
                memberSubTab === 'zahlend'
                  ? 'border-primary-500 text-white'
                  : 'border-transparent text-dark-400 hover:text-white'
              }`}
            >
              <Crown className="w-4 h-4" />
              Zahlende Mitglieder
            </button>
          </div>

          {/* Sub-Tab Content */}
          {memberSubTab === 'registriert' ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Header mit Statistiken */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary-500" />
                    Registrierte Nutzer
                  </h2>
                  <p className="text-dark-400 text-sm mt-1">
                    Alle Nutzer die sich bei deinem Tenant registriert haben
                  </p>
                </div>

                {/* Statistik-Badge */}
                <div className="flex gap-3">
                  <div className="bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 flex items-center gap-2">
                    <User className="w-4 h-4 text-dark-400" />
                    <span className="text-dark-300 font-medium">{members.length} Benutzer</span>
                  </div>
                </div>
              </div>

              {/* Suchleiste */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                <input
                  type="text"
                  placeholder="Mitglieder suchen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-dark-700 rounded-xl focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
                />
              </div>

              {/* Mitglieder-Liste */}
              {filteredMembers.length === 0 ? (
                <div className="text-center py-12 text-dark-400">
                  {searchTerm ? 'Keine Mitglieder gefunden' : 'Noch keine Mitglieder registriert'}
                </div>
              ) : (
                <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
                  {/* Tabellen-Header */}
                  <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-dark-900 border-b border-dark-700 text-sm font-medium text-dark-400">
                    <div className="col-span-4">Mitglied</div>
                    <div className="col-span-2">Rolle</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-2">Beigetreten</div>
                    <div className="col-span-2">Letzter Login</div>
                  </div>

                  {/* Mitglieder-Zeilen */}
                  <div className="divide-y divide-dark-700">
                    {filteredMembers.map((member, index) => (
                      <motion.div
                        key={member.user_id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className="grid grid-cols-12 gap-4 px-4 py-4 hover:bg-dark-700/50 transition-colors"
                      >
                        {/* Mitglied Info */}
                        <div className="col-span-4 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-dark-700 text-dark-400">
                            <User className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-white truncate">
                              {member.name || 'Unbekannt'}
                            </p>
                            <p className="text-sm text-dark-400 truncate flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {member.email}
                            </p>
                          </div>
                        </div>

                        {/* Rolle */}
                        <div className="col-span-2 flex items-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            member.role === 'admin'
                              ? 'bg-primary-500/20 text-primary-400'
                              : 'bg-dark-700 text-dark-300'
                          }`}>
                            {member.role === 'admin' ? 'Admin' : 'Benutzer'}
                          </span>
                        </div>

                        {/* Status */}
                        <div className="col-span-2 flex items-center">
                          <div className="flex items-center gap-1.5">
                            {member.email_verified ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-yellow-500" />
                            )}
                            <span className={`text-sm ${
                              member.email_verified ? 'text-green-400' : 'text-yellow-400'
                            }`}>
                              {member.email_verified ? 'Verifiziert' : 'Ausstehend'}
                            </span>
                          </div>
                        </div>

                        {/* Beigetreten */}
                        <div className="col-span-2 flex items-center text-sm text-dark-400">
                          <Calendar className="w-4 h-4 mr-1.5" />
                          {formatDate(member.joined_at)}
                        </div>

                        {/* Letzter Login */}
                        <div className="col-span-2 flex items-center text-sm text-dark-400">
                          {member.last_login ? formatDate(member.last_login) : '-'}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Refresh Button */}
              <div className="flex justify-end">
                <button
                  onClick={loadMembers}
                  disabled={loading}
                  className="btn-secondary flex items-center gap-2"
                >
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                  Aktualisieren
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Suchleiste */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                <input
                  type="text"
                  placeholder="Mitglieder suchen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-dark-700 rounded-xl focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
                />
              </div>
              <MembershipMembersList tenantId={tenantId} searchTerm={searchTerm} />
            </motion.div>
          )}
        </div>
      ) : (
        /* Monetarisierung Tab */
        <div className="space-y-6">
          {/* Sub-Tabs */}
          <div className="flex gap-4 border-b border-dark-700">
            <button
              onClick={() => setMonetarisierungSubTab('zahlungsanbieter')}
              className={`pb-3 px-1 border-b-2 transition-colors flex items-center gap-2 ${
                monetarisierungSubTab === 'zahlungsanbieter'
                  ? 'border-primary-500 text-white'
                  : 'border-transparent text-dark-400 hover:text-white'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Zahlungsanbieter
              {mollieConnected && (
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              )}
            </button>
            <button
              onClick={() => setMonetarisierungSubTab('einstellungen')}
              className={`pb-3 px-1 border-b-2 transition-colors flex items-center gap-2 ${
                monetarisierungSubTab === 'einstellungen'
                  ? 'border-primary-500 text-white'
                  : 'border-transparent text-dark-400 hover:text-white'
              }`}
            >
              <Crown className="w-4 h-4" />
              Mitgliedschaft einrichten
            </button>
          </div>

          {/* Sub-Tab Content */}
          {monetarisierungSubTab === 'zahlungsanbieter' ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-2xl"
            >
              <div className="mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary-500" />
                  Zahlungsanbieter verbinden
                </h2>
                <p className="text-dark-400 text-sm mt-1">
                  Verbinde dein Mollie-Konto, um Mitgliedschaften abzurechnen.
                </p>
              </div>
              
              <div className="card">
                <MollieConnectSetup 
                  tenantId={tenantId}
                  onStatusChange={(connected) => setMollieConnected(connected)}
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {!mollieConnected ? (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-yellow-400">Mollie-Konto erforderlich</h3>
                      <p className="text-sm text-dark-400 mt-1">
                        Verbinde zuerst dein Mollie-Konto unter "Zahlungsanbieter", um Mitgliedschaften einzurichten.
                      </p>
                      <button
                        onClick={() => setMonetarisierungSubTab('zahlungsanbieter')}
                        className="mt-3 text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1"
                      >
                        <CreditCard className="w-4 h-4" />
                        Zum Zahlungsanbieter
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <Crown className="w-5 h-5 text-primary-500" />
                      Mitgliedschaft einrichten
                    </h2>
                    <p className="text-dark-400 text-sm mt-1">
                      Konfiguriere dein Mitgliedschafts-Angebot für deine Fans.
                    </p>
                  </div>

                  {membershipLoading ? (
                    <div className="card flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                      {/* Linke Spalte - Einstellungen */}
                      <div className="lg:col-span-3 card space-y-6">
                        {/* Aktivieren */}
                        <div className="flex items-center justify-between p-4 bg-dark-900 rounded-xl">
                          <div>
                            <h3 className="font-medium">Mitgliedschaft aktivieren</h3>
                            <p className="text-sm text-dark-400">Nutzer können sich als zahlende Mitglieder anmelden</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={membershipSettings.enabled}
                              onChange={e => setMembershipSettings(prev => ({ ...prev, enabled: e.target.checked }))}
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
                            value={membershipSettings.title}
                            onChange={e => setMembershipSettings(prev => ({ ...prev, title: e.target.value }))}
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
                              value={membershipSettings.monthly_price}
                              onChange={e => setMembershipSettings(prev => ({ ...prev, monthly_price: parseFloat(e.target.value) || 0 }))}
                              className="w-full pl-12 pr-4 py-3 bg-dark-900 border border-dark-700 rounded-xl focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                            />
                          </div>
                          
                          {/* Gebühren-Übersicht */}
                          <div className="mt-3 p-4 bg-dark-900/50 rounded-xl text-sm">
                            <div className="flex justify-between text-dark-400">
                              <span>Mitgliedsbeitrag</span>
                              <span>€{membershipSettings.monthly_price.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-dark-400 mt-1">
                              <span>Plattform-Gebühr ({membershipSettings.platform_fee_percent}%)</span>
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
                            value={membershipSettings.description}
                            onChange={e => setMembershipSettings(prev => ({ ...prev, description: e.target.value }))}
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
                            {membershipSettings.benefits.map((benefit, index) => (
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
                        {membershipError && (
                          <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span>{membershipError}</span>
                          </div>
                        )}

                        {membershipSuccess && (
                          <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400">
                            <CheckCircle className="w-5 h-5 flex-shrink-0" />
                            <span>Einstellungen gespeichert!</span>
                          </div>
                        )}

                        {/* Save Button */}
                        <div className="flex justify-end pt-4 border-t border-dark-700">
                          <button
                            onClick={handleSaveMembershipSettings}
                            disabled={membershipSaving}
                            className="px-6 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center gap-2"
                          >
                            {membershipSaving ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <Save className="w-5 h-5" />
                            )}
                            Speichern
                          </button>
                        </div>
                      </div>

                      {/* Rechte Spalte - Vorschau */}
                      <div className="lg:col-span-2">
                        <div className="sticky top-4">
                          <p className="text-sm text-dark-400 mb-3">Vorschau für deine Fans</p>
                          
                          {/* Membership Card Preview */}
                          <div className={`rounded-2xl border-2 overflow-hidden transition-all ${
                            membershipSettings.enabled 
                              ? 'border-primary-500 bg-gradient-to-br from-primary-500/10 to-dark-800' 
                              : 'border-dark-700 bg-dark-800 opacity-60'
                          }`}>
                            {/* Header */}
                            <div className="p-6 text-center border-b border-dark-700/50">
                              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-500/20 flex items-center justify-center">
                                <Crown className="w-8 h-8 text-primary-400" />
                              </div>
                              <h3 className="text-xl font-bold">
                                {membershipSettings.title || 'Mitgliedschaft'}
                              </h3>
                              {membershipSettings.description && (
                                <p className="text-dark-400 text-sm mt-2">
                                  {membershipSettings.description}
                                </p>
                              )}
                            </div>

                            {/* Preis */}
                            <div className="p-6 text-center bg-dark-900/30">
                              <div className="flex items-baseline justify-center gap-1">
                                <span className="text-4xl font-bold text-primary-400">
                                  €{membershipSettings.monthly_price.toFixed(2)}
                                </span>
                                <span className="text-dark-400">/Monat</span>
                              </div>
                            </div>

                            {/* Benefits */}
                            {membershipSettings.benefits.length > 0 && (
                              <div className="p-6 space-y-3">
                                {membershipSettings.benefits.map((benefit, index) => (
                                  <div key={index} className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                    <span className="text-sm">{benefit}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* CTA Button */}
                            <div className="p-6 pt-0">
                              <button 
                                disabled
                                className="w-full py-3 px-6 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 rounded-xl font-medium transition-colors"
                              >
                                Jetzt Mitglied werden
                              </button>
                              <p className="text-xs text-dark-500 text-center mt-3">
                                Jederzeit kündbar
                              </p>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className={`mt-4 p-3 rounded-xl text-center text-sm ${
                            membershipSettings.enabled
                              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                              : 'bg-dark-800 border border-dark-700 text-dark-400'
                          }`}>
                            {membershipSettings.enabled ? (
                              <span className="flex items-center justify-center gap-2">
                                <CheckCircle className="w-4 h-4" />
                                Mitgliedschaft ist aktiv
                              </span>
                            ) : (
                              <span className="flex items-center justify-center gap-2">
                                <XCircle className="w-4 h-4" />
                                Mitgliedschaft ist deaktiviert
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </div>
      )}
    </div>
  )
}
