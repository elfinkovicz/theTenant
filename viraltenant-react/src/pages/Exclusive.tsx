import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Crown, Video, DollarSign, CheckCircle, Loader2, CreditCard, XCircle, AlertCircle } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAdmin } from '../hooks/useAdmin'
import { usePremium, invalidatePremiumCache } from '../hooks/usePremium'
import { useTenant } from '../providers/TenantProvider'
import { BillingManagement } from '../components/BillingManagement'
import { 
  getMembershipInfo, 
  subscribeMembership, 
  cancelMembership,
  MembershipInfo 
} from '../services/membership.service'
import { PageBanner } from '../components/PageBanner'
import { toast } from '../utils/toast-alert'

export const Exclusive = () => {
  const { isAuthenticated, accessToken, user } = useAuthStore()
  const { isAdmin } = useAdmin()
  const { isPremium, membershipStatus, isLoading: premiumLoading, refreshPremiumStatus } = usePremium()
  const { tenantId } = useTenant()
  const navigate = useNavigate()
  
  const [activeTab, setActiveTab] = useState<'membership' | 'billing'>('membership')
  const [membershipInfo, setMembershipInfo] = useState<MembershipInfo | null>(null)
  const [infoLoading, setInfoLoading] = useState(true)
  const [subscribing, setSubscribing] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" />
  }

  // Load membership info
  useEffect(() => {
    if (tenantId) {
      loadMembershipInfo()
    }
  }, [tenantId])

  const loadMembershipInfo = async () => {
    if (!tenantId) return
    setInfoLoading(true)
    try {
      const info = await getMembershipInfo(tenantId)
      setMembershipInfo(info)
    } catch (error) {
      console.error('Error loading membership info:', error)
    } finally {
      setInfoLoading(false)
    }
  }

  const handleSubscribe = async () => {
    if (!tenantId || !accessToken || !user?.email) return
    setSubscribing(true)
    try {
      const result = await subscribeMembership(
        tenantId, 
        accessToken, 
        window.location.href, // Redirect back here after payment
        user.email // E-Mail für Mollie Customer
      )
      
      if (result.checkoutUrl) {
        // Redirect to Mollie checkout
        window.location.href = result.checkoutUrl
      } else {
        toast.success('Mitgliedschaft erfolgreich gestartet!')
        invalidatePremiumCache()
        refreshPremiumStatus()
      }
    } catch (error: any) {
      console.error('Error subscribing:', error)
      toast.error(error.message || 'Fehler beim Starten der Mitgliedschaft')
    } finally {
      setSubscribing(false)
    }
  }

  const handleCancel = async () => {
    if (!tenantId || !accessToken) return
    if (!confirm('Möchtest du deine Mitgliedschaft wirklich kündigen? Du behältst den Zugang bis zum Ende der aktuellen Periode.')) {
      return
    }
    
    setCancelling(true)
    try {
      const result = await cancelMembership(tenantId, accessToken)
      toast.success(`Mitgliedschaft gekündigt. Zugang bis ${new Date(result.expiresAt).toLocaleDateString('de-DE')}`)
      invalidatePremiumCache()
      refreshPremiumStatus()
    } catch (error: any) {
      console.error('Error cancelling:', error)
      toast.error(error.message || 'Fehler beim Kündigen')
    } finally {
      setCancelling(false)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const isLoading = premiumLoading || infoLoading

  return (
    <div className="min-h-screen">
      <PageBanner pageId="exclusive">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold mb-2" style={{ color: 'rgb(var(--color-text))' }}>
            <span className="glow-text flex items-center gap-3">
              <Crown className="w-10 h-10 text-yellow-500" />
              Mitgliedschaft
            </span>
          </h1>
          <p className="text-lg" style={{ color: 'rgb(var(--color-text-secondary))' }}>
            {isPremium ? 'Willkommen im exklusiven Bereich!' : 'Werde Premium-Mitglied'}
          </p>
        </div>
      </PageBanner>

      <div className="container mx-auto px-4 py-8">
        {/* Tabs (nur für Admins) */}
        {isAdmin && (
          <div className="flex gap-2 mb-6 border-b border-dark-700">
            <button
              onClick={() => setActiveTab('membership')}
              className={`px-6 py-3 font-semibold transition-colors flex items-center gap-2 ${
                activeTab === 'membership'
                  ? 'text-primary-500 border-b-2 border-primary-500'
                  : 'text-dark-400 hover:text-white'
              }`}
            >
              <Crown size={18} />
              Mitgliedschaft
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`px-6 py-3 font-semibold transition-colors flex items-center gap-2 ${
                activeTab === 'billing'
                  ? 'text-primary-500 border-b-2 border-primary-500'
                  : 'text-dark-400 hover:text-white'
              }`}
            >
              <DollarSign size={18} />
              Rechnungen
            </button>
          </div>
        )}

        {/* Membership Tab */}
        {activeTab === 'membership' && (
          <div className="max-w-4xl mx-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
              </div>
            ) : !membershipInfo?.enabled ? (
              /* Membership not available */
              <div className="text-center py-16">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-dark-800 flex items-center justify-center">
                  <Crown className="w-10 h-10 text-dark-500" />
                </div>
                <h2 className="text-2xl font-bold mb-4">Keine Mitgliedschaft verfügbar</h2>
                <p className="text-dark-400">
                  Der Creator hat noch keine Mitgliedschaft eingerichtet.
                </p>
              </div>
            ) : isPremium || isAdmin ? (
              /* Premium User View */
              <div className="space-y-8">
                {/* Status Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-br from-yellow-500/10 to-amber-500/5 rounded-2xl border border-yellow-500/30 p-8"
                >
                  <div className="flex items-start justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center">
                        <Crown className="w-8 h-8 text-yellow-400" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-yellow-400">
                          {isAdmin ? 'Admin-Zugang' : membershipInfo.title || 'Premium-Mitglied'}
                        </h2>
                        <p className="text-dark-400">
                          {isAdmin 
                            ? 'Du hast als Admin vollen Zugang zu allen Inhalten.'
                            : 'Du hast Zugang zu allen exklusiven Inhalten.'}
                        </p>
                      </div>
                    </div>
                    
                    {!isAdmin && membershipStatus?.membership && (
                      <div className="text-right">
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                          membershipStatus.membership.status === 'active'
                            ? 'bg-green-500/20 text-green-400'
                            : membershipStatus.membership.status === 'cancelled'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-dark-700 text-dark-400'
                        }`}>
                          {membershipStatus.membership.status === 'active' && <CheckCircle className="w-4 h-4" />}
                          {membershipStatus.membership.status === 'cancelled' && <AlertCircle className="w-4 h-4" />}
                          {membershipStatus.membership.status === 'active' ? 'Aktiv' : 
                           membershipStatus.membership.status === 'cancelled' ? 'Gekündigt' : 
                           membershipStatus.membership.status}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Membership Details */}
                  {!isAdmin && membershipStatus?.membership && (
                    <div className="mt-6 pt-6 border-t border-yellow-500/20 grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-dark-400">Preis</p>
                        <p className="font-semibold">€{membershipStatus.membership.price.toFixed(2)}/Monat</p>
                      </div>
                      <div>
                        <p className="text-sm text-dark-400">Mitglied seit</p>
                        <p className="font-semibold">{formatDate(membershipStatus.membership.startedAt)}</p>
                      </div>
                      {membershipStatus.membership.cancelledAt && (
                        <div>
                          <p className="text-sm text-dark-400">Gekündigt am</p>
                          <p className="font-semibold">{formatDate(membershipStatus.membership.cancelledAt)}</p>
                        </div>
                      )}
                      {membershipStatus.membership.expiresAt && (
                        <div>
                          <p className="text-sm text-dark-400">Zugang bis</p>
                          <p className="font-semibold">{formatDate(membershipStatus.membership.expiresAt)}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Cancel Button */}
                  {!isAdmin && membershipStatus?.membership?.status === 'active' && (
                    <div className="mt-6 pt-6 border-t border-yellow-500/20">
                      <button
                        onClick={handleCancel}
                        disabled={cancelling}
                        className="text-sm text-dark-400 hover:text-red-400 transition-colors flex items-center gap-2"
                      >
                        {cancelling ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                        Mitgliedschaft kündigen
                      </button>
                    </div>
                  )}
                </motion.div>

                {/* Benefits */}
                {membershipInfo.benefits && membershipInfo.benefits.length > 0 && (
                  <div className="card">
                    <h3 className="text-lg font-bold mb-4">Deine Vorteile</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {membershipInfo.benefits.map((benefit, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 bg-dark-900 rounded-lg">
                          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>{benefit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Links */}
                <div className="card">
                  <h3 className="text-lg font-bold mb-4">Exklusive Inhalte</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                      onClick={() => navigate('/videos')}
                      className="p-4 bg-dark-900 rounded-xl hover:bg-dark-800 transition-colors text-left"
                    >
                      <Video className="w-8 h-8 text-primary-500 mb-2" />
                      <p className="font-semibold">Exklusive Videos</p>
                      <p className="text-sm text-dark-400">Alle Premium-Videos ansehen</p>
                    </button>
                    <button
                      onClick={() => navigate('/live')}
                      className="p-4 bg-dark-900 rounded-xl hover:bg-dark-800 transition-colors text-left"
                    >
                      <Crown className="w-8 h-8 text-yellow-500 mb-2" />
                      <p className="font-semibold">Exklusive Streams</p>
                      <p className="text-sm text-dark-400">Members-Only Livestreams</p>
                    </button>
                    <button
                      onClick={() => navigate('/newsfeed')}
                      className="p-4 bg-dark-900 rounded-xl hover:bg-dark-800 transition-colors text-left"
                    >
                      <CreditCard className="w-8 h-8 text-green-500 mb-2" />
                      <p className="font-semibold">Exklusive Posts</p>
                      <p className="text-sm text-dark-400">Premium Newsfeed-Beiträge</p>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Non-Premium User View - Membership Offer */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left: Info */}
                <div className="space-y-6">
                  <div>
                    <h2 className="text-3xl font-bold mb-4">{membershipInfo.title || 'Premium-Mitgliedschaft'}</h2>
                    {membershipInfo.description && (
                      <p className="text-dark-400 text-lg">{membershipInfo.description}</p>
                    )}
                  </div>

                  {/* Benefits */}
                  {membershipInfo.benefits && membershipInfo.benefits.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-lg">Das erwartet dich:</h3>
                      {membershipInfo.benefits.map((benefit, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-start gap-3"
                        >
                          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>{benefit}</span>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: Pricing Card */}
                <div>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-gradient-to-br from-yellow-500/10 to-amber-500/5 rounded-2xl border-2 border-yellow-500/50 p-8 sticky top-4"
                  >
                    {/* Header */}
                    <div className="text-center mb-6">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
                        <Crown className="w-8 h-8 text-yellow-400" />
                      </div>
                      <h3 className="text-xl font-bold">{membershipInfo.title || 'Premium'}</h3>
                    </div>

                    {/* Price */}
                    <div className="text-center mb-6 pb-6 border-b border-yellow-500/20">
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-5xl font-bold text-yellow-400">
                          €{membershipInfo.monthly_price?.toFixed(2)}
                        </span>
                        <span className="text-dark-400">/Monat</span>
                      </div>
                    </div>

                    {/* CTA */}
                    <button
                      onClick={handleSubscribe}
                      disabled={subscribing}
                      className="w-full py-4 px-6 bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-bold rounded-xl hover:from-yellow-400 hover:to-amber-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {subscribing ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Crown className="w-5 h-5" />
                          Jetzt Mitglied werden
                        </>
                      )}
                    </button>

                    <p className="text-xs text-dark-500 text-center mt-4">
                      Jederzeit kündbar • Sichere Zahlung via Mollie
                    </p>
                  </motion.div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Billing Tab (nur für Admins) */}
        {activeTab === 'billing' && isAdmin && (
          <BillingManagement tenantId={tenantId} />
        )}
      </div>
    </div>
  )
}
