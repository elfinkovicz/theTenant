import { awsConfig } from '../config/aws-config'

interface CognitoUser {
  username: string
  email: string
  sub: string
}

class CognitoService {
  /**
   * Registriert einen neuen User
   */
  async signUp(email: string, username: string, password: string, tenantId?: string): Promise<{ userSub: string; userConfirmed: boolean }> {
    try {
      // Get current tenant ID if not provided
      const currentTenantId = tenantId || localStorage.getItem('currentTenantId') || undefined;
      
      const response = await fetch(`${awsConfig.api.user}/api/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentTenantId && { 'X-Creator-ID': currentTenantId })
        },
        body: JSON.stringify({
          email,
          username,
          password,
          tenantId: currentTenantId
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Registrierung fehlgeschlagen' }))
        throw new Error(error.error || error.message || 'Registrierung fehlgeschlagen')
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('SignUp error:', error)
      throw error
    }
  }

  /**
   * Bestätigt die E-Mail mit dem Code
   */
  async confirmSignUp(email: string, code: string): Promise<void> {
    try {
      const response = await fetch(`${awsConfig.api.user}/api/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          code
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Bestätigung fehlgeschlagen')
      }
    } catch (error) {
      console.error('ConfirmSignUp error:', error)
      throw error
    }
  }

  /**
   * Login
   */
  async signIn(email: string, password: string): Promise<{ accessToken: string; idToken: string; refreshToken: string }> {
    try {
      const response = await fetch(`${awsConfig.api.user}/api/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Login fehlgeschlagen')
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('SignIn error:', error)
      throw error
    }
  }

  /**
   * Refresh Access Token using Refresh Token
   */
  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; idToken: string }> {
    try {
      const response = await fetch(`${awsConfig.api.user}/api/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Token refresh fehlgeschlagen' }))
        throw new Error(error.message || 'Token refresh fehlgeschlagen')
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('RefreshToken error:', error)
      throw error
    }
  }

  /**
   * Logout
   */
  async signOut(): Promise<void> {
    // Clear local storage
    localStorage.removeItem('auth-storage')
  }

  /**
   * Holt User-Informationen
   */
  async getCurrentUser(accessToken: string): Promise<CognitoUser | null> {
    try {
      const response = await fetch(`${awsConfig.api.user}/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        return null
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('GetCurrentUser error:', error)
      return null
    }
  }

  /**
   * Sendet Bestätigungscode erneut
   */
  async resendConfirmationCode(email: string): Promise<void> {
    try {
      const response = await fetch(`${awsConfig.api.user}/api/resend-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Fehler beim Senden des Codes')
      }
    } catch (error) {
      console.error('ResendCode error:', error)
      throw error
    }
  }

  /**
   * Initiiert Passwort-Reset (sendet Code per E-Mail)
   */
  async forgotPassword(email: string): Promise<void> {
    try {
      const response = await fetch(`${awsConfig.api.user}/api/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ 
          error: 'Fehler beim Senden des Reset-Codes',
          status: response.status,
          statusText: response.statusText
        }))
        console.error('ForgotPassword API error:', error)
        throw new Error(error.error || error.message || `HTTP ${response.status}: ${response.statusText}`)
      }
    } catch (error: any) {
      console.error('ForgotPassword error:', error)
      if (error.message === 'Failed to fetch') {
        throw new Error('Netzwerkfehler. Bitte prüfe deine Internetverbindung.')
      }
      throw error
    }
  }

  /**
   * Bestätigt Passwort-Reset mit Code und neuem Passwort
   */
  async confirmForgotPassword(email: string, code: string, newPassword: string): Promise<void> {
    try {
      const response = await fetch(`${awsConfig.api.user}/api/confirm-forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          code,
          newPassword
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ 
          error: 'Fehler beim Zurücksetzen des Passworts',
          status: response.status,
          statusText: response.statusText
        }))
        console.error('ConfirmForgotPassword API error:', error)
        throw new Error(error.error || error.message || `HTTP ${response.status}: ${response.statusText}`)
      }
    } catch (error: any) {
      console.error('ConfirmForgotPassword error:', error)
      // Wenn es ein Netzwerkfehler ist, gib mehr Details
      if (error.message === 'Failed to fetch') {
        throw new Error('Netzwerkfehler. Bitte prüfe deine Internetverbindung.')
      }
      throw error
    }
  }
}

export const cognitoService = new CognitoService()
