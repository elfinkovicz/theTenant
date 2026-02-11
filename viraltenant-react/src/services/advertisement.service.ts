import { awsConfig } from '../config/aws-config'

export interface Advertisement {
  adId: string
  position?: 'top' | 'bottom'
  imageKey?: string | null
  imageUrl?: string | null
  linkUrl?: string | null
  enabled: boolean
  updatedAt?: string
}

export interface AdvertisementResponse {
  topBanner: Advertisement
  bottomBanner: Advertisement
  advertisement: Advertisement // Backward compatibility
}

class AdvertisementService {
  private apiUrl = awsConfig.api.user

  private getTenantId(): string {
    // Priority: currentTenantId (set by TenantProvider) > hostname detection > platform UUID
    const currentTenantId = localStorage.getItem('currentTenantId')
    if (currentTenantId) {
      console.log('Using currentTenantId:', currentTenantId)
      return currentTenantId
    }
    
    // Get tenant ID from subdomain
    const hostname = window.location.hostname
    
    // Check if it's a viraltenant.com domain
    if (hostname.includes('viraltenant.com')) {
      const parts = hostname.split('.')
      
      // If we have more than 2 parts and first part is not 'www'
      if (parts.length >= 3 && parts[0] !== 'www') {
        const subdomain = parts[0]
        console.log('Detected subdomain:', subdomain)
        return subdomain
      }
    }
    
    // On main domain or custom domain without resolution - use platform
    console.warn('No subdomain detected - using platform tenant')
    return '319190e1-0791-43b0-bd04-506f959c1471'
  }

  async getAdvertisements(): Promise<AdvertisementResponse | null> {
    try {
      const tenantId = this.getTenantId()
      console.log('Loading advertisements for tenant:', tenantId)
      
      const response = await fetch(`${this.apiUrl}/tenants/${tenantId}/advertisement`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Creator-ID': tenantId
        }
      })
      
      if (!response.ok) {
        console.warn('Advertisement API returned error:', response.status)
        return null
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.warn('Advertisement API not available:', error)
      return null
    }
  }

  // Backward compatibility
  async getAdvertisement(): Promise<Advertisement | null> {
    const data = await this.getAdvertisements()
    return data?.advertisement || null
  }

  async updateAdvertisement(ad: Partial<Advertisement> & { position?: 'top' | 'bottom' }, token: string): Promise<void> {
    const tenantId = this.getTenantId()
    
    const response = await fetch(`${this.apiUrl}/tenants/${tenantId}/advertisement`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Creator-ID': tenantId
      },
      body: JSON.stringify(ad)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to update advertisement')
    }
  }

  async uploadImage(file: File, token: string, position: 'top' | 'bottom' = 'top'): Promise<{ imageKey: string; imageUrl: string }> {
    const tenantId = this.getTenantId()
    
    // Get presigned URL
    const urlResponse = await fetch(`${this.apiUrl}/tenants/${tenantId}/advertisement/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Creator-ID': tenantId
      },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type,
        position
      })
    })

    if (!urlResponse.ok) {
      throw new Error('Failed to get upload URL')
    }

    const { uploadUrl, imageKey, imageUrl } = await urlResponse.json()

    // Upload to S3
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type
      },
      body: file
    })

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload image')
    }

    return { imageKey, imageUrl }
  }

  async deleteImage(token: string, position: 'top' | 'bottom' = 'top'): Promise<void> {
    const tenantId = this.getTenantId()
    
    const response = await fetch(`${this.apiUrl}/tenants/${tenantId}/advertisement/image`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Creator-ID': tenantId
      },
      body: JSON.stringify({ position })
    })

    if (!response.ok) {
      throw new Error('Failed to delete image')
    }
  }
}

export const advertisementService = new AdvertisementService()
