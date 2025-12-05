import axios from 'axios'
import { awsConfig } from '../config/aws-config'

export interface WhatsAppSettings {
  enabled: boolean
  phoneNumberId: string
  groupId: string
  groupName: string
}

export interface TelegramSettings {
  enabled: boolean
  botToken: string
  chatId: string
  chatName: string
}

export interface EmailSettings {
  enabled: boolean
  senderPrefix: string
  senderDomain: string
  senderName: string
}

class WhatsAppService {
  private apiUrl = awsConfig.api.user

  async getSettings(token: string): Promise<WhatsAppSettings> {
    try {
      const response = await axios.get(`${this.apiUrl}/whatsapp/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      return response.data.settings
    } catch (error: any) {
      // If API not deployed yet, use localStorage as fallback
      if (error.response?.status === 403 || error.response?.status === 404) {
        console.log('📦 Using localStorage for WhatsApp settings (API not deployed)')
        const saved = localStorage.getItem('whatsapp-settings')
        if (saved) {
          try {
            return JSON.parse(saved)
          } catch (e) {
            console.error('Failed to parse saved settings:', e)
          }
        }
      } else {
        console.error('Failed to load WhatsApp settings:', error)
      }
      return {
        enabled: false,
        phoneNumberId: '',
        groupId: '',
        groupName: ''
      }
    }
  }

  async updateSettings(settings: WhatsAppSettings, token: string): Promise<void> {
    try {
      await axios.put(
        `${this.apiUrl}/whatsapp/settings`,
        settings,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      console.log('✅ Settings saved to backend')
    } catch (error: any) {
      // Fallback to localStorage if API not available
      if (error.response?.status === 403 || error.response?.status === 404) {
        localStorage.setItem('whatsapp-settings', JSON.stringify(settings))
        console.log('💾 Settings saved to localStorage (API not deployed)')
        return
      }
      console.error('Failed to save settings:', error)
      throw error
    }
  }

  async sendTestMessage(token: string): Promise<void> {
    try {
      await axios.post(
        `${this.apiUrl}/whatsapp/test`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
    } catch (error: any) {
      if (error.response?.status === 403 || error.response?.status === 404) {
        throw new Error('WhatsApp Test-API noch nicht deployed. Bitte deploye das messaging-settings Modul.')
      }
      throw error
    }
  }

  // Telegram methods
  async getTelegramSettings(token: string): Promise<TelegramSettings> {
    try {
      const response = await axios.get(`${this.apiUrl}/telegram/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      return response.data.settings
    } catch (error: any) {
      // If API not deployed yet, use localStorage as fallback
      if (error.response?.status === 403 || error.response?.status === 404) {
        console.log('📦 Using localStorage for Telegram settings (API not deployed)')
        const saved = localStorage.getItem('telegram-settings')
        if (saved) {
          try {
            return JSON.parse(saved)
          } catch (e) {
            console.error('Failed to parse saved settings:', e)
          }
        }
      } else {
        console.error('Failed to load Telegram settings:', error)
      }
      return {
        enabled: false,
        botToken: '',
        chatId: '',
        chatName: ''
      }
    }
  }

  async updateTelegramSettings(settings: TelegramSettings, token: string): Promise<void> {
    try {
      await axios.put(
        `${this.apiUrl}/telegram/settings`,
        settings,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      console.log('✅ Settings saved to backend')
    } catch (error: any) {
      // Fallback to localStorage if API not available
      if (error.response?.status === 403 || error.response?.status === 404) {
        localStorage.setItem('telegram-settings', JSON.stringify(settings))
        console.log('💾 Settings saved to localStorage (API not deployed)')
        return
      }
      console.error('Failed to save settings:', error)
      throw error
    }
  }

  async sendTelegramTestMessage(token: string): Promise<void> {
    try {
      await axios.post(
        `${this.apiUrl}/telegram/test`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
    } catch (error: any) {
      // If API not available, try to send directly from frontend (not recommended for production)
      if (error.response?.status === 403 || error.response?.status === 404) {
        const saved = localStorage.getItem('telegram-settings')
        if (saved) {
          const settings = JSON.parse(saved)
          if (settings.botToken && settings.chatId) {
            // Send test message directly
            const message = '🧪 <b>Test-Nachricht</b>\n\nDeine Telegram-Integration funktioniert! ✅'
            const response = await axios.post(
              `https://api.telegram.org/bot${settings.botToken}/sendMessage`,
              {
                chat_id: settings.chatId,
                text: message,
                parse_mode: 'HTML'
              }
            )
            if (response.data.ok) {
              return
            }
          }
        }
      }
      throw error
    }
  }

  async getEmailSettings(token: string): Promise<EmailSettings> {
    try {
      const response = await axios.get(`${this.apiUrl}/email/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      return response.data.settings
    } catch (error: any) {
      if (error.response?.status === 403 || error.response?.status === 404) {
        console.log('📦 Using localStorage for Email settings (API not deployed)')
        const saved = localStorage.getItem('email-settings')
        if (saved) {
          try {
            return JSON.parse(saved)
          } catch (e) {
            console.error('Failed to parse saved settings:', e)
          }
        }
      } else {
        console.error('Failed to load Email settings:', error)
      }
      return {
        enabled: false,
        senderPrefix: 'newsfeed',
        senderDomain: '',
        senderName: 'Newsfeed'
      }
    }
  }

  async updateEmailSettings(settings: EmailSettings, token: string): Promise<void> {
    // Save to localStorage first
    localStorage.setItem('email-settings', JSON.stringify(settings))
    
    try {
      await axios.put(
        `${this.apiUrl}/email/settings`,
        { settings },
        { headers: { Authorization: `Bearer ${token}` } }
      )
    } catch (error: any) {
      if (error.response?.status === 403 || error.response?.status === 404) {
        console.log('📦 Email settings saved to localStorage (API not deployed)')
        return
      }
      throw error
    }
  }

  async sendEmailTestMessage(token: string): Promise<void> {
    try {
      await axios.post(
        `${this.apiUrl}/email/test`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
    } catch (error: any) {
      if (error.response?.status === 403 || error.response?.status === 404) {
        throw new Error('API nicht verfügbar - bitte Backend deployen')
      }
      throw error
    }
  }
}

export const whatsappService = new WhatsAppService()
