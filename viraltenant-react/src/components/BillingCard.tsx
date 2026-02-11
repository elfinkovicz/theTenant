import { useEffect, useState } from 'react'
import { billingService, BillingEstimate } from '../services/billing.service'
import './BillingCard.css'

interface BillingCardProps {
  token?: string
  tenantId?: string
  compact?: boolean
}

export function BillingCard({ token, tenantId, compact = false }: BillingCardProps) {
  const [estimate, setEstimate] = useState<BillingEstimate | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchEstimate = async () => {
      try {
        const data = await billingService.getMonthlyEstimate(undefined, token, tenantId)
        setEstimate(data)
      } catch (err) {
        console.error('Error fetching billing estimate:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchEstimate()
  }, [token, tenantId])

  if (loading) {
    return (
      <div className="billing-card loading">
        <div className="spinner"></div>
      </div>
    )
  }

  if (!estimate) {
    return null
  }

  const infrastructureCost = Object.values(estimate.breakdown).reduce(
    (sum, item) => sum + item.cost,
    0
  )

  if (compact) {
    return (
      <div className="billing-card compact">
        <div className="card-header">
          <h3>Abrechnung</h3>
          <span className="month">{billingService.formatMonth(estimate.month)}</span>
        </div>
        <div className="card-total">
          <span className="label">Geschätzte Summe</span>
          <span className="amount">{billingService.formatCurrency(estimate.estimatedTotal)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="billing-card">
      <div className="card-header">
        <h3>Abrechnung</h3>
        <span className="month">{billingService.formatMonth(estimate.month)}</span>
      </div>

      <div className="card-content">
        <div className="cost-row">
          <span className="label">Grundgebühr</span>
          <span className="amount">{billingService.formatCurrency(estimate.baseFee)}</span>
        </div>

        <div className="cost-row">
          <span className="label">Infrastruktur</span>
          <span className="amount">{billingService.formatCurrency(infrastructureCost)}</span>
        </div>

        <div className="cost-row total">
          <span className="label">Geschätzte Summe</span>
          <span className="amount">{billingService.formatCurrency(estimate.estimatedTotal)}</span>
        </div>
      </div>

      <div className="card-footer">
        <small>Aktualisiert: {new Date(estimate.lastUpdated).toLocaleTimeString('de-DE')}</small>
      </div>
    </div>
  )
}
