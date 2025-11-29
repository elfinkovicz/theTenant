import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Mail, Check } from 'lucide-react'
import { useAuthStore } from '@store/authStore'

export const ConfirmEmail = () => {
  const [searchParams] = useSearchParams()
  const emailFromUrl = searchParams.get('email') || ''
  
  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { confirmEmail, resendCode, pendingEmail } = useAuthStore()
  
  const email = emailFromUrl || pendingEmail || ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    
    try {
      await confirmEmail(email, code)
      alert('✅ E-Mail erfolgreich bestätigt! Du kannst dich jetzt anmelden.')
      navigate('/login')
    } catch (error: any) {
      setError(error.message || 'Bestätigung fehlgeschlagen')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    setError('')
    setIsLoading(true)
    
    try {
      await resendCode(email)
      alert('✅ Bestätigungscode wurde erneut gesendet!')
    } catch (error: any) {
      setError(error.message || 'Fehler beim Senden')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-full mb-4">
            <Mail size={32} />
          </div>
          <h1 className="text-3xl font-bold mb-2">E-Mail bestätigen</h1>
          <p className="text-dark-400">
            Wir haben dir einen Bestätigungscode an<br />
            <strong>{email}</strong> gesendet
          </p>
        </div>

        <div className="card">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Bestätigungscode
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="input w-full text-center text-2xl tracking-widest"
                placeholder="123456"
                required
                maxLength={6}
                pattern="[0-9]{6}"
              />
              <p className="text-xs text-dark-400 mt-2">
                Gib den 6-stelligen Code aus der E-Mail ein
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading || code.length !== 6}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Check size={20} />
              {isLoading ? 'Wird bestätigt...' : 'E-Mail bestätigen'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-dark-400 text-sm mb-2">
              Keinen Code erhalten?
            </p>
            <button
              onClick={handleResend}
              disabled={isLoading}
              className="text-primary-400 hover:text-primary-300 font-semibold text-sm"
            >
              Code erneut senden
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
