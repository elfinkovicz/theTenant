import { awsConfig } from '../config/aws-config'

export interface BillingBreakdown {
  label: string
  cost: number
  usage: string
}

export interface BillingEstimate {
  month: string
  baseFee: number
  breakdown: {
    multistream: BillingBreakdown
    videohost: BillingBreakdown
    domain: BillingBreakdown
    crosspost: BillingBreakdown
  }
  estimatedTotal: number
  lastUpdated: string
  error?: string
}

export interface Invoice {
  invoiceId: string
  invoiceNumber?: string
  tenantId: string
  amount: number
  baseFee: number
  awsCosts: number
  awsBreakdown: Record<string, number>
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible'
  period: {
    start: string
    end: string
  }
  createdAt: string
  paidAt?: string
  pdfUrl?: string
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

export interface InvoicesResponse {
  invoices: Invoice[]
  currentMonth: CurrentMonthEstimate
}

export interface PaymentMethodStatus {
  hasPaymentMethod: boolean
  paymentMethod?: {
    type: string
    last4?: string
    brand?: string
  }
}

export interface SetupIntentResponse {
  clientSecret: string
}

export interface ManualChargeResponse {
  invoiceId: string
  amount: number
  status: string
}

export interface PayPalOrderResponse {
  orderId: string
  approvalUrl: string
  amount: number
}

export interface PayPalCaptureResponse {
  success: boolean
  captureId: string
  status: string
  amount: number
}

export interface PaddleTransactionResponse {
  transactionId: string
  checkoutUrl: string
  amount: number
  status: string
}

export interface PaddleVerifyResponse {
  success: boolean
  status: string
  isPending: boolean
  amount: number
  transactionId: string
}

export interface PaymentMethods {
  paypal: { enabled: boolean; name: string; description: string }
  mollie: { enabled: boolean; name: string; description: string }
  savedPaymentMethod?: { type: string | null; last4: string | null; brand: string | null }
}

class BillingService {
  private apiUrl = awsConfig.api.user

  private getTenantId(): string {
    // Priority: currentTenantId (set by TenantProvider) > hostname detection > platform UUID
    const currentTenantId = localStorage.getItem('currentTenantId')
    if (currentTenantId) {
      return currentTenantId
    }
    
    const hostname = window.location.hostname
    
    // Check if it's a viraltenant.com domain
    if (hostname.includes('viraltenant.com')) {
      const parts = hostname.split('.')
      if (parts.length >= 3 && parts[0] !== 'www') {
        return parts[0]
      }
    }
    return '319190e1-0791-43b0-bd04-506f959c1471'
  }

  private getHeaders(token?: string): HeadersInit {
    const tenantId = this.getTenantId()
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Creator-ID': tenantId
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    return headers
  }

