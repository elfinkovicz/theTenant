import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, Globe, Settings, AlertCircle, Crown, DollarSign, Sparkles, Users, Mail, Calendar, Plus, AlertTriangle, Palette, Loader2, CheckCircle, Video, CreditCard, XCircle } from 'lucide-react'
import { useTenant } from '../providers/TenantProvider'
import { useAuthStore } from '@store/authStore'
import { BillingManagement } from '@components/BillingManagement'
import { TenantDesignSettings } from '@components/TenantDesignSettings'
import { TenantMembers } from '@components/TenantMembers'
import { useAdmin } from '@hooks/useAdmin'
import { usePremium, invalidatePremiumCache } from '@hooks/usePremium'
import { awsConfig } from '../config/aws-config'
import { toast } from '../utils/toast-alert'
import { getMembershipInfo, subscribeMembership, cancelMembership, MembershipInfo } from '../services/membership.service'

interface SubdomainCheckResponse {
  available: boolean
  message?: string
}

interface TenantSettings {
  id: string
  subdomain: string
  creator_name: string
  creator_email?: string
  first_name?: string
  last_name?: string
  phone?: string
  status: 'active' | 'pending' | 'suspended'
}

interface TenantAdmin {
  user_id: string
  email: string
  name: string | null
  role: string
  permissions: string[]
  joined_at: string
}

// Platform tenant UUID
const PLATFORM_TENANT_ID = '319190e1-0791-43b0-bd04-506f959c1471';

