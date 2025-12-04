import { useState, useEffect } from 'react'
import { Mail, MessageSquare, Send, MapPin, Phone, Settings } from 'lucide-react'
import { awsConfig } from '../config/aws-config'
import { ContactInfo, contactInfoService } from '../services/contactInfo.service'
import { ContactInfoModal } from '../components/ContactInfoModal'
import { useAdmin } from '../hooks/useAdmin'

export const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [contactInfo, setContactInfo] = useState<ContactInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { isAdmin } = useAdmin()

  useEffect(() => {
    loadContactInfo()
  }, [])

  const loadContactInfo = async () => {
    try {
      const data = await contactInfoService.getContactInfo()
      setContactInfo(data)
    } catch (error) {
      console.error('Failed to load contact info:', error)
      // Fallback to default
      setContactInfo([
        { id: 'email', type: 'email', title: 'E-Mail', value: 'contact@yourbrand.com', icon: 'mail', enabled: true },
        { id: 'phone', type: 'phone', title: 'Telefon', value: '+49 123 456789', icon: 'phone', enabled: true },
        { id: 'address', type: 'address', title: 'Adresse', value: 'Musterstraße 123\n12345 Musterstadt\nDeutschland', icon: 'mapPin', enabled: true }
      ])
    } finally {
      setLoading(false)
    }
  }

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

  const getIcon = (iconType: string) => {
    switch (iconType) {
      case 'mail': return <Mail size={24} />
      case 'phone': return <Phone size={24} />
      case 'mapPin': return <MapPin size={24} />
      default: return <Mail size={24} />
    }
  }

  const visibleContactInfo = isAdmin ? contactInfo : contactInfo.filter(info => info.enabled)

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="relative py-12 overflow-hidden bg-gradient-to-br from-primary-900/20 via-dark-950 to-dark-950">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">
                <span className="glow-text">Kontakt</span>
              </h1>
              <p className="text-dark-400 text-lg">
                Hast du Fragen? Wir helfen gerne weiter!
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Settings size={20} />
                Optionen
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="container mx-auto max-w-6xl px-4 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Contact Info */}
            <div className="space-y-6">
              {visibleContactInfo.map((info) => (
                <div key={info.id} className="card">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-primary-600 rounded-lg">
                      {getIcon(info.icon)}
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">{info.title}</h3>
                      <p className="text-dark-400 whitespace-pre-line">{info.value}</p>
                    </div>
                  </div>
                </div>
              ))}
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
        )}
      </div>

      {/* Modal */}
      <ContactInfoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadContactInfo}
        contactInfo={contactInfo}
      />
    </div>
  )
}
