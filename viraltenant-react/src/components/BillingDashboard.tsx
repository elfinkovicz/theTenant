import { useEffect, useState } from 'react'
import { billingService, BillingEstimate } from '../services/billing.service'
import './BillingDashboard.css'

interface BillingDashboardProps {
  token?: string
  tenantId?: string
}

export function BillingDashboard({ token, tenantId }: BillingDashboardProps) {
  const [estimate, setEstimate] = useState<BillingEstimate | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string>('')

  useEffect(() => {
    const fetchEstimate = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const data = await billingService.getMonthlyEstimate(
          selectedMonth || undefined,
          token,
          tenantId
        )
        
        setEstimate(data)
        
        if (data.error) {
          setError(data.error)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load billing data'
        setError(message)
        console.error('Error fetching billing estimate:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchEstimate()
  }, [selectedMonth, token, tenantId])

  if (loading) {
    return (
      <div className="billing-dashboard loading">
        <div className="spinner"></div>
        <p>Abrechnung wird geladen...</p>
      </div>
    )
  }

  if (error && !estimate) {
    return (
      <div className="billing-dashboard error">
        <div className="error-message">
          <h3>Fehler beim Laden der Abrechnung</h3>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (!estimate) {
    return (
      <div className="billing-dashboard empty">
        <p>Keine Abrechnungsdaten verfügbar</p>
      </div>
    )
  }

  const infrastructureCost = Object.values(estimate.breakdown).reduce(
    (sum, item) => sum + item.cost,
    0
  )

  return (
    <div className="billing-dashboard">
      <div className="billing-header">
        <h2>Abrechnung</h2>
        <div className="month-selector">
          <label htmlFor="month-select">Monat:</label>
          <input
            id="month-select"
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="month-input"
          />
        </div>
      </div>

      <div className="billing-period">
        <h3>Aktueller Monat (Vorschau)</h3>
        <p className="month-display">{billingService.formatMonth(estimate.month)}</p>
      </div>

      <div className="billing-summary">
        <div className="summary-item">
          <label>Grundgebühr</label>
          <span className="amount">{billingService.formatCurrency(estimate.baseFee)}</span>
        </div>

        <div className="summary-item">
          <label>Infrastruktur</label>
          <span className="amount">{billingService.formatCurrency(infrastructureCost)}</span>
        </div>

        <div className="summary-item total">
          <label>Geschätzte Summe</label>
          <span className="amount total-amount">
            {billingService.formatCurrency(estimate.estimatedTotal)}
          </span>
        </div>
      </div>

      <div className="billing-details">
        <h4>Infrastruktur Details:</h4>
        <table className="billing-table">
          <thead>
            <tr>
              <th>Dienst</th>
              <th className="amount-col">Kosten</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(estimate.breakdown).map(([key, item]) => (
              <tr key={key} className={`billing-row ${key}`}>
                <td className="service-name">{item.label}</td>
                <td className="amount-col">
                  {billingService.formatCurrency(item.cost)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="billing-footer">
        <small>
          Zuletzt aktualisiert: {new Date(estimate.lastUpdated).toLocaleString('de-DE')}
        </small>
        {estimate.error && (
          <div className="warning-message">
            ⚠️ {estimate.error}
          </div>
        )}
      </div>
    </div>
  )
}
