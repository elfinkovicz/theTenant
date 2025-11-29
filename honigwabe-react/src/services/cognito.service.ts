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
  async signUp(email: string, username: string, password: string): Promise<{ userSub: string; userConfirmed: boolean }> {
    try {
      const response = await fetch(`${awsConfig.api.user}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          username,
          password
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Registrierung fehlgeschlagen')
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
      const response = await fetch(`${awsConfig.api.user}/confirm`, {
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
      const response = await fetch(`${awsConfig.api.user}/signin`, {
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
      const response = await fetch(`${awsConfig.api.user}/resend-code`, {
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
}

export const cognitoService = new CognitoService()
