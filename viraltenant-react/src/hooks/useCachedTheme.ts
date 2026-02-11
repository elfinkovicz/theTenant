import { useEffect, useState } from 'react'
import { tenantCacheService } from '../services/tenantCache.service'
import { themeService } from '../services/theme.service'
import { heroService } from '../services/hero.service'
import { tenantService } from '../services/tenant.service'

interface UseCachedThemeOptions {
  tenantId?: string
}

/**
 * Hook that loads theme from API first to avoid theme jumping.
 * Cache is only used as fallback on error.
 */
export const useCachedTheme = (options: UseCachedThemeOptions = {}) => {
  const [isLoading, setIsLoading] = useState(true)
  const [usedCache, setUsedCache] = useState(false)

  useEffect(() => {
    const loadTheme = async () => {
      // Wait for tenant resolution
      const tenant = await tenantService.waitForResolution()
      const tenantId = options.tenantId || tenant.tenantId

      console.log('[useCachedTheme] Loading for tenant:', tenantId)

      try {
        const heroContent = await heroService.getHeroContent(tenantId)
        const theme = await themeService.getTheme()
        themeService.applyTheme(theme.colors, heroContent.designSettings)
        
        if (heroContent.themeColors && heroContent.designSettings) {
          tenantCacheService.cache(tenantId, heroContent)
        }
        
        console.log('[useCachedTheme] Theme applied for tenant:', tenantId)
      } catch (error) {
        console.error('[useCachedTheme] Failed to load theme:', error)
        const cached = tenantCacheService.getCached(tenantId)
        if (cached) {
          tenantCacheService.applyCachedTheme(cached)
          setUsedCache(true)
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadTheme()
  }, [options.tenantId])

  return { isLoading, usedCache }
}
