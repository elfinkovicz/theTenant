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

  async getAdvertisements(): Promise<AdvertisementResponse | null> {
    try {
      const response = await fetch(`${this.apiUrl}/advertisement`)
      
      if (!response.ok) {
        console.warn('Advertisement API not yet deployed')
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
    const response = await fetch(`${this.apiUrl}/advertisement`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(ad)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update advertisement')
    }
  }

  async uploadImage(file: File, token: string, position: 'top' | 'bottom' = 'top'): Promise<{ imageKey: string; imageUrl: string }> {
    // Get presigned URL
    const urlResponse = await fetch(`${this.apiUrl}/advertisement/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
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
    const response = await fetch(`${this.apiUrl}/advertisement/image`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ position })
    })

    if (!response.ok) {
      throw new Error('Failed to delete image')
    }
  }
}

export const advertisementService = new AdvertisementService()
