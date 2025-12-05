import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://1rhnpplzti.execute-api.eu-central-1.amazonaws.com'

export interface Invoice {
  invoiceId: string
  invoiceNumber?: string
  stripeInvoiceId: string
  amount: number
  baseFee: number
  awsCosts: number
  awsBreakdown: Record<string, number>
  period: {
    start: string
    end: string
  }
  status: 'draft' | 'open' | 'paid' | 'payment_failed' | 'void'
  currency: string
  createdAt: number
  updatedAt: number
  paidAt?: number
}

export interface CurrentMonthEstimate {
  baseFee: number
  awsCosts: number
  awsBreakdown: Record<string, number>
  estimatedTotal: number
  period: {
    start: string
    end: string
  }
}

export interface BillingData {
  invoices: Invoice[]
  currentMonth: CurrentMonthEstimate
}

export interface SetupIntentResponse {
  clientSecret: string
  customerId: string
}

export interface PaymentMethodStatus {
  hasPaymentMethod: boolean
  paymentMethod?: {
    type: string
    last4?: string
  }
}

class BillingService {
  async getInvoices(accessToken: string): Promise<BillingData> {
    const response = await axios.get(`${API_BASE_URL}/billing`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })
    return response.data
  }

  async createSetupIntent(accessToken: string): Promise<SetupIntentResponse> {
    const response = await axios.post(
      `${API_BASE_URL}/billing/setup-intent`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    )
    return response.data
  }

  async getPaymentMethodStatus(accessToken: string): Promise<PaymentMethodStatus> {
    const response = await axios.get(`${API_BASE_URL}/billing/setup-intent`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })
    return response.data
  }

  async createManualCharge(accessToken: string): Promise<{
    invoiceId: string
    stripeInvoiceId: string
    amount: number
    status: string
    hostedInvoiceUrl: string
  }> {
    const response = await axios.post(
      `${API_BASE_URL}/billing/charge`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    )
    return response.data
  }

  async downloadInvoicePDF(accessToken: string, invoiceId: string): Promise<string> {
    const response = await axios.get(
      `${API_BASE_URL}/billing/invoice/${invoiceId}/pdf`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    )
    return response.data.downloadUrl
  }

  formatCurrency(amount: number, currency: string = 'EUR'): string {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency
    }).format(amount)
  }

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  getStatusColor(status: Invoice['status']): string {
    switch (status) {
      case 'paid':
        return 'text-green-500'
      case 'payment_failed':
        return 'text-red-500'
      case 'open':
        return 'text-yellow-500'
      default:
        return 'text-dark-400'
    }
  }

  getStatusText(status: Invoice['status']): string {
    switch (status) {
      case 'paid':
        return 'Bezahlt'
      case 'payment_failed':
        return 'Fehlgeschlagen'
      case 'open':
        return 'Offen'
      case 'draft':
        return 'Entwurf'
      case 'void':
        return 'Storniert'
      default:
        return status
    }
  }
}

export const billingService = new BillingService()
