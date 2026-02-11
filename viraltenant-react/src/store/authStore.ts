import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { cognitoService } from '../services/cognito.service'
import { tenantService } from '../services/tenant.service'

interface User {
  id: string
  email: string
  username: string
  role: 'member' | 'admin'
  subscription?: 'free' | 'premium'
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  accessToken: string | null
  refreshToken: string | null
  tokenExpiry: number | null
  needsEmailConfirmation: boolean
  pendingEmail: string | null
  isRefreshing: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string) => Promise<void>
  confirmEmail: (email: string, code: string) => Promise<void>
  resendCode: (email: string) => Promise<void>
  forgotPassword: (email: string) => Promise<void>
  confirmForgotPassword: (email: string, code: string, newPassword: string) => Promise<void>
  logout: () => void
  updateUser: (user: Partial<User>) => void
  isTokenExpired: () => boolean
  isTokenExpiringSoon: () => boolean
  refreshAccessToken: () => Promise<boolean>
  forceLogout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      tokenExpiry: null,
      needsEmailConfirmation: false,
      pendingEmail: null,
      isRefreshing: false,
      
      login: async (email: string, password: string) => {
        try {
          const tokens = await cognitoService.signIn(email, password)
          const user = await cognitoService.getCurrentUser(tokens.accessToken)
          
          if (user) {
            // Token läuft nach 60 Minuten ab
            const tokenExpiry = Date.now() + (60 * 60 * 1000) // 1 Stunde
            
            set({
              user: {
                id: user.email,
                email: user.email,
                username: user.username,
                role: 'member',
                subscription: 'free'
              },
              isAuthenticated: true,
              accessToken: tokens.accessToken,
              refreshToken: tokens.refreshToken || null,
              tokenExpiry,
              needsEmailConfirmation: false,
              pendingEmail: null
            })

            // Auto-join current tenant after successful login
            try {
              await tenantService.joinTenant(tokens.accessToken)
            } catch (joinError) {
              console.warn('Could not auto-join tenant:', joinError)
              // Don't fail login if join fails
            }
          }
        } catch (error: any) {
          console.error('Login failed:', error)
          throw new Error(error.message || 'Login fehlgeschlagen')
        }
      },
      
      register: async (email: string, username: string, password: string) => {
        try {
          const result = await cognitoService.signUp(email, username, password)
          
          // User muss E-Mail bestätigen
          set({
            needsEmailConfirmation: true,
            pendingEmail: email,
            isAuthenticated: false,
            user: null
          })
          
          if (result.userConfirmed) {
            // Auto-Login wenn bereits bestätigt
            await get().login(email, password)
          }
        } catch (error: any) {
          console.error('Registration failed:', error)
          throw new Error(error.message || 'Registrierung fehlgeschlagen')
        }
      },
      
      confirmEmail: async (email: string, code: string) => {
        try {
          await cognitoService.confirmSignUp(email, code)
          set({
            needsEmailConfirmation: false,
            pendingEmail: null
          })
        } catch (error: any) {
          console.error('Email confirmation failed:', error)
          throw new Error(error.message || 'Bestätigung fehlgeschlagen')
        }
      },
      
      resendCode: async (email: string) => {
        try {
          await cognitoService.resendConfirmationCode(email)
        } catch (error: any) {
          console.error('Resend code failed:', error)
          throw new Error(error.message || 'Fehler beim Senden des Codes')
        }
      },
      
      forgotPassword: async (email: string) => {
        try {
          await cognitoService.forgotPassword(email)
        } catch (error: any) {
          console.error('Forgot password failed:', error)
          throw new Error(error.message || 'Fehler beim Senden des Reset-Codes')
        }
      },
      
      confirmForgotPassword: async (email: string, code: string, newPassword: string) => {
        try {
          await cognitoService.confirmForgotPassword(email, code, newPassword)
        } catch (error: any) {
          console.error('Confirm forgot password failed:', error)
          throw new Error(error.message || 'Fehler beim Zurücksetzen des Passworts')
        }
      },
      
      logout: async () => {
        try {
          await cognitoService.signOut()
        } catch (error) {
          console.error('Logout error:', error)
        }
        set({ 
          user: null, 
          isAuthenticated: false,
          accessToken: null,
          refreshToken: null,
          tokenExpiry: null,
          needsEmailConfirmation: false,
          pendingEmail: null,
          isRefreshing: false
        })
      },
      
      // Erzwungener Logout ohne Cognito-Call (für abgelaufene Tokens)
      forceLogout: () => {
        console.warn('Force logout - Token expired or invalid')
        set({ 
          user: null, 
          isAuthenticated: false,
          accessToken: null,
          refreshToken: null,
          tokenExpiry: null,
          needsEmailConfirmation: false,
          pendingEmail: null,
          isRefreshing: false
        })
      },
      
      // Prüft ob Token abgelaufen ist
      isTokenExpired: () => {
        const { tokenExpiry } = get()
        if (!tokenExpiry) return true
        return Date.now() >= tokenExpiry
      },
      
      // Prüft ob Token bald abläuft (5 Minuten vorher)
      isTokenExpiringSoon: () => {
        const { tokenExpiry } = get()
        if (!tokenExpiry) return true
        // 5 Minuten vor Ablauf refreshen
        return Date.now() >= (tokenExpiry - 5 * 60 * 1000)
      },
      
      // Refresh Access Token
      refreshAccessToken: async () => {
        const { refreshToken, isRefreshing } = get()
        
        // Verhindere parallele Refresh-Aufrufe
        if (isRefreshing) {
          console.log('Token refresh already in progress')
          return false
        }
        
        if (!refreshToken) {
          console.warn('No refresh token available')
          get().forceLogout()
          return false
        }
        
        set({ isRefreshing: true })
        
        try {
          console.log('Refreshing access token...')
          const tokens = await cognitoService.refreshAccessToken(refreshToken)
          
          // Neues Token-Expiry setzen (60 Minuten)
          const tokenExpiry = Date.now() + (60 * 60 * 1000)
          
          set({
            accessToken: tokens.accessToken,
            tokenExpiry,
            isRefreshing: false
          })
          
          console.log('Access token refreshed successfully')
          return true
        } catch (error) {
          console.error('Token refresh failed:', error)
          set({ isRefreshing: false })
          // Refresh Token ist ungültig - User muss sich neu einloggen
          get().forceLogout()
          return false
        }
      },
      
      updateUser: (userData) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null
        }))
      }
    }),
    {
      name: 'auth-storage'
    }
  )
)
