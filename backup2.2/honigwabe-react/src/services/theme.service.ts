import { heroService, ThemeColors, DesignSettings, AnimationSettings } from './hero.service'

export interface ThemeConfig {
  themeId: string
  name: string
  colors: ThemeColors
  updatedAt?: string
}

export type { ThemeColors, DesignSettings, AnimationSettings }

export const themePresets: ThemeConfig[] = [
  {
    themeId: 'default',
    name: 'Honigwabe (Standard)',
    colors: {
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
    }
  },
  {
    themeId: 'ocean',
    name: 'Ocean Blue',
    colors: {
      primary: '#0ea5e9',
      primaryHover: '#0284c7',
      secondary: '#1e293b',
      secondaryHover: '#334155',
      background: '#020617',
      backgroundLight: '#0f172a',
      text: '#ffffff',
      textSecondary: '#94a3b8',
      border: '#334155',
      accent: '#38bdf8'
    }
  },
  {
    themeId: 'forest',
    name: 'Forest Green',
    colors: {
      primary: '#10b981',
      primaryHover: '#059669',
      secondary: '#1c2e1f',
      secondaryHover: '#2d4a32',
      background: '#0a1f0f',
      backgroundLight: '#14291a',
      text: '#ffffff',
      textSecondary: '#86efac',
      border: '#2d4a32',
      accent: '#34d399'
    }
  },
  {
    themeId: 'sunset',
    name: 'Sunset Orange',
    colors: {
      primary: '#f97316',
      primaryHover: '#ea580c',
      secondary: '#292524',
      secondaryHover: '#44403c',
      background: '#0c0a09',
      backgroundLight: '#1c1917',
      text: '#ffffff',
      textSecondary: '#a8a29e',
      border: '#44403c',
      accent: '#fb923c'
    }
  },
  {
    themeId: 'purple',
    name: 'Royal Purple',
    colors: {
      primary: '#a855f7',
      primaryHover: '#9333ea',
      secondary: '#2e1065',
      secondaryHover: '#4c1d95',
      background: '#0f0520',
      backgroundLight: '#1e1b4b',
      text: '#ffffff',
      textSecondary: '#c4b5fd',
      border: '#4c1d95',
      accent: '#c084fc'
    }
  },
  {
    themeId: 'crimson',
    name: 'Crimson Red',
    colors: {
      primary: '#dc2626',
      primaryHover: '#b91c1c',
      secondary: '#2d1515',
      secondaryHover: '#4a1f1f',
      background: '#0f0505',
      backgroundLight: '#1f1010',
      text: '#ffffff',
      textSecondary: '#fca5a5',
      border: '#4a1f1f',
      accent: '#ef4444'
    }
  },
  {
    themeId: 'cyber',
    name: 'Cyber Pink',
    colors: {
      primary: '#ec4899',
      primaryHover: '#db2777',
      secondary: '#1e1b2e',
      secondaryHover: '#2d2640',
      background: '#0a0612',
      backgroundLight: '#1a1625',
      text: '#ffffff',
      textSecondary: '#f9a8d4',
      border: '#2d2640',
      accent: '#f472b6'
    }
  },
  {
    themeId: 'gold',
    name: 'Luxury Gold',
    colors: {
      primary: '#eab308',
      primaryHover: '#ca8a04',
      secondary: '#292520',
      secondaryHover: '#3f3a2f',
      background: '#0f0d08',
      backgroundLight: '#1c1a15',
      text: '#ffffff',
      textSecondary: '#fde047',
      border: '#3f3a2f',
      accent: '#facc15'
    }
  },
  {
    themeId: 'mint',
    name: 'Fresh Mint',
    colors: {
      primary: '#14b8a6',
      primaryHover: '#0d9488',
      secondary: '#1a2e2c',
      secondaryHover: '#2d4a46',
      background: '#051614',
      backgroundLight: '#0f2622',
      text: '#ffffff',
      textSecondary: '#5eead4',
      border: '#2d4a46',
      accent: '#2dd4bf'
    }
  },
  {
    themeId: 'midnight',
    name: 'Midnight Blue',
    colors: {
      primary: '#3b82f6',
      primaryHover: '#2563eb',
      secondary: '#1e293b',
      secondaryHover: '#334155',
      background: '#000000',
      backgroundLight: '#0f172a',
      text: '#ffffff',
      textSecondary: '#94a3b8',
      border: '#1e293b',
      accent: '#60a5fa'
    }
  }
]

