/**
 * Tenant Cache Service
 * 
 * Caches tenant-specific static settings (theme, design, banners) for faster initial load.
 * Dynamic content (newsfeed, videos) is always fetched fresh.
 */

import { HeroContent, ThemeColors, DesignSettings } from './hero.service'

interface CachedTenantData {
  tenantId: string
  version: number
  timestamp: number
  // Static data that rarely changes
  theme: {
    themeId: string
    themeName: string
    themeColors: ThemeColors
  }
  design: DesignSettings
  branding: {
    logoUrl: string | null
    navbarLogoUrl: string | null
    navbarTitle: string
    title: string
    subtitle: string
    heroHeight: number
    heroBackground: HeroContent['heroBackground']
  }
  navigation: HeroContent['navSettings']
}

// Use same cache key as index.html for consistency
const HERO_CACHE_KEY_PREFIX = 'heroContent_'
const CACHE_KEY_PREFIX = 'vt_tenant_cache_'
const CACHE_VERSION = 1
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

class TenantCacheService {
  private memoryCache: Map<string, CachedTenantData> = new Map()

  /**
   * Get cached tenant data - returns immediately if available
   */
  getCached(tenantId: string): CachedTenantData | null {
    // Check memory cache first (fastest)
    if (this.memoryCache.has(tenantId)) {
      const cached = this.memoryCache.get(tenantId)!
      if (this.isValid(cached)) {
        return cached
      }
      this.memoryCache.delete(tenantId)
    }

    // Check localStorage
    try {
      const stored = localStorage.getItem(CACHE_KEY_PREFIX + tenantId)
      if (stored) {
        const cached: CachedTenantData = JSON.parse(stored)
        if (this.isValid(cached)) {
          this.memoryCache.set(tenantId, cached)
          return cached
        }
        // Remove stale cache
        localStorage.removeItem(CACHE_KEY_PREFIX + tenantId)
      }
    } catch (e) {
      console.warn('[TenantCache] Failed to read cache:', e)
    }

    return null
  }

  /**
   * Cache tenant data from hero content
   */
  cache(tenantId: string, heroContent: HeroContent): void {
    const cached: CachedTenantData = {
      tenantId,
      version: CACHE_VERSION,
      timestamp: Date.now(),
      theme: {
        themeId: heroContent.themeId || 'default',
        themeName: heroContent.themeName || 'Default',
        themeColors: heroContent.themeColors!
      },
      design: heroContent.designSettings!,
      branding: {
        logoUrl: heroContent.logoUrl || null,
        navbarLogoUrl: heroContent.navbarLogoUrl || null,
        navbarTitle: heroContent.navbarTitle || heroContent.title,
        title: heroContent.title,
        subtitle: heroContent.subtitle,
        heroHeight: heroContent.heroHeight || 70,
        heroBackground: heroContent.heroBackground
      },
      navigation: heroContent.navSettings
    }

    // Store in memory
    this.memoryCache.set(tenantId, cached)

    // Store in localStorage (both keys for compatibility with index.html script)
    try {
      localStorage.setItem(CACHE_KEY_PREFIX + tenantId, JSON.stringify(cached))
      // Also store in heroContent_ format for index.html FOUC prevention script
      localStorage.setItem(HERO_CACHE_KEY_PREFIX + tenantId, JSON.stringify(heroContent))
    } catch (e) {
      console.warn('[TenantCache] Failed to write cache:', e)
    }
  }

  /**
   * Invalidate cache for a tenant (call after settings update)
   */
  invalidate(tenantId: string): void {
    this.memoryCache.delete(tenantId)
    try {
      localStorage.removeItem(CACHE_KEY_PREFIX + tenantId)
      localStorage.removeItem(HERO_CACHE_KEY_PREFIX + tenantId)
    } catch (e) {
      // Ignore
    }
  }

  /**
   * Check if cached data is still valid
   */
  private isValid(cached: CachedTenantData): boolean {
    if (cached.version !== CACHE_VERSION) return false
    if (Date.now() - cached.timestamp > CACHE_MAX_AGE_MS) return false
    if (!cached.theme?.themeColors || !cached.design) return false
    return true
  }

  /**
   * Apply cached theme immediately (before API call completes)
   */
  applyCachedTheme(cached: CachedTenantData): void {
    const root = document.documentElement
    const colors = cached.theme.themeColors
    const design = cached.design

    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      return result 
        ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`
        : '0 0 0'
    }

    // Apply critical colors immediately to prevent flash
    root.style.setProperty('--color-background', hexToRgb(colors.background))
    root.style.setProperty('--color-background-light', hexToRgb(colors.backgroundLight))
    root.style.setProperty('--color-text', hexToRgb(colors.text))
    root.style.setProperty('--color-primary', hexToRgb(colors.primary))
    root.style.setProperty('--color-navbar-background', hexToRgb(colors.navbarBackground))
    root.style.setProperty('--color-card-background', hexToRgb(colors.cardBackground))

    // Apply design settings
    if (design) {
      root.style.setProperty('--button-roundness', `${design.buttonRoundness}px`)
      root.style.setProperty('--card-roundness', `${design.cardRoundness}px`)
      root.style.setProperty('--font-size-base', `${design.fontSize}px`)
      root.style.setProperty('--font-family', design.fontFamily)
    }

    // Set body background immediately using CSS variable (not direct color)
    // This ensures theme changes work correctly
    document.body.style.backgroundColor = `rgb(${hexToRgb(colors.background)})`
  }
}

export const tenantCacheService = new TenantCacheService()
