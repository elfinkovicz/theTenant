import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Github, Twitter, Youtube, Instagram } from 'lucide-react'
import { heroService, HeroContent } from '../../services/hero.service'

export const Footer = () => {
  const currentYear = new Date().getFullYear()
  const [heroContent, setHeroContent] = useState<HeroContent | null>(null)

  useEffect(() => {
    heroService.getHeroContent()
      .then(setHeroContent)
      .catch(err => console.error('Failed to load hero content for footer:', err))
  }, [])

  return (
    <footer className="border-t mt-20" style={{ backgroundColor: 'rgb(var(--color-background-light))', borderColor: 'rgb(var(--color-border))' }}>
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="text-2xl font-bold glow-text">{heroContent?.title || 'Your Brand'}</div>
            <p className="whitespace-pre-line" style={{ color: 'rgb(var(--color-text-secondary))' }}>
              {heroContent?.subtitle || 'Your modern creator platform for live streaming, events and community.'}
            </p>
            <div className="flex space-x-4">
              <a href="#" className="transition-colors hover:opacity-80" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                <Youtube size={20} />
              </a>
              <a href="#" className="transition-colors hover:opacity-80" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                <Twitter size={20} />
              </a>
              <a href="#" className="transition-colors hover:opacity-80" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                <Instagram size={20} />
              </a>
              <a href="#" className="transition-colors hover:opacity-80" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                <Github size={20} />
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="font-semibold mb-4" style={{ color: 'rgb(var(--color-text))' }}>Navigation</h3>
            <ul className="space-y-2">
              <li><Link to="/" className="transition-colors hover:opacity-80" style={{ color: 'rgb(var(--color-text-secondary))' }}>Home</Link></li>
              <li><Link to="/live" className="transition-colors hover:opacity-80" style={{ color: 'rgb(var(--color-text-secondary))' }}>Live</Link></li>
              <li><Link to="/shop" className="transition-colors hover:opacity-80" style={{ color: 'rgb(var(--color-text-secondary))' }}>Shop</Link></li>
              <li><Link to="/events" className="transition-colors hover:opacity-80" style={{ color: 'rgb(var(--color-text-secondary))' }}>Events</Link></li>
            </ul>
          </div>

          {/* Community */}
          <div>
            <h3 className="font-semibold mb-4" style={{ color: 'rgb(var(--color-text))' }}>Community</h3>
            <ul className="space-y-2">
              <li><Link to="/channels" className="transition-colors hover:opacity-80" style={{ color: 'rgb(var(--color-text-secondary))' }}>Kanäle</Link></li>
              <li><Link to="/team" className="transition-colors hover:opacity-80" style={{ color: 'rgb(var(--color-text-secondary))' }}>Team</Link></li>
              <li><Link to="/contact" className="transition-colors hover:opacity-80" style={{ color: 'rgb(var(--color-text-secondary))' }}>Kontakt</Link></li>
              <li><Link to="/tenant" className="transition-colors hover:opacity-80" style={{ color: 'rgb(var(--color-text-secondary))' }}>Tenant</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold mb-4" style={{ color: 'rgb(var(--color-text))' }}>Rechtliches</h3>
            <ul className="space-y-2">
              <li><Link to="/legal?tab=impressum" className="transition-colors hover:opacity-80" style={{ color: 'rgb(var(--color-text-secondary))' }}>Impressum</Link></li>
              <li><Link to="/legal?tab=datenschutz" className="transition-colors hover:opacity-80" style={{ color: 'rgb(var(--color-text-secondary))' }}>Datenschutz</Link></li>
              <li><Link to="/legal?tab=agb" className="transition-colors hover:opacity-80" style={{ color: 'rgb(var(--color-text-secondary))' }}>AGB</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t text-center" style={{ borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-secondary))' }}>
          <p>© {currentYear} The Viral Tenant, your Whitelabel Creator Platform</p>
        </div>
      </div>
    </footer>
  )
}
