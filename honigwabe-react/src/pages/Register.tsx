import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, UserPlus } from 'lucide-react'
import { useAuthStore } from '@store/authStore'

export const Register = () => {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { register } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      alert('Passwörter stimmen nicht überein')
      return
    }
    
    if (password.length < 8) {
      alert('Passwort muss mindestens 8 Zeichen lang sein')
      return
    }

    if (username.length < 3) {
      alert('Username muss mindestens 3 Zeichen lang sein')
      return
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      alert('Username darf nur Buchstaben, Zahlen und Unterstriche enthalten')
      return
    }
    
    setIsLoading(true)
    
    try {
      await register(email, username, password)
      // Weiterleitung zur E-Mail-Bestätigung
      navigate(`/confirm-email?email=${encodeURIComponent(email)}`)
      alert('✅ Registrierung erfolgreich! Bitte bestätige deine E-Mail.')
    } catch (error: any) {
      console.error('Registration failed:', error)
      alert(`❌ Registrierung fehlgeschlagen: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🍯</div>
          <h1 className="text-3xl font-bold mb-2">Werde Teil der Community!</h1>
          <p className="text-dark-400">Erstelle dein kostenloses Konto</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Username
              </label>
              <div className="relative">
                <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={20} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input pl-10 w-full"
                  placeholder="deinusername"
                  required
                  minLength={3}
                  maxLength={20}
                  pattern="[a-zA-Z0-9_]+"
                  title="Nur Buchstaben, Zahlen und Unterstriche"
                />
              </div>
              <p className="text-xs text-dark-500 mt-1">
                Wird im Chat angezeigt (3-20 Zeichen, nur Buchstaben, Zahlen und _)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                E-Mail
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={20} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-10 w-full"
                  placeholder="deine@email.de"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Passwort
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={20} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-10 w-full"
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
              </div>
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
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input pl-10 w-full"
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
              </div>
            </div>

            <div className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" required />
              <span className="text-sm text-dark-400">
                Ich akzeptiere die{' '}
                <a href="#" className="text-primary-400 hover:text-primary-300">
                  AGB
                </a>{' '}
                und{' '}
                <a href="#" className="text-primary-400 hover:text-primary-300">
                  Datenschutzerklärung
                </a>
              </span>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <UserPlus size={20} />
              {isLoading ? 'Wird erstellt...' : 'Konto erstellen'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-dark-400">
              Bereits ein Konto?{' '}
              <Link to="/login" className="text-primary-400 hover:text-primary-300 font-semibold">
                Jetzt anmelden
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
