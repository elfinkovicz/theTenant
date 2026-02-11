import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const API_URL = (import.meta.env.VITE_SHOP_API_URL || 'https://xd3b0v72nl.execute-api.eu-central-1.amazonaws.com').replace(/\/$/, '')

export interface OrderItem {
  productId: string
  name: string
  price: number
  quantity: number
}

export interface CreateOrderRequest {
  items: OrderItem[]
  totalAmount: number
  paymentProvider: 'paypal' | 'mollie'
}

export interface CreateOrderResponse {
  orderId: string
  paymentId: string
  approvalUrl?: string
}

export interface VerifyPaymentRequest {
  orderId: string
  paypalOrderId: string
}

export interface ShopSettings {
  // PayPal
  paypalClientId?: string
  paypalClientSecret?: string
  paypalMode?: 'sandbox' | 'live'
  paypalEnabled: boolean
  
  // Mollie
  mollieApiKey?: string
  mollieEnabled: boolean
  
  // General
  sellerEmail: string
  sellerName: string
}

class CartService {
  private getAuthHeaders() {
    const token = useAuthStore.getState().accessToken
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  // Create Order (PayPal, Mollie)
  async createOrder(data: CreateOrderRequest): Promise<CreateOrderResponse> {
    try {
      console.log('Creating order with API URL:', `${API_URL}/orders`)
      console.log('Order data:', data)
      
      const response = await axios.post(
        `${API_URL}/orders`,
        data,
        { headers: this.getAuthHeaders() }
      )
      
      console.log('Order response:', response.data)
      return response.data
    } catch (error: any) {
      console.error('Create order error:', error)
      console.error('Error response:', error.response?.data)
      throw error
    }
  }

  // Verify PayPal Payment
  async verifyPayment(data: VerifyPaymentRequest): Promise<void> {
    await axios.post(
      `${API_URL}/orders/verify`,
      data,
      { headers: this.getAuthHeaders() }
    )
  }

  // Get Order Details
  async getOrder(orderId: string): Promise<any> {
    const response = await axios.get(
      `${API_URL}/orders/${orderId}`,
      { headers: this.getAuthHeaders() }
    )
    return response.data
  }

  // Shop Settings (Admin only)
  async getSettings(): Promise<ShopSettings> {
    const response = await axios.get(
      `${API_URL}/settings`,
      { headers: this.getAuthHeaders() }
    )
    return response.data
  }

  async updateSettings(settings: ShopSettings): Promise<void> {
    await axios.put(
      `${API_URL}/settings`,
      settings,
      { headers: this.getAuthHeaders() }
    )
  }
}

export const cartService = new CartService()
