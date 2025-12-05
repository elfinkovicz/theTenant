import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, ArrowLeft, CheckCircle } from 'lucide-react'
import { useAuthStore } from '@store/authStore'

export const ForgotPassword = () => {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()
  const { forgotPassword, confirmForgotPassword } = useAuthStore()

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      await forgotPassword(email)
      setStep('code')
    } catch (error: any) {
      console.error('Send code failed:', error)
      if (error.message?.includes('UserNotFoundException')) {
        setError('Kein Konto mit dieser E-Mail gefunden.')
      } else if (error.message?.includes('LimitExceededException')) {
        setError('Zu viele Anfragen. Bitte warte einen Moment.')
      } else {
        setError(error.message || 'Fehler beim Senden des Codes. Bitte versuche es erneut.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validierung
    if (newPassword.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Die Passwörter stimmen nicht überein.')
      return
    }

    setIsLoading(true)

    try {
      await confirmForgotPassword(email, code, newPassword)
      setSuccess(true)
      
      // Nach 2 Sekunden zur Login-Seite
      setTimeout(() => {
        navigate('/login')
      }, 2000)
    } catch (error: any) {
      console.error('Reset password failed:', error)
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      })
      
      if (error.message?.includes('CodeMismatchException') || error.message?.includes('CodeMismatch')) {
        setError('Ungültiger Code. Bitte prüfe den Code und versuche es erneut.')
      } else if (error.message?.includes('ExpiredCodeException') || error.message?.includes('ExpiredCode')) {
        setError('Der Code ist abgelaufen. Bitte fordere einen neuen Code an.')
      } else if (error.message?.includes('InvalidPasswordException') || error.message?.includes('InvalidPassword')) {
        setError('Das Passwort erfüllt nicht die Anforderungen. Es muss mindestens 8 Zeichen, einen Großbuchstaben, eine Zahl und ein Sonderzeichen enthalten.')
      } else if (error.message?.includes('HTTP 404')) {
        setError('API-Endpunkt nicht gefunden. Bitte kontaktiere den Support.')
      } else if (error.message?.includes('HTTP 500')) {
        setError('Server-Fehler. Bitte versuche es später erneut.')
      } else {
        setError(error.message || 'Fehler beim Zurücksetzen des Passworts.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendCode = async () => {
    setIsLoading(true)
    setError(null)

    try {
      await forgotPassword(email)
      setError(null)
      // Zeige Erfolg an
      const successMsg = 'Code wurde erneut gesendet!'
      setError(successMsg)
      setTimeout(() => setError(null), 3000)
    } catch (error: any) {
      setError(error.message || 'Fehler beim erneuten Senden des Codes.')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="card text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="text-green-500" size={64} />
            </div>
            <h1 className="text-2xl font-bold mb-2">Passwort erfolgreich zurückgesetzt!</h1>
            <p className="text-dark-400 mb-6">
              Du wirst in Kürze zur Login-Seite weitergeleitet...
            </p>
            <Link to="/login" className="btn-primary inline-block">
              Jetzt anmelden
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🔐</div>
          <h1 className="text-3xl font-bold mb-2">
            {step === 'email' ? 'Passwort vergessen?' : 'Neues Passwort setzen'}
          </h1>
          <p className="text-dark-400">
            {step === 'email' 
              ? 'Gib deine E-Mail ein und wir senden dir einen Code zum Zurücksetzen.'
              : 'Gib den Code aus der E-Mail und dein neues Passwort ein.'}
          </p>
        </div>

        <div className="card">
          {step === 'email' ? (
            <form onSubmit={handleSendCode} className="space-y-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">
                  E-Mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={20} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setError(null)
                    }}
                    className="input pl-10 w-full"
                    placeholder="deine@email.de"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full"
              >
                {isLoading ? 'Wird gesendet...' : 'Code senden'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-6">
              {error && (
                <div className={`${error.includes('erneut gesendet') ? 'bg-green-500/10 border-green-500/50' : 'bg-red-500/10 border-red-500/50'} border rounded-lg p-4`}>
                  <p className={`${error.includes('erneut gesendet') ? 'text-green-400' : 'text-red-400'} text-sm`}>{error}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">
                  Bestätigungscode
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value)
                    setError(null)
                  }}
                  className="input w-full"
                  placeholder="123456"
                  required
                />
                <p className="text-xs text-dark-400 mt-1">
                  Prüfe deine E-Mails für den 6-stelligen Code
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Neues Passwort
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={20} />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value)
                      setError(null)
                    }}
                    className="input pl-10 w-full"
                    placeholder="••••••••"
                    required
                  />
                </div>
                <p className="text-xs text-dark-400 mt-1">
                  Mindestens 8 Zeichen, 1 Großbuchstabe, 1 Zahl, 1 Sonderzeichen
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Passwort bestätigen
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={20} />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value)
                      setError(null)
                    }}
                    className="input pl-10 w-full"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full"
              >
                {isLoading ? 'Wird zurückgesetzt...' : 'Passwort zurücksetzen'}
              </button>

              <button
                type="button"
                onClick={handleResendCode}
                disabled={isLoading}
                className="btn-secondary w-full"
              >
                Code erneut senden
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link to="/login" className="text-primary-400 hover:text-primary-300 inline-flex items-center gap-2">
              <ArrowLeft size={16} />
              Zurück zum Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
