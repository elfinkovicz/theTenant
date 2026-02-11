/**
 * MembershipSubscribe - User-Komponente zum Abonnieren einer Mitgliedschaft
 */

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Crown, CheckCircle, Loader2, AlertCircle, 
  XCircle, CreditCard, Gift
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { 
  getMembershipInfo, 
  getMyMembershipStatus,
  subscribeMembership,
  cancelMembership,
  MembershipInfo,
  MyMembershipStatus
} from '../services/membership.service'

interface MembershipSubscribeProps {
  tenantId: string
}

export function MembershipSubscribe({ tenantId }: MembershipSubscribeProps) {
  const { accessToken, isAuthenticated, user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [info, setInfo] = useState<MembershipInfo | null>(null)
  const [myStatus, setMyStatus] = useState<MyMembershipStatus | null>(null)

  useEffect(() => {
    loadData()
  }, [tenantId, accessToken])

  const loadData = async () => {
    setLoading(true)
    setError(null)

    try {
      // Öffentliche Info laden (kein Auth nötig)
      const infoData = await getMembershipInfo(tenantId)
      setInfo(infoData)

      // Eigenen Status laden (nur wenn eingeloggt)
      if (accessToken) {
        const statusData = await getMyMembershipStatus(tenantId, accessToken)
        setMyStatus(statusData)
      }
    } catch (err: any) {
      console.error('Error loading membership data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubscribe = async () => {
    if (!accessToken || !user?.email) {
      setError('Bitte melde dich an, um Mitglied zu werden')
      return
    }

    setSubscribing(true)
    setError(null)

    try {
      const redirectUrl = window.location.href.split('?')[0]
      const result = await subscribeMembership(tenantId, accessToken, redirectUrl, user.email)
      
      // Zu Mollie Checkout weiterleiten
      window.location.href = result.checkoutUrl
    } catch (err: any) {
      console.error('Error subscribing:', err)
      setError(err.message)
      setSubscribing(false)
    }
  }

  const handleCancel = async () => {
    if (!accessToken) return

    if (!confirm('Möchtest du deine Mitgliedschaft wirklich kündigen?')) {
      return
    }

    setCancelling(true)
    setError(null)

    try {
      const result = await cancelMembership(tenantId, accessToken)
      alert(`Mitgliedschaft gekündigt. Zugang bis: ${new Date(result.expiresAt).toLocaleDateString('de-DE')}`)
      loadData()
    } catch (err: any) {
      console.error('Error cancelling:', err)
      setError(err.message)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    )
  }

  // Membership nicht aktiviert
  if (!info?.enabled) {
    return null
  }

  // User ist bereits Mitglied
  if (myStatus?.isMember && myStatus.membership) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-primary-500/20 to-primary-600/10 rounded-2xl p-6 border border-primary-500/30"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-primary-500/30 flex items-center justify-center">
            <Crown className="w-6 h-6 text-primary-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-primary-400">Du bist Mitglied!</h3>
            <p className="text-sm text-dark-400">Vielen Dank für deine Unterstützung</p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-dark-400">Status</span>
            <span className={`font-medium ${
              myStatus.membership.status === 'active' ? 'text-green-400' : 'text-yellow-400'
            }`}>
              {myStatus.membership.status === 'active' ? 'Aktiv' : 
               myStatus.membership.status === 'cancelled' ? 'Gekündigt' : myStatus.membership.status}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-dark-400">Mitglied seit</span>
            <span>{formatDate(myStatus.membership.startedAt)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-dark-400">Monatlicher Beitrag</span>
            <span>€{myStatus.membership.price.toFixed(2)}</span>
          </div>
          {myStatus.membership.expiresAt && (
            <div className="flex justify-between text-sm">
              <span className="text-dark-400">Läuft ab am</span>
              <span className="text-yellow-400">{formatDate(myStatus.membership.expiresAt)}</span>
            </div>
          )}
        </div>

        {myStatus.membership.status === 'active' && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="w-full py-2 text-sm text-dark-400 hover:text-red-400 transition-colors flex items-center justify-center gap-2"
          >
            {cancelling ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            Mitgliedschaft kündigen
          </button>
        )}
      </motion.div>
    )
  }

  // Membership-Angebot anzeigen
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-dark-800 rounded-2xl overflow-hidden border border-dark-700"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-6 text-center">
        <Crown className="w-12 h-12 mx-auto mb-3 text-white" />
        <h3 className="text-2xl font-bold text-white">{info.title}</h3>
        {info.tenant_name && (
          <p className="text-primary-100 mt-1">von {info.tenant_name}</p>
        )}
      </div>

      {/* Preis */}
      <div className="p-6 text-center border-b border-dark-700">
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-4xl font-bold">€{info.monthly_price?.toFixed(2)}</span>
          <span className="text-dark-400">/Monat</span>
        </div>
      </div>

      {/* Beschreibung */}
      {info.description && (
        <div className="px-6 py-4 border-b border-dark-700">
          <p className="text-dark-300">{info.description}</p>
        </div>
      )}

      {/* Benefits */}
      {info.benefits && info.benefits.length > 0 && (
        <div className="p-6 border-b border-dark-700">
          <h4 className="font-medium mb-4 flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary-400" />
            Deine Vorteile
          </h4>
          <ul className="space-y-3">
            {info.benefits.map((benefit, index) => (
              <li key={index} className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-dark-300">{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* CTA */}
      <div className="p-6">
        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isAuthenticated ? (
          <button
            onClick={handleSubscribe}
            disabled={subscribing}
            className="w-full py-4 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            {subscribing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <CreditCard className="w-5 h-5" />
            )}
            Jetzt Mitglied werden
          </button>
        ) : (
          <div className="text-center">
            <p className="text-dark-400 mb-3">Melde dich an, um Mitglied zu werden</p>
            <button
              onClick={() => {
                // Trigger login modal or redirect
                window.dispatchEvent(new CustomEvent('openLoginModal'))
              }}
              className="w-full py-4 bg-primary-500 hover:bg-primary-600 rounded-xl font-medium transition-colors"
            >
              Anmelden
            </button>
          </div>
        )}

        <p className="text-xs text-dark-500 text-center mt-4">
          Sichere Zahlung über Mollie. Jederzeit kündbar.
        </p>
      </div>
    </motion.div>
  )
}
