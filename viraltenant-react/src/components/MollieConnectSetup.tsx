import { useState, useEffect } from 'react'
import { Link2, Unlink, CheckCircle, AlertCircle, Loader2, Users, CreditCard, ExternalLink, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { billingService } from '../services/billing.service'
import { toast } from '../utils/toast-alert'

interface MollieConnectSetupProps {
  tenantId: string
  onStatusChange?: (connected: boolean) => void
}

interface ConnectStatus {
  connected: boolean
  organizationId?: string
  organizationName?: string
  connectedAt?: string
  needsReconnect?: boolean
}

export const MollieConnectSetup = ({ tenantId, onStatusChange }: MollieConnectSetupProps) => {
  const [loading, setLoading] = useState(true)
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null)
  const [connectLoading, setConnectLoading] = useState(false)
  const [disconnectLoading, setDisconnectLoading] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    loadConnectStatus()
    
    // Check URL params for connection result
    const params = new URLSearchParams(window.location.search)
    if (params.get('mollie_connected') === 'true') {
      toast.success('Mollie erfolgreich verbunden!')
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname)
      loadConnectStatus()
    }
    if (params.get('error')) {
      toast.error(`Mollie Verbindung fehlgeschlagen: ${params.get('error')}`)
      window.history.replaceState({}, '', window.location.pathname)
    }

    // Listen for localStorage changes from callback page (cross-tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'mollie_connect_complete' && e.newValue) {
        loadConnectStatus()
      }
    }
    window.addEventListener('storage', handleStorageChange)

    // Check localStorage on mount (same-tab, after redirect)
    const connectComplete = localStorage.getItem('mollie_connect_complete')
    if (connectComplete) {
      const timestamp = parseInt(connectComplete, 10)
      // Only process if it was set in the last 30 seconds
      if (Date.now() - timestamp < 30000) {
        loadConnectStatus()
        localStorage.removeItem('mollie_connect_complete')
      }
    }
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [tenantId])

  const loadConnectStatus = async () => {
    setLoading(true)
    try {
      const status = await billingService.getMollieConnectStatus(tenantId)
      setConnectStatus(status)
      onStatusChange?.(status.connected)
    } catch (error) {
      console.error('Failed to load Mollie Connect status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async () => {
    setConnectLoading(true)
    try {
      // Redirect zurück zur aktuellen Seite nach OAuth
      const redirectUrl = window.location.href.split('?')[0]
      const result = await billingService.getMollieConnectAuthorizeUrl(tenantId, redirectUrl)
      
      if (result.authorizeUrl) {
        // Redirect to Mollie OAuth
        window.location.href = result.authorizeUrl
      }
    } catch (error: any) {
      console.error('Failed to get authorize URL:', error)
      toast.error(error.message || 'Fehler beim Verbinden mit Mollie')
      setConnectLoading(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Möchtest du die Mollie-Verbindung wirklich trennen? Bestehende Mitglieder-Abos bleiben bei Mollie aktiv.')) {
      return
    }

    setDisconnectLoading(true)
    try {
      await billingService.disconnectMollieConnect(tenantId)
      toast.success('Mollie-Verbindung getrennt')
      await loadConnectStatus()
    } catch (error: any) {
      console.error('Failed to disconnect:', error)
      toast.error(error.message || 'Fehler beim Trennen')
    } finally {
      setDisconnectLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    )
  }

  // Connected state
  if (connectStatus?.connected) {
    return (
      <div className="space-y-6">
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-green-400">Mollie Connect aktiv</h3>
              <p className="text-sm text-dark-300 mt-1">
                Dein Mollie-Konto ist verbunden. Du kannst jetzt Mitglieder-Abos abrechnen.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-dark-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary-400" />
            <span className="font-medium">Verbundenes Konto</span>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-dark-400">Anbieter:</span>
              <span className="font-semibold">Viral Tenant via Mollie</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark-400">Verbunden seit:</span>
              <span>{connectStatus.connectedAt ? new Date(connectStatus.connectedAt).toLocaleDateString('de-DE') : '-'}</span>
            </div>
          </div>
        </div>

        <div className="bg-dark-800/50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium">Mitglieder-Abrechnung</h4>
              <p className="text-sm text-dark-400 mt-1">
                Zahlungen deiner Mitglieder gehen direkt auf dein Mollie-Konto. 
                Du behältst die volle Kontrolle über deine Einnahmen.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <a
            href="https://www.mollie.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Mollie Dashboard
          </a>
          <button
            onClick={handleDisconnect}
            disabled={disconnectLoading}
            className="btn-secondary text-red-500 hover:bg-red-500/10 flex items-center gap-2"
          >
            {disconnectLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
            Trennen
          </button>
        </div>
      </div>
    )
  }

  // Needs reconnect
  if (connectStatus?.needsReconnect) {
    return (
      <div className="space-y-6">
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-400">Erneute Verbindung erforderlich</h3>
              <p className="text-sm text-dark-300 mt-1">
                Die Mollie-Verbindung ist abgelaufen. Bitte verbinde dein Konto erneut.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleConnect}
          disabled={connectLoading}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {connectLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Link2 className="w-5 h-5" />}
          Erneut mit Mollie verbinden
        </button>
      </div>
    )
  }

  // Not connected
  return (
    <div className="space-y-6">
      <div className="bg-dark-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <CreditCard className="w-6 h-6 text-primary-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold">Mollie Connect einrichten</h3>
            <p className="text-sm text-dark-400 mt-1">
              Verbinde dein Mollie-Konto, um Mitgliedschaften direkt abzurechnen. 
              Zahlungen gehen direkt auf dein Konto.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-4">
        <p className="text-sm">
          <strong className="text-primary-400">Hinweis:</strong> Du benötigst ein verifiziertes Mollie-Konto. 
          Falls du noch keins hast, kannst du es während des Verbindungsprozesses erstellen.
        </p>
      </div>

      <button
        onClick={handleConnect}
        disabled={connectLoading}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {connectLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Link2 className="w-5 h-5" />}
        Mit Mollie verbinden
      </button>

      {/* Anleitung */}
      <div className="border border-dark-700 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-dark-800/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-primary-400" />
            <span className="text-sm font-medium">Noch kein Mollie-Konto?</span>
          </div>
          {showGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        
        {showGuide && (
          <div className="px-4 pb-4 text-sm space-y-4 border-t border-dark-700 pt-4">
            <div>
              <h4 className="font-medium text-white mb-2">1. Mollie-Konto erstellen</h4>
              <p className="text-dark-400">
                Registriere dich kostenlos auf{' '}
                <a href="https://www.mollie.com/signup" target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">
                  mollie.com/signup
                </a>
              </p>
            </div>
            
            <div>
              <h4 className="font-medium text-white mb-2">2. Verifizierung</h4>
              <p className="text-dark-400">
                Mollie benötigt: Name, Adresse, Bankverbindung (IBAN) und deine Viral Tenant URL. 
                Dauert ca. 1-2 Werktage.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium text-white mb-2">3. Verbinden</h4>
              <p className="text-dark-400">
                Nach der Verifizierung klickst du oben auf "Mit Mollie verbinden" und autorisierst die Verbindung.
              </p>
            </div>

            <div>
              <h4 className="font-medium text-white mb-2">4. Erträge erhalten</h4>
              <p className="text-dark-400">
                Im Anschluss werden Erträge aus deinen Mitgliedschaften über Mollie abgerechnet und an dein Bankkonto ausgezahlt.
              </p>
            </div>

            <div className="bg-dark-800 rounded-lg p-3 mt-3">
              <p className="text-dark-400 text-xs">
                <strong className="text-dark-300">Gebühren:</strong> 0,25€ + 0,6% pro SEPA-Lastschrift.
              </p>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-dark-500 text-center">
        Powered by Mollie Connect. Sichere OAuth-Verbindung.
      </p>
    </div>
  )
}
