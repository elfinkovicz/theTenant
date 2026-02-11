import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Play, ShoppingBag, Calendar, Users, Sparkles, Edit, X, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { HeroManagement } from '../components/HeroManagement'
import { heroService, HeroContent } from '../services/hero.service'
import { useAdmin } from '../hooks/useAdmin'
import { useAuthStore } from '../store/authStore'

interface FeatureCard {
  icon: string
  title: string
  description: string
  link: string
}

const defaultFeatures: FeatureCard[] = [
  {
    icon: 'play',
    title: 'Live-Streaming',
    description: 'Erlebe spannende Live-Streams in HD-Qualität mit interaktivem Chat',
    link: '/live'
  },
  {
    icon: 'shopping',
    title: 'Merch Shop',
    description: 'Exklusive Produkte und limitierte Editionen für echte Unterstützer',
    link: '/shop'
  },
  {
    icon: 'calendar',
    title: 'Events',
    description: 'Verpasse keine Events und sichere dir deine Tickets',
    link: '/events'
  },
  {
    icon: 'users',
    title: 'Community',
    description: 'Werde Teil unserer wachsenden Community',
    link: '/channels'
  }
]

const getFeatureIcon = (iconType: string) => {
  switch (iconType) {
    case 'play': return <Play size={32} />
    case 'shopping': return <ShoppingBag size={32} />
    case 'calendar': return <Calendar size={32} />
    case 'users': return <Users size={32} />
    default: return <Sparkles size={32} />
  }
}

