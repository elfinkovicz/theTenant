import { heroService, ThemeColors, DesignSettings, AnimationSettings } from './hero.service'

export interface ThemeConfig {
  themeId: string
  name: string
  colors: ThemeColors
  updatedAt?: string
}

export type { ThemeColors, DesignSettings, AnimationSettings }

// Helper function to create complete theme colors with defaults
const createThemeColors = (partial: Partial<ThemeColors>): ThemeColors => ({
  primary: '#f59e0b',
  primaryHover: '#d97706',
  secondary: '#1f2937',
  secondaryHover: '#374151',
  guest: '#f59e0b', // Default guest button color (bright/colorful for dark themes)
  guestHover: '#d97706',
  complementary: '#f59e0b', // Complementary color for accents (same as primary for dark themes)
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
  glowColor: '#f59e0b',
  ...partial
})

export const themePresets: ThemeConfig[] = [
  // === DARK THEMES ===
  { themeId: 'default', name: 'ViralTenant', colors: createThemeColors({}) },
  { themeId: 'ocean', name: 'Ocean Blue', colors: createThemeColors({
    primary: '#0ea5e9', primaryHover: '#0284c7', secondary: '#1e293b', secondaryHover: '#334155',
    guest: '#0ea5e9', guestHover: '#0284c7',
    background: '#020617', backgroundLight: '#0f172a', textSecondary: '#94a3b8', textMuted: '#64748b',
    border: '#334155', accent: '#38bdf8', info: '#0ea5e9', cardBackground: '#0f172a',
    navbarBackground: '#020617', navbarActive: '#0ea5e9', inputBackground: '#1e293b', inputPlaceholder: '#64748b', glowColor: '#0ea5e9'
  })},
  { themeId: 'forest', name: 'Forest', colors: createThemeColors({
    primary: '#10b981', primaryHover: '#059669', secondary: '#1c2e1f', secondaryHover: '#2d4a32',
    guest: '#10b981', guestHover: '#059669',
    background: '#0a1f0f', backgroundLight: '#14291a', textSecondary: '#86efac', textMuted: '#4ade80',
    border: '#2d4a32', accent: '#34d399', success: '#10b981', cardBackground: '#14291a',
    navbarBackground: '#0a1f0f', navbarActive: '#10b981', inputBackground: '#1c2e1f', inputPlaceholder: '#4ade80', glowColor: '#10b981'
  })},
  { themeId: 'purple', name: 'Royal Purple', colors: createThemeColors({
    primary: '#a855f7', primaryHover: '#9333ea', secondary: '#2e1065', secondaryHover: '#4c1d95',
    guest: '#a855f7', guestHover: '#9333ea',
    background: '#0f0520', backgroundLight: '#1e1b4b', textSecondary: '#c4b5fd', textMuted: '#a78bfa',
    border: '#4c1d95', accent: '#c084fc', info: '#a855f7', cardBackground: '#1e1b4b',
    navbarBackground: '#0f0520', navbarActive: '#a855f7', inputBackground: '#2e1065', inputPlaceholder: '#a78bfa', glowColor: '#a855f7'
  })},
  { themeId: 'crimson', name: 'Crimson', colors: createThemeColors({
    primary: '#dc2626', primaryHover: '#b91c1c', secondary: '#2d1515', secondaryHover: '#4a1f1f',
    guest: '#dc2626', guestHover: '#b91c1c',
    background: '#0f0505', backgroundLight: '#1f1010', textSecondary: '#fca5a5', textMuted: '#f87171',
    border: '#4a1f1f', accent: '#ef4444', error: '#dc2626', cardBackground: '#1f1010',
    navbarBackground: '#0f0505', navbarActive: '#dc2626', inputBackground: '#2d1515', inputPlaceholder: '#f87171', glowColor: '#dc2626'
  })},
  { themeId: 'cyber', name: 'Cyber Pink', colors: createThemeColors({
    primary: '#ec4899', primaryHover: '#db2777', secondary: '#1e1b2e', secondaryHover: '#2d2640',
    guest: '#ec4899', guestHover: '#db2777',
    background: '#0a0612', backgroundLight: '#1a1625', textSecondary: '#f9a8d4', textMuted: '#f472b6',
    border: '#2d2640', accent: '#f472b6', cardBackground: '#1a1625',
    navbarBackground: '#0a0612', navbarActive: '#ec4899', inputBackground: '#1e1b2e', inputPlaceholder: '#f472b6', glowColor: '#ec4899'
  })},
  { themeId: 'gold', name: 'Luxury Gold', colors: createThemeColors({
    primary: '#eab308', primaryHover: '#ca8a04', secondary: '#292520', secondaryHover: '#3f3a2f',
    guest: '#eab308', guestHover: '#ca8a04',
    background: '#0f0d08', backgroundLight: '#1c1a15', textSecondary: '#fde047', textMuted: '#facc15',
    border: '#3f3a2f', accent: '#facc15', warning: '#eab308', cardBackground: '#1c1a15',
    navbarBackground: '#0f0d08', navbarActive: '#eab308', inputBackground: '#292520', inputPlaceholder: '#facc15', glowColor: '#eab308'
  })},
  { themeId: 'midnight', name: 'Midnight', colors: createThemeColors({
    primary: '#3b82f6', primaryHover: '#2563eb', secondary: '#1e293b', secondaryHover: '#334155',
    guest: '#3b82f6', guestHover: '#2563eb',
    background: '#000000', backgroundLight: '#0f172a', textSecondary: '#94a3b8', textMuted: '#64748b',
    border: '#1e293b', accent: '#60a5fa', info: '#3b82f6', cardBackground: '#0f172a',
    navbarBackground: '#000000', navbarActive: '#3b82f6', inputBackground: '#1e293b', inputPlaceholder: '#64748b', glowColor: '#3b82f6'
  })},
  
  // === DUAL-COLOR THEMES ===
  { themeId: 'neon', name: 'Neon Nights', colors: createThemeColors({
    primary: '#06b6d4', primaryHover: '#0891b2', secondary: '#7c3aed', secondaryHover: '#6d28d9',
    guest: '#06b6d4', guestHover: '#0891b2',
    background: '#030712', backgroundLight: '#0f172a', textSecondary: '#a5b4fc', textMuted: '#818cf8',
    border: '#4c1d95', accent: '#f0abfc', info: '#06b6d4', cardBackground: '#1e1b4b',
    navbarBackground: '#030712', navbarActive: '#06b6d4', inputBackground: '#1e1b4b', inputPlaceholder: '#818cf8', glowColor: '#06b6d4'
  })},
  { themeId: 'fire-ice', name: 'Fire & Ice', colors: createThemeColors({
    primary: '#ef4444', primaryHover: '#dc2626', secondary: '#0ea5e9', secondaryHover: '#0284c7',
    guest: '#ef4444', guestHover: '#dc2626',
    background: '#0c0a09', backgroundLight: '#1c1917', textSecondary: '#94a3b8', textMuted: '#64748b',
    border: '#374151', accent: '#38bdf8', error: '#ef4444', info: '#0ea5e9', cardBackground: '#1c1917',
    navbarBackground: '#0c0a09', navbarActive: '#ef4444', inputBackground: '#292524', inputPlaceholder: '#64748b', glowColor: '#ef4444'
  })},
  { themeId: 'aurora', name: 'Aurora', colors: createThemeColors({
    primary: '#22c55e', primaryHover: '#16a34a', secondary: '#8b5cf6', secondaryHover: '#7c3aed',
    guest: '#22c55e', guestHover: '#16a34a',
    background: '#020617', backgroundLight: '#0f172a', textSecondary: '#a5f3fc', textMuted: '#67e8f9',
    border: '#334155', accent: '#a78bfa', success: '#22c55e', cardBackground: '#0f172a',
    navbarBackground: '#020617', navbarActive: '#22c55e', inputBackground: '#1e293b', inputPlaceholder: '#67e8f9', glowColor: '#22c55e'
  })},
  { themeId: 'tropical', name: 'Tropical', colors: createThemeColors({
    primary: '#f97316', primaryHover: '#ea580c', secondary: '#14b8a6', secondaryHover: '#0d9488',
    guest: '#f97316', guestHover: '#ea580c',
    background: '#0a1f1c', backgroundLight: '#134e4a', textSecondary: '#5eead4', textMuted: '#2dd4bf',
    border: '#2d4a46', accent: '#2dd4bf', warning: '#f97316', success: '#14b8a6', cardBackground: '#134e4a',
    navbarBackground: '#0a1f1c', navbarActive: '#f97316', inputBackground: '#1a2e2c', inputPlaceholder: '#2dd4bf', glowColor: '#f97316'
  })},
  
  // === LIGHT THEMES ===
  { themeId: 'light', name: 'Light', colors: createThemeColors({
    primary: '#3b82f6', primaryHover: '#2563eb', secondary: '#e5e7eb', secondaryHover: '#d1d5db',
    guest: '#6b7280', guestHover: '#4b5563',
    complementary: '#3b82f6', // Same as primary
    background: '#ffffff', backgroundLight: '#f9fafb', text: '#0f172a', textSecondary: '#334155', textMuted: '#64748b',
    border: '#d1d5db', accent: '#60a5fa', success: '#10b981', warning: '#f59e0b', error: '#ef4444', info: '#3b82f6',
    cardBackground: '#ffffff', navbarBackground: '#ffffff', navbarActive: '#3b82f6', inputBackground: '#f3f4f6',
    inputText: '#111827', inputPlaceholder: '#9ca3af', glowColor: '#3b82f6'
  })},
  { themeId: 'light-warm', name: 'Light Warm', colors: createThemeColors({
    primary: '#f59e0b', primaryHover: '#d97706', secondary: '#fef3c7', secondaryHover: '#fde68a',
    guest: '#92400e', guestHover: '#78350f',
    complementary: '#f59e0b', // Same as primary
    background: '#fffbeb', backgroundLight: '#fef3c7', text: '#292524', textSecondary: '#44403c', textMuted: '#57534e',
    border: '#d6d3d1', accent: '#fbbf24', success: '#10b981', warning: '#f59e0b', error: '#ef4444', info: '#3b82f6',
    cardBackground: '#ffffff', navbarBackground: '#fffbeb', navbarActive: '#f59e0b', inputBackground: '#fef3c7',
    inputText: '#1c1917', inputPlaceholder: '#a8a29e', glowColor: '#f59e0b'
  })},
  { themeId: 'light-green', name: 'Light Green', colors: createThemeColors({
    primary: '#10b981', primaryHover: '#059669', secondary: '#d1fae5', secondaryHover: '#a7f3d0',
    guest: '#047857', guestHover: '#065f46',
    complementary: '#10b981', // Same as primary
    background: '#f0fdf4', backgroundLight: '#dcfce7', text: '#052e16', textSecondary: '#14532d', textMuted: '#166534',
    border: '#86efac', accent: '#34d399', success: '#10b981', warning: '#f59e0b', error: '#ef4444', info: '#3b82f6',
    cardBackground: '#ffffff', navbarBackground: '#f0fdf4', navbarActive: '#10b981', inputBackground: '#dcfce7',
    inputText: '#14532d', inputPlaceholder: '#6ee7b7', glowColor: '#10b981'
  })},
  { themeId: 'light-purple', name: 'Light Purple', colors: createThemeColors({
    primary: '#8b5cf6', primaryHover: '#7c3aed', secondary: '#ede9fe', secondaryHover: '#ddd6fe',
    guest: '#7c3aed', guestHover: '#6d28d9',
    complementary: '#8b5cf6', // Same as primary
    background: '#faf5ff', backgroundLight: '#f3e8ff', text: '#2e1065', textSecondary: '#4c1d95', textMuted: '#6d28d9',
    border: '#c4b5fd', accent: '#a855f7', success: '#10b981', warning: '#f59e0b', error: '#ef4444', info: '#3b82f6',
    cardBackground: '#ffffff', navbarBackground: '#faf5ff', navbarActive: '#8b5cf6', inputBackground: '#f3e8ff',
    inputText: '#3b0764', inputPlaceholder: '#c4b5fd', glowColor: '#8b5cf6'
  })},
  { themeId: 'light-pink', name: 'Light Pink', colors: createThemeColors({
    primary: '#ec4899', primaryHover: '#db2777', secondary: '#fce7f3', secondaryHover: '#fbcfe8',
    guest: '#be185d', guestHover: '#9f1239',
    complementary: '#ec4899', // Same as primary
    background: '#fdf2f8', backgroundLight: '#fce7f3', text: '#500724', textSecondary: '#831843', textMuted: '#9f1239',
    border: '#f9a8d4', accent: '#f472b6', success: '#10b981', warning: '#f59e0b', error: '#ef4444', info: '#3b82f6',
    cardBackground: '#ffffff', navbarBackground: '#fdf2f8', navbarActive: '#ec4899', inputBackground: '#fce7f3',
    inputText: '#500724', inputPlaceholder: '#f9a8d4', glowColor: '#ec4899'
  })},
  { themeId: 'light-sky', name: 'Light Sky', colors: createThemeColors({
    primary: '#0ea5e9', primaryHover: '#0284c7', secondary: '#e0f2fe', secondaryHover: '#bae6fd',
    guest: '#0369a1', guestHover: '#075985',
    complementary: '#0ea5e9', // Same as primary
    background: '#f0f9ff', backgroundLight: '#e0f2fe', text: '#082f49', textSecondary: '#0c4a6e', textMuted: '#075985',
    border: '#7dd3fc', accent: '#38bdf8', success: '#10b981', warning: '#f59e0b', error: '#ef4444', info: '#0ea5e9',
    cardBackground: '#ffffff', navbarBackground: '#f0f9ff', navbarActive: '#0ea5e9', inputBackground: '#e0f2fe',
    inputText: '#0c4a6e', inputPlaceholder: '#7dd3fc', glowColor: '#0ea5e9'
  })},
  { themeId: 'light-rose', name: 'Light Rose', colors: createThemeColors({
    primary: '#f43f5e', primaryHover: '#e11d48', secondary: '#ffe4e6', secondaryHover: '#fecdd3',
    guest: '#be123c', guestHover: '#9f1239',
    complementary: '#f43f5e', // Same as primary
    background: '#fff1f2', backgroundLight: '#ffe4e6', text: '#4c0519', textSecondary: '#881337', textMuted: '#9f1239',
    border: '#fda4af', accent: '#fb7185', success: '#10b981', warning: '#f59e0b', error: '#f43f5e', info: '#3b82f6',
    cardBackground: '#ffffff', navbarBackground: '#fff1f2', navbarActive: '#f43f5e', inputBackground: '#ffe4e6',
    inputText: '#4c0519', inputPlaceholder: '#fda4af', glowColor: '#f43f5e'
  })},
  { themeId: 'light-minimal', name: 'Light Minimal', colors: createThemeColors({
    primary: '#18181b', primaryHover: '#27272a', secondary: '#f4f4f5', secondaryHover: '#e4e4e7',
    guest: '#52525b', guestHover: '#3f3f46',
    complementary: '#18181b', // Same as primary
    background: '#ffffff', backgroundLight: '#fafafa', text: '#09090b', textSecondary: '#27272a', textMuted: '#52525b',
    border: '#e4e4e7', accent: '#52525b', success: '#10b981', warning: '#f59e0b', error: '#ef4444', info: '#3b82f6',
    cardBackground: '#ffffff', navbarBackground: '#ffffff', navbarActive: '#18181b', inputBackground: '#f4f4f5',
    inputText: '#18181b', inputPlaceholder: '#a1a1aa', glowColor: '#71717a'
  })},
  
  // === SPECIAL THEMES ===
  { themeId: 'matrix', name: 'Matrix', colors: createThemeColors({
    primary: '#22c55e', primaryHover: '#16a34a', secondary: '#052e16', secondaryHover: '#14532d',
    guest: '#22c55e', guestHover: '#16a34a',
    background: '#000000', backgroundLight: '#052e16', text: '#22c55e', textSecondary: '#4ade80', textMuted: '#86efac',
    border: '#14532d', accent: '#4ade80', success: '#22c55e', warning: '#84cc16', error: '#ef4444', info: '#22c55e',
    cardBackground: '#052e16', navbarBackground: '#000000', navbarActive: '#22c55e', inputBackground: '#052e16',
    inputText: '#22c55e', inputPlaceholder: '#4ade80', glowColor: '#22c55e'
  })},
  { themeId: 'dracula', name: 'Dracula', colors: createThemeColors({
    primary: '#bd93f9', primaryHover: '#a370f7', secondary: '#44475a', secondaryHover: '#6272a4',
    guest: '#bd93f9', guestHover: '#a370f7',
    background: '#282a36', backgroundLight: '#44475a', text: '#f8f8f2', textSecondary: '#f8f8f2', textMuted: '#6272a4',
    border: '#44475a', accent: '#ff79c6', success: '#50fa7b', warning: '#f1fa8c', error: '#ff5555', info: '#8be9fd',
    cardBackground: '#44475a', navbarBackground: '#282a36', navbarActive: '#bd93f9', inputBackground: '#44475a',
    inputText: '#f8f8f2', inputPlaceholder: '#6272a4', glowColor: '#bd93f9'
  })},
  { themeId: 'nord', name: 'Nord', colors: createThemeColors({
    primary: '#88c0d0', primaryHover: '#81a1c1', secondary: '#3b4252', secondaryHover: '#434c5e',
    guest: '#88c0d0', guestHover: '#81a1c1',
    background: '#2e3440', backgroundLight: '#3b4252', text: '#eceff4', textSecondary: '#d8dee9', textMuted: '#4c566a',
    border: '#4c566a', accent: '#5e81ac', success: '#a3be8c', warning: '#ebcb8b', error: '#bf616a', info: '#88c0d0',
    cardBackground: '#3b4252', navbarBackground: '#2e3440', navbarActive: '#88c0d0', inputBackground: '#3b4252',
    inputText: '#eceff4', inputPlaceholder: '#4c566a', glowColor: '#88c0d0'
  })},
  { themeId: 'mono', name: 'Monochrome', colors: createThemeColors({
    primary: '#ffffff', primaryHover: '#e5e5e5', secondary: '#262626', secondaryHover: '#404040',
    guest: '#ffffff', guestHover: '#e5e5e5',
    background: '#000000', backgroundLight: '#171717', text: '#ffffff', textSecondary: '#a3a3a3', textMuted: '#737373',
    border: '#404040', accent: '#d4d4d4', success: '#a3a3a3', warning: '#d4d4d4', error: '#737373', info: '#e5e5e5',
    cardBackground: '#171717', navbarBackground: '#000000', navbarActive: '#ffffff', inputBackground: '#262626',
    inputText: '#ffffff', inputPlaceholder: '#737373', glowColor: '#ffffff'
  })}
]


