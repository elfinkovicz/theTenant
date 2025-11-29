import { useState } from 'react'
import { Mail, MessageSquare, Send, MapPin, Phone } from 'lucide-react'
import { awsConfig } from '../config/aws-config'

export const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    try {
      const response = await fetch(`${awsConfig.api.contactForm}/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          message: `${formData.subject}\n\n${formData.message}`
        })
      })

      if (response.ok) {
        setFormData({ name: '', email: '', subject: '', message: '' })
        alert('✅ Nachricht wurde erfolgreich gesendet!')
      } else {
        throw new Error('Failed to send message')
      }
    } catch (error) {
      console.error('Error sending message:', error)
      alert('❌ Fehler beim Senden. Bitte versuche es später erneut.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="relative py-12 overflow-hidden bg-gradient-to-br from-primary-900/20 via-dark-950 to-dark-950">
        <div className="container mx-auto px-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold mb-2">
              <span className="glow-text">Kontakt</span>
            </h1>
            <p className="text-dark-400 text-lg">
              Hast du Fragen? Wir helfen gerne weiter!
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto max-w-6xl px-4 py-8">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contact Info */}
          <div className="space-y-6">
            <div className="card">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary-600 rounded-lg">
                  <Mail size={24} />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">E-Mail</h3>
                  <p className="text-dark-400">contact@yourbrand.com</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary-600 rounded-lg">
                  <Phone size={24} />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Telefon</h3>
                  <p className="text-dark-400">+49 123 456789</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary-600 rounded-lg">
                  <MapPin size={24} />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Adresse</h3>
                  <p className="text-dark-400">
                    Musterstraße 123<br />
                    12345 Musterstadt<br />
                    Deutschland
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <div className="card">
              <div className="flex items-center gap-2 mb-6">
                <MessageSquare size={24} className="text-primary-500" />
                <h2 className="text-2xl font-bold">Schreib uns eine Nachricht</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Name
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="input w-full"
                      placeholder="Dein Name"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      E-Mail
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="input w-full"
                      placeholder="deine@email.de"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Betreff
                  </label>
                  <input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="Worum geht es?"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Nachricht
                  </label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    className="input w-full min-h-[200px] resize-y"
                    placeholder="Deine Nachricht..."
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <Send size={20} />
                  {isSubmitting ? 'Wird gesendet...' : 'Nachricht senden'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
