import { Link, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, Zap, Clock, Video, Users, Globe, Shield, Rocket, ArrowRight } from 'lucide-react'
import { usePlatformTenant } from '../hooks/usePlatformTenant'

export function PlatformPricing() {
  const { isPlatform, isLoading } = usePlatformTenant()
  
  // Redirect to home if not on platform
  if (!isLoading && !isPlatform) {
    return <Navigate to="/" replace />
  }

  const includedFeatures = [
    { icon: Globe, text: 'Eigene Subdomain (.viraltenant.com)' },
    { icon: Users, text: 'Unbegrenzte Community-Mitglieder' },
    { icon: Video, text: 'Video-Hosting & On-Demand' },
    { icon: Shield, text: 'Shop mit Zahlungsabwicklung' },
    { icon: Zap, text: 'Newsfeed & Events' },
    { icon: Clock, text: 'Live-Chat während Streams' },
  ]

  const streamingFeatures = [
    'HD Streaming (1080p): 2,50€ / Stunde',
    'Unbegrenzte Zuschauer inklusive',
    'Restreaming: 1,50€ / Stunde pro Ziel',
    'Bis zu 7 Restreaming-Ziele gleichzeitig',
    'Automatische Aufzeichnung',
    'Minutengenau abgerechnet',
  ]

  const faqs = [
    {
      q: 'Wie wird die Streaming-Zeit berechnet?',
      a: 'Die Streaming-Zeit wird minutengenau erfasst. Du zahlst nur für die tatsächliche Live-Zeit. Wenn du 45 Minuten streamst, zahlst du auch nur für 45 Minuten.'
    },
    {
      q: 'Sind Zuschauer im Preis enthalten?',
      a: 'Ja! Die Viewer-Kosten sind im Streaming-Preis bereits enthalten. Egal ob 10 oder 1000 Zuschauer – der Preis bleibt gleich.'
    },
    {
      q: 'Was kostet Multi-Plattform Restreaming?',
      a: 'Jedes Restreaming-Ziel (YouTube, Twitch, Facebook etc.) kostet 1,50€ pro Stunde. Du kannst bis zu 7 Ziele gleichzeitig nutzen.'
    },
    {
      q: 'Was ist in der Grundgebühr enthalten?',
      a: 'Die Grundgebühr deckt deine komplette Plattform ab: Subdomain, unbegrenzte Nutzer, Video-Hosting, Shop, Newsfeed, Events und alle Community-Features. Nur Live-Streaming wird nach Verbrauch abgerechnet.'
    },
    {
      q: 'Gibt es versteckte Kosten?',
      a: 'Nein. Du zahlst 30€ Grundgebühr + Streaming-Kosten + Restreaming. Bei Shop-Verkäufen fallen die üblichen Zahlungsanbieter-Gebühren an (PayPal/Mollie).'
    },
    {
      q: 'Kann ich jederzeit kündigen?',
      a: 'Ja, monatlich kündbar. Keine Mindestlaufzeit, keine Kündigungsfristen.'
    }
  ]

  // Floating animation variants
  const floatingVariants = {
    animate: {
      y: [0, -10, 0],
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  }

  return (
    <div className="min-h-screen py-12 px-4 relative overflow-hidden">
      {/* Floating Background Elements */}
      <motion.div
        variants={floatingVariants}
        animate="animate"
        className="absolute top-20 left-10 w-20 h-20 bg-primary-500/10 rounded-full blur-xl"
      />
      <motion.div
        variants={floatingVariants}
        animate="animate"
        transition={{ delay: 0.5 }}
        className="absolute top-40 right-20 w-32 h-32 bg-purple-500/10 rounded-full blur-xl"
      />
      <motion.div
        variants={floatingVariants}
        animate="animate"
        transition={{ delay: 1 }}
        className="absolute bottom-40 left-1/4 w-24 h-24 bg-blue-500/10 rounded-full blur-xl"
      />
      <motion.div
        variants={floatingVariants}
        animate="animate"
        transition={{ delay: 1.5 }}
        className="absolute bottom-20 right-1/3 w-28 h-28 bg-pink-500/10 rounded-full blur-xl"
      />

      <div className="container mx-auto max-w-5xl relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="glow-text">Einfach. Transparent. Fair.</span>
          </h1>
          <p className="text-xl text-dark-400 max-w-2xl mx-auto">
            30€ Grundgebühr + Pay-as-you-go für Streaming. 
            Zahle nur was du wirklich nutzt.
          </p>
        </motion.div>

        {/* Main Pricing Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card border-primary-500 ring-2 ring-primary-500/20 mb-12"
        >
          <div className="grid md:grid-cols-2 gap-8">
            {/* Left: Base Fee */}
            <div>
              <div className="text-primary-400 text-sm font-semibold mb-2">GRUNDGEBÜHR</div>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-5xl font-bold">30€</span>
                <span className="text-dark-400">/ Monat</span>
              </div>
              <p className="text-dark-400 mb-6">
                Deine komplette Creator-Plattform mit allen Features. 
                Nur Live-Streaming wird zusätzlich nach Verbrauch berechnet.
              </p>
              
              <div className="space-y-3">
                {includedFeatures.map((feature, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center">
                      <feature.icon size={16} className="text-primary-400" />
                    </div>
                    <span className="text-dark-300">{feature.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Streaming Costs */}
            <div className="md:border-l md:border-dark-700 md:pl-8">
              <div className="text-primary-400 text-sm font-semibold mb-2">LIVE-STREAMING</div>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-5xl font-bold">2,50€</span>
                <span className="text-dark-400">/ Stunde</span>
              </div>
              <p className="text-dark-400 mb-6">
                Unbegrenzte Zuschauer inklusive. Minutengenau abgerechnet.
              </p>
              
              <div className="space-y-2">
                {streamingFeatures.map((feature, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Check size={16} className="text-green-400 flex-shrink-0" />
                    <span className="text-dark-300 text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-dark-700">
            <Link
              to="/tenant-registration"
              className="btn-primary w-full md:w-auto text-center text-lg px-8 py-4 inline-flex items-center justify-center gap-2"
            >
              <Rocket size={20} />
              Jetzt starten
              <ArrowRight size={20} />
            </Link>
          </div>
        </motion.div>

        {/* Comparison */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <h2 className="text-2xl font-bold text-center mb-8">Warum Pay-as-you-go?</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="card text-center">
              <div className="text-4xl mb-4">💰</div>
              <h3 className="font-semibold mb-2">Keine Verschwendung</h3>
              <p className="text-dark-400 text-sm">
                Zahle nur für tatsächliche Streaming-Zeit. Kein Geld für ungenutzte Kapazitäten.
              </p>
            </div>
            <div className="card text-center">
              <div className="text-4xl mb-4">📈</div>
              <h3 className="font-semibold mb-2">Skaliert mit dir</h3>
              <p className="text-dark-400 text-sm">
                Wenig Streams = niedrige Kosten. Viele Streams = du verdienst auch mehr.
              </p>
            </div>
            <div className="card text-center">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="font-semibold mb-2">Volle Kontrolle</h3>
              <p className="text-dark-400 text-sm">
                Du entscheidest wann und wie lange du streamst. Keine Mindestabnahme.
              </p>
            </div>
          </div>
        </motion.div>

        {/* FAQ */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <h2 className="text-2xl font-bold text-center mb-8">Häufige Fragen</h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="card">
                <h4 className="font-semibold mb-2">{faq.q}</h4>
                <p className="text-dark-400">{faq.a}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h2 className="text-2xl font-bold mb-4">Bereit durchzustarten?</h2>
          <p className="text-dark-400 mb-6">Starte jetzt mit deiner eigenen Creator-Plattform.</p>
          <Link
            to="/tenant-registration"
            className="btn-primary inline-flex items-center gap-2 text-lg px-8 py-4"
          >
            <Rocket size={20} />
            Jetzt Tenant erstellen
            <ArrowRight size={20} />
          </Link>
        </motion.div>
      </div>
    </div>
  )
}