class ThemeService {
  private readonly CACHE_KEY = 'viraltenant_theme_cache'

  async getTheme(): Promise<ThemeConfig> {
    try {
      const heroContent = await heroService.getHeroContent()
      
      if (heroContent.themeId && heroContent.themeColors) {
        const theme = {
          themeId: heroContent.themeId,
          name: heroContent.themeName || 'Custom Theme',
          colors: heroContent.themeColors,
          updatedAt: heroContent.updatedAt
        }
        this.cacheTheme(theme)
        return theme
      }
    } catch (error) {
      console.error('Failed to load theme from hero:', error)
    }
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
    await heroService.updateHeroContent({
      themeId: theme.themeId,
      themeName: theme.name,
      themeColors: theme.colors
    }, token)
    this.cacheTheme(theme)
  }

  applyTheme(colors: ThemeColors, designSettings?: DesignSettings) {
    const root = document.documentElement
    
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      return result 
        ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`
        : '0 0 0'
    }

    // Apply all colors
    root.style.setProperty('--color-primary', hexToRgb(colors.primary))
    root.style.setProperty('--color-primary-hover', hexToRgb(colors.primaryHover))
    root.style.setProperty('--color-secondary', hexToRgb(colors.secondary))
    root.style.setProperty('--color-secondary-hover', hexToRgb(colors.secondaryHover))
    root.style.setProperty('--color-guest', hexToRgb(colors.guest || colors.secondary))
    root.style.setProperty('--color-guest-hover', hexToRgb(colors.guestHover || colors.secondaryHover))
    root.style.setProperty('--color-complementary', hexToRgb(colors.complementary || colors.primary))
    root.style.setProperty('--color-background', hexToRgb(colors.background))
    root.style.setProperty('--color-background-light', hexToRgb(colors.backgroundLight))
    root.style.setProperty('--color-text', hexToRgb(colors.text))
    root.style.setProperty('--color-text-secondary', hexToRgb(colors.textSecondary))
    root.style.setProperty('--color-text-muted', hexToRgb(colors.textMuted || colors.textSecondary))
    root.style.setProperty('--color-border', hexToRgb(colors.border))
    root.style.setProperty('--color-accent', hexToRgb(colors.accent))
    root.style.setProperty('--color-success', hexToRgb(colors.success || '#10b981'))
    root.style.setProperty('--color-warning', hexToRgb(colors.warning || '#f59e0b'))
    root.style.setProperty('--color-error', hexToRgb(colors.error || '#ef4444'))
    root.style.setProperty('--color-info', hexToRgb(colors.info || '#3b82f6'))
    root.style.setProperty('--color-card-background', hexToRgb(colors.cardBackground || colors.backgroundLight))
    root.style.setProperty('--color-navbar-background', hexToRgb(colors.navbarBackground || colors.background))
    root.style.setProperty('--color-navbar-active', hexToRgb(colors.navbarActive || colors.primary))
    root.style.setProperty('--color-input-background', hexToRgb(colors.inputBackground || colors.secondary))
    root.style.setProperty('--color-input-text', hexToRgb(colors.inputText || colors.text))
    root.style.setProperty('--color-input-placeholder', hexToRgb(colors.inputPlaceholder || colors.textMuted || '#6b7280'))
    root.style.setProperty('--color-glow', hexToRgb(colors.glowColor || colors.primary))

    // Clear any inline background style on body so CSS variable takes effect
    document.body.style.backgroundColor = ''

    // Apply design settings
    if (designSettings) {
      root.style.setProperty('--button-roundness', `${designSettings.buttonRoundness}px`)
      root.style.setProperty('--card-roundness', `${designSettings.cardRoundness}px`)
      root.style.setProperty('--card-padding', `${designSettings.cardPadding}px`)
      root.style.setProperty('--border-width', `${designSettings.borderWidth}px`)
      root.style.setProperty('--font-size-base', `${designSettings.fontSize}px`)
      root.style.setProperty('--spacing-multiplier', `${designSettings.spacing}`)
      root.style.setProperty('--font-family', designSettings.fontFamily)
      
      // Load Google Fonts if needed
      this.loadGoogleFont(designSettings.fontFamily)
      
      const buttonSizes = { small: '0.75rem 1.25rem', medium: '0.75rem 1.5rem', large: '1rem 2rem' }
      root.style.setProperty('--button-padding', buttonSizes[designSettings.buttonSize])

      if (designSettings.animations) {
        const speeds = { slow: '0.5s', normal: '0.3s', fast: '0.15s' }
        root.style.setProperty('--animation-speed', speeds[designSettings.animations.speed])
        root.style.setProperty('--hover-scale', designSettings.animations.hoverEnabled ? `${designSettings.animations.hoverScale}` : '1')
        root.style.setProperty('--transition-type', designSettings.animations.transitionType)
        
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

  private loadGoogleFont(fontFamily: string) {
    // Extract font name from CSS font-family string
    const fontMatch = fontFamily.match(/'([^']+)'/)
    if (!fontMatch) return // Not a Google Font (system font)
    
    const fontName = fontMatch[1]
    const fontId = `google-font-${fontName.replace(/\s+/g, '-').toLowerCase()}`
    
    // Check if already loaded
    if (document.getElementById(fontId)) return
    
    // Complete map of all available Google Fonts
    const googleFonts: { [key: string]: string } = {
      'Inter': 'Inter:wght@400;500;600;700',
      'Roboto': 'Roboto:wght@400;500;700',
      'Open Sans': 'Open+Sans:wght@400;500;600;700',
      'Montserrat': 'Montserrat:wght@400;500;600;700',
      'Poppins': 'Poppins:wght@400;500;600;700',
      'Outfit': 'Outfit:wght@400;500;600;700',
      'Space Grotesk': 'Space+Grotesk:wght@400;500;600;700',
      'Playfair Display': 'Playfair+Display:wght@400;500;600;700',
      'Cormorant Garamond': 'Cormorant+Garamond:wght@400;500;600;700',
      'Libre Baskerville': 'Libre+Baskerville:wght@400;700',
      'Nunito': 'Nunito:wght@400;500;600;700',
      'Quicksand': 'Quicksand:wght@400;500;600;700',
      'Comfortaa': 'Comfortaa:wght@400;500;600;700',
      'Source Sans 3': 'Source+Sans+3:wght@400;500;600;700',
      'Work Sans': 'Work+Sans:wght@400;500;600;700',
      'Raleway': 'Raleway:wght@400;500;600;700',
      'Lato': 'Lato:wght@400;700',
      'Oswald': 'Oswald:wght@400;500;600;700',
      'Merriweather': 'Merriweather:wght@400;700'
    }
    
    const fontSpec = googleFonts[fontName]
    if (!fontSpec) return
    
    // Load the font with display=swap for better performance
    const link = document.createElement('link')
    link.id = fontId
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${fontSpec}&display=swap`
    document.head.appendChild(link)
    
    console.log(`[Theme] Loaded font: ${fontName}`)
  }
}

export const themeService = new ThemeService()
