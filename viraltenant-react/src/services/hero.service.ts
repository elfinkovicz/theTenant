import { awsConfig } from '../config/aws-config'
import { tenantCacheService } from './tenantCache.service'

export interface ThemeColors {
  primary: string
  primaryHover: string
  secondary: string
  secondaryHover: string
  guest?: string
  guestHover?: string
  complementary?: string
  background: string
  backgroundLight: string
  text: string
  textSecondary: string
  textMuted: string
  border: string
  accent: string
  // Status colors
  success: string
  warning: string
  error: string
  info: string
  // Component colors
  cardBackground: string
  navbarBackground: string
  navbarActive: string
  inputBackground: string
  inputText: string
  inputPlaceholder: string
  glowColor: string
}

export interface HeroBackground {
  type: 'color' | 'gradient' | 'image' | 'video'
  value: string // color hex, gradient CSS, image URL, or video URL
  imageKey?: string | null
  videoKey?: string | null
  blur?: number // 0-20 px blur amount
}

export interface AnimationSettings {
  // Animation speed
  speed: 'slow' | 'normal' | 'fast' // 0.5s, 0.3s, 0.15s
  
  // Hover effects
  hoverScale: number // 1.0 - 1.2
  hoverEnabled: boolean
  
  // Transitions
  transitionType: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear'
  
  // Page transitions
  pageTransitions: boolean
  
  // Scroll animations
  scrollAnimations: boolean
  
  // Background floating animations (Channels page etc.)
  backgroundAnimations?: boolean
  backgroundAnimationType?: 'subtle' | 'elegant' | 'dynamic' | 'minimal'
}

export interface DesignSettings {
  // Button settings
  buttonSize: 'small' | 'medium' | 'large'
  buttonRoundness: number // 0-50 (px)
  
  // Typography
  fontFamily: string
  fontSize: number // base size in px
  
  // Spacing
  spacing: number // multiplier (0.5 - 2)
  
  // Card settings
  cardRoundness: number // 0-50 (px)
  cardPadding: number // 16-48 (px)
  
  // Border settings
  borderWidth: number // 1-4 (px)
  
  // Animations
  animations: AnimationSettings
}

export interface HeroContent {
  heroId: string
  logoKey?: string | null
  logoUrl?: string | null
  logoEnabled?: boolean
  title: string
  subtitle: string
  logoSize?: number | 'small' | 'medium' | 'large'
  navbarLogoKey?: string | null
  navbarLogoUrl?: string | null
  navbarTitle?: string
  
  // Hero section settings
  heroHeight?: number // vh units (40-100)
  heroBackground?: HeroBackground
  
  // Theme settings
  themeId?: string
  themeName?: string
  themeColors?: ThemeColors
  designSettings?: DesignSettings
  
  // Navbar settings
  navSettings?: {
    disabledPages: string[]
    pageLabels?: Record<string, string>
    pageSubtitles?: Record<string, string>
    customPages?: string[] // slugs of custom pages to show in nav
    pageOrder?: string[] // ordered list of page paths for navigation order
  }
  
  // Stream settings
  streamTitle?: string
  streamDescription?: string
  autoSaveStream?: boolean
  autoPublishToNewsfeed?: boolean
  
  // Section texts (editable)
  featuresTitle?: string
  featuresSubtitle?: string
  ctaTitle?: string
  ctaSubtitle?: string
  ctaButtonText?: string
  
  // Feature cards (editable)
  featureCards?: {
    icon: string
    title: string
    description: string
    link: string
  }[]
  
  updatedAt?: string
}

class HeroService {
  private apiUrl = awsConfig.api.user

  private getTenantId(overrideTenantId?: string): string {
    if (overrideTenantId) {
      return overrideTenantId
    }
    
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

  async getHeroContent(tenantId?: string): Promise<HeroContent> {
    try {
      const resolvedTenantId = this.getTenantId(tenantId)
      console.log('Loading hero content for tenant:', resolvedTenantId)
      
      // Try to fetch from API
      const response = await fetch(`${this.apiUrl}/tenants/${resolvedTenantId}/hero`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Creator-ID': resolvedTenantId
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.hero) {
          // Cache in localStorage for faster subsequent loads
          localStorage.setItem('heroContent', JSON.stringify(data.hero))
          return data.hero
        }
      }
      
      // Fallback to localStorage cache
      const stored = localStorage.getItem('heroContent')
      if (stored) {
        console.log('Using cached hero content from localStorage')
        return JSON.parse(stored)
      }
      
      return this.getDefaultHeroContent()
    } catch (error) {
      console.warn('Hero API not available, using defaults:', error)
      
      // Try localStorage fallback
      const stored = localStorage.getItem('heroContent')
      if (stored) {
        return JSON.parse(stored)
      }
      
      return this.getDefaultHeroContent()
    }
  }

