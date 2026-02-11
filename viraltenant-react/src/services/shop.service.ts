import axios, { AxiosProgressEvent } from 'axios'
import { useAuthStore } from '../store/authStore'
import { awsConfig } from '../config/aws-config'

const API_BASE_URL = awsConfig.api.user

export interface Product {
  productId: string
  name: string
  description?: string
  price: number
  currency: string
  imageKey?: string
  imageUrl?: string
  externalLink?: string
  category?: string
  stock?: number
  featured?: boolean
  status: 'draft' | 'published'
  createdAt: string
  updatedAt: string
}

export interface ShopData {
  tenant_id: string
  products: Product[]
  categories: string[]
  settings: {
    currency: string
    taxRate: number
    shippingEnabled: boolean
    paymentConfig?: {
      paypal?: { enabled: boolean; clientId?: string; sandbox?: boolean }
      mollie?: { enabled: boolean; profileId?: string }
    }
  }
  orders?: Order[]
  created_at: string
  updated_at: string
  resolvedTenantId?: string
}

export interface ShippingAddress {
  firstName: string
  lastName: string
  email: string
  phone: string
  street: string
  city: string
  postalCode: string
  country: string
}

export interface Order {
  orderId: string
  provider: 'paypal' | 'mollie'
  status: 'pending' | 'completed' | 'failed' | 'canceled'
  items: CartItem[]
  total: number
  currency: string
  customerEmail?: string
  shippingAddress?: ShippingAddress
  created_at: string
  updated_at?: string
}

export interface CartItem {
  productId: string
  name: string
  price: number
  quantity: number
  imageUrl?: string
}

export interface CheckoutResponse {
  provider: string
  orderId: string
  checkoutUrl?: string
  approvalUrl?: string
  sessionId?: string
  paymentId?: string
  providerOrderId?: string
}

export interface PaymentConfig {
  paypal: { enabled: boolean; clientId?: string; sandbox?: boolean }
  mollie: { enabled: boolean; profileId?: string }
}

export interface UploadUrlResponse {
  uploadUrl: string
  key: string
  publicUrl: string
}

