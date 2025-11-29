import { motion } from 'framer-motion'
import { Play, ShoppingBag, Calendar, Users, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

export const Home = () => {
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
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900/20 via-dark-950 to-dark-950" />
        
        <div className="relative z-10 text-center px-4">
          <div className="text-8xl mb-6">
            Logo
          </div>
          
          <h1 className="text-6xl md:text-8xl font-bold mb-6">
            <span className="glow-text">Your Brand</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-dark-300 mb-12 max-w-2xl mx-auto">
            Deine moderne Creator-Plattform für Live-Streaming, Events und Community
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
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
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
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="glass rounded-2xl p-12 text-center">
            <h2 className="text-4xl font-bold mb-4">
              Bereit loszulegen?
            </h2>
            <p className="text-dark-400 text-lg mb-8 max-w-2xl mx-auto">
              Werde Teil unserer Community und erlebe exklusive Inhalte, Live-Events und vieles mehr
            </p>
            <Link to="/register" className="btn-primary inline-flex items-center gap-2">
              <Sparkles size={20} />
              Jetzt kostenlos registrieren
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
