import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Crown, Rocket, Users, Globe, Zap, Shield, ArrowRight } from 'lucide-react'

export function PlatformHome() {
  const features = [
    {
      icon: Globe,
      title: 'Eigene Subdomain',
      description: 'Erhalte deine eigene .viraltenant.com Subdomain oder verbinde deine eigene Domain.'
    },
    {
      icon: Users,
      title: 'Community aufbauen',
      description: 'Baue deine eigene Community mit Registrierung, Mitgliederbereichen und exklusiven Inhalten.'
    },
    {
      icon: Zap,
      title: 'Live Streaming',
      description: 'Streame live zu deiner Community mit integriertem Chat und Multi-Plattform-Restreaming.'
    },
    {
      icon: Shield,
      title: 'Vollständig isoliert',
      description: 'Jeder Tenant ist komplett isoliert - eigene Nutzer, eigene Daten, eigenes Branding.'
    }
  ]

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 via-transparent to-purple-500/10" />
        <div className="container mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-4xl mx-auto"
          >
            <div className="flex items-center justify-center gap-3 mb-6">
              <Crown size={48} className="text-primary-500" />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="glow-text">Deine eigene</span>
              <br />
              <span className="text-white">Creator-Plattform</span>
            </h1>
            <p className="text-xl text-dark-300 mb-8 max-w-2xl mx-auto">
              Erstelle deinen eigenen Tenant mit eigener Subdomain, Community und allen Features 
              die du brauchst um deine Fans zu begeistern.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/tenant-registration"
                className="btn-primary text-lg px-8 py-4 flex items-center justify-center gap-2"
              >
                <Rocket size={20} />
                Jetzt Tenant erstellen
                <ArrowRight size={20} />
              </Link>
              <Link
                to="/pricing"
                className="btn-secondary text-lg px-8 py-4"
              >
                Preise ansehen
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-dark-900/50">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Alles was du brauchst
            </h2>
            <p className="text-dark-400 text-lg max-w-2xl mx-auto">
              Eine vollständige Plattform für Creator - von Live-Streaming bis Shop, 
              von Newsfeed bis Events.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="card hover:border-primary-500/50 transition-colors"
              >
                <feature.icon size={40} className="text-primary-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-dark-400">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="card bg-gradient-to-r from-primary-500/20 to-purple-500/20 border-primary-500/30 text-center py-12"
          >
            <Crown size={48} className="text-primary-500 mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Bereit durchzustarten?
            </h2>
            <p className="text-dark-300 text-lg mb-8 max-w-xl mx-auto">
              Erstelle jetzt deinen eigenen Tenant und starte mit deiner Community.
              Kostenlos testen, keine Kreditkarte erforderlich.
            </p>
            <Link
              to="/tenant-registration"
              className="btn-primary text-lg px-8 py-4 inline-flex items-center gap-2"
            >
              <Rocket size={20} />
              Tenant erstellen
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer with Operator Info (Google OAuth Verification) */}
      <footer className="py-12 px-4 border-t border-dark-700 bg-dark-900/50">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {/* About */}
            <div>
              <h3 className="text-lg font-semibold mb-4">ViralTenant</h3>
              <p className="text-dark-400 text-sm">
                ViralTenant ist ein Online-Tool, betrieben von <strong className="text-white">Niels Fink</strong>.
                All-in-One Creator Platform für Live Streaming, Online Shop, Newsfeed, Events und Crossposting.
              </p>
            </div>

            {/* Contact / Impressum */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Kontakt / Impressum</h3>
              <address className="text-dark-400 text-sm not-italic leading-relaxed">
                Niels Fink<br />
                Bahnhofstrasse 59<br />
                6312 Steinhausen<br />
                Schweiz (CH)<br />
                <a href="mailto:email@nielsfink.de" className="text-primary-400 hover:text-primary-300">email@nielsfink.de</a><br />
                <a href="tel:+41763612839" className="text-primary-400 hover:text-primary-300">+41 76 361 28 39</a>
              </address>
            </div>

            {/* Legal Links */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Rechtliches</h3>
              <nav className="flex flex-col gap-2 text-sm">
                <Link to="/legal?tab=impressum" className="text-dark-400 hover:text-primary-400">Impressum</Link>
                <Link to="/legal?tab=datenschutz" className="text-dark-400 hover:text-primary-400">Datenschutz</Link>
                <Link to="/legal?tab=agb" className="text-dark-400 hover:text-primary-400">AGB</Link>
              </nav>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-dark-700 text-center text-dark-500 text-sm">
            © {new Date().getFullYear()} ViralTenant. Alle Rechte vorbehalten.
          </div>
        </div>
      </footer>
    </div>
  )
}
