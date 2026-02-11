import { awsConfig } from '../config/aws-config'
import { tenantService } from './tenant.service'

export interface PageBanner {
  pageId: string
  bannerKey?: string
  bannerUrl?: string
  title?: string
  subtitle?: string
  height?: number
  overlay?: boolean
  overlayOpacity?: number
  blur?: number
  updatedAt?: string
}

export interface BannersData {
  [pageId: string]: PageBanner
}

class BannerService {
  private apiUrl = awsConfig.api.user
  private bannersCache: BannersData | null = null
  private cachedForTenant: string | null = null
  private preloadedImages: Set<string> = new Set()
  private loadPromise: Promise<BannersData> | null = null

  private getTenantId(): string {
    return tenantService.getCurrentTenantId()
  }

  async preloadAllBanners(): Promise<void> {
    await tenantService.waitForResolution()
    const banners = await this.getBanners()
    
    const imageUrls = Object.values(banners)
      .filter(b => b.bannerUrl)
      .map(b => b.bannerUrl!)
    
    await this.preloadImages(imageUrls)
    console.log(`[Banners] Preloaded ${imageUrls.length} images`)
  }

  private preloadImages(urls: string[]): Promise<void[]> {
    return Promise.all(
      urls.map(url => {
        if (this.preloadedImages.has(url)) return Promise.resolve()
        
        return new Promise<void>((resolve) => {
          const img = new Image()
          img.onload = () => {
            this.preloadedImages.add(url)
            resolve()
          }
          img.onerror = () => resolve()
          img.src = url
        })
      })
    )
  }

  async getBanners(): Promise<BannersData> {
    await tenantService.waitForResolution()
    const tenantId = this.getTenantId()
    
    // Check cache validity
    if (this.bannersCache && this.cachedForTenant === tenantId) {
      return this.bannersCache
    }
    
    // Clear stale cache
    if (this.cachedForTenant !== tenantId) {
      this.invalidateCache()
    }

    if (this.loadPromise) {
      return this.loadPromise
    }

    this.loadPromise = this.fetchBanners(tenantId)
    const result = await this.loadPromise
    this.loadPromise = null
    return result
  }

  private async fetchBanners(tenantId: string): Promise<BannersData> {
    try {
      console.log('[Banners] Fetching for tenant:', tenantId)
      
      const response = await fetch(`${this.apiUrl}/tenants/${tenantId}/banners`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Creator-ID': tenantId
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.banners) {
          this.bannersCache = data.banners
          this.cachedForTenant = tenantId
          console.log('[Banners] Loaded', Object.keys(data.banners).length, 'banners')
          return data.banners
        }
      }
      
      this.bannersCache = {}
      this.cachedForTenant = tenantId
      return {}
    } catch (error) {
      console.warn('[Banners] API error:', error)
      this.bannersCache = {}
      this.cachedForTenant = tenantId
      return {}
    }
  }

  async getBanner(pageId: string): Promise<PageBanner | null> {
    const banners = await this.getBanners()
    return banners[pageId] || null
  }

  getBannerSync(pageId: string): PageBanner | null {
    if (this.bannersCache && this.cachedForTenant === this.getTenantId()) {
      return this.bannersCache[pageId] || null
    }
    return null
  }

  isImagePreloaded(url: string): boolean {
    return this.preloadedImages.has(url)
  }

  invalidateCache(): void {
    this.bannersCache = null
    this.cachedForTenant = null
    this.preloadedImages.clear()
  }

  async updateBanner(pageId: string, banner: Partial<PageBanner>, token: string): Promise<void> {
    await tenantService.waitForResolution()
    const tenantId = this.getTenantId()
    
    console.log('[Banners] Updating banner for tenant:', tenantId, 'page:', pageId, 'data:', banner)
    
    const response = await fetch(`${this.apiUrl}/tenants/${tenantId}/banners/${pageId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Creator-ID': tenantId
      },
      body: JSON.stringify(banner)
    })

    console.log('[Banners] Update response status:', response.status)
    
    if (!response.ok) {
      const error = await response.json()
      console.error('[Banners] Update failed:', error)
      throw new Error(error.message || 'Failed to update banner')
    }
    
    if (this.bannersCache && this.cachedForTenant === tenantId) {
      this.bannersCache[pageId] = { ...this.bannersCache[pageId], ...banner, pageId, updatedAt: new Date().toISOString() }
    }
  }

  async uploadBanner(pageId: string, file: File, token: string): Promise<{ bannerKey: string; bannerUrl: string }> {
    await tenantService.waitForResolution()
    const tenantId = this.getTenantId()
    
    console.log('[Banners] Uploading for tenant:', tenantId, 'page:', pageId)
    
    const urlResponse = await fetch(`${this.apiUrl}/tenants/${tenantId}/banners/${pageId}/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Creator-ID': tenantId
      },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type
      })
    })

    if (!urlResponse.ok) {
      const error = await urlResponse.json().catch(() => ({ message: 'Failed to get upload URL' }))
      throw new Error(error.message || 'Failed to get upload URL')
    }

    const { uploadUrl, bannerKey, bannerUrl } = await urlResponse.json()

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file
    })

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload banner to S3')
    }

    if (this.bannersCache && this.cachedForTenant === tenantId) {
      this.bannersCache[pageId] = { ...this.bannersCache[pageId], bannerKey, bannerUrl, pageId, updatedAt: new Date().toISOString() }
    }
    
    this.preloadImages([bannerUrl])
    return { bannerKey, bannerUrl }
  }

  async deleteBanner(pageId: string, token: string): Promise<void> {
    await tenantService.waitForResolution()
    const tenantId = this.getTenantId()
    
    const response = await fetch(`${this.apiUrl}/tenants/${tenantId}/banners/${pageId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Creator-ID': tenantId
      }
    })

    if (!response.ok) {
      throw new Error('Failed to delete banner')
    }
    
    if (this.bannersCache && this.cachedForTenant === tenantId) {
      delete this.bannersCache[pageId]
    }
  }
}

export const bannerService = new BannerService()
