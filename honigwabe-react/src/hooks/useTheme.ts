import { useEffect } from 'react'
import { themeService } from '../services/theme.service'

export const useTheme = () => {
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const theme = await themeService.getTheme()
        themeService.applyTheme(theme.colors)
      } catch (error) {
        console.error('Failed to load theme:', error)
      }
    }

    loadTheme()
  }, [])
}