class ShopService {
  private getAuthHeaders() {
    const token = useAuthStore.getState().accessToken
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  private isCustomDomain(): boolean {
    const hostname = window.location.hostname
    return !hostname.includes('viraltenant.com')
  }

  private getStoredTenantId(): string | null {
    // Priority: currentTenantId (set by TenantProvider) > resolvedTenantId (legacy)
    return localStorage.getItem('currentTenantId') || localStorage.getItem('resolvedTenantId')
  }

  private getTenantId(): string {
    // Priority: currentTenantId (set by TenantProvider after domain resolution)
    const currentTenantId = localStorage.getItem('currentTenantId')
    if (currentTenantId) {
      return currentTenantId
    }
    
    // Fallback: detect from hostname (should rarely happen)
    const hostname = window.location.hostname
    if (hostname.includes('viraltenant.com')) {
      const parts = hostname.split('.')
      if (parts.length >= 3 && parts[0] !== 'www') {
        return parts[0]
      }
    }
    
    return '319190e1-0791-43b0-bd04-506f959c1471'
  }

  // Public: Get shop data
  async getShop(tenantId?: string): Promise<ShopData> {
    try {
      const resolvedTenantId = tenantId || this.getTenantId()
      const response = await axios.get(`${API_BASE_URL}/tenants/${resolvedTenantId}/shop`, {
        headers: { 'X-Creator-ID': resolvedTenantId }
      })
      
      // Only store the resolved tenant ID for custom domains
      if (response.data.resolvedTenantId && this.isCustomDomain()) {
        localStorage.setItem('resolvedTenantId', response.data.resolvedTenantId)
        console.log('Stored resolved tenant ID:', response.data.resolvedTenantId)
      }
      
      return response.data
    } catch (error) {
      console.error('Error loading shop data:', error)
      return { 
        tenant_id: this.getTenantId(),
        products: [], 
        categories: [], 
        settings: { currency: 'EUR', taxRate: 19, shippingEnabled: true },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    }
  }

  // Admin: Generate upload URL for product image
  async generateUploadUrl(fileName: string, fileType: string, tenantId?: string): Promise<UploadUrlResponse> {
    const resolvedTenantId = tenantId || this.getTenantId()
    console.log('Generating upload URL:', { fileName, fileType, tenantId: resolvedTenantId })
    
    const response = await axios.post(
      `${API_BASE_URL}/tenants/${resolvedTenantId}/shop/upload-url`,
      { fileName, fileType, uploadType: 'product' },
      { 
        headers: {
          ...this.getAuthHeaders(),
          'X-Creator-ID': resolvedTenantId
        }
      }
    )
    console.log('Upload URL response:', response.data)
    return response.data
  }

  // Admin: Upload file to S3 using presigned URL
  async uploadToS3(uploadUrl: string, file: File, onProgress?: (progress: number) => void): Promise<void> {
    await axios.put(uploadUrl, file, {
      headers: {
        'Content-Type': file.type,
      },
      onUploadProgress: (progressEvent: AxiosProgressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(progress)
        }
      },
    })
  }

  // Admin: Update shop data (add/update products)
  async updateShop(products: Product[], categories?: string[], settings?: object, tenantId?: string): Promise<void> {
    // Use stored resolved tenant ID if available, otherwise use provided or detected tenant ID
    const storedTenantId = this.getStoredTenantId()
    const resolvedTenantId = tenantId || storedTenantId || this.getTenantId()
    
    console.log('Updating shop for tenant:', resolvedTenantId, 'stored:', storedTenantId, 'provided:', tenantId)
    
    await axios.put(
      `${API_BASE_URL}/tenants/${resolvedTenantId}/shop`,
      { products, categories, settings },
      { 
        headers: {
          ...this.getAuthHeaders(),
          'X-Creator-ID': resolvedTenantId
        }
      }
    )
  }

  // Admin: Add a new product
  async addProduct(product: Omit<Product, 'createdAt' | 'updatedAt'>, tenantId?: string): Promise<void> {
    const resolvedTenantId = tenantId || this.getTenantId()
    const data = await this.getShop(resolvedTenantId)
    
    const newProduct: Product = {
      ...product,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    // Use the resolved tenant ID from the backend response if available
    const targetTenantId = data.resolvedTenantId || resolvedTenantId
    console.log('Adding product to tenant:', targetTenantId, 'original:', resolvedTenantId)
    
    // Add new product at the beginning (position 1)
    await this.updateShop([newProduct, ...data.products], data.categories, data.settings, targetTenantId)
  }

  // Admin: Delete product
  async deleteProduct(productId: string, tenantId?: string): Promise<void> {
    // Use stored resolved tenant ID if available, otherwise use provided or detected tenant ID
    const storedTenantId = this.getStoredTenantId()
    const resolvedTenantId = tenantId || storedTenantId || this.getTenantId()
    const data = await this.getShop(resolvedTenantId)
    
    const productToDelete = data.products.find(p => p.productId === productId)
    if (productToDelete && productToDelete.imageKey) {
      // Delete S3 asset
      await this.deleteAsset(productToDelete.imageKey, resolvedTenantId)
    }
    
    const updatedProducts = data.products.filter(p => p.productId !== productId)
    await this.updateShop(updatedProducts, data.categories, data.settings, resolvedTenantId)
  }

  // Admin: Delete asset from S3
  async deleteAsset(key: string, tenantId?: string): Promise<void> {
    // Use stored resolved tenant ID if available, otherwise use provided or detected tenant ID
    const storedTenantId = this.getStoredTenantId()
    const resolvedTenantId = tenantId || storedTenantId || this.getTenantId()
    
    await axios.delete(
      `${API_BASE_URL}/tenants/${resolvedTenantId}/shop/asset`,
      { 
        headers: {
          ...this.getAuthHeaders(),
          'X-Creator-ID': resolvedTenantId
        },
        data: { key }
      }
    )
  }

  // Public: Get payment configuration (public keys only)
  async getPaymentConfig(tenantId?: string): Promise<PaymentConfig> {
    const resolvedTenantId = tenantId || this.getTenantId()
    const response = await axios.get(
      `${API_BASE_URL}/tenants/${resolvedTenantId}/shop/payment-config`,
      { headers: { 'X-Creator-ID': resolvedTenantId } }
    )
    return response.data
  }

  // Public: Create checkout session
  async createCheckout(
    items: CartItem[],
    returnUrl: string,
    cancelUrl: string,
    customerEmail?: string,
    shippingAddress?: ShippingAddress,
    tenantId?: string,
    provider?: string
  ): Promise<CheckoutResponse> {
    const resolvedTenantId = tenantId || this.getTenantId()
    const response = await axios.post(
      `${API_BASE_URL}/tenants/${resolvedTenantId}/shop/checkout`,
      { items, returnUrl, cancelUrl, customerEmail, shippingAddress, provider },
      { headers: { 'X-Creator-ID': resolvedTenantId } }
    )
    return response.data
  }

  // Public: Capture PayPal payment
  async capturePayPalPayment(orderId: string, providerOrderId: string, customerEmail?: string, tenantId?: string): Promise<{ success: boolean; status: string }> {
    const resolvedTenantId = tenantId || this.getTenantId()
    const response = await axios.post(
      `${API_BASE_URL}/tenants/${resolvedTenantId}/shop/capture`,
      { orderId, providerOrderId, customerEmail },
      { headers: { 'X-Creator-ID': resolvedTenantId } }
    )
    return response.data
  }

  // Admin: Get orders
  async getOrders(tenantId?: string): Promise<Order[]> {
    const storedTenantId = this.getStoredTenantId()
    const resolvedTenantId = tenantId || storedTenantId || this.getTenantId()
    
    const response = await axios.get(
      `${API_BASE_URL}/tenants/${resolvedTenantId}/shop/orders`,
      { 
        headers: {
          ...this.getAuthHeaders(),
          'X-Creator-ID': resolvedTenantId
        }
      }
    )
    return response.data.orders || []
  }
}

export const shopService = new ShopService()
