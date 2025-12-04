import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Play, ShoppingBag, Calendar, Users, Sparkles, Edit } from 'lucide-react'
import { Link } from 'react-router-dom'
import { HeroManagement } from '../components/HeroManagement'
import { heroService, HeroContent } from '../services/hero.service'
import { useAdmin } from '../hooks/useAdmin'

export const Home = () => {
  const [heroContent, setHeroContent] = useState<HeroContent | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showHeroManagement, setShowHeroManagement] = useState(false)
  const { isAdmin } = useAdmin()

  useEffect(() => {
    loadHeroContent()
  }, [])

  const loadHeroContent = async () => {
    try {
      const content = await heroService.getHeroContent()
      setHeroContent(content)
    } catch (error) {
      console.error('Failed to load hero content:', error)
    } finally {
      setIsLoading(false)
    }
  }
  const features = [
    {
      icon: <Play size={32} />,
      title: 'Live-Streaming',
      description: 'Erlebe spannende Live-Streams in HD-Qualität mit interaktivem Chat',
      link: '/live'
    },
    {
      icon: <ShoppingBag size={32} />,
      title: 'Merch Shop',
      description: 'Exklusive Produkte und limitierte Editionen für echte Fans',
      link: '/shop'
    },
    {
      icon: <Calendar size={32} />,
      title: 'Events',
      description: 'Verpasse keine Events und sichere dir deine Tickets',
      link: '/events'
    },
    {
      icon: <Users size={32} />,
      title: 'Community',
      description: 'Werde Teil unserer wachsenden Community',
      link: '/channels'
    }
  ]

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section 
        className="relative flex items-center justify-center overflow-hidden pt-20"
        style={{
          minHeight: `${heroContent?.heroHeight || 70}vh`
        }}
      >
        {/* Dynamic Background */}
        {heroContent?.heroBackground?.type === 'color' && (
          <div 
            className="absolute inset-0" 
            style={{ backgroundColor: heroContent.heroBackground.value }}
          />
        )}
        {heroContent?.heroBackground?.type === 'gradient' && (
          <div 
            className="absolute inset-0" 
            style={{ background: heroContent.heroBackground.value }}
          />
        )}
        {heroContent?.heroBackground?.type === 'image' && heroContent.heroBackground.value && (
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${heroContent.heroBackground.value})` }}
          />
        )}
        {heroContent?.heroBackground?.type === 'video' && heroContent.heroBackground.value && (
          <video
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            loop
            muted
            playsInline
          >
            <source src={heroContent.heroBackground.value} type="video/mp4" />
          </video>
        )}
        {!heroContent?.heroBackground && (
          <div className="absolute inset-0 bg-gradient-to-br from-primary-900/20 via-dark-950 to-dark-950" />
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
          {/* Logo - nur anzeigen wenn geladen oder kein Custom-Logo */}
          {!isLoading && (
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
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="text-6xl md:text-8xl mb-6">
                  🐝
                </div>
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
          
          <p className="text-lg md:text-xl text-dark-300 mb-8 max-w-2xl mx-auto whitespace-pre-wrap">
            {heroContent?.subtitle || 'Deine moderne Creator-Plattform für Live-Streaming, Events und Community'}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/live" className="btn-primary flex items-center justify-center gap-2">
              <Play size={20} />
              Jetzt Live ansehen
            </Link>
            <Link to="/register" className="btn-secondary flex items-center justify-center gap-2">
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
      <section className="py-12 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Was dich erwartet
            </h2>
            <p className="text-dark-400 text-lg">
              Entdecke alle Features unserer Plattform
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                whileHover={{ scale: 1.05 }}
              >
                <Link to={feature.link} className="card h-full block group">
                  <div className="text-primary-500 mb-4 group-hover:scale-110 transition-transform">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-dark-400">{feature.description}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 px-4">
        <div className="container mx-auto">
          <div className="glass rounded-2xl p-8 md:p-10 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Bereit loszulegen?
            </h2>
            <p className="text-dark-400 text-lg mb-6 max-w-2xl mx-auto">
              Werde Teil unserer Community und erlebe exklusive Inhalte, Live-Events und vieles mehr
            </p>
            <Link to="/register" className="btn-primary inline-flex items-center gap-2">
              <Sparkles size={20} />
              Jetzt kostenlos registrieren
            </Link>
          </div>
        </div>
      </section>

      {/* Hero Management Modal */}
      {showHeroManagement && (
        <HeroManagement 
          onClose={() => {
            setShowHeroManagement(false)
            loadHeroContent()
          }} 
        />
      )}
    </div>
  )
}