class ThemeService {
  private readonly CACHE_KEY = 'honigwabe_theme_cache'

  async getTheme(): Promise<ThemeConfig> {
    try {
      // Load from hero content (includes theme data)
      const heroContent = await heroService.getHeroContent()
      
      if (heroContent.themeId && heroContent.themeColors) {
        const theme = {
          themeId: heroContent.themeId,
          name: heroContent.themeName || 'Custom Theme',
          colors: heroContent.themeColors,
          updatedAt: heroContent.updatedAt
        }
        
        // Cache theme for FOUC prevention
        this.cacheTheme(theme)
        
        return theme
      }
    } catch (error) {
      console.error('Failed to load theme from hero:', error)
    }

    // Return default theme
    const defaultTheme = themePresets[0]
    this.cacheTheme(defaultTheme)
    return defaultTheme
  }

  private cacheTheme(theme: ThemeConfig): void {
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(theme))
    } catch (error) {
      console.warn('Failed to cache theme:', error)
    }
  }

  async updateTheme(theme: ThemeConfig, token: string): Promise<void> {
    // Save theme data to hero endpoint
    await heroService.updateHeroContent({
      themeId: theme.themeId,
      themeName: theme.name,
      themeColors: theme.colors
    }, token)
    
    // Update cache immediately
    this.cacheTheme(theme)
  }

  applyTheme(colors: ThemeColors, designSettings?: DesignSettings) {
    const root = document.documentElement
    
    // Convert hex to RGB for Tailwind
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      return result 
        ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`
        : '0 0 0'
    }

    // Apply colors
    root.style.setProperty('--color-primary', hexToRgb(colors.primary))
    root.style.setProperty('--color-primary-hover', hexToRgb(colors.primaryHover))
    root.style.setProperty('--color-secondary', hexToRgb(colors.secondary))
    root.style.setProperty('--color-secondary-hover', hexToRgb(colors.secondaryHover))
    root.style.setProperty('--color-background', hexToRgb(colors.background))
    root.style.setProperty('--color-background-light', hexToRgb(colors.backgroundLight))
    root.style.setProperty('--color-text', hexToRgb(colors.text))
    root.style.setProperty('--color-text-secondary', hexToRgb(colors.textSecondary))
    root.style.setProperty('--color-border', hexToRgb(colors.border))
    root.style.setProperty('--color-accent', hexToRgb(colors.accent))

    // Apply design settings
    if (designSettings) {
      root.style.setProperty('--button-roundness', `${designSettings.buttonRoundness}px`)
      root.style.setProperty('--card-roundness', `${designSettings.cardRoundness}px`)
      root.style.setProperty('--card-padding', `${designSettings.cardPadding}px`)
      root.style.setProperty('--border-width', `${designSettings.borderWidth}px`)
      root.style.setProperty('--font-size-base', `${designSettings.fontSize}px`)
      root.style.setProperty('--spacing-multiplier', `${designSettings.spacing}`)
      root.style.fontFamily = designSettings.fontFamily
      
      // Button size classes
      const buttonSizes = {
        small: '0.75rem 1.25rem',
        medium: '0.75rem 1.5rem',
        large: '1rem 2rem'
      }
      root.style.setProperty('--button-padding', buttonSizes[designSettings.buttonSize])

      // Animation settings
      if (designSettings.animations) {
        const speeds = {
          slow: '0.5s',
          normal: '0.3s',
          fast: '0.15s'
        }
        root.style.setProperty('--animation-speed', speeds[designSettings.animations.speed])
        root.style.setProperty('--hover-scale', designSettings.animations.hoverEnabled ? `${designSettings.animations.hoverScale}` : '1')
        root.style.setProperty('--transition-type', designSettings.animations.transitionType)
        
        // Toggle animation classes
        if (!designSettings.animations.scrollAnimations) {
          root.classList.add('no-scroll-animations')
        } else {
          root.classList.remove('no-scroll-animations')
        }
        
        if (!designSettings.animations.pageTransitions) {
          root.classList.add('no-page-transitions')
        } else {
          root.classList.remove('no-page-transitions')
        }
      }
    }
  }
}

export const themeService = new ThemeService()