export function Tenant() {
  const { tenantId, subdomain, creatorName, isSuspended, statusReason } = useTenant()
  const tenant = tenantId !== PLATFORM_TENANT_ID ? { id: tenantId, subdomain, creator_name: creatorName } : null
  const { isAuthenticated, user, accessToken } = useAuthStore()
  const { isAdmin, isActualAdmin } = useAdmin()
  const { isPremium, membershipStatus, isLoading: premiumLoading, refreshPremiumStatus } = usePremium()
  
  // Membership states for user subscription
  const [membershipInfo, setMembershipInfo] = useState<MembershipInfo | null>(null)
  const [membershipInfoLoading, setMembershipInfoLoading] = useState(true)
  const [subscribing, setSubscribing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  
  // Debug logging
  useEffect(() => {
    console.log('Tenant Page - Auth State:', {
      isAuthenticated,
      user: user?.email,
      hasAccessToken: !!accessToken,
      tenant: tenant?.id
    })
  }, [isAuthenticated, user, accessToken, tenant])
  const [subdomainInput, setSubdomainInput] = useState('')
  const [isChecking, setIsChecking] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [checkResult, setCheckResult] = useState<SubdomainCheckResponse | null>(null)
  const [tenantSettings, setTenantSettings] = useState<TenantSettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'settings' | 'design' | 'billing' | 'members' | 'membership'>(() => {
    // Check URL params for payment redirect - if payment success, show membership tab
    const urlParams = new URLSearchParams(window.location.search)
    const payment = urlParams.get('payment')
    const membershipId = urlParams.get('membershipId')
    const status = urlParams.get('status')
    
    // After membership payment, show membership tab
    if (membershipId || status === 'success') {
      return 'membership'
    }
    
    if (payment === 'success' || payment === 'cancelled') {
      return 'billing'
    }
    
    // Default: membership tab for users, settings for admins (will be set after admin check)
    return 'membership'
  })
  const [availableTenants, setAvailableTenants] = useState<TenantSettings[]>([])
  const [isLoadingTenants, setIsLoadingTenants] = useState(false)
  const [tenantAdmins, setTenantAdmins] = useState<TenantAdmin[]>([])
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(false)
  const [selectedPlatformTenant, setSelectedPlatformTenant] = useState<TenantSettings | null>(null)
  
  // Admin management
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [isAddingAdmin, setIsAddingAdmin] = useState(false)
  const [removingAdminId, setRemovingAdminId] = useState<string | null>(null)
  const [adminError, setAdminError] = useState<string | null>(null)
  const [adminSuccess, setAdminSuccess] = useState<string | null>(null)
  const [showAddAdminModal, setShowAddAdminModal] = useState(false)
  const [isTenantAdmin, setIsTenantAdmin] = useState(false)
  
  // Email notification settings
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true)
  const [isSavingNotifications, setIsSavingNotifications] = useState(false)

  // Editable profile fields
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  // Check admin status and token validity
  useEffect(() => {
    if (isAuthenticated && user) {
      // Check if token is expired
      if (useAuthStore.getState().isTokenExpired()) {
        console.warn('Token expired, forcing logout')
        useAuthStore.getState().forceLogout()
        return
      }
    }
  }, [isAuthenticated, user])

  // Set resolvedTenantId as early as possible for billing and other services
  useEffect(() => {
    const currentTenant = tenant || selectedPlatformTenant
    if (currentTenant?.id) {
      const stored = localStorage.getItem('resolvedTenantId')
      if (stored !== currentTenant.id) {
        localStorage.setItem('resolvedTenantId', currentTenant.id)
        console.log('Set resolvedTenantId:', currentTenant.id)
      }
    }
  }, [tenant?.id, selectedPlatformTenant?.id])

  // Load tenant settings on mount
  useEffect(() => {
    const currentTenant = tenant || selectedPlatformTenant
    if (currentTenant && isAuthenticated && accessToken) {
      loadTenantSettings()
    }
  }, [tenant?.id, selectedPlatformTenant?.id, isAuthenticated, accessToken])

  // Load tenant admins when settings tab is active (only once when tab opens)
  // Also load on initial page load to check if user is tenant admin
  const [adminsLoaded, setAdminsLoaded] = useState(false)
  
  useEffect(() => {
    // Load admins on initial page load to determine isTenantAdmin
    const currentTenant = tenant || selectedPlatformTenant
    if (currentTenant && isAuthenticated && accessToken && !adminsLoaded) {
      loadTenantAdmins()
      setAdminsLoaded(true)
    }
  }, [tenant?.id, selectedPlatformTenant?.id, isAuthenticated, accessToken, adminsLoaded])

  // Load available tenants if no tenant is detected via subdomain
  useEffect(() => {
    if (isAuthenticated && !tenant && !selectedPlatformTenant && accessToken) {
      loadAvailableTenants()
    }
  }, [isAuthenticated, tenant, selectedPlatformTenant, accessToken])

  const loadAvailableTenants = async () => {
    if (!accessToken) return
    
    // Don't redirect if we're already on a subdomain
    const hostname = window.location.hostname
    const parts = hostname.split('.')
    const isOnSubdomain = parts.length >= 3 && parts[0] !== 'www' && parts[0] !== 'viraltenant'
    
    console.log('Loading available tenants...')
    console.log('Access Token:', accessToken ? 'Present' : 'Missing')
    console.log('API URL:', `${awsConfig.api.user}/user/tenants`)
    console.log('Is on subdomain:', isOnSubdomain, 'hostname:', hostname)
    
    setIsLoadingTenants(true)
    try {
      const response = await fetch(`${awsConfig.api.user}/user/tenants`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })
      
      console.log('API Response Status:', response.status)
      console.log('API Response Headers:', Object.fromEntries(response.headers.entries()))
      
      if (response.ok) {
        const tenants = await response.json()
        console.log('Loaded tenants:', tenants)
        setAvailableTenants(tenants)
        
        // If user has only one tenant and NOT already on a subdomain, redirect to it
        // Skip redirect for platform tenant (subdomain "www" or empty)
        if (tenants.length === 1 && !isOnSubdomain) {
          const tenant = tenants[0]
          if (tenant.subdomain && tenant.subdomain !== 'www' && tenant.id !== PLATFORM_TENANT_ID) {
            window.location.href = `https://${tenant.subdomain}.viraltenant.com/tenant`
          }
        }
      } else {
        const errorText = await response.text()
        console.error('API Error:', response.status, errorText)
      }
    } catch (err) {
      console.error('Error loading available tenants:', err)
    } finally {
      setIsLoadingTenants(false)
    }
  }

  const loadTenantSettings = async () => {
    const currentTenant = tenant || selectedPlatformTenant
    if (!currentTenant || !accessToken) return
    
    // Store the resolved tenant ID for billing and other services
    if (currentTenant.id) {
      localStorage.setItem('resolvedTenantId', currentTenant.id)
      console.log('Set resolvedTenantId:', currentTenant.id)
    }
    
    try {
      const response = await fetch(`${awsConfig.api.user}/tenants/${currentTenant.id}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Creator-ID': currentTenant.id
        }
      })
      
      if (response.ok) {
        const settings = await response.json()
        setTenantSettings(settings)
        setSubdomainInput(settings.subdomain || '')
        // Initialize editable fields
        setEditFirstName(settings.first_name || '')
        setEditLastName(settings.last_name || '')
        setEditPhone(settings.phone || '')
      }
    } catch (err) {
      setError('Fehler beim Laden der Tenant-Einstellungen')
    }
  }

  const loadTenantAdmins = async () => {
    const currentTenant = tenant || selectedPlatformTenant
    if (!currentTenant || !accessToken) return
    
    setIsLoadingAdmins(true)
    try {
      const response = await fetch(`${awsConfig.api.user}/tenants/${currentTenant.id}/admins`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Creator-ID': currentTenant.id
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        const admins = data.admins || []
        setTenantAdmins(admins)
        // Check if current user is a tenant admin
        const currentUserEmail = user?.email?.toLowerCase()
        const isCurrentUserAdmin = admins.some((admin: TenantAdmin) => 
          admin.email?.toLowerCase() === currentUserEmail
        )
        setIsTenantAdmin(isCurrentUserAdmin)
      } else {
        console.error('Error loading tenant admins:', response.status)
        setIsTenantAdmin(false)
      }
    } catch (err) {
      console.error('Error loading tenant admins:', err)
      setIsTenantAdmin(false)
    } finally {
      setIsLoadingAdmins(false)
    }
  }

  // Add new admin to tenant
  const handleAddAdmin = async () => {
    const currentTenant = tenant || selectedPlatformTenant
    if (!currentTenant || !accessToken || !newAdminEmail) return

    setIsAddingAdmin(true)
    setAdminError(null)
    setAdminSuccess(null)

    try {
      const response = await fetch(`${awsConfig.api.user}/tenants/${currentTenant.id}/admins`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Creator-ID': currentTenant.id
        },
        body: JSON.stringify({ email: newAdminEmail })
      })

      const data = await response.json()

      if (response.ok) {
        setAdminSuccess('Administrator erfolgreich hinzugefügt')
        setNewAdminEmail('')
        setShowAddAdminModal(false)
        loadTenantAdmins()
        setTimeout(() => setAdminSuccess(null), 3000)
      } else {
        setAdminError(data.message || 'Fehler beim Hinzufügen des Administrators')
      }
    } catch (err) {
      console.error('Error adding admin:', err)
      setAdminError('Fehler beim Hinzufügen des Administrators')
    } finally {
      setIsAddingAdmin(false)
    }
  }

  // Remove admin from tenant
  const handleRemoveAdmin = async (adminUserId: string) => {
    const currentTenant = tenant || selectedPlatformTenant
    if (!currentTenant || !accessToken) return

    if (!confirm('Möchten Sie diesen Administrator wirklich entfernen?')) return

    setRemovingAdminId(adminUserId)
    setAdminError(null)
    setAdminSuccess(null)

    try {
      const response = await fetch(`${awsConfig.api.user}/tenants/${currentTenant.id}/admins/${adminUserId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Creator-ID': currentTenant.id
        }
      })

      const data = await response.json()

      if (response.ok) {
        setAdminSuccess('Administrator erfolgreich entfernt')
        loadTenantAdmins()
        setTimeout(() => setAdminSuccess(null), 3000)
      } else {
        setAdminError(data.message || 'Fehler beim Entfernen des Administrators')
      }
    } catch (err) {
      console.error('Error removing admin:', err)
      setAdminError('Fehler beim Entfernen des Administrators')
    } finally {
      setRemovingAdminId(null)
    }
  }

  // Load email notification settings
  const loadEmailNotificationSettings = async () => {
    const currentTenant = tenant || selectedPlatformTenant
    if (!currentTenant || !accessToken) return

    try {
      const response = await fetch(`${awsConfig.api.user}/tenants/${currentTenant.id}/user/notifications`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Creator-ID': currentTenant.id
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setEmailNotificationsEnabled(data.emailNotifications !== false) // Default true
      }
    } catch (err) {
      console.error('Error loading notification settings:', err)
    }
  }

  // Handle email notification toggle
  const handleEmailNotificationToggle = async (enabled: boolean) => {
    const currentTenant = tenant || selectedPlatformTenant
    if (!currentTenant || !accessToken) return

    setIsSavingNotifications(true)

    try {
      const response = await fetch(`${awsConfig.api.user}/tenants/${currentTenant.id}/user/notifications`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'X-Creator-ID': currentTenant.id
        },
        body: JSON.stringify({ emailNotifications: enabled })
      })

      if (response.ok) {
        setEmailNotificationsEnabled(enabled)
        toast.success(enabled ? 'Benachrichtigungen aktiviert' : 'Benachrichtigungen deaktiviert')
      } else {
        toast.error('Fehler beim Speichern der Einstellungen')
      }
    } catch (err) {
      console.error('Error saving notification settings:', err)
      toast.error('Fehler beim Speichern der Einstellungen')
    } finally {
      setIsSavingNotifications(false)
    }
  }

  // Load notification settings when settings tab is opened
  useEffect(() => {
    if ((tenant || selectedPlatformTenant) && isAuthenticated && activeTab === 'settings') {
      loadEmailNotificationSettings()
    }
  }, [tenant, selectedPlatformTenant, isAuthenticated, activeTab])

  // Load membership info for users
  useEffect(() => {
    const currentTenant = tenant || selectedPlatformTenant
    if (currentTenant?.id && activeTab === 'membership') {
      loadMembershipInfo()
    }
  }, [tenant?.id, selectedPlatformTenant?.id, activeTab])

  const loadMembershipInfo = async () => {
    const currentTenant = tenant || selectedPlatformTenant
    if (!currentTenant?.id) return
    setMembershipInfoLoading(true)
    try {
      const info = await getMembershipInfo(currentTenant.id)
      setMembershipInfo(info)
    } catch (error) {
      console.error('Error loading membership info:', error)
    } finally {
      setMembershipInfoLoading(false)
    }
  }

  const handleSubscribe = async () => {
    const currentTenant = tenant || selectedPlatformTenant
    if (!currentTenant?.id || !accessToken || !user?.email) return
    setSubscribing(true)
    try {
      const result = await subscribeMembership(
        currentTenant.id, 
        accessToken, 
        window.location.href, // Redirect back here after payment
        user.email // E-Mail für Mollie Customer
      )
      
      if (result.checkoutUrl) {
        // Redirect to Mollie checkout (goes to creator's Mollie account)
        window.location.href = result.checkoutUrl
      } else {
        toast.success('Mitgliedschaft erfolgreich gestartet!')
        invalidatePremiumCache()
        refreshPremiumStatus()
      }
    } catch (error: any) {
      console.error('Error subscribing:', error)
      toast.error(error.message || 'Fehler beim Starten der Mitgliedschaft')
    } finally {
      setSubscribing(false)
    }
  }

  const handleCancelMembership = async () => {
    const currentTenant = tenant || selectedPlatformTenant
    if (!currentTenant?.id || !accessToken) return
    if (!confirm('Möchtest du deine Mitgliedschaft wirklich kündigen? Du behältst den Zugang bis zum Ende der aktuellen Periode.')) {
      return
    }
    
    setCancelling(true)
    try {
      const result = await cancelMembership(currentTenant.id, accessToken)
      toast.success(`Mitgliedschaft gekündigt. Zugang bis ${new Date(result.expiresAt).toLocaleDateString('de-DE')}`)
      invalidatePremiumCache()
      refreshPremiumStatus()
    } catch (error: any) {
      console.error('Error cancelling:', error)
      toast.error(error.message || 'Fehler beim Kündigen')
    } finally {
      setCancelling(false)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  // Save profile data
  const handleSaveProfile = async () => {
    const currentTenant = tenant || selectedPlatformTenant
    if (!currentTenant || !accessToken) return

    setIsSavingProfile(true)

    try {
      const response = await fetch(`${awsConfig.api.user}/tenants/${currentTenant.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'X-Creator-ID': currentTenant.id
        },
        body: JSON.stringify({
          firstName: editFirstName,
          lastName: editLastName,
          phone: editPhone
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Profil erfolgreich gespeichert!')
        // Update local state with new data
        if (data.tenant) {
          setTenantSettings(prev => prev ? {
            ...prev,
            creator_name: data.tenant.creator_name,
            first_name: data.tenant.first_name,
            last_name: data.tenant.last_name,
            phone: data.tenant.phone
          } : null)
        }
      } else {
        toast.error('Fehler beim Speichern des Profils')
      }
    } catch (err) {
      console.error('Error saving profile:', err)
      toast.error('Fehler beim Speichern des Profils')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const checkSubdomainAvailability = async () => {
    const currentTenant = tenant || selectedPlatformTenant
    if (!subdomainInput.trim() || !currentTenant || !accessToken) return
    
    setIsChecking(true)
    setCheckResult(null)
    setError(null)

    try {
      const response = await fetch(`${awsConfig.api.user}/tenants/${currentTenant.id}/subdomain/check?name=${encodeURIComponent(subdomainInput)}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Creator-ID': currentTenant.id
        }
      })

      const result = await response.json()
      setCheckResult(result)
    } catch (err) {
      setError('Fehler bei der Verfügbarkeitsprüfung')
    } finally {
      setIsChecking(false)
    }
  }

  const createSubdomain = async () => {
    const currentTenant = tenant || selectedPlatformTenant
    if (!checkResult?.available || !currentTenant || !accessToken) return

    setIsCreating(true)
    setError(null)

    try {
      const response = await fetch(`${awsConfig.api.user}/tenants/${currentTenant.id}/subdomain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'X-Creator-ID': currentTenant.id
        },
        body: JSON.stringify({
          subdomain: subdomainInput
        })
      })

      if (response.ok) {
        await loadTenantSettings()
        setCheckResult(null)
        setSubdomainInput('')
      } else {
        const errorData = await response.json()
        setError(errorData.message || 'Fehler beim Erstellen der Subdomain')
      }
    } catch (err) {
      setError('Fehler beim Erstellen der Subdomain')
    } finally {
      setIsCreating(false)
    }
  }

  const isValidSubdomain = (name: string) => {
    const pattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/
    const blacklist = ['www', 'api', 'admin', 'app', 'mail', 'ftp', 'cdn', 'assets']
    
    return pattern.test(name) && 
           name.length >= 3 && 
           name.length <= 20 && 
           !blacklist.includes(name.toLowerCase())
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen py-8 px-4 flex items-center justify-center">
        <div className="card text-center max-w-md">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-primary-500" />
          <h2 className="text-2xl font-bold mb-2">Anmeldung erforderlich</h2>
          <p className="text-dark-400">Bitte melden Sie sich an, um Ihre Tenant-Einstellungen zu verwalten.</p>
        </div>
      </div>
    )
  }

  // Show tenant selection if no tenant detected via subdomain and no platform tenant selected
  if (!tenant && !selectedPlatformTenant) {
    return (
      <div className="min-h-screen py-8 px-4">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto"
          >
            <div className="flex items-center justify-center gap-3 mb-8">
              <Crown size={40} className="text-primary-500" />
              <h1 className="text-4xl font-bold">
                <span className="glow-text">Tenant-Auswahl</span>
              </h1>
            </div>
            
            <p className="text-xl text-dark-400 mb-8 text-center">
              Willkommen zurück, {user?.email}! Wählen Sie Ihren Creator-Bereich aus:
            </p>

            {/* Content Tab - Tenant Selection */}
            {(
              <>
                {isLoadingTenants ? (
                  <div className="max-w-2xl mx-auto">
                    <div className="card">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
                      <p className="text-dark-400 mt-4">Lade verfügbare Bereiche...</p>
                    </div>
                  </div>
                ) : availableTenants.length > 0 ? (
                  <div className="max-w-2xl mx-auto">
                    <div className="space-y-4">
                      {availableTenants.map((t) => (
                        <motion.div
                          key={t.id}
                          whileHover={{ scale: 1.02 }}
                          className="card cursor-pointer"
                          onClick={() => {
                            // For platform tenant, set it as selected and show settings
                            if (t.id === PLATFORM_TENANT_ID || t.subdomain === 'www') {
                              setSelectedPlatformTenant(t)
                              setActiveTab('settings')
                            } else if (t.subdomain) {
                              window.location.href = `https://${t.subdomain}.viraltenant.com/tenant`
                            }
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-left">
                              <h3 className="text-xl font-bold">{t.creator_name}</h3>
                              <p className="text-dark-400">
                                {t.subdomain ? `${t.subdomain}.viraltenant.com` : 'Keine Subdomain konfiguriert'}
                              </p>
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-2 ${
                                t.status === 'active' ? 'bg-green-500/20 text-green-300' :
                                t.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                                'bg-red-500/20 text-red-300'
                              }`}>
                                {t.status === 'active' ? 'Aktiv' :
                                 t.status === 'pending' ? 'Ausstehend' : 'Gesperrt'}
                              </span>
                            </div>
                            <Globe className="w-8 h-8 text-primary-500" />
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <AlertCircle className="w-24 h-24 mx-auto mb-6 text-yellow-500" />
                    <h2 className="text-3xl font-bold mb-6">Kein Creator-Bereich gefunden</h2>
                    <p className="text-dark-400 text-lg mb-8 max-w-2xl mx-auto">
                      Sie sind noch keinem Creator-Bereich zugeordnet. Kontaktieren Sie den Administrator, 
                      um Zugang zu einem Creator-Bereich zu erhalten.
                    </p>
                    <button
                      onClick={loadAvailableTenants}
                      className="btn-primary text-lg px-8 py-3"
                    >
                      Erneut laden
                    </button>
                  </div>
                )}
              </>
            )}

          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-8">
      {/* Full-width Header Section */}
      <div className="w-full px-4 mb-8">
        <div className="container mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <Crown size={40} className="text-primary-500" />
            <h1 className="text-4xl md:text-5xl font-bold">
              <span className="glow-text">Tenant-Bereich</span>
            </h1>
          </div>
          <p className="text-dark-400 text-lg">
            Willkommen zurück, {user?.email}!
          </p>
        </div>
      </div>

      {/* Suspended Tenant Warning - Show prominently for admins */}
      {isSuspended && isActualAdmin && (
        <div className="w-full px-4 mb-8">
          <div className="container mx-auto">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/10 border-2 border-red-500 rounded-xl p-6"
            >
              <div className="flex items-start gap-4">
                <AlertTriangle className="w-8 h-8 text-red-500 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-red-400 mb-2">
                    Account gesperrt - Offene Rechnungen
                  </h2>
                  <p className="text-dark-300 mb-4">
                    Dein Creator-Bereich wurde aufgrund offener Rechnungen gesperrt. 
                    Solange die Sperrung aktiv ist, kannst du keine Änderungen an deiner Seite vornehmen.
                    {statusReason && <span className="block mt-2 text-dark-400">Grund: {statusReason}</span>}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => setActiveTab('billing')}
                      className="btn-primary bg-red-600 hover:bg-red-700 flex items-center gap-2"
                    >
                      <DollarSign size={18} />
                      Rechnungen anzeigen & bezahlen
                    </button>
                    <a
                      href="mailto:support@viraltenant.com"
                      className="btn-secondary flex items-center gap-2"
                    >
                      <Mail size={18} />
                      Support kontaktieren
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {/* Full-width Content */}
      <div className="w-full px-4">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-dark-700 overflow-x-auto">
            {/* Membership Tab - für alle User sichtbar */}
            <button
              onClick={() => setActiveTab('membership')}
              className={`px-6 py-3 font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'membership'
                  ? 'text-yellow-500 border-b-2 border-yellow-500'
                  : 'text-dark-400 hover:text-white'
              }`}
            >
              <Crown size={18} />
              Mitgliedschaft
              {isPremium && <CheckCircle size={14} className="text-green-500" />}
            </button>
            {isTenantAdmin && (
            <button
              onClick={() => setActiveTab('members')}
              className={`px-6 py-3 font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'members'
                  ? 'text-primary-500 border-b-2 border-primary-500'
                  : 'text-dark-400 hover:text-white'
              }`}
            >
              <Users size={18} />
              Monetarisierung
            </button>
            )}
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-6 py-3 font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'settings'
                  ? 'text-primary-500 border-b-2 border-primary-500'
                  : 'text-dark-400 hover:text-white'
              }`}
            >
              <Settings className="w-4 h-4 inline mr-2" />
              Einstellungen
            </button>
            {isTenantAdmin && (
              <button
                onClick={() => setActiveTab('design')}
                className={`px-6 py-3 font-semibold transition-colors whitespace-nowrap ${
                  activeTab === 'design'
                    ? 'text-primary-500 border-b-2 border-primary-500'
                    : 'text-dark-400 hover:text-white'
                }`}
              >
                <Palette className="w-4 h-4 inline mr-2" />
                Design
              </button>
            )}
            {isTenantAdmin && (
            <button
              onClick={() => setActiveTab('billing')}
              className={`px-6 py-3 font-semibold transition-colors flex items-center gap-2 ${
                activeTab === 'billing'
                  ? 'text-primary-500 border-b-2 border-primary-500'
                  : 'text-dark-400 hover:text-white'
              }`}
            >
              <DollarSign size={18} />
              Rechnungen
            </button>
            )}
          </div>

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <>
              {/* Current Settings - nur für Admins */}
              {tenantSettings && isTenantAdmin && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="card mb-8"
                >
                  <h2 className="text-2xl font-bold mb-4 flex items-center">
                    <Settings className="w-6 h-6 mr-2 text-primary-500" />
                    Tenant-Einstellungen
                  </h2>
                  
                  {/* Non-editable fields */}
                  <div className="grid md:grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-dark-400 text-sm font-medium mb-1">
                        Tenant ID
                      </label>
                      <div className="bg-dark-800 rounded-lg p-3 font-mono text-sm">
                        {tenantSettings.id}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-dark-400 text-sm font-medium mb-1">
                        Creator Name
                      </label>
                      <div className="bg-dark-800 rounded-lg p-3">
                        {tenantSettings.creator_name}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-dark-400 text-sm font-medium mb-1">
                        Aktuelle Subdomain
                      </label>
                      <div className="bg-dark-800 rounded-lg p-3 flex items-center">
                        <Globe className="w-4 h-4 mr-2 text-primary-500" />
                        {tenantSettings.subdomain ? (
                          <a 
                            href={`https://${tenantSettings.subdomain}.viraltenant.com`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-400 hover:text-primary-300 underline"
                          >
                            {tenantSettings.subdomain}.viraltenant.com
                          </a>
                        ) : (
                          <span className="text-dark-400">Keine Subdomain konfiguriert</span>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-dark-400 text-sm font-medium mb-1">
                        Status
                      </label>
                      <div className="bg-dark-800 rounded-lg p-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          tenantSettings.status === 'active' ? 'bg-green-500/20 text-green-300' :
                          tenantSettings.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                          'bg-red-500/20 text-red-300'
                        }`}>
                          {tenantSettings.status === 'active' ? 'Aktiv' :
                           tenantSettings.status === 'pending' ? 'Ausstehend' : 'Gesperrt'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Editable fields - only for tenant admins */}
                  <>
                    <h3 className="text-lg font-semibold mb-3 text-primary-400">Profildaten bearbeiten</h3>
                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-dark-400 text-sm font-medium mb-1">
                          Vorname
                        </label>
                        <input
                          type="text"
                          value={editFirstName}
                          onChange={(e) => setEditFirstName(e.target.value)}
                          className="input w-full"
                          placeholder="Vorname"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-dark-400 text-sm font-medium mb-1">
                          Nachname
                        </label>
                        <input
                          type="text"
                          value={editLastName}
                          onChange={(e) => setEditLastName(e.target.value)}
                          className="input w-full"
                          placeholder="Nachname"
                        />
                      </div>
                      
                      <div className="md:col-span-2">
                        <label className="block text-dark-400 text-sm font-medium mb-1">
                          Telefonnummer
                        </label>
                        <input
                          type="tel"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          className="input w-full"
                          placeholder="+49 123 456789"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <button
                        onClick={handleSaveProfile}
                        disabled={isSavingProfile}
                        className="btn-primary flex items-center gap-2 disabled:opacity-50"
                        >
                          {isSavingProfile ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          Speichern
                        </button>
                      </div>
                    </>
                </motion.div>
              )}

              {/* User Settings - für normale User (nicht Admins) */}
              {!isTenantAdmin && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="card mb-8"
                >
                  <h2 className="text-2xl font-bold mb-4 flex items-center">
                    <Settings className="w-6 h-6 mr-2 text-primary-500" />
                    Meine Einstellungen
                  </h2>
                  
                  <div>
                    <label className="block text-dark-400 text-sm font-medium mb-1">
                      E-Mail
                    </label>
                    <div className="bg-dark-800 rounded-lg p-3">
                      {user?.email || 'Nicht verfügbar'}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Tenant Admins - nur für Tenant-Admins sichtbar */}
              {isTenantAdmin && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="card mb-8"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold flex items-center">
                    <Users className="w-6 h-6 mr-2 text-primary-500" />
                    Administratoren
                  </h2>
                  <button
                    onClick={() => setShowAddAdminModal(true)}
                    className="p-2 bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
                    title="Administrator hinzufügen"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                {/* Add Admin Modal */}
                <AnimatePresence>
                  {showAddAdminModal && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                      onClick={() => setShowAddAdminModal(false)}
                    >
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="bg-dark-800 rounded-xl p-6 w-full max-w-md mx-4 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold">Administrator hinzufügen</h3>
                          <button
                            onClick={() => setShowAddAdminModal(false)}
                            className="p-1 hover:bg-dark-700 rounded-lg transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                        <input
                          type="email"
                          value={newAdminEmail}
                          onChange={(e) => setNewAdminEmail(e.target.value)}
                          placeholder="E-Mail-Adresse"
                          className="w-full px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg focus:outline-none focus:border-primary-500 mb-3"
                          autoFocus
                        />
                        <p className="text-xs text-dark-400 mb-4">
                          Der Benutzer muss bereits registriert sein.
                        </p>
                        <div className="flex gap-3">
                          <button
                            onClick={() => setShowAddAdminModal(false)}
                            className="flex-1 px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors"
                          >
                            Abbrechen
                          </button>
                          <button
                            onClick={() => {
                              handleAddAdmin()
                              if (!adminError) setShowAddAdminModal(false)
                            }}
                            disabled={isAddingAdmin || !newAdminEmail}
                            className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                          >
                            {isAddingAdmin ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                              'Hinzufügen'
                            )}
                          </button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Success/Error Messages */}
                {adminSuccess && (
                  <div className="bg-green-500/20 border border-green-500 text-green-300 px-4 py-3 rounded-lg mb-4">
                    {adminSuccess}
                  </div>
                )}
                {adminError && (
                  <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg mb-4">
                    {adminError}
                  </div>
                )}
                
                {isLoadingAdmins ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                    <span className="ml-3 text-dark-400">Lade Administratoren...</span>
                  </div>
                ) : tenantAdmins.length > 0 ? (
                  <div className="space-y-3">
                    {tenantAdmins.map((admin) => (
                      <div 
                        key={admin.user_id}
                        className="bg-dark-800 rounded-lg p-4 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center">
                            <Crown className="w-5 h-5 text-primary-500" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-dark-400" />
                              <span className="font-medium">{admin.email}</span>
                            </div>
                            {admin.name && (
                              <p className="text-sm text-dark-400">{admin.name}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-500/20 text-primary-300">
                            {admin.role === 'admin' ? 'Administrator' : admin.role}
                          </span>
                          {admin.joined_at && (
                            <div className="flex items-center gap-1 text-sm text-dark-400">
                              <Calendar className="w-4 h-4" />
                              <span>
                                {new Date(admin.joined_at).toLocaleDateString('de-DE')}
                              </span>
                            </div>
                          )}
                          {/* Remove Admin Button - only show if not current user */}
                          {admin.user_id !== user?.id && (
                            <button
                              onClick={() => handleRemoveAdmin(admin.user_id)}
                              disabled={removingAdminId === admin.user_id}
                              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                              title="Administrator entfernen"
                            >
                              {removingAdminId === admin.user_id ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400"></div>
                              ) : (
                                <X className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-dark-400">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Keine Administratoren gefunden</p>
                  </div>
                )}
              </motion.div>
              )}

              {/* Email Notification Settings - für alle User */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="card mb-8"
              >
                <h2 className="text-2xl font-bold mb-4 flex items-center">
                  <Mail className="w-6 h-6 mr-2 text-primary-500" />
                  E-Mail-Benachrichtigungen
                </h2>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
                    <div>
                      <p className="font-medium">Newsfeed-Benachrichtigungen</p>
                      <p className="text-sm text-dark-400">E-Mails bei neuen Posts im Newsfeed erhalten</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={emailNotificationsEnabled}
                        onChange={(e) => handleEmailNotificationToggle(e.target.checked)}
                        disabled={isSavingNotifications}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-dark-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                    </label>
                  </div>
                </div>
              </motion.div>

              {/* Subdomain Management - nur für Admins */}
              {isAdmin && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="card"
              >
                <h2 className="text-2xl font-bold mb-4 flex items-center">
                  <Globe className="w-6 h-6 mr-2 text-primary-500" />
                  Subdomain verwalten
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-dark-400 text-sm font-medium mb-2">
                      Gewünschte Subdomain
                    </label>
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={subdomainInput}
                          onChange={(e) => setSubdomainInput(e.target.value.toLowerCase())}
                          placeholder="meinname"
                          className="input w-full pr-32"
                        />
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-dark-400 text-sm">
                          .viraltenant.com
                        </div>
                      </div>
                      
                      <button
                        onClick={checkSubdomainAvailability}
                        disabled={!subdomainInput.trim() || !isValidSubdomain(subdomainInput) || isChecking}
                        className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isChecking ? 'Prüfe...' : 'Verfügbarkeit prüfen'}
                      </button>
                    </div>
                    
                    {/* Validation Messages */}
                    {subdomainInput && !isValidSubdomain(subdomainInput) && (
                      <p className="text-red-400 text-sm mt-2">
                        Subdomain muss 3-20 Zeichen lang sein, nur Kleinbuchstaben, Zahlen und Bindestriche enthalten
                      </p>
                    )}
                  </div>

                  {/* Check Result */}
                  {checkResult && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`p-4 rounded-lg flex items-center space-x-3 ${
                        checkResult.available 
                          ? 'bg-green-500/20 border border-green-500/30' 
                          : 'bg-red-500/20 border border-red-500/30'
                      }`}
                    >
                      {checkResult.available ? (
                        <Check className="w-5 h-5 text-green-400" />
                      ) : (
                        <X className="w-5 h-5 text-red-400" />
                      )}
                      <div>
                        <p className={`font-medium ${checkResult.available ? 'text-green-300' : 'text-red-300'}`}>
                          {checkResult.available ? 'Subdomain verfügbar!' : 'Subdomain nicht verfügbar'}
                        </p>
                        {checkResult.message && (
                          <p className="text-sm text-dark-400 mt-1">{checkResult.message}</p>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* Create Button */}
                  {checkResult?.available && (
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={createSubdomain}
                      disabled={isCreating}
                      className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Sparkles size={16} />
                      {isCreating ? 'Erstelle Subdomain...' : `${subdomainInput}.viraltenant.com erstellen`}
                    </motion.button>
                  )}

                  {/* Error Message */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-4 bg-red-500/20 border border-red-500/30 rounded-lg"
                    >
                      <p className="text-red-300 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-2" />
                        {error}
                      </p>
                    </motion.div>
                  )}
                </div>
              </motion.div>
              )}
            </>
          )}

          {/* Billing Tab (nur für Tenant-Admins) */}
          {activeTab === 'billing' && isTenantAdmin && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card"
            >
              <BillingManagement tenantId={(tenant || selectedPlatformTenant)?.id} />
            </motion.div>
          )}

          {/* Design Tab (nur für Tenant-Admins) */}
          {activeTab === 'design' && isTenantAdmin && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <TenantDesignSettings />
            </motion.div>
          )}

          {/* Members Tab (nur für Tenant-Admins) */}
          {activeTab === 'members' && isTenantAdmin && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card"
            >
              <TenantMembers tenantId={(tenant || selectedPlatformTenant)?.id || ''} />
            </motion.div>
          )}

          {/* Membership Tab - für alle User */}
          {activeTab === 'membership' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto"
            >
              {membershipInfoLoading || premiumLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                </div>
              ) : !membershipInfo?.enabled ? (
                /* Membership not available */
                <div className="card text-center py-16">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-dark-800 flex items-center justify-center">
                    <Crown className="w-10 h-10 text-dark-500" />
                  </div>
                  <h2 className="text-2xl font-bold mb-4">Keine Mitgliedschaft verfügbar</h2>
                  <p className="text-dark-400">
                    Der Creator hat noch keine Mitgliedschaft eingerichtet.
                  </p>
                </div>
              ) : isPremium || isTenantAdmin ? (
                /* Premium User View */
                <div className="space-y-6">
                  {/* Status Card */}
                  <div className="bg-gradient-to-br from-yellow-500/10 to-amber-500/5 rounded-2xl border border-yellow-500/30 p-8">
                    <div className="flex items-start justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center">
                          <Crown className="w-8 h-8 text-yellow-400" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold text-yellow-400">
                            {isTenantAdmin ? 'Admin-Zugang' : membershipInfo.title || 'Premium-Mitglied'}
                          </h2>
                          <p className="text-dark-400">
                            {isTenantAdmin 
                              ? 'Du hast als Admin vollen Zugang zu allen Inhalten.'
                              : 'Du hast Zugang zu allen exklusiven Inhalten.'}
                          </p>
                        </div>
                      </div>
                      
                      {!isTenantAdmin && membershipStatus?.membership && (
                        <div className="text-right">
                          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                            membershipStatus.membership.status === 'active'
                              ? 'bg-green-500/20 text-green-400'
                              : membershipStatus.membership.status === 'cancelled'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-dark-700 text-dark-400'
                          }`}>
                            {membershipStatus.membership.status === 'active' && <CheckCircle className="w-4 h-4" />}
                            {membershipStatus.membership.status === 'cancelled' && <AlertCircle className="w-4 h-4" />}
                            {membershipStatus.membership.status === 'active' ? 'Aktiv' : 
                             membershipStatus.membership.status === 'cancelled' ? 'Gekündigt' : 
                             membershipStatus.membership.status}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Membership Details */}
                    {!isTenantAdmin && membershipStatus?.membership && (
                      <div className="mt-6 pt-6 border-t border-yellow-500/20 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-dark-400">Preis</p>
                          <p className="font-semibold">€{membershipStatus.membership.price.toFixed(2)}/Monat</p>
                        </div>
                        <div>
                          <p className="text-sm text-dark-400">Mitglied seit</p>
                          <p className="font-semibold">{formatDate(membershipStatus.membership.startedAt)}</p>
                        </div>
                        {membershipStatus.membership.cancelledAt && (
                          <div>
                            <p className="text-sm text-dark-400">Gekündigt am</p>
                            <p className="font-semibold">{formatDate(membershipStatus.membership.cancelledAt)}</p>
                          </div>
                        )}
                        {membershipStatus.membership.expiresAt && (
                          <div>
                            <p className="text-sm text-dark-400">Zugang bis</p>
                            <p className="font-semibold">{formatDate(membershipStatus.membership.expiresAt)}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Cancel Button */}
                    {!isTenantAdmin && membershipStatus?.membership?.status === 'active' && (
                      <div className="mt-6 pt-6 border-t border-yellow-500/20">
                        <button
                          onClick={handleCancelMembership}
                          disabled={cancelling}
                          className="text-sm text-dark-400 hover:text-red-400 transition-colors flex items-center gap-2"
                        >
                          {cancelling ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          Mitgliedschaft kündigen
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Benefits */}
                  {membershipInfo.benefits && membershipInfo.benefits.length > 0 && (
                    <div className="card">
                      <h3 className="text-lg font-bold mb-4">Deine Vorteile</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {membershipInfo.benefits.map((benefit, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-dark-900 rounded-lg">
                            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                            <span>{benefit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick Links */}
                  <div className="card">
                    <h3 className="text-lg font-bold mb-4">Exklusive Inhalte</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <a
                        href="/videos"
                        className="p-4 bg-dark-900 rounded-xl hover:bg-dark-800 transition-colors text-left block"
                      >
                        <Video className="w-8 h-8 text-primary-500 mb-2" />
                        <p className="font-semibold">Exklusive Videos</p>
                        <p className="text-sm text-dark-400">Alle Premium-Videos ansehen</p>
                      </a>
                      <a
                        href="/live"
                        className="p-4 bg-dark-900 rounded-xl hover:bg-dark-800 transition-colors text-left block"
                      >
                        <Crown className="w-8 h-8 text-yellow-500 mb-2" />
                        <p className="font-semibold">Exklusive Streams</p>
                        <p className="text-sm text-dark-400">Members-Only Livestreams</p>
                      </a>
                      <a
                        href="/newsfeed"
                        className="p-4 bg-dark-900 rounded-xl hover:bg-dark-800 transition-colors text-left block"
                      >
                        <CreditCard className="w-8 h-8 text-green-500 mb-2" />
                        <p className="font-semibold">Exklusive Posts</p>
                        <p className="text-sm text-dark-400">Premium Newsfeed-Beiträge</p>
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                /* Non-Premium User View - Membership Offer */
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left: Info */}
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-3xl font-bold mb-4">{membershipInfo.title || 'Premium-Mitgliedschaft'}</h2>
                      {membershipInfo.description && (
                        <p className="text-dark-400 text-lg">{membershipInfo.description}</p>
                      )}
                    </div>

                    {/* Benefits */}
                    {membershipInfo.benefits && membershipInfo.benefits.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="font-semibold text-lg">Das erwartet dich:</h3>
                        {membershipInfo.benefits.map((benefit, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex items-start gap-3"
                          >
                            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                            <span>{benefit}</span>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right: Pricing Card */}
                  <div>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-gradient-to-br from-yellow-500/10 to-amber-500/5 rounded-2xl border-2 border-yellow-500/50 p-8 sticky top-4"
                    >
                      {/* Header */}
                      <div className="text-center mb-6">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
                          <Crown className="w-8 h-8 text-yellow-400" />
                        </div>
                        <h3 className="text-xl font-bold">{membershipInfo.title || 'Premium'}</h3>
                      </div>

                      {/* Price */}
                      <div className="text-center mb-6 pb-6 border-b border-yellow-500/20">
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-5xl font-bold text-yellow-400">
                            €{membershipInfo.monthly_price?.toFixed(2)}
                          </span>
                          <span className="text-dark-400">/Monat</span>
                        </div>
                      </div>

                      {/* CTA */}
                      <button
                        onClick={handleSubscribe}
                        disabled={subscribing}
                        className="w-full py-4 px-6 bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-bold rounded-xl hover:from-yellow-400 hover:to-amber-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {subscribing ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <Crown className="w-5 h-5" />
                            Jetzt Mitglied werden
                          </>
                        )}
                      </button>

                      <p className="text-xs text-dark-500 text-center mt-4">
                        Jederzeit kündbar • Sichere Zahlung via Mollie
                      </p>
                    </motion.div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}