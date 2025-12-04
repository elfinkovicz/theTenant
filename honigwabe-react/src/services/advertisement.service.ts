import { awsConfig } from '../config/aws-config'

export interface Advertisement {
  adId: string
  imageKey?: string | null
  imageUrl?: string | null
  linkUrl?: string | null
  enabled: boolean
  updatedAt?: string
}

class AdvertisementService {
  private apiUrl = awsConfig.api.user

  async getAdvertisement(): Promise<Advertisement | null> {
    try {
      const response = await fetch(`${this.apiUrl}/advertisement`)
      
      if (!response.ok) {
        console.warn('Advertisement API not yet deployed')
        return null
      }

      const data = await response.json()
      return data.advertisement
    } catch (error) {
      console.warn('Advertisement API not available:', error)
      return null
    }
  }

  async updateAdvertisement(ad: Partial<Advertisement>, token: string): Promise<void> {
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

  async uploadImage(file: File, token: string): Promise<{ imageKey: string; imageUrl: string }> {
    // Get presigned URL
    const urlResponse = await fetch(`${this.apiUrl}/advertisement/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type
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

  async deleteImage(token: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/advertisement/image`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      throw new Error('Failed to delete image')
    }
  }
}

export const advertisementService = new AdvertisementService()
