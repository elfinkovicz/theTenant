import { awsConfig } from '../config/aws-config'
import { useAuthStore } from '../store/authStore'

export interface ShopSettings {
  // PayPal
  paypalEnabled: boolean
  paypalClientId?: string
  paypalClientSecret?: string
  paypalMode?: 'sandbox' | 'live'
  
  // Stripe
  stripeEnabled: boolean
  stripePublishableKey?: string
  stripeSecretKey?: string
  stripeWebhookSecret?: string
  
  // Mollie
  mollieEnabled: boolean
  mollieApiKey?: string
  
  // General
  sellerEmail: string
  sellerName: string
}

class ShopService {
  private getAuthHeaders() {
    const token = useAuthStore.getState().accessToken
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    }
  }

  async getSettings(): Promise<ShopSettings> {
    const response = await fetch(`${awsConfig.api.shop}/settings`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    })

    if (!response.ok) {
      throw new Error('Failed to load shop settings')
    }

    return response.json()
  }

  async updateSettings(settings: ShopSettings): Promise<void> {
    const response = await fetch(`${awsConfig.api.shop}/settings`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(settings)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update shop settings')
    }
  }
}

export const shopService = new ShopService()