export const Home = () => {
  // Platform tenant now shows normal creator home (same as other tenants)
  // Marketing/landing page moved to a separate route if needed
  
  const [heroContent, setHeroContent] = useState<HeroContent | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [bgLoaded, setBgLoaded] = useState(false)
  const [showHeroManagement, setShowHeroManagement] = useState(false)
  const [editingTexts, setEditingTexts] = useState(false)
  const [editedTexts, setEditedTexts] = useState({
    featuresTitle: '',
    featuresSubtitle: '',
    ctaTitle: '',
    ctaSubtitle: '',
    ctaButtonText: ''
  })
  const [editedFeatures, setEditedFeatures] = useState<FeatureCard[]>(defaultFeatures)
  const [savingTexts, setSavingTexts] = useState(false)
  const { isAdmin } = useAdmin()
  const { accessToken } = useAuthStore()

  useEffect(() => {
    loadHeroContent()
  }, [])

  // Preload background image
  useEffect(() => {
    if (heroContent?.heroBackground?.type === 'image' && heroContent.heroBackground.value) {
      setBgLoaded(false)
      const img = new Image()
      img.onload = () => setBgLoaded(true)
      img.src = heroContent.heroBackground.value
    } else if (heroContent?.heroBackground) {
      // Colors, gradients, videos don't need image preloading
      setBgLoaded(true)
    }
  }, [heroContent?.heroBackground])

  const loadHeroContent = async () => {
    try {
      const content = await heroService.getHeroContent()
      setHeroContent(content)
      setEditedTexts({
        featuresTitle: content.featuresTitle || 'Was dich erwartet',
        featuresSubtitle: content.featuresSubtitle || 'Entdecke alle Features unserer Plattform',
        ctaTitle: content.ctaTitle || 'Bereit loszulegen?',
        ctaSubtitle: content.ctaSubtitle || 'Werde Teil unserer Community und erlebe exklusive Inhalte, Live-Events und vieles mehr',
        ctaButtonText: content.ctaButtonText || 'Jetzt kostenlos registrieren'
      })
      // Load saved features or use defaults
      setEditedFeatures(content.featureCards || defaultFeatures)
    } catch (error) {
      console.error('Failed to load hero content:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const saveTexts = async () => {
    if (!accessToken) return
    setSavingTexts(true)
    try {
      await heroService.updateHeroContent({
        ...editedTexts,
        featureCards: editedFeatures
      }, accessToken)
      await loadHeroContent()
      setEditingTexts(false)
    } catch (error) {
      console.error('Failed to save texts:', error)
    } finally {
      setSavingTexts(false)
    }
  }

  const updateFeature = (index: number, field: keyof FeatureCard, value: string) => {
    setEditedFeatures(prev => prev.map((f, i) => 
      i === index ? { ...f, [field]: value } : f
    ))
  }

  // Get features to display (from heroContent or defaults)
  const features = heroContent?.featureCards || defaultFeatures

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section 
        className="relative flex items-center justify-center overflow-hidden pt-20" 
        style={{ minHeight: `${heroContent?.heroHeight || 70}vh` }}
      >
        {/* Dynamic Background */}
        {heroContent?.heroBackground?.type === 'color' && (
          <div 
            className={`absolute inset-0 transition-opacity duration-300 ${bgLoaded ? 'opacity-100' : 'opacity-0'}`}
            style={{ 
              backgroundColor: heroContent.heroBackground.value,
              filter: heroContent.heroBackground.blur ? `blur(${heroContent.heroBackground.blur}px)` : undefined
            }} 
          />
        )}
        
        {heroContent?.heroBackground?.type === 'gradient' && (
          <div 
            className={`absolute inset-0 transition-opacity duration-300 ${bgLoaded ? 'opacity-100' : 'opacity-0'}`}
            style={{ 
              background: heroContent.heroBackground.value,
              filter: heroContent.heroBackground.blur ? `blur(${heroContent.heroBackground.blur}px)` : undefined
            }} 
          />
        )}
        
        {heroContent?.heroBackground?.type === 'image' && heroContent.heroBackground.value && (
          <div 
            className={`absolute inset-0 bg-cover bg-center transition-opacity duration-300 ${bgLoaded ? 'opacity-100' : 'opacity-0'}`}
            style={{ 
              backgroundImage: `url(${heroContent.heroBackground.value})`,
              filter: heroContent.heroBackground.blur ? `blur(${heroContent.heroBackground.blur}px)` : undefined,
              transform: heroContent.heroBackground.blur ? 'scale(1.1)' : undefined // Prevent blur edges
            }} 
          />
        )}
        
        {heroContent?.heroBackground?.type === 'video' && heroContent.heroBackground.value && (
          <video 
            className="absolute inset-0 w-full h-full object-cover" 
            autoPlay 
            loop 
            muted 
            playsInline
            onLoadedData={() => setBgLoaded(true)}
            style={{ 
              filter: heroContent.heroBackground.blur ? `blur(${heroContent.heroBackground.blur}px)` : undefined,
              transform: heroContent.heroBackground.blur ? 'scale(1.1)' : undefined // Prevent blur edges
            }}
          >
            <source src={heroContent.heroBackground.value} type="video/mp4" />
          </video>
        )}
        
        {/* Neutral background when no hero background is set - no gradient flash */}
        {!heroContent?.heroBackground && (
          <div className="absolute inset-0" style={{ backgroundColor: 'rgb(var(--color-background))' }} />
        )}

        {/* Admin Options Button */}
        {isAdmin && (
          <div className="absolute top-6 right-6 z-20 flex gap-3">
            <button
              onClick={() => setShowHeroManagement(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Edit size={20} />
              Optionen
            </button>
          </div>
        )}

        <div className="relative z-10 text-center px-4">
          {/* Logo - nur anzeigen wenn geladen, aktiviert und vorhanden */}
          {!isLoading && heroContent?.logoEnabled !== false && (
            <>
              {heroContent?.logoUrl ? (
                <div 
                  className="mx-auto mb-6" 
                  style={{ 
                    width: `${typeof heroContent.logoSize === 'number' ? heroContent.logoSize : 160}px`, 
                    height: `${typeof heroContent.logoSize === 'number' ? heroContent.logoSize : 160}px` 
                  }}
                >
                  <img 
                    src={heroContent.logoUrl} 
                    alt="Logo" 
                    className="w-full h-full object-contain bg-transparent" 
                  />
                </div>
              ) : (
                <div className="text-6xl md:text-8xl mb-6">🎬</div>
              )}
            </>
          )}

          {/* Loading Placeholder */}
          {isLoading && (
            <div className="w-32 h-32 md:w-40 md:h-40 mx-auto mb-6 flex items-center justify-center">
              <div className="animate-pulse w-full h-full bg-dark-800 rounded-full"></div>
            </div>
          )}

          <h1 className="font-bold mb-4 text-5xl md:text-7xl">
            <span className="glow-text">{heroContent?.title || 'Your Brand'}</span>
          </h1>
          
          <p className="text-lg md:text-xl mb-8 max-w-2xl mx-auto whitespace-pre-wrap" style={{ color: 'rgb(var(--color-text-secondary))' }}>
            {heroContent?.subtitle || 'Deine moderne Creator-Plattform für Live-Streaming, Events und Community'}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link to="/live" className="btn-primary flex items-center justify-center gap-2">
              <Play size={20} />
              Jetzt Live ansehen
            </Link>
            <Link to="/register" className="btn-guest flex items-center justify-center gap-2">
              <Sparkles size={20} />
              Mitglied werden
            </Link>
          </div>
        </div>

        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-primary-500/20 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -30, 0],
                opacity: [0.2, 0.5, 0.2],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 px-4 relative">
        {/* Edit Button */}
        {isAdmin && !editingTexts && (
          <button
            onClick={() => setEditingTexts(true)}
            className="absolute top-4 right-4 p-2 rounded-full bg-primary-500/20 hover:bg-primary-500/40 transition-colors z-10"
            title="Texte bearbeiten"
          >
            <Edit size={18} className="text-primary-500" />
          </button>
        )}
        
        {/* Save/Cancel Buttons */}
        {editingTexts && (
          <div className="absolute top-4 right-4 flex gap-2 z-10">
            <button
              onClick={() => setEditingTexts(false)}
              className="p-2 rounded-full bg-red-500/20 hover:bg-red-500/40 transition-colors"
              title="Abbrechen"
            >
              <X size={18} className="text-red-500" />
            </button>
            <button
              onClick={saveTexts}
              disabled={savingTexts}
              className="p-2 rounded-full bg-green-500/20 hover:bg-green-500/40 transition-colors"
              title="Speichern"
            >
              <Check size={18} className="text-green-500" />
            </button>
          </div>
        )}

        <div className="container mx-auto">
          <div className="text-center mb-10">
            {editingTexts ? (
              <>
                <input
                  type="text"
                  value={editedTexts.featuresTitle}
                  onChange={(e) => setEditedTexts(prev => ({ ...prev, featuresTitle: e.target.value }))}
                  className="text-3xl md:text-4xl font-bold mb-3 bg-transparent border-b-2 border-primary-500 text-center w-full max-w-lg mx-auto block"
                  style={{ color: 'rgb(var(--color-text))' }}
                />
                <input
                  type="text"
                  value={editedTexts.featuresSubtitle}
                  onChange={(e) => setEditedTexts(prev => ({ ...prev, featuresSubtitle: e.target.value }))}
                  className="text-lg bg-transparent border-b-2 border-primary-500/50 text-center w-full max-w-xl mx-auto block"
                  style={{ color: 'rgb(var(--color-text-secondary))' }}
                />
              </>
            ) : (
              <>
                <h2 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: 'rgb(var(--color-text))' }}>
                  {heroContent?.featuresTitle || 'Was dich erwartet'}
                </h2>
                <p className="text-lg" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  {heroContent?.featuresSubtitle || 'Entdecke alle Features unserer Plattform'}
                </p>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {(editingTexts ? editedFeatures : features).map((feature, index) => (
              <motion.div key={index} whileHover={{ scale: editingTexts ? 1 : 1.05 }} className="h-full">
                {editingTexts ? (
                  <div className="card h-full flex flex-col">
                    <div className="mb-4 flex-shrink-0" style={{ color: 'rgb(var(--color-primary))' }}>
                      {getFeatureIcon(feature.icon)}
                    </div>
                    <input
                      type="text"
                      value={editedFeatures[index]?.title || ''}
                      onChange={(e) => updateFeature(index, 'title', e.target.value)}
                      className="text-xl font-semibold mb-2 bg-dark-800 border border-primary-500 rounded-lg px-3 py-2 w-full"
                      style={{ color: 'rgb(var(--color-text))' }}
                      placeholder="Titel"
                    />
                    <textarea
                      value={editedFeatures[index]?.description || ''}
                      onChange={(e) => updateFeature(index, 'description', e.target.value)}
                      className="bg-dark-800 border border-primary-500/50 rounded-lg px-3 py-2 w-full flex-1 resize-none text-sm min-h-[80px]"
                      style={{ color: 'rgb(var(--color-text-secondary))' }}
                      placeholder="Beschreibung"
                    />
                    {/* Live Preview */}
                    <div className="mt-3 pt-3 border-t border-dark-700">
                      <p className="text-xs text-dark-500 mb-1">Vorschau:</p>
                      <h4 className="text-sm font-semibold truncate" style={{ color: 'rgb(var(--color-text))' }}>
                        {editedFeatures[index]?.title || 'Titel'}
                      </h4>
                      <p className="text-xs line-clamp-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                        {editedFeatures[index]?.description || 'Beschreibung'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <Link to={feature.link} className="card h-full block group">
                    <div className="mb-4 group-hover:scale-110 transition-transform" style={{ color: 'rgb(var(--color-primary))' }}>
                      {getFeatureIcon(feature.icon)}
                    </div>
                    <h3 className="text-xl font-semibold mb-2" style={{ color: 'rgb(var(--color-text))' }}>{feature.title}</h3>
                    <p style={{ color: 'rgb(var(--color-text-secondary))' }}>{feature.description}</p>
                  </Link>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 px-4">
        <div className="container mx-auto">
          <div className="glass rounded-2xl p-8 md:p-10 text-center">
            {editingTexts ? (
              <>
                <input
                  type="text"
                  value={editedTexts.ctaTitle}
                  onChange={(e) => setEditedTexts(prev => ({ ...prev, ctaTitle: e.target.value }))}
                  className="text-3xl md:text-4xl font-bold mb-3 bg-transparent border-b-2 border-primary-500 text-center w-full max-w-lg mx-auto block"
                  style={{ color: 'rgb(var(--color-text))' }}
                />
                <textarea
                  value={editedTexts.ctaSubtitle}
                  onChange={(e) => setEditedTexts(prev => ({ ...prev, ctaSubtitle: e.target.value }))}
                  className="text-lg mb-6 bg-transparent border-b-2 border-primary-500/50 text-center w-full max-w-2xl mx-auto block resize-none"
                  style={{ color: 'rgb(var(--color-text-secondary))' }}
                  rows={2}
                />
                <input
                  type="text"
                  value={editedTexts.ctaButtonText}
                  onChange={(e) => setEditedTexts(prev => ({ ...prev, ctaButtonText: e.target.value }))}
                  className="bg-transparent border-b-2 border-primary-500 text-center"
                  style={{ color: 'rgb(var(--color-primary))' }}
                />
              </>
            ) : (
              <>
                <h2 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: 'rgb(var(--color-text))' }}>
                  {heroContent?.ctaTitle || 'Bereit loszulegen?'}
                </h2>
                <p className="text-lg mb-6 max-w-2xl mx-auto" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  {heroContent?.ctaSubtitle || 'Werde Teil unserer Community und erlebe exklusive Inhalte, Live-Events und vieles mehr'}
                </p>
                <Link to="/register" className="btn-primary inline-flex items-center gap-2">
                  <Sparkles size={20} />
                  {heroContent?.ctaButtonText || 'Jetzt kostenlos registrieren'}
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Hero Management Modal */}
      {showHeroManagement && (
        <HeroManagement
          onClose={() => setShowHeroManagement(false)}
          onSave={() => loadHeroContent()}
        />
      )}
    </div>
  )
}