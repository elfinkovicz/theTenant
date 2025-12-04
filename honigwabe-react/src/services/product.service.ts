import axios from 'axios'
import { useAuthStore } from '../store/authStore'

// Remove trailing slash from API URL
const API_URL = (import.meta.env.VITE_PRODUCT_API_URL || 'https://1rhnpplzti.execute-api.eu-central-1.amazonaws.com').replace(/\/$/, '')

export interface Product {
  productId: string
  name: string
  description: string
  price: number
  imageKey?: string | null
  imageUrl?: string | null
  externalLink?: string | null
  category: string
  stock: number
  featured: boolean
  createdAt?: string
  updatedAt?: string
}

class ProductService {
  private getAuthHeaders() {
    const token = useAuthStore.getState().accessToken
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  async getProducts(): Promise<Product[]> {
    const response = await axios.get(`${API_URL}/products`)
    return response.data.products
  }

  async createProduct(data: Partial<Product>): Promise<Product> {
    const response = await axios.post(
      `${API_URL}/products`,
      data,
      { headers: this.getAuthHeaders() }
    )
    return response.data.product
  }

  async updateProduct(productId: string, data: Partial<Product>): Promise<void> {
    await axios.put(
      `${API_URL}/products/${productId}`,
      data,
      { headers: this.getAuthHeaders() }
    )
  }

  async deleteProduct(productId: string): Promise<void> {
    await axios.delete(
      `${API_URL}/products/${productId}`,
      { headers: this.getAuthHeaders() }
    )
  }

  async generateUploadUrl(fileName: string, fileType: string): Promise<{
    uploadUrl: string
    imageKey: string
    imageUrl: string
  }> {
    const response = await axios.post(
      `${API_URL}/products/upload-url`,
      { fileName, fileType },
      { headers: this.getAuthHeaders() }
    )
    return response.data
  }

  async uploadToS3(uploadUrl: string, file: File): Promise<void> {
    await axios.put(uploadUrl, file, {
      headers: {
        'Content-Type': file.type
      }
    })
  }
}

export const productService = new ProductService()
