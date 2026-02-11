import { useEffect, useState } from 'react'
import { themeService } from '../services/theme.service'
import { heroService } from '../services/hero.service'
import { tenantCacheService } from '../services/tenantCache.service'
import { tenantService } from '../services/tenant.service'

export const useTheme = () => {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const loadTheme = async () => {
      try {
        // Wait for tenant resolution
        const tenant = await tenantService.waitForResolution()
        const tenantId = tenant.tenantId
        
        console.log('[useTheme] Loading theme for tenant:', tenantId)

        // Load fresh data
        const heroContent = await heroService.getHeroContent()
        const theme = await themeService.getTheme()
        
        // Apply theme
        if (heroContent.designSettings) {
          themeService.applyTheme(theme.colors, heroContent.designSettings)
        } else {
          themeService.applyTheme(theme.colors)
        }

        // Update cache
        if (heroContent.themeColors && heroContent.designSettings) {
          tenantCacheService.cache(tenantId, heroContent)
        }
        
        setIsReady(true)
        console.log('[useTheme] Theme applied for tenant:', tenantId)
      } catch (error) {
        console.error('[useTheme] Failed to load theme:', error)
        setIsReady(true)
      }
    }

    loadTheme()
  }, [])

  return { isReady }
}
