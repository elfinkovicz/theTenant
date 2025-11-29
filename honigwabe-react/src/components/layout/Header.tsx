import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Menu, X, User, LogOut } from 'lucide-react'
import { useAuthStore } from '@store/authStore'
import clsx from 'clsx'

export const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const location = useLocation()
  const { isAuthenticated, user, logout } = useAuthStore()

  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/live', label: 'Live' },
    { path: '/videos', label: 'Videos' },
    { path: '/shop', label: 'Shop' },
    { path: '/events', label: 'Events' },
    { path: '/channels', label: 'Channels' },
    { path: '/team', label: 'Team' },
    { path: '/contact', label: 'Contact' },
  ]

  const isActive = (path: string) => location.pathname === path

  return (
    <header className="sticky top-0 z-50 glass border-b border-dark-800">
      <nav className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="text-2xl font-bold glow-text flex items-center gap-2"
            >
              <span className="text-3xl">🎬</span>
              <span>Your Brand</span>
            </motion.div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={clsx(
                  'relative py-2 transition-colors duration-300',
                  isActive(item.path)
                    ? 'text-primary-400'
                    : 'text-dark-300 hover:text-white'
                )}
              >
                {item.label}
                {isActive(item.path) && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            ))}
          </div>

          {/* Actions */}
          <div className="hidden lg:flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="flex items-center space-x-4">
                <Link
                  to="/exclusive"
                  className="flex items-center space-x-2 text-dark-300 hover:text-white transition-colors"
                >
                  <User size={20} />
                  <span>{user?.email}</span>
                </Link>
                <button
                  onClick={logout}
                  className="p-2 rounded-lg hover:bg-dark-800 transition-colors"
                >
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link to="/login" className="btn-secondary">
                  Login
                </Link>
                <Link to="/register" className="btn-primary">
                  Registrieren
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-dark-800 transition-colors"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden mt-4 space-y-4"
          >
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMenuOpen(false)}
                className={clsx(
                  'block py-2 px-4 rounded-lg transition-colors',
                  isActive(item.path)
                    ? 'bg-primary-600 text-white'
                    : 'text-dark-300 hover:bg-dark-800 hover:text-white'
                )}
              >
                {item.label}
              </Link>
            ))}
            
            <div className="pt-4 border-t border-dark-800 space-y-4">
              {isAuthenticated ? (
                <>
                  <Link
                    to="/exclusive"
                    onClick={() => setIsMenuOpen(false)}
                    className="block py-2 px-4 rounded-lg text-dark-300 hover:bg-dark-800 hover:text-white transition-colors"
                  >
                    Profil
                  </Link>
                  <button
                    onClick={() => {
                      logout()
                      setIsMenuOpen(false)
                    }}
                    className="w-full text-left py-2 px-4 rounded-lg text-dark-300 hover:bg-dark-800 hover:text-white transition-colors"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setIsMenuOpen(false)}
                    className="block btn-secondary text-center"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setIsMenuOpen(false)}
                    className="block btn-primary text-center"
                  >
                    Registrieren
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </nav>
    </header>
  )
}