  async getMonthlyEstimate(month?: string, token?: string, tenantId?: string): Promise<BillingEstimate> {
    try {
      const resolvedTenantId = tenantId || this.getTenantId()
      
      const params = new URLSearchParams()
      if (month) params.append('month', month)

      const response = await fetch(
        `${this.apiUrl}/billing/estimate/${resolvedTenantId}?${params.toString()}`,
        { headers: this.getHeaders(token) }
      )
      
      if (!response.ok) {
        console.error('Failed to fetch billing estimate:', response.status)
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      
      if (data.resolvedTenantId) {
        localStorage.setItem('resolvedTenantId', data.resolvedTenantId)
      }
      
      return data
    } catch (error) {
      console.error('Error fetching billing estimate:', error)
      
      const now = new Date()
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      
      return {
        month,
        baseFee: 30.00,
        breakdown: {
          multistream: { label: 'Multistreaming', cost: 0, usage: 'N/A' },
          videohost: { label: 'Videohosting', cost: 0, usage: 'N/A' },
          domain: { label: 'Domain', cost: 0, usage: 'N/A' },
          crosspost: { label: 'Crossposting', cost: 0, usage: 'N/A' }
        },
        estimatedTotal: 30.00,
        lastUpdated: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async getHistoricalEstimates(months: number = 12, token?: string, tenantId?: string): Promise<BillingEstimate[]> {
    try {
      const resolvedTenantId = tenantId || this.getTenantId()

      const response = await fetch(
        `${this.apiUrl}/billing/estimates/${resolvedTenantId}?months=${months}`,
        { headers: this.getHeaders(token) }
      )
      
      if (!response.ok) {
        console.error('Failed to fetch historical estimates:', response.status)
        return []
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching historical estimates:', error)
      return []
    }
  }

  async getInvoices(token: string): Promise<InvoicesResponse> {
    const tenantId = this.getTenantId()
    
    const response = await fetch(
      `${this.apiUrl}/billing/invoices/${tenantId}`,
      { headers: this.getHeaders(token) }
    )
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return await response.json()
  }

  async getPaymentMethodStatus(token: string): Promise<PaymentMethodStatus> {
    const tenantId = this.getTenantId()
    
    const response = await fetch(
      `${this.apiUrl}/billing/payment-method/${tenantId}`,
      { headers: this.getHeaders(token) }
    )
    
    if (!response.ok) {
      // Return default if endpoint not available
      return { hasPaymentMethod: false }
    }

    return await response.json()
  }

  async createSetupIntent(token: string): Promise<SetupIntentResponse> {
    const tenantId = this.getTenantId()
    
    const response = await fetch(
      `${this.apiUrl}/billing/setup-intent/${tenantId}`,
      {
        method: 'POST',
        headers: this.getHeaders(token)
      }
    )
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return await response.json()
  }

  async createManualCharge(token: string): Promise<ManualChargeResponse> {
    const tenantId = this.getTenantId()
    
    const response = await fetch(
      `${this.apiUrl}/billing/charge/${tenantId}`,
      {
        method: 'POST',
        headers: this.getHeaders(token)
      }
    )
    
    if (!response.ok) {
      const error = await response.json()
      throw { response: { data: error } }
    }

    return await response.json()
  }

  async downloadInvoicePDF(token: string, invoiceId: string): Promise<string> {
    const tenantId = this.getTenantId()
    
    const response = await fetch(
      `${this.apiUrl}/billing/invoices/${tenantId}/${invoiceId}/pdf`,
      { headers: this.getHeaders(token) }
    )
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    return data.url
  }

  async getPaymentMethods(token: string): Promise<PaymentMethods> {
    const tenantId = this.getTenantId()
    
    const response = await fetch(
      `${this.apiUrl}/billing/payment-methods/${tenantId}`,
      { headers: this.getHeaders(token) }
    )
    
    if (!response.ok) {
      // Return defaults if endpoint not available
      return {
        paypal: { enabled: true, name: 'PayPal', description: 'Bezahlen Sie sicher mit PayPal' },
        mollie: { enabled: true, name: 'Mollie', description: 'Bezahlen Sie mit Karte oder SEPA' }
      }
    }

    return await response.json()
  }

  async createPayPalOrder(token: string, invoiceId?: string): Promise<PayPalOrderResponse> {
    const tenantId = this.getTenantId()
    
    // Get current origin for return URL (handles subdomains and custom domains)
    const returnBaseUrl = window.location.origin
    
    const response = await fetch(
      `${this.apiUrl}/billing/paypal/create-order/${tenantId}`,
      {
        method: 'POST',
        headers: this.getHeaders(token),
        body: JSON.stringify({ invoiceId, returnBaseUrl })
      }
    )
    
    if (!response.ok) {
      const error = await response.json()
      throw { response: { data: error } }
    }

    return await response.json()
  }

  async capturePayPalPayment(token: string, orderId: string, invoiceId?: string): Promise<PayPalCaptureResponse> {
    const tenantId = this.getTenantId()
    
    const response = await fetch(
      `${this.apiUrl}/billing/paypal/capture/${tenantId}`,
      {
        method: 'POST',
        headers: this.getHeaders(token),
        body: JSON.stringify({ orderId, invoiceId })
      }
    )
    
    if (!response.ok) {
      const error = await response.json()
      throw { response: { data: error } }
    }

    return await response.json()
  }

  async createPaddleTransaction(token: string, invoiceId?: string): Promise<PaddleTransactionResponse> {
    const tenantId = this.getTenantId()
    
    // Get current origin for return URL (handles subdomains and custom domains)
    const returnBaseUrl = window.location.origin
    
    const response = await fetch(
      `${this.apiUrl}/billing/paddle/create-transaction/${tenantId}`,
      {
        method: 'POST',
        headers: this.getHeaders(token),
        body: JSON.stringify({ invoiceId, returnBaseUrl })
      }
    )
    
    if (!response.ok) {
      const error = await response.json()
      throw { response: { data: error } }
    }

    return await response.json()
  }

  async verifyPaddlePayment(token: string, transactionId: string, invoiceId?: string): Promise<PaddleVerifyResponse> {
    const tenantId = this.getTenantId()
    
    const response = await fetch(
      `${this.apiUrl}/billing/paddle/verify/${tenantId}`,
      {
        method: 'POST',
        headers: this.getHeaders(token),
        body: JSON.stringify({ transactionId, invoiceId })
      }
    )
    
    if (!response.ok) {
      const error = await response.json()
      throw { response: { data: error } }
    }

    return await response.json()
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(value)
  }

  formatMonth(monthStr: string): string {
    const [year, month] = monthStr.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('de-DE', { year: 'numeric', month: 'long' })
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  getStatusColor(status: Invoice['status']): string {
    switch (status) {
      case 'paid': return 'text-green-500'
      case 'open': return 'text-yellow-500'
      case 'draft': return 'text-gray-500'
      case 'void': return 'text-red-500'
      case 'uncollectible': return 'text-red-500'
      default: return 'text-gray-500'
    }
  }

  getStatusText(status: Invoice['status']): string {
    switch (status) {
      case 'paid': return 'Bezahlt'
      case 'open': return 'Offen'
      case 'draft': return 'Entwurf'
      case 'void': return 'Storniert'
      case 'uncollectible': return 'Uneinbringlich'
      default: return status
    }
  }

  // ============================================================
  // MOLLIE METHODS
  // ============================================================

  // Helper to get access token from zustand persisted storage
  private getAccessToken(): string | null {
    try {
      const authStorage = localStorage.getItem('auth-storage')
      if (authStorage) {
        const parsed = JSON.parse(authStorage)
        return parsed?.state?.accessToken || null
      }
    } catch (e) {
      console.error('Failed to parse auth storage:', e)
    }
    return null
  }

  async getMollieCustomer(tenantId?: string): Promise<MollieCustomerInfo> {
    const resolvedTenantId = tenantId || this.getTenantId()
    const token = this.getAccessToken()
    
    const response = await fetch(
      `${this.apiUrl}/billing/mollie/customer/${resolvedTenantId}`,
      { headers: this.getHeaders(token || undefined) }
    )
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return await response.json()
  }

  async createMollieCustomer(tenantId: string, data: { name?: string; email?: string }): Promise<{ customerId: string }> {
    const token = this.getAccessToken()
    
    const response = await fetch(
      `${this.apiUrl}/billing/mollie/create-customer/${tenantId}`,
      {
        method: 'POST',
        headers: this.getHeaders(token || undefined),
        body: JSON.stringify(data)
      }
    )
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    return await response.json()
  }

  async createMollieFirstPayment(tenantId: string, redirectUrl: string, amount?: string): Promise<{ paymentId: string; checkoutUrl: string; status: string }> {
    const token = this.getAccessToken()
    
    const response = await fetch(
      `${this.apiUrl}/billing/mollie/create-first-payment/${tenantId}`,
      {
        method: 'POST',
        headers: this.getHeaders(token || undefined),
        body: JSON.stringify({ redirectUrl, amount })
      }
    )
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    return await response.json()
  }

  async chargeMollie(tenantId: string, amount: number, description?: string, invoiceId?: string): Promise<{ paymentId: string; status: string }> {
    const token = this.getAccessToken()
    
    const response = await fetch(
      `${this.apiUrl}/billing/mollie/charge/${tenantId}`,
      {
        method: 'POST',
        headers: this.getHeaders(token || undefined),
        body: JSON.stringify({ amount, description, invoiceId })
      }
    )
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    return await response.json()
  }

  async getMolliePayments(tenantId?: string): Promise<{ payments: MolliePayment[] }> {
    const resolvedTenantId = tenantId || this.getTenantId()
    const token = this.getAccessToken()
    
    const response = await fetch(
      `${this.apiUrl}/billing/mollie/payments/${resolvedTenantId}`,
      { headers: this.getHeaders(token || undefined) }
    )
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return await response.json()
  }

  async revokeMollieMandate(tenantId: string): Promise<{ message: string }> {
    const token = this.getAccessToken()
    
    const response = await fetch(
      `${this.apiUrl}/billing/mollie/mandate/${tenantId}`,
      {
        method: 'DELETE',
        headers: this.getHeaders(token || undefined)
      }
    )
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    return await response.json()
  }

  // ============================================================
  // MOLLIE CONNECT METHODS (Creator → Mitglieder Abrechnung)
  // ============================================================

  async getMollieConnectStatus(tenantId?: string): Promise<MollieConnectStatus> {
    const resolvedTenantId = tenantId || this.getTenantId()
    const token = this.getAccessToken()
    
    const response = await fetch(
      `${this.apiUrl}/billing/mollie/connect/status/${resolvedTenantId}`,
      { headers: this.getHeaders(token || undefined) }
    )
    
    if (!response.ok) {
      return { connected: false }
    }

    return await response.json()
  }

  async getMollieConnectAuthorizeUrl(tenantId: string, redirectUrl: string): Promise<{ authorizeUrl: string; state: string }> {
    const token = this.getAccessToken()
    
    const response = await fetch(
      `${this.apiUrl}/billing/mollie/connect/authorize/${tenantId}`,
      {
        method: 'POST',
        headers: this.getHeaders(token || undefined),
        body: JSON.stringify({ redirectUrl })
      }
    )
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    return await response.json()
  }

  async disconnectMollieConnect(tenantId: string): Promise<{ message: string }> {
    const token = this.getAccessToken()
    
    const response = await fetch(
      `${this.apiUrl}/billing/mollie/connect/${tenantId}`,
      {
        method: 'DELETE',
        headers: this.getHeaders(token || undefined)
      }
    )
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    return await response.json()
  }

  async createMemberCustomer(tenantId: string, data: { memberId: string; name?: string; email: string }): Promise<{ customerId: string }> {
    const token = this.getAccessToken()
    
    const response = await fetch(
      `${this.apiUrl}/billing/mollie/connect/create-member-customer/${tenantId}`,
      {
        method: 'POST',
        headers: this.getHeaders(token || undefined),
        body: JSON.stringify(data)
      }
    )
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    return await response.json()
  }

  async createMemberMandate(tenantId: string, data: { memberId: string; customerId: string; redirectUrl: string }): Promise<{ paymentId: string; checkoutUrl: string }> {
    const token = this.getAccessToken()
    
    const response = await fetch(
      `${this.apiUrl}/billing/mollie/connect/create-member-mandate/${tenantId}`,
      {
        method: 'POST',
        headers: this.getHeaders(token || undefined),
        body: JSON.stringify(data)
      }
    )
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    return await response.json()
  }

  async createMemberSubscription(tenantId: string, data: { 
    memberId: string
    customerId: string
    amount: number
    description?: string
    interval?: string 
  }): Promise<{ subscriptionId: string; status: string; nextPaymentDate: string }> {
    const token = this.getAccessToken()
    
    const response = await fetch(
      `${this.apiUrl}/billing/mollie/connect/create-member-subscription/${tenantId}`,
      {
        method: 'POST',
        headers: this.getHeaders(token || undefined),
        body: JSON.stringify(data)
      }
    )
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    return await response.json()
  }

  async getMemberSubscriptions(tenantId?: string): Promise<{ subscriptions: MemberSubscription[] }> {
    const resolvedTenantId = tenantId || this.getTenantId()
    const token = this.getAccessToken()
    
    const response = await fetch(
      `${this.apiUrl}/billing/mollie/connect/member-subscriptions/${resolvedTenantId}`,
      { headers: this.getHeaders(token || undefined) }
    )
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return await response.json()
  }

  async cancelMemberSubscription(tenantId: string, subscriptionId: string, customerId: string): Promise<{ message: string }> {
    const token = this.getAccessToken()
    
    const response = await fetch(
      `${this.apiUrl}/billing/mollie/connect/member-subscription/${tenantId}/${subscriptionId}`,
      {
        method: 'DELETE',
        headers: this.getHeaders(token || undefined),
        body: JSON.stringify({ customerId })
      }
    )
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    return await response.json()
  }
}

// Mollie Types
interface MollieCustomerInfo {
  hasCustomer: boolean
  customerId?: string
  customerName?: string
  customerEmail?: string
  hasMandate: boolean
  subscriptionStatus?: 'active' | 'inactive'
  subscriptionActivatedAt?: string
  mandate?: {
    id: string
    method: string
    status: string
    details?: {
      // SEPA details
      consumerName?: string
      consumerAccount?: string
      consumerBic?: string
      // Card details
      cardNumber?: string
      cardHolder?: string
      cardLabel?: string
      cardFingerprint?: string
      cardExpiryDate?: string
    }
    createdAt: string
  }
}

interface MolliePayment {
  id: string
  amount: { currency: string; value: string }
  description: string
  status: string
  method: string
  createdAt: string
  paidAt?: string
  metadata: Record<string, any>
}

// Mollie Connect Types
interface MollieConnectStatus {
  connected: boolean
  organizationId?: string
  organizationName?: string
  connectedAt?: string
  needsReconnect?: boolean
}

interface MemberSubscription {
  subscriptionId: string
  customerId: string
  customerName: string
  customerEmail: string
  memberId: string
  amount: { currency: string; value: string }
  interval: string
  status: string
  nextPaymentDate: string
  createdAt: string
}

export const billingService = new BillingService()
