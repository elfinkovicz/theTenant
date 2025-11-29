import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { cognitoService } from '../services/cognito.service'

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
  needsEmailConfirmation: boolean
  pendingEmail: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string) => Promise<void>
  confirmEmail: (email: string, code: string) => Promise<void>
  resendCode: (email: string) => Promise<void>
  logout: () => void
  updateUser: (user: Partial<User>) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      accessToken: null,
      needsEmailConfirmation: false,
      pendingEmail: null,
      
      login: async (email: string, password: string) => {
        try {
          const tokens = await cognitoService.signIn(email, password)
          const user = await cognitoService.getCurrentUser(tokens.accessToken)
          
          if (user) {
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
              needsEmailConfirmation: false,
              pendingEmail: null
            })
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
      
      logout: async () => {
        await cognitoService.signOut()
        set({ 
          user: null, 
          isAuthenticated: false,
          accessToken: null,
          needsEmailConfirmation: false,
          pendingEmail: null
        })
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
