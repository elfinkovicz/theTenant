import { useState } from 'react'
import { motion } from 'framer-motion'
import { Crown, User, Mail, Globe, AlertCircle, CheckCircle, Loader, ArrowRight, ArrowLeft, KeyRound } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { awsConfig } from '../config/aws-config'
import { usePlatformTenant } from '../hooks/usePlatformTenant'

interface TenantRegistrationData {
  firstName: string
  lastName: string
  creatorEmail: string
  phone: string
  subdomain: string
}

type Step = 'form' | 'verify' | 'success'

export function TenantRegistration() {
  const { isPlatform, isLoading: tenantLoading } = usePlatformTenant()
  
  // Redirect to home if not on platform tenant
  if (!tenantLoading && !isPlatform) {
    return <Navigate to="/" replace />
  }

  const [step, setStep] = useState<Step>('form')
  const [formData, setFormData] = useState<TenantRegistrationData>({
    firstName: '',
    lastName: '',
    creatorEmail: '',
    phone: '',
    subdomain: ''
  })
  const [verificationCode, setVerificationCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successData, setSuccessData] = useState<{ tenantId: string; subdomain: string; url: string } | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'Vorname ist erforderlich'
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Nachname ist erforderlich'
    }

    if (!formData.creatorEmail.trim()) {
      newErrors.creatorEmail = 'E-Mail ist erforderlich'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.creatorEmail)) {
      newErrors.creatorEmail = 'Ungültige E-Mail-Adresse'
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Telefonnummer ist erforderlich'
    } else if (!/^[\d\s\+\-\(\)]{6,20}$/.test(formData.phone)) {
      newErrors.phone = 'Ungültige Telefonnummer'
    }

    if (!formData.subdomain.trim()) {
      newErrors.subdomain = 'Subdomain ist erforderlich'
    } else if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(formData.subdomain) && formData.subdomain.length > 2) {
      newErrors.subdomain = 'Subdomain darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten'
    } else if (formData.subdomain.length < 3 || formData.subdomain.length > 20) {
      newErrors.subdomain = 'Subdomain muss zwischen 3 und 20 Zeichen lang sein'
    }

    const blacklistedSubdomains = ['www', 'api', 'admin', 'app', 'mail', 'ftp', 'cdn', 'assets', 'support', 'help']
    if (blacklistedSubdomains.includes(formData.subdomain.toLowerCase())) {
      newErrors.subdomain = 'Diese Subdomain ist reserviert'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (field: keyof TenantRegistrationData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: field === 'subdomain' ? value.toLowerCase() : value
    }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  // Step 1: Send verification code
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`${awsConfig.api.user}/admin/tenants/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok) {
        setStep('verify')
      } else {
        setError(data.message || 'Fehler beim Senden des Codes')
      }
    } catch (err) {
      setError('Netzwerkfehler. Bitte versuchen Sie es erneut.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Step 2: Verify code and create tenant
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Bitte geben Sie den 6-stelligen Code ein')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`${awsConfig.api.user}/admin/tenants/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.creatorEmail, code: verificationCode })
      })

      const data = await response.json()

      if (response.ok) {
        setSuccessData({ tenantId: data.tenantId, subdomain: data.subdomain, url: data.url })
        setStep('success')
      } else {
        setError(data.message || 'Ungültiger Verifizierungscode')
      }
    } catch (err) {
      setError('Netzwerkfehler. Bitte versuchen Sie es erneut.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Resend verification code
  const handleResendCode = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`${awsConfig.api.user}/admin/tenants/resend-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.creatorEmail })
      })

      const data = await response.json()

      if (response.ok) {
        setError(null)
        alert('Neuer Code wurde gesendet!')
      } else {
        setError(data.message || 'Fehler beim erneuten Senden')
      }
    } catch (err) {
      setError('Netzwerkfehler')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Render Step Indicator
  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-4 mb-8">
      {['Daten eingeben', 'E-Mail verifizieren', 'Fertig'].map((label, idx) => {
        const stepNum = idx + 1
        const isActive = (step === 'form' && idx === 0) || (step === 'verify' && idx === 1) || (step === 'success' && idx === 2)
        const isCompleted = (step === 'verify' && idx === 0) || (step === 'success' && idx <= 1)
        return (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              isCompleted ? 'bg-green-500 text-white' : isActive ? 'bg-primary-500 text-white' : 'bg-dark-700 text-dark-400'
            }`}>
              {isCompleted ? '✓' : stepNum}
            </div>
            <span className={`text-sm hidden sm:inline ${isActive ? 'text-white' : 'text-dark-400'}`}>{label}</span>
            {idx < 2 && <div className="w-8 h-0.5 bg-dark-700" />}
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="container mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Crown size={40} className="text-primary-500" />
              <h1 className="text-4xl font-bold">
                <span className="glow-text">Neuen Tenant erstellen</span>
              </h1>
            </div>
            <p className="text-dark-400 text-lg">
              Erstellen Sie Ihren eigenen Creator-Bereich mit eigener Subdomain
            </p>
          </div>

          <StepIndicator />

          {/* Error Message */}
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card mb-6 border-red-500/30 bg-red-500/10">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-red-400" />
                <p className="text-red-300">{error}</p>
              </div>
            </motion.div>
          )}

          {/* Step 1: Form */}
          {step === 'form' && (
            <div className="card">
              <form onSubmit={handleSendCode} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-dark-400 text-sm font-medium mb-2">
                      <User className="w-4 h-4 inline mr-2" />Vorname
                    </label>
                    <input type="text" value={formData.firstName} onChange={(e) => handleInputChange('firstName', e.target.value)}
                      placeholder="Max" className={`input w-full ${errors.firstName ? 'border-red-500' : ''}`} disabled={isSubmitting} />
                    {errors.firstName && <p className="text-red-400 text-sm mt-1">{errors.firstName}</p>}
                  </div>

                  <div>
                    <label className="block text-dark-400 text-sm font-medium mb-2">
                      <User className="w-4 h-4 inline mr-2" />Nachname
                    </label>
                    <input type="text" value={formData.lastName} onChange={(e) => handleInputChange('lastName', e.target.value)}
                      placeholder="Mustermann" className={`input w-full ${errors.lastName ? 'border-red-500' : ''}`} disabled={isSubmitting} />
                    {errors.lastName && <p className="text-red-400 text-sm mt-1">{errors.lastName}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-dark-400 text-sm font-medium mb-2">
                    <Mail className="w-4 h-4 inline mr-2" />E-Mail-Adresse
                  </label>
                  <input type="email" value={formData.creatorEmail} onChange={(e) => handleInputChange('creatorEmail', e.target.value)}
                    placeholder="creator@example.com" className={`input w-full ${errors.creatorEmail ? 'border-red-500' : ''}`} disabled={isSubmitting} />
                  {errors.creatorEmail && <p className="text-red-400 text-sm mt-1">{errors.creatorEmail}</p>}
                  <p className="text-dark-500 text-xs mt-1">An diese Adresse wird ein Verifizierungscode gesendet</p>
                </div>

                <div>
                  <label className="block text-dark-400 text-sm font-medium mb-2">
                    📞 Telefonnummer
                  </label>
                  <input type="tel" value={formData.phone} onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="+49 123 456789" className={`input w-full ${errors.phone ? 'border-red-500' : ''}`} disabled={isSubmitting} />
                  {errors.phone && <p className="text-red-400 text-sm mt-1">{errors.phone}</p>}
                </div>

                <div>
                  <label className="block text-dark-400 text-sm font-medium mb-2">
                    <Globe className="w-4 h-4 inline mr-2" />Subdomain
                  </label>
                  <div className="flex items-center">
                    <input type="text" value={formData.subdomain} onChange={(e) => handleInputChange('subdomain', e.target.value)}
                      placeholder="creator-name" className={`input flex-1 rounded-r-none ${errors.subdomain ? 'border-red-500' : ''}`} disabled={isSubmitting} />
                    <div className="bg-dark-800 border border-l-0 border-dark-600 px-3 py-2 rounded-r-lg text-dark-400">.viraltenant.com</div>
                  </div>
                  {errors.subdomain && <p className="text-red-400 text-sm mt-1">{errors.subdomain}</p>}
                </div>

                <button type="submit" disabled={isSubmitting} className="btn-primary w-full flex items-center justify-center gap-2">
                  {isSubmitting ? <><Loader className="w-4 h-4 animate-spin" />Sende Code...</> : <><ArrowRight className="w-4 h-4" />Weiter zur Verifizierung</>}
                </button>
              </form>
            </div>
          )}

          {/* Step 2: Verification */}
          {step === 'verify' && (
            <div className="card">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-primary-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <KeyRound className="w-8 h-8 text-primary-400" />
                </div>
                <h2 className="text-2xl font-bold mb-2">E-Mail verifizieren</h2>
                <p className="text-dark-400">
                  Wir haben einen 6-stelligen Code an <span className="text-primary-400">{formData.creatorEmail}</span> gesendet.
                </p>
              </div>

              <form onSubmit={handleVerify} className="space-y-6">
                <div>
                  <label className="block text-dark-400 text-sm font-medium mb-2 text-center">Verifizierungscode</label>
                  <input type="text" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000" maxLength={6}
                    className="input w-full text-center text-3xl tracking-[0.5em] font-mono" disabled={isSubmitting} autoFocus />
                </div>

                <div className="flex gap-4">
                  <button type="button" onClick={() => { setStep('form'); setVerificationCode(''); setError(null); }}
                    className="btn-secondary flex-1 flex items-center justify-center gap-2" disabled={isSubmitting}>
                    <ArrowLeft className="w-4 h-4" />Zurück
                  </button>
                  <button type="submit" disabled={isSubmitting || verificationCode.length !== 6}
                    className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
                    {isSubmitting ? <><Loader className="w-4 h-4 animate-spin" />Prüfe...</> : <><CheckCircle className="w-4 h-4" />Bestätigen</>}
                  </button>
                </div>

                <div className="text-center">
                  <button type="button" onClick={handleResendCode} disabled={isSubmitting} className="text-primary-400 hover:text-primary-300 text-sm">
                    Code nicht erhalten? Erneut senden
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Step 3: Success */}
          {step === 'success' && successData && (
            <div className="card text-center">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-400" />
              </div>
              <h2 className="text-3xl font-bold mb-4 text-green-400">Tenant erfolgreich erstellt!</h2>
              <p className="text-dark-400 mb-6">
                Ihre Zugangsdaten wurden an <span className="text-primary-400">{formData.creatorEmail}</span> gesendet.
              </p>

              <div className="bg-dark-800 rounded-lg p-6 mb-6 text-left">
                <h3 className="font-semibold text-primary-300 mb-4">Ihre Tenant-Informationen</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-dark-400">Subdomain:</span>
                    <a href={successData.url} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:text-primary-300">
                      {successData.subdomain}.viraltenant.com
                    </a>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-dark-400">Tenant-ID:</span>
                    <span className="font-mono text-sm">{successData.tenantId}</span>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
                <p className="text-yellow-300 text-sm">
                  📧 Prüfen Sie Ihren Posteingang für die Login-Daten. Schauen Sie auch im Spam-Ordner nach.
                </p>
              </div>

              <a href={`${successData.url}/login`} target="_blank" rel="noopener noreferrer"
                className="btn-primary inline-flex items-center gap-2">
                <ArrowRight className="w-4 h-4" />Zum Login
              </a>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}