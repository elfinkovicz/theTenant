import { awsConfig } from '../config/aws-config'

export interface ThemeColors {
  primary: string
  primaryHover: string
  secondary: string
  secondaryHover: string
  background: string
  backgroundLight: string
  text: string
  textSecondary: string
  border: string
  accent: string
}

export interface HeroBackground {
  type: 'color' | 'gradient' | 'image' | 'video'
  value: string // color hex, gradient CSS, image URL, or video URL
  imageKey?: string | null
  videoKey?: string | null
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
  title: string
  subtitle: string
  logoSize?: number | 'small' | 'medium' | 'large'
  navbarLogoKey?: string | null
  navbarLogoUrl?: string | null
  navbarTitle?: string
  
  // Hero section settings
  heroHeight?: number // vh units (40-100)
  heroWidth?: 'full' | 'contained' // full width or container
  heroBackground?: HeroBackground
  
  // Theme settings
  themeId?: string
  themeName?: string
  themeColors?: ThemeColors
  designSettings?: DesignSettings
  
  updatedAt?: string
}

class HeroService {
  private apiUrl = awsConfig.api.user

  async getHeroContent(): Promise<HeroContent> {
    try {
      const response = await fetch(`${this.apiUrl}/hero`)
      
      if (!response.ok) {
        console.warn('Hero API not yet deployed, using defaults')
        return this.getDefaultHeroContent()
      }

      const data = await response.json()
      return data.hero
    } catch (error) {
      console.warn('Hero API not available, using defaults:', error)
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
      heroWidth: 'full',
      heroBackground: {
        type: 'gradient',
        value: 'linear-gradient(to bottom right, rgba(245, 158, 11, 0.2), rgba(3, 7, 18, 1))'
      },
      themeId: 'default',
      themeName: 'Honigwabe (Standard)',
      themeColors: {
        primary: '#f59e0b',
        primaryHover: '#d97706',
        secondary: '#1f2937',
        secondaryHover: '#374151',
        background: '#030712',
        backgroundLight: '#111827',
        text: '#ffffff',
        textSecondary: '#9ca3af',
        border: '#374151',
        accent: '#f59e0b'
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
      }
    }
  }

  async updateHeroContent(hero: Partial<HeroContent>, token: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/hero`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(hero)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update hero content')
    }
  }

  async uploadLogo(file: File, token: string, type: 'hero' | 'navbar' = 'hero'): Promise<{ logoKey: string; logoUrl: string }> {
    // Get presigned URL
    const urlResponse = await fetch(`${this.apiUrl}/hero/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
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

  async uploadBackground(file: File, token: string, type: 'image' | 'video'): Promise<{ key: string; url: string }> {
    // Get presigned URL
    const urlResponse = await fetch(`${this.apiUrl}/hero/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
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

  async deleteLogo(token: string, type: 'hero' | 'navbar' = 'hero'): Promise<void> {
    const response = await fetch(`${this.apiUrl}/hero/logo?type=${type}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      throw new Error('Failed to delete logo')
    }
  }
}

export const heroService = new HeroService()
