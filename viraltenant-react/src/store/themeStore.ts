import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ThemeState {
  isDark: boolean
  toggleTheme: () => void
  setTheme: (isDark: boolean) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      isDark: true,
      
      toggleTheme: () => {
        set((state) => {
          const newIsDark = !state.isDark
          document.documentElement.classList.toggle('dark', newIsDark)
          return { isDark: newIsDark }
        })
      },
      
      setTheme: (isDark: boolean) => {
        document.documentElement.classList.toggle('dark', isDark)
        set({ isDark })
      }
    }),
    {
      name: 'theme-storage'
    }
  )
)
