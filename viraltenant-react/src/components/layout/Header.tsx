import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Menu, X, User, LogOut, Settings } from 'lucide-react'
import { useAuthStore } from '@store/authStore'
import { heroService, HeroContent } from '../../services/hero.service'
import { customPageService, CustomPage } from '../../services/customPage.service'
import { useAdmin } from '../../hooks/useAdmin'
import { usePlatformTenant } from '../../hooks/usePlatformTenant'
import { PageSettingsModal } from '../PageSettingsModal'
import clsx from 'clsx'

interface NavSettings {
  disabledPages: string[]
  pageLabels?: Record<string, string>
  pageSubtitles?: Record<string, string>
  customPages?: string[]
  pageOrder?: string[]
}

export const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showNavSettings, setShowNavSettings] = useState(false)
  const [heroContent, setHeroContent] = useState<HeroContent | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [navSettings, setNavSettings] = useState<NavSettings>({ disabledPages: [], pageLabels: {}, pageSubtitles: {} })
  const [customPages, setCustomPages] = useState<CustomPage[]>([])
  const location = useLocation()
  const { isAuthenticated, user, logout } = useAuthStore()
  const { isAdmin } = useAdmin()
  const { isPlatform } = usePlatformTenant()

  useEffect(() => {
    loadHeroContent()
    loadCustomPages()
  }, [])

  const loadHeroContent = async () => {
    try {
      const content = await heroService.getHeroContent()
      console.log('Header: Loaded hero content, navSettings:', content.navSettings);
      setHeroContent(content)
      if (content.navSettings) {
        const newNavSettings = {
          disabledPages: content.navSettings.disabledPages || [],
          pageLabels: content.navSettings.pageLabels || {},
          pageSubtitles: content.navSettings.pageSubtitles || {},
          customPages: content.navSettings.customPages || [],
          pageOrder: content.navSettings.pageOrder || []
        };
        console.log('Header: Setting navSettings state:', newNavSettings);
        setNavSettings(newNavSettings)
      }
    } catch (error) {
      console.error('Failed to load hero content:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadCustomPages = async () => {
    try {
      const pages = await customPageService.getCustomPages()
      setCustomPages(pages.filter(p => p.isPublished))
    } catch (error) {
      console.error('Failed to load custom pages:', error)
    }
  }

  const allNavItems: { path: string; label: string; platformOnly?: boolean; isCustom?: boolean }[] = [
    { path: '/', label: 'Home' },
    { path: '/live', label: 'Live' },
    { path: '/videos', label: 'Videos' },
    { path: '/podcasts', label: 'Podcasts' },
    { path: '/shop', label: 'Shop' },
    { path: '/events', label: 'Events' },
    { path: '/newsfeed', label: 'Newsfeed' },
    { path: '/channels', label: 'Channels' },
    { path: '/team', label: 'Team' },
    { path: '/contact', label: 'Kontakt' },
    { path: '/pricing', label: 'Preise', platformOnly: true },
    { path: '/tenant-registration', label: 'Tenant erstellen', platformOnly: true },
    // Add custom pages
    ...customPages.map(cp => ({
      path: `/page/${cp.slug}`,
      label: cp.title,
      isCustom: true
    }))
  ]

  // Get display label (custom or default)
  const getLabel = (item: { path: string; label: string }) => {
    return navSettings.pageLabels?.[item.path] || item.label
  }

  // Filter based on platform vs tenant context
  const contextFilteredItems = allNavItems.filter(item => {
    if (isPlatform) {
      return true // Platform shows ALL items
    } else {
      return !item.platformOnly // Tenants hide platform-only items
    }
  })

  // Filter out disabled pages for non-admins
  const filteredItems = isAdmin 
    ? contextFilteredItems 
    : contextFilteredItems.filter(item => !navSettings.disabledPages.includes(item.path))

  // Sort by pageOrder if available
  const navItems = navSettings.pageOrder && navSettings.pageOrder.length > 0
    ? [...filteredItems].sort((a, b) => {
        const indexA = navSettings.pageOrder!.indexOf(a.path)
        const indexB = navSettings.pageOrder!.indexOf(b.path)
        // Items not in pageOrder go to the end
        if (indexA === -1 && indexB === -1) return 0
        if (indexA === -1) return 1
        if (indexB === -1) return -1
        return indexA - indexB
      })
    : filteredItems

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
              {!isLoading && (
                <>
                  {heroContent?.navbarLogoUrl ? (
                    <div className="w-10 h-10">
                      <img 
                        src={heroContent.navbarLogoUrl} 
                        alt="Logo" 
                        className="w-full h-full object-contain bg-transparent" 
                      />
                    </div>
                  ) : (
                    <span className="text-3xl">🎬</span>
                  )}
                </>
              )}
              {isLoading && (
                <div className="w-10 h-10 animate-pulse bg-dark-800 rounded-full"></div>
              )}
              <span>{heroContent?.navbarTitle || 'Your Brand'}</span>
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
                  navSettings.disabledPages.includes(item.path) && 'opacity-50',
                  isActive(item.path)
                    ? 'text-navbar-active'
                    : 'text-dark-300 hover:text-white'
                )}
              >
                {getLabel(item)}
                {isActive(item.path) && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-navbar-active"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            ))}
            
            {/* Admin Nav Settings Button */}
            {isAdmin && (
              <button
                onClick={() => setShowNavSettings(!showNavSettings)}
                className="p-2 rounded-lg hover:bg-dark-800 transition-colors text-dark-400 hover:text-white"
                title="Navbar-Einstellungen"
              >
                <Settings size={18} />
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="hidden lg:flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="flex items-center space-x-4">
                <Link
                  to="/tenant"
                  className="flex items-center space-x-2 text-dark-300 hover:text-white transition-colors"
                >
                  <User size={20} />
                  <span>{user?.email}</span>
                </Link>
                <button
                  onClick={logout}
                  className="p-2 rounded-lg hover:bg-dark-800 transition-colors"
                  style={{ color: 'rgb(var(--color-text-secondary))' }}
                >
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link to="/login" className="btn-guest">
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

        {/* Nav Settings Modal */}
        <PageSettingsModal
          isOpen={showNavSettings}
          onClose={() => setShowNavSettings(false)}
          onSuccess={() => {
            loadHeroContent()
            loadCustomPages()
          }}
          currentSettings={navSettings}
        />

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
                    ? 'text-white bg-navbar-active'
                    : 'text-dark-300 hover:bg-dark-800 hover:text-white'
                )}
              >
                {getLabel(item)}
              </Link>
            ))}

            <div className="pt-4 border-t border-dark-800 space-y-4">
              {isAuthenticated ? (
                <>
                  <Link
                    to="/tenant"
                    onClick={() => setIsMenuOpen(false)}
                    className="block py-2 px-4 rounded-lg text-dark-300 hover:bg-dark-800 hover:text-white transition-colors"
                  >
                    Tenant
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
                    className="block btn-guest text-center"
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