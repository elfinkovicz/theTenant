import { Link } from 'react-router-dom'
import { Github, Twitter, Youtube, Instagram } from 'lucide-react'

export const Footer = () => {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-dark-900 border-t border-dark-800 mt-20">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="text-2xl font-bold glow-text">Your Brand</div>
            <p className="text-dark-400">
              Your modern creator platform for live streaming, events and community.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-dark-400 hover:text-primary-500 transition-colors">
                <Youtube size={20} />
              </a>
              <a href="#" className="text-dark-400 hover:text-primary-500 transition-colors">
                <Twitter size={20} />
              </a>
              <a href="#" className="text-dark-400 hover:text-primary-500 transition-colors">
                <Instagram size={20} />
              </a>
              <a href="#" className="text-dark-400 hover:text-primary-500 transition-colors">
                <Github size={20} />
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="font-semibold mb-4">Navigation</h3>
            <ul className="space-y-2">
              <li><Link to="/" className="text-dark-400 hover:text-white transition-colors">Home</Link></li>
              <li><Link to="/live" className="text-dark-400 hover:text-white transition-colors">Live</Link></li>
              <li><Link to="/shop" className="text-dark-400 hover:text-white transition-colors">Shop</Link></li>
              <li><Link to="/events" className="text-dark-400 hover:text-white transition-colors">Events</Link></li>
            </ul>
          </div>

          {/* Community */}
          <div>
            <h3 className="font-semibold mb-4">Community</h3>
            <ul className="space-y-2">
              <li><Link to="/channels" className="text-dark-400 hover:text-white transition-colors">Kanäle</Link></li>
              <li><Link to="/team" className="text-dark-400 hover:text-white transition-colors">Team</Link></li>
              <li><Link to="/contact" className="text-dark-400 hover:text-white transition-colors">Kontakt</Link></li>
              <li><Link to="/exclusive" className="text-dark-400 hover:text-white transition-colors">Exklusiv</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold mb-4">Rechtliches</h3>
            <ul className="space-y-2">
              <li><Link to="/legal?tab=impressum" className="text-dark-400 hover:text-white transition-colors">Impressum</Link></li>
              <li><Link to="/legal?tab=datenschutz" className="text-dark-400 hover:text-white transition-colors">Datenschutz</Link></li>
              <li><Link to="/legal?tab=agb" className="text-dark-400 hover:text-white transition-colors">AGB</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-dark-800 text-center text-dark-400">
          <p>© {currentYear} Your Brand. Whitelabel Creator Platform</p>
        </div>
      </div>
    </footer>
  )
}
