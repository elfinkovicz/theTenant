import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, LogIn } from 'lucide-react'
import { useAuthStore } from '@store/authStore'
import { heroService, HeroContent } from '../services/hero.service'

export const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [heroContent, setHeroContent] = useState<HeroContent | null>(null)
  const navigate = useNavigate()
  const { login } = useAuthStore()

  useEffect(() => {
    loadHeroContent()
  }, [])

  const loadHeroContent = async () => {
    try {
      const content = await heroService.getHeroContent()
      setHeroContent(content)
    } catch (error) {
      console.error('Failed to load hero content:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      await login(email, password)
      navigate('/exclusive')
    } catch (error) {
      console.error('Login failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {heroContent?.logoUrl ? (
            <div 
              className="mx-auto mb-4"
              style={{
                width: `${typeof heroContent.logoSize === 'number' ? Math.min(heroContent.logoSize, 200) : 120}px`,
                height: `${typeof heroContent.logoSize === 'number' ? Math.min(heroContent.logoSize, 200) : 120}px`
              }}
            >
              <img 
                src={heroContent.logoUrl} 
                alt="Logo" 
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="text-6xl mb-4">🐝</div>
          )}
          <h1 className="text-3xl font-bold mb-2">Willkommen zurück!</h1>
          <p className="text-dark-400">Melde dich an, um fortzufahren</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-6">
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
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded" />
                <span className="text-sm text-dark-400">Angemeldet bleiben</span>
              </label>
              <a href="#" className="text-sm text-primary-400 hover:text-primary-300">
                Passwort vergessen?
              </a>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <LogIn size={20} />
              {isLoading ? 'Wird angemeldet...' : 'Anmelden'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-dark-400">
              Noch kein Konto?{' '}
              <Link to="/register" className="text-primary-400 hover:text-primary-300 font-semibold">
                Jetzt registrieren
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
