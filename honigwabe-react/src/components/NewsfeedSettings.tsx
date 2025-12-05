import { useState, useEffect } from 'react'
import { Save, X, MessageCircle, Phone, Users, Send, Mail } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { whatsappService, WhatsAppSettings, TelegramSettings, EmailSettings } from '../services/whatsapp.service'
import { awsConfig } from '../config/aws-config'

interface NewsfeedSettingsProps {
  onClose: () => void
}

type TabType = 'whatsapp' | 'telegram' | 'email'

export const NewsfeedSettings = ({ onClose }: NewsfeedSettingsProps) => {
  const { accessToken } = useAuthStore()
  const [activeTab, setActiveTab] = useState<TabType>('whatsapp')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<WhatsAppSettings>({
    enabled: false,
    phoneNumberId: '',
    groupId: '',
    groupName: ''
  })
  const [telegramSettings, setTelegramSettings] = useState<TelegramSettings>({
    enabled: false,
    botToken: '',
    chatId: '',
    chatName: ''
  })
  const [emailSettings, setEmailSettings] = useState<EmailSettings>({
    enabled: false,
    senderPrefix: 'newsfeed',
    senderDomain: awsConfig.domain || 'honigwabe.live',
    senderName: 'Newsfeed'
  })

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    if (!accessToken) {
      setLoading(false)
      return
    }

    try {
      const [whatsappSettings, telegramSettingsData, emailSettingsData] = await Promise.all([
        whatsappService.getSettings(accessToken),
        whatsappService.getTelegramSettings(accessToken),
        whatsappService.getEmailSettings(accessToken)
      ])
      setSettings(whatsappSettings)
      setTelegramSettings(telegramSettingsData)
      setEmailSettings(emailSettingsData)
    } catch (error) {
      // Silently fail - fallback to localStorage is handled in service
      console.log('Using local settings (API not yet deployed)')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!accessToken) return

    setSaving(true)
    try {
      if (activeTab === 'whatsapp') {
        await whatsappService.updateSettings(settings, accessToken)
      } else if (activeTab === 'telegram') {
        await whatsappService.updateTelegramSettings(telegramSettings, accessToken)
      } else {
        await whatsappService.updateEmailSettings(emailSettings, accessToken)
      }
      alert('✅ Einstellungen erfolgreich gespeichert!\n\n💡 Hinweis: Einstellungen werden lokal gespeichert, bis das Backend deployed wird.')
      onClose()
    } catch (error: any) {
      console.error('Failed to save settings:', error)
      // Don't show error if it's just API not deployed
      if (error.response?.status === 403 || error.response?.status === 404) {
        alert('✅ Einstellungen lokal gespeichert!\n\n💡 Für persistente Speicherung deploye das messaging-settings Modul.')
        onClose()
      } else {
        const errorMsg = error.response?.data?.error || error.message || 'Unbekannter Fehler'
        alert(`❌ Fehler beim Speichern: ${errorMsg}`)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleTestMessage = async () => {
    if (!accessToken) return

    if (!settings.enabled || !settings.phoneNumberId || !settings.groupId) {
      alert('Bitte fülle alle Felder aus und aktiviere die Integration')
      return
    }

    try {
      await whatsappService.sendTestMessage(accessToken)
      alert('✅ Test-Nachricht wurde erfolgreich gesendet!')
    } catch (error: any) {
      console.error('Failed to send test message:', error)
      const errorMsg = error.response?.data?.error || error.message || 'Unbekannter Fehler'
      alert(`❌ Fehler beim Senden: ${errorMsg}`)
    }
  }

  const handleTelegramTestMessage = async () => {
    if (!accessToken) return

    if (!telegramSettings.enabled || !telegramSettings.botToken || !telegramSettings.chatId) {
      alert('⚠️ Bitte fülle alle Felder aus und aktiviere die Integration')
      return
    }

    try {
      await whatsappService.sendTelegramTestMessage(accessToken)
      alert('✅ Test-Nachricht wurde erfolgreich gesendet!\n\nÜberprüfe deinen Telegram-Kanal.')
    } catch (error: any) {
      console.error('Failed to send test message:', error)
      const errorMsg = error.response?.data?.error || error.message || 'Unbekannter Fehler'
      alert(`❌ Fehler beim Senden: ${errorMsg}\n\nÜberprüfe:\n- Bot Token korrekt?\n- Chat ID korrekt?\n- Bot ist Admin in der Gruppe?`)
    }
  }

  const handleEmailTestMessage = async () => {
    if (!accessToken) return

    if (!emailSettings.enabled || !emailSettings.senderPrefix) {
      alert('⚠️ Bitte fülle alle Felder aus und aktiviere die Integration')
      return
    }

    try {
      await whatsappService.sendEmailTestMessage(accessToken)
      alert('✅ Test-E-Mail wurde erfolgreich versendet!\n\nÜberprüfe dein E-Mail-Postfach.')
    } catch (error: any) {
      console.error('Failed to send test email:', error)
      const errorMsg = error.response?.data?.error || error.message || 'Unbekannter Fehler'
      alert(`❌ Fehler beim Senden: ${errorMsg}\n\nÜberprüfe:\n- Sender-Prefix korrekt?\n- Domain in SES verifiziert?`)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-dark-900 rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-dark-800 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Newsfeed Einstellungen</h2>
          <button onClick={onClose} className="text-dark-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-dark-800">
          <div className="flex">
            <button
              onClick={() => setActiveTab('whatsapp')}
              className={`flex-1 px-6 py-4 font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'whatsapp'
                  ? 'bg-primary-600 text-white'
                  : 'bg-dark-800 text-dark-400 hover:text-white hover:bg-dark-700'
              }`}
            >
              <MessageCircle size={20} />
              WhatsApp
            </button>
            <button
              onClick={() => setActiveTab('telegram')}
              className={`flex-1 px-6 py-4 font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'telegram'
                  ? 'bg-primary-600 text-white'
                  : 'bg-dark-800 text-dark-400 hover:text-white hover:bg-dark-700'
              }`}
            >
              <Send size={20} />
              Telegram
            </button>
            <button
              onClick={() => setActiveTab('email')}
              className={`flex-1 px-6 py-4 font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'email'
                  ? 'bg-primary-600 text-white'
                  : 'bg-dark-800 text-dark-400 hover:text-white hover:bg-dark-700'
              }`}
            >
              <Mail size={20} />
              E-Mail
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {activeTab === 'whatsapp' ? (
            <div>
            <div className="flex items-center gap-3 mb-4">
              <MessageCircle size={24} className="text-green-500" />
              <h3 className="text-xl font-semibold">WhatsApp Integration</h3>
            </div>
            
            <p className="text-dark-400 mb-4">
              Sende neue Newsfeed-Posts automatisch an eine WhatsApp-Gruppe
            </p>

            {/* Enable Toggle */}
            <div className="mb-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                  className="w-5 h-5 rounded"
                />
                <span className="font-medium">WhatsApp-Benachrichtigungen aktivieren</span>
              </label>
            </div>

            {/* Settings Fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  <Phone size={16} className="inline mr-2" />
                  WhatsApp Phone Number ID
                </label>
                <input
                  type="text"
                  value={settings.phoneNumberId}
                  onChange={(e) => setSettings({ ...settings, phoneNumberId: e.target.value })}
                  placeholder="1234567890"
                  className="input w-full"
                  disabled={!settings.enabled}
                />
                <p className="text-xs text-dark-500 mt-1">
                  Aus AWS End User Messaging Console
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  <Users size={16} className="inline mr-2" />
                  WhatsApp Group ID
                </label>
                <input
                  type="text"
                  value={settings.groupId}
                  onChange={(e) => setSettings({ ...settings, groupId: e.target.value })}
                  placeholder="120363XXXXXXXXXX@g.us"
                  className="input w-full font-mono text-sm"
                  disabled={!settings.enabled}
                />
                <p className="text-xs text-dark-500 mt-1">
                  Format: 120363XXXXXXXXXX@g.us
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Gruppen-Name (optional)
                </label>
                <input
                  type="text"
                  value={settings.groupName}
                  onChange={(e) => setSettings({ ...settings, groupName: e.target.value })}
                  placeholder="Meine WhatsApp Gruppe"
                  className="input w-full"
                  disabled={!settings.enabled}
                />
                <p className="text-xs text-dark-500 mt-1">
                  Zur besseren Übersicht
                </p>
              </div>
            </div>

            {/* Test Button */}
            {settings.enabled && (
              <div className="mt-6 p-4 bg-dark-800 rounded-lg">
                <p className="text-sm text-dark-400 mb-3">
                  Teste die Integration, indem du eine Test-Nachricht sendest
                </p>
                <button
                  onClick={handleTestMessage}
                  className="btn-secondary flex items-center gap-2"
                >
                  <MessageCircle size={18} />
                  Test-Nachricht senden
                </button>
              </div>
            )}

            {/* Info Box */}
            <div className="mt-6 border-t border-dark-800 pt-6">
              <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <MessageCircle size={18} className="text-primary-400" />
                  Einrichtung
                </h4>
                <ol className="text-sm text-dark-300 space-y-2 list-decimal list-inside">
                  <li>Erstelle einen WhatsApp Business Account bei Meta</li>
                  <li>Konfiguriere AWS End User Messaging in der AWS Console</li>
                  <li>Verbinde deinen WhatsApp Business Account</li>
                  <li>Erstelle eine WhatsApp-Gruppe und füge die Business-Nummer hinzu</li>
                  <li>Trage die Phone Number ID und Group ID hier ein</li>
                  <li>Aktiviere die Integration und teste sie</li>
                </ol>
                <p className="text-xs text-dark-500 mt-3">
                  💡 Neue Posts werden automatisch an die Gruppe gesendet, sobald sie veröffentlicht werden
                </p>
              </div>
            </div>
            </div>
          ) : activeTab === 'telegram' ? (
            <div>
            {/* Telegram Integration */}
            <div className="flex items-center gap-3 mb-4">
              <Send size={24} className="text-blue-500" />
              <h3 className="text-xl font-semibold">Telegram Bot Integration</h3>
            </div>
            
            <p className="text-dark-400 mb-4">
              Sende neue Newsfeed-Posts automatisch an einen Telegram-Kanal oder eine Gruppe
            </p>

            {/* Enable Toggle */}
            <div className="mb-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={telegramSettings.enabled}
                  onChange={(e) => setTelegramSettings({ ...telegramSettings, enabled: e.target.checked })}
                  className="w-5 h-5 rounded"
                />
                <span className="font-medium">Telegram-Benachrichtigungen aktivieren</span>
              </label>
            </div>

            {/* Settings Fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  <Send size={16} className="inline mr-2" />
                  Bot Token
                </label>
                <input
                  type="password"
                  value={telegramSettings.botToken}
                  onChange={(e) => setTelegramSettings({ ...telegramSettings, botToken: e.target.value })}
                  placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                  className="input w-full font-mono text-sm"
                  disabled={!telegramSettings.enabled}
                />
                <p className="text-xs text-dark-500 mt-1">
                  Von @BotFather erhalten
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  <Users size={16} className="inline mr-2" />
                  Chat/Channel ID
                </label>
                <input
                  type="text"
                  value={telegramSettings.chatId}
                  onChange={(e) => setTelegramSettings({ ...telegramSettings, chatId: e.target.value })}
                  placeholder="-1001234567890"
                  className="input w-full font-mono text-sm"
                  disabled={!telegramSettings.enabled}
                />
                <p className="text-xs text-dark-500 mt-1">
                  Für Gruppen: -100XXXXXXXXXX, für Kanäle: @channel_name
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Chat-Name (optional)
                </label>
                <input
                  type="text"
                  value={telegramSettings.chatName}
                  onChange={(e) => setTelegramSettings({ ...telegramSettings, chatName: e.target.value })}
                  placeholder="Mein Telegram Kanal"
                  className="input w-full"
                  disabled={!telegramSettings.enabled}
                />
                <p className="text-xs text-dark-500 mt-1">
                  Zur besseren Übersicht
                </p>
              </div>
            </div>

            {/* Test Button */}
            {telegramSettings.enabled && (
              <div className="mt-6 p-4 bg-dark-800 rounded-lg">
                <p className="text-sm text-dark-400 mb-3">
                  Teste die Integration, indem du eine Test-Nachricht sendest
                </p>
                <button
                  onClick={handleTelegramTestMessage}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Send size={18} />
                  Test-Nachricht senden
                </button>
              </div>
            )}

            {/* Info Box */}
            <div className="mt-6 border-t border-dark-800 pt-6">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Send size={18} className="text-blue-400" />
                  Einrichtung
                </h4>
                <ol className="text-sm text-dark-300 space-y-2 list-decimal list-inside">
                  <li>Öffne Telegram und suche nach @BotFather</li>
                  <li>Sende /newbot und folge den Anweisungen</li>
                  <li>Kopiere den Bot Token</li>
                  <li>Füge den Bot zu deinem Kanal/Gruppe hinzu</li>
                  <li>Gib dem Bot Admin-Rechte (zum Senden von Nachrichten)</li>
                  <li>Hole die Chat-ID (z.B. mit @userinfobot)</li>
                  <li>Trage Token und Chat-ID hier ein</li>
                  <li>Aktiviere die Integration und teste sie</li>
                </ol>
                <p className="text-xs text-dark-500 mt-3">
                  💡 Neue Posts werden automatisch an den Kanal gesendet, sobald sie veröffentlicht werden
                </p>
              </div>
            </div>
          </div>
          ) : activeTab === 'email' ? (
            <div>
            {/* Email Integration */}
            <div className="flex items-center gap-3 mb-4">
              <Mail size={24} className="text-primary-500" />
              <h3 className="text-xl font-semibold">E-Mail Benachrichtigungen</h3>
            </div>
            
            <p className="text-dark-400 mb-4">
              Sende neue Newsfeed-Posts automatisch per E-Mail an alle registrierten Benutzer
            </p>

            {/* Enable Toggle */}
            <div className="mb-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailSettings.enabled}
                  onChange={(e) => setEmailSettings({ ...emailSettings, enabled: e.target.checked })}
                  className="w-5 h-5 rounded"
                />
                <span className="font-medium">E-Mail-Benachrichtigungen aktivieren</span>
              </label>
            </div>

            {/* Settings Fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  <Mail size={16} className="inline mr-2" />
                  Absender E-Mail
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={emailSettings.senderPrefix}
                    onChange={(e) => setEmailSettings({ ...emailSettings, senderPrefix: e.target.value })}
                    placeholder="newsfeed"
                    className="input flex-1 font-mono text-sm"
                    disabled={!emailSettings.enabled}
                  />
                  <span className="text-dark-400 font-mono">@{awsConfig.domain || 'honigwabe.live'}</span>
                </div>
                <p className="text-xs text-dark-500 mt-1">
                  E-Mails werden von {emailSettings.senderPrefix || 'newsfeed'}@{awsConfig.domain || 'honigwabe.live'} gesendet
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Absender-Name
                </label>
                <input
                  type="text"
                  value={emailSettings.senderName}
                  onChange={(e) => setEmailSettings({ ...emailSettings, senderName: e.target.value })}
                  placeholder="Newsfeed"
                  className="input w-full"
                  disabled={!emailSettings.enabled}
                />
                <p className="text-xs text-dark-500 mt-1">
                  Wird als Anzeigename in E-Mails verwendet
                </p>
              </div>
            </div>

            {/* Test Button */}
            {emailSettings.enabled && (
              <div className="mt-6 p-4 bg-dark-800 rounded-lg">
                <p className="text-sm text-dark-400 mb-3">
                  Teste die Integration, indem du eine Test-E-Mail sendest
                </p>
                <button
                  onClick={handleEmailTestMessage}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Mail size={18} />
                  Test-E-Mail senden
                </button>
              </div>
            )}

            {/* Info Box */}
            <div className="mt-6 border-t border-dark-800 pt-6">
              <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Mail size={18} className="text-primary-400" />
                  Wichtige Hinweise
                </h4>
                <ul className="text-sm text-dark-300 space-y-2 list-disc list-inside">
                  <li>Alle registrierten Benutzer erhalten die E-Mails</li>
                  <li>E-Mails werden nur bei veröffentlichten Posts versendet</li>
                  <li>Schöne HTML-Templates mit Bildern und Links</li>
                </ul>
                <p className="text-xs text-dark-500 mt-3">
                  💡 Neue Posts werden automatisch per E-Mail versendet, sobald sie veröffentlicht werden
                </p>
              </div>
            </div>
            </div>
          ) : null}
        </div>

        {/* Action Buttons */}
        <div className="p-6 border-t border-dark-800 flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Speichern...
              </>
            ) : (
              <>
                <Save size={18} />
                Speichern
              </>
            )}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="btn-secondary flex-1"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}