  private getDefaultHeroContent(): HeroContent {
    return {
      heroId: 'home-hero',
      logoUrl: null,
      title: 'Your Brand',
      subtitle: 'Deine moderne Creator-Plattform für Live-Streaming, Events und Community',
      logoSize: 160,
      navbarLogoUrl: null,
      navbarTitle: 'Your Brand',
      heroHeight: 70,
      heroBackground: {
        type: 'gradient',
        value: 'linear-gradient(to bottom right, rgba(245, 158, 11, 0.2), rgba(3, 7, 18, 1))'
      },
      themeId: 'default',
      themeName: 'ViralTenant (Standard)',
      themeColors: {
        primary: '#f59e0b',
        primaryHover: '#d97706',
        secondary: '#1f2937',
        secondaryHover: '#374151',
        background: '#030712',
        backgroundLight: '#111827',
        text: '#ffffff',
        textSecondary: '#9ca3af',
        textMuted: '#6b7280',
        border: '#374151',
        accent: '#f59e0b',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
        cardBackground: '#111827',
        navbarBackground: '#030712',
        navbarActive: '#f59e0b',
        inputBackground: '#1f2937',
        inputText: '#ffffff',
        inputPlaceholder: '#6b7280',
        glowColor: '#f59e0b'
      },
      designSettings: {
        buttonSize: 'medium',
        buttonRoundness: 8,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 16,
        spacing: 1,
        cardRoundness: 12,
        cardPadding: 24,
        borderWidth: 1,
        animations: {
          speed: 'normal',
          hoverScale: 1.05,
          hoverEnabled: true,
          transitionType: 'ease-in-out',
          pageTransitions: true,
          scrollAnimations: true
        }
      },
      streamTitle: 'Live Stream',
      streamDescription: 'Welcome to the stream!',
      autoSaveStream: false,
      autoPublishToNewsfeed: false
    }
  }

  async updateHeroContent(hero: Partial<HeroContent>, token: string, tenantId?: string): Promise<void> {
    const resolvedTenantId = this.getTenantId(tenantId)
    console.log('HeroService: updateHeroContent called with:', hero)
    
    const response = await fetch(`${this.apiUrl}/tenants/${resolvedTenantId}/hero`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Creator-ID': resolvedTenantId
      },
      body: JSON.stringify(hero)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('HeroService: Update failed:', errorText)
      throw new Error(`Failed to update hero content: ${errorText}`)
    }
    
    const data = await response.json()
    console.log('HeroService: Update response:', data)
    
    // Clear the cache to force a fresh fetch next time
    localStorage.removeItem('heroContent')
    console.log('HeroService: Cache cleared')
    
    // Invalidate tenant cache so next page load fetches fresh data
    tenantCacheService.invalidate(resolvedTenantId)
    
    // Re-fetch and cache fresh data
    const freshContent = await this.getHeroContent(resolvedTenantId)
    if (freshContent.themeColors && freshContent.designSettings) {
      tenantCacheService.cache(resolvedTenantId, freshContent)
    }
  }

  async uploadLogo(file: File, token: string, type: 'hero' | 'navbar' = 'hero', tenantId?: string): Promise<{ logoKey: string; logoUrl: string }> {
    const resolvedTenantId = this.getTenantId(tenantId)
    console.log('Uploading logo for tenant:', resolvedTenantId)
    
    // Get presigned URL
    const urlResponse = await fetch(`${this.apiUrl}/tenants/${resolvedTenantId}/hero/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Creator-ID': resolvedTenantId
      },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type,
        logoType: type
      })
    })

    if (!urlResponse.ok) {
      throw new Error('Failed to get upload URL')
    }

    const { uploadUrl, logoKey, logoUrl } = await urlResponse.json()

    // Upload to S3
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type
      },
      body: file
    })

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload logo')
    }

    return { logoKey, logoUrl }
  }

  async uploadBackground(file: File, token: string, type: 'image' | 'video', tenantId?: string): Promise<{ key: string; url: string }> {
    const resolvedTenantId = this.getTenantId(tenantId)
    
    // Get presigned URL
    const urlResponse = await fetch(`${this.apiUrl}/tenants/${resolvedTenantId}/hero/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Creator-ID': resolvedTenantId
      },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type,
        logoType: `background-${type}`
      })
    })

    if (!urlResponse.ok) {
      throw new Error('Failed to get upload URL')
    }

    const { uploadUrl, logoKey, logoUrl } = await urlResponse.json()

    // Upload to S3
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type
      },
      body: file
    })

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload background')
    }

    return { key: logoKey, url: logoUrl }
  }

  async deleteLogo(token: string, type: 'hero' | 'navbar' = 'hero', tenantId?: string): Promise<void> {
    const resolvedTenantId = this.getTenantId(tenantId)
    
    const response = await fetch(`${this.apiUrl}/tenants/${resolvedTenantId}/hero/logo?type=${type}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Creator-ID': resolvedTenantId
      }
    })

    if (!response.ok) {
      throw new Error('Failed to delete logo')
    }
  }
}

export const heroService = new HeroService()
