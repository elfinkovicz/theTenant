/**
 * MembershipMembersList - Liste der zahlenden Mitglieder für Admins
 */

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Users, Euro, TrendingUp, Calendar, CheckCircle, XCircle, 
  Clock, Loader2, RefreshCw, CreditCard, AlertCircle
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { 
  getMembershipMembers, 
  getMembershipPayouts,
  Membership,
  MembershipStats,
  MembershipPayment,
  PayoutSummary
} from '../services/membership.service'

interface MembershipMembersListProps {
  tenantId: string
  searchTerm?: string
}

export function MembershipMembersList({ tenantId, searchTerm = '' }: MembershipMembersListProps) {
  const { accessToken } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'members' | 'payouts'>('members')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [members, setMembers] = useState<Membership[]>([])
  const [stats, setStats] = useState<MembershipStats | null>(null)
  const [payments, setPayments] = useState<MembershipPayment[]>([])
  const [payoutSummary, setPayoutSummary] = useState<PayoutSummary | null>(null)

  useEffect(() => {
    if (accessToken && tenantId) {
      loadData()
    }
  }, [tenantId, accessToken, activeTab])

  const loadData = async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)

    try {
      if (activeTab === 'members') {
        const data = await getMembershipMembers(tenantId, accessToken)
        setMembers(data.members)
        setStats(data.stats)
      } else {
        const data = await getMembershipPayouts(tenantId, accessToken)
        setPayments(data.payments)
        setPayoutSummary(data.summary)
      }
    } catch (err: any) {
      console.error('Error loading data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
            <CheckCircle className="w-3 h-3" />
            Aktiv
          </span>
        )
      case 'cancelled':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs">
            <Clock className="w-3 h-3" />
            Gekündigt
          </span>
        )
      case 'expired':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-dark-600 text-dark-400 rounded-full text-xs">
            <XCircle className="w-3 h-3" />
            Abgelaufen
          </span>
        )
      case 'pending':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs">
            <Clock className="w-3 h-3" />
            Ausstehend
          </span>
        )
      default:
        return (
          <span className="px-2 py-1 bg-dark-600 text-dark-400 rounded-full text-xs">
            {status}
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-dark-900 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'members' 
              ? 'bg-primary-500 text-white' 
              : 'text-dark-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          Mitglieder
        </button>
        <button
          onClick={() => setActiveTab('payouts')}
          className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'payouts' 
              ? 'bg-primary-500 text-white' 
              : 'text-dark-400 hover:text-white'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Einnahmen
        </button>
      </div>

      {/* Stats Cards */}
      {activeTab === 'members' && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
            <div className="flex items-center gap-2 text-dark-400 text-sm mb-1">
              <Users className="w-4 h-4" />
              Gesamt
            </div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
          <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
            <div className="flex items-center gap-2 text-green-400 text-sm mb-1">
              <CheckCircle className="w-4 h-4" />
              Aktiv
            </div>
            <div className="text-2xl font-bold text-green-400">{stats.active}</div>
          </div>
          <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
            <div className="flex items-center gap-2 text-dark-400 text-sm mb-1">
              <Euro className="w-4 h-4" />
              Monatlich
            </div>
            <div className="text-2xl font-bold">{formatCurrency(stats.monthlyRevenue)}</div>
          </div>
          <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
            <div className="flex items-center gap-2 text-primary-400 text-sm mb-1">
              <TrendingUp className="w-4 h-4" />
              Netto
            </div>
            <div className="text-2xl font-bold text-primary-400">{formatCurrency(stats.netRevenue)}</div>
          </div>
        </div>
      )}

      {activeTab === 'payouts' && payoutSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
            <div className="text-dark-400 text-sm mb-1">Zahlungen</div>
            <div className="text-2xl font-bold">{payoutSummary.paidPayments}</div>
          </div>
          <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
            <div className="text-dark-400 text-sm mb-1">Einnahmen</div>
            <div className="text-2xl font-bold">{formatCurrency(payoutSummary.totalReceived)}</div>
          </div>
          <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
            <div className="text-dark-400 text-sm mb-1">Plattform-Gebühr</div>
            <div className="text-2xl font-bold text-dark-400">{formatCurrency(payoutSummary.totalPlatformFee)}</div>
          </div>
          <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
            <div className="text-primary-400 text-sm mb-1">Auszahlung</div>
            <div className="text-2xl font-bold text-primary-400">{formatCurrency(payoutSummary.totalPayout)}</div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button onClick={loadData} className="ml-auto hover:text-red-300">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      ) : activeTab === 'members' ? (
        /* Members List */
        (() => {
          const filteredMembers = members.filter(member => {
            if (!searchTerm) return true
            const search = searchTerm.toLowerCase()
            return member.user_email.toLowerCase().includes(search)
          })
          return filteredMembers.length === 0 ? (
          <div className="text-center py-12 text-dark-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{searchTerm ? 'Keine Mitglieder gefunden' : 'Noch keine zahlenden Mitglieder'}</p>
          </div>
        ) : (
          <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-dark-900 border-b border-dark-700 text-sm font-medium text-dark-400">
              <div className="col-span-4">Mitglied</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Preis</div>
              <div className="col-span-2">Seit</div>
              <div className="col-span-2">Läuft ab</div>
            </div>
            <div className="divide-y divide-dark-700">
              {filteredMembers.map((member, index) => (
                <motion.div
                  key={member.membership_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="grid grid-cols-12 gap-4 px-4 py-4 hover:bg-dark-700/50 transition-colors"
                >
                  <div className="col-span-4">
                    <p className="font-medium truncate">{member.user_email}</p>
                    <p className="text-xs text-dark-400 truncate">{member.membership_id}</p>
                  </div>
                  <div className="col-span-2 flex items-center">
                    {getStatusBadge(member.status)}
                  </div>
                  <div className="col-span-2 flex items-center">
                    {formatCurrency(member.price)}/Mo
                  </div>
                  <div className="col-span-2 flex items-center text-sm text-dark-400">
                    {formatDate(member.started_at)}
                  </div>
                  <div className="col-span-2 flex items-center text-sm text-dark-400">
                    {member.expires_at ? formatDate(member.expires_at) : '-'}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )
        })()
      ) : (
        /* Payments List */
        payments.length === 0 ? (
          <div className="text-center py-12 text-dark-400">
            <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Noch keine Zahlungen</p>
          </div>
        ) : (
          <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-dark-900 border-b border-dark-700 text-sm font-medium text-dark-400">
              <div className="col-span-3">Datum</div>
              <div className="col-span-3">Betrag</div>
              <div className="col-span-2">Gebühr</div>
              <div className="col-span-2">Auszahlung</div>
              <div className="col-span-2">Status</div>
            </div>
            <div className="divide-y divide-dark-700">
              {payments.map((payment, index) => (
                <motion.div
                  key={payment.payment_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="grid grid-cols-12 gap-4 px-4 py-4 hover:bg-dark-700/50 transition-colors"
                >
                  <div className="col-span-3 flex items-center text-sm">
                    <Calendar className="w-4 h-4 mr-2 text-dark-400" />
                    {formatDate(payment.paid_at || payment.created_at)}
                  </div>
                  <div className="col-span-3 flex items-center font-medium">
                    {formatCurrency(payment.amount)}
                  </div>
                  <div className="col-span-2 flex items-center text-dark-400">
                    -{formatCurrency(payment.platform_fee)}
                  </div>
                  <div className="col-span-2 flex items-center text-green-400 font-medium">
                    {formatCurrency(payment.tenant_payout)}
                  </div>
                  <div className="col-span-2 flex items-center">
                    {payment.status === 'paid' ? (
                      <span className="flex items-center gap-1 text-green-400 text-sm">
                        <CheckCircle className="w-4 h-4" />
                        Bezahlt
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-yellow-400 text-sm">
                        <Clock className="w-4 h-4" />
                        {payment.status}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )
      )}

      {/* Refresh Button */}
      <div className="flex justify-end">
        <button
          onClick={loadData}
          disabled={loading}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Aktualisieren
        </button>
      </div>
    </div>
  )
}
