import { useState, useEffect } from 'react'
import { Mail, MessageSquare, Send, MapPin, Phone, Settings, Calendar, ExternalLink } from 'lucide-react'
import { awsConfig } from '../config/aws-config'
import { ContactInfo, BookingWidget } from '../services/contactInfo.service'
import { prefetchService } from '../services/prefetch.service'
import { ContactInfoModal } from '../components/ContactInfoModal'
import { PageBanner } from '../components/PageBanner'
import { useAdmin } from '../hooks/useAdmin'
import { usePageTitle } from '../hooks/usePageTitle'
import { toast } from '../utils/toast-alert'

export const Contact = () => {
  const { title: pageTitle, subtitle: pageSubtitle } = usePageTitle('/contact')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Initialize with cached data if available (prevents flash)
  const cachedData = prefetchService.getCachedSync('contact')
  const initialContacts = cachedData?.contacts || []
  const initialWidgets = cachedData?.bookingWidgets || []
  
  const [contactInfo, setContactInfo] = useState<ContactInfo[]>(initialContacts.length > 0 ? initialContacts : [
    { id: 'email', type: 'email', title: 'E-Mail', value: 'contact@yourbrand.com', icon: 'mail', enabled: true },
    { id: 'phone', type: 'phone', title: 'Telefon', value: '+49 123 456789', icon: 'phone', enabled: true },
    { id: 'address', type: 'address', title: 'Adresse', value: 'Musterstraße 123\n12345 Musterstadt\nDeutschland', icon: 'mapPin', enabled: true }
  ])
  const [bookingWidgets, setBookingWidgets] = useState<BookingWidget[]>(initialWidgets)
  const [loading, setLoading] = useState(!cachedData) // Only show loading if no cache
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { isAdmin } = useAdmin()

  useEffect(() => {
    loadContactInfo()
  }, [])

  const loadContactInfo = async () => {
    try {
      // Only show loading if we don't have cached data
      const hasCachedData = contactInfo.length > 0
      if (!hasCachedData) {
        setLoading(true)
      }
      
      // Use prefetch cache if available
      const result = await prefetchService.getContact()
      console.log('Loaded contact info:', result);
      // getContactInfo() returns { contacts: [...], bookingWidgets: [...], settings: {...} }
      const contacts = Array.isArray(result.contacts) ? result.contacts : []
      const widgets = Array.isArray(result.bookingWidgets) ? result.bookingWidgets : []
      
      // If no contacts are stored, show default contacts
      if (contacts.length === 0) {
        console.log('No contacts found, using default contacts');
        setContactInfo([
          { id: 'email', type: 'email', title: 'E-Mail', value: 'contact@yourbrand.com', icon: 'mail', enabled: true },
          { id: 'phone', type: 'phone', title: 'Telefon', value: '+49 123 456789', icon: 'phone', enabled: true },
          { id: 'address', type: 'address', title: 'Adresse', value: 'Musterstraße 123\n12345 Musterstadt\nDeutschland', icon: 'mapPin', enabled: true }
        ])
      } else {
        setContactInfo(contacts)
      }
      
      setBookingWidgets(widgets)
    } catch (error) {
      console.error('Failed to load contact info:', error)
      // Fallback to default
      setContactInfo([
        { id: 'email', type: 'email', title: 'E-Mail', value: 'contact@yourbrand.com', icon: 'mail', enabled: true },
        { id: 'phone', type: 'phone', title: 'Telefon', value: '+49 123 456789', icon: 'phone', enabled: true },
        { id: 'address', type: 'address', title: 'Adresse', value: 'Musterstraße 123\n12345 Musterstadt\nDeutschland', icon: 'mapPin', enabled: true }
      ])
      setBookingWidgets([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    try {
      // Get tenant ID from subdomain or localStorage
      const hostname = window.location.hostname;
      const parts = hostname.split('.');
      const subdomain = (parts.length >= 3 && parts[0] !== 'www') ? parts[0] : 'platform';
      const storedTenantId = localStorage.getItem('resolvedTenantId');
      const tenantId = storedTenantId || subdomain;
      
      const response = await fetch(`${awsConfig.api.user}/tenants/${tenantId}/contact/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Creator-ID': tenantId
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          subject: formData.subject,
          message: formData.message
        })
      })

      if (response.ok) {
        setFormData({ name: '', email: '', subject: '', message: '' })
        toast.success('Nachricht erfolgreich gesendet!')
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Failed to send message')
      }
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Fehler beim Senden der Nachricht')
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

  const getBookingIcon = (type: string) => {
    switch (type) {
      case 'calendly':
        return (
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
            <path d="M19.655 14.262c-.207.09-.42.163-.637.22a3.31 3.31 0 01-.197.046 5.47 5.47 0 01-1.08.107c-2.963 0-5.398-2.36-5.398-5.238 0-2.877 2.435-5.237 5.398-5.237.37 0 .732.037 1.08.107.066.014.132.03.197.046.217.057.43.13.637.22.104.045.206.094.306.146l.003.002c.1.052.198.107.293.165l.003.002c.095.058.188.12.278.183l.003.002c.09.063.177.13.262.198l.003.002c.085.068.167.14.247.213l.003.003c.08.073.157.15.232.228l.003.003c.075.078.147.16.217.243l.003.003c.07.083.137.17.201.258l.003.003c.064.088.125.18.184.273l.003.003c.059.093.115.19.168.288l.003.003c.053.098.103.2.15.303l.003.003c.047.103.091.21.132.318l.003.003c.041.108.079.22.114.333l.003.003c.035.113.067.23.096.348l.003.003c.029.118.055.24.078.363l.003.003c.023.123.043.25.06.378l.003.003c.017.128.031.26.042.393l.003.003c.011.133.019.27.024.408l.003.003c.005.138.008.28.008.423 0 .143-.003.285-.008.423l-.003.003c-.005.138-.013.275-.024.408l-.003.003c-.011.133-.025.265-.042.393l-.003.003c-.017.128-.037.255-.06.378l-.003.003c-.023.123-.049.245-.078.363l-.003.003c-.029.118-.061.235-.096.348l-.003.003c-.035.113-.073.225-.114.333l-.003.003c-.041.108-.085.215-.132.318l-.003.003c-.047.103-.097.205-.15.303l-.003.003c-.053.098-.109.195-.168.288l-.003.003c-.059.093-.12.185-.184.273l-.003.003c-.064.088-.131.175-.201.258l-.003.003c-.07.083-.142.165-.217.243l-.003.003c-.075.078-.152.155-.232.228l-.003.003c-.08.073-.162.145-.247.213l-.003.002c-.085.068-.172.135-.262.198l-.003.002c-.09.063-.183.125-.278.183l-.003.002c-.095.058-.193.113-.293.165l-.003.002c-.1.052-.202.101-.306.146z" fill="#006BFF"/>
          </svg>
        )
      case 'microsoft':
        return (
          <svg viewBox="0 0 24 24" className="w-6 h-6">
            <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
            <rect x="13" y="1" width="10" height="10" fill="#7FBA00"/>
            <rect x="1" y="13" width="10" height="10" fill="#00A4EF"/>
            <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
          </svg>
        )
      case 'google':
        return (
          <svg viewBox="0 0 24 24" className="w-6 h-6">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        )
      case 'zoom':
        return (
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#2D8CFF">
            <path d="M4.585 6.836A2.25 2.25 0 0 0 2.25 9v6a2.25 2.25 0 0 0 2.335 2.164l.165-.014h8.5a2.25 2.25 0 0 0 2.25-2.25V9a2.25 2.25 0 0 0-2.25-2.25h-8.5l-.165.086zm11.165 1.414v7.5l4.5 2.25V6l-4.5 2.25z"/>
          </svg>
        )
      case 'simplybook':
        return (
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#FF6B35">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H7v-2h5v2zm5-4H7v-2h10v2zm0-4H7V7h10v2z"/>
          </svg>
        )
      case 'acuity':
        return (
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#006BFF">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>
          </svg>
        )
      case 'custom':
      default:
        return <Calendar size={24} className="text-primary-500" />
    }
  }

  const getBookingProviderName = (type: string) => {
    switch (type) {
      case 'calendly': return 'Calendly'
      case 'microsoft': return 'Microsoft Bookings'
      case 'google': return 'Google Calendar'
      case 'zoom': return 'Zoom'
      case 'simplybook': return 'SimplyBook'
      case 'acuity': return 'Acuity Scheduling'
      case 'custom': return 'Eigener Kalender'
      default: return 'Terminbuchung'
    }
  }

  const getBookingProviderColor = (type: string) => {
    switch (type) {
      case 'calendly': return 'bg-[#006BFF]/10 border-[#006BFF]/30'
      case 'microsoft': return 'bg-[#00A4EF]/10 border-[#00A4EF]/30'
      case 'google': return 'bg-[#4285F4]/10 border-[#4285F4]/30'
      case 'zoom': return 'bg-[#2D8CFF]/10 border-[#2D8CFF]/30'
      case 'simplybook': return 'bg-[#FF6B35]/10 border-[#FF6B35]/30'
      case 'acuity': return 'bg-[#006BFF]/10 border-[#006BFF]/30'
      case 'custom': return 'bg-primary-500/10 border-primary-500/30'
      default: return 'bg-dark-700 border-dark-600'
    }
  }

  const visibleContactInfo = isAdmin ? contactInfo : contactInfo.filter(info => info.enabled)
  const visibleBookingWidgets = isAdmin ? bookingWidgets : bookingWidgets.filter(w => w.enabled && w.url)

  return (
    <div className="min-h-screen">
      {/* Page Banner mit Titel */}
      <PageBanner pageId="contact">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold mb-2" style={{ color: 'rgb(var(--color-text))' }}>
            <span className="glow-text">{pageTitle}</span>
          </h1>
          <p className="text-lg" style={{ color: 'rgb(var(--color-text-secondary))' }}>
            {pageSubtitle}
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
      </PageBanner>

      <div className="container mx-auto max-w-6xl px-4 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Contact Info & Booking */}
            <div className="space-y-6">
              {/* Contact Info Cards */}
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

              {/* Booking Widgets */}
              {visibleBookingWidgets.length > 0 && (
                <div className="card">
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar size={20} className="text-primary-500" />
                    <h3 className="font-semibold">Termin buchen</h3>
                  </div>
                  <div className="space-y-3">
                    {visibleBookingWidgets.map((widget) => (
                      widget.embedType === 'link' ? (
                        <a
                          key={widget.id}
                          href={widget.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center justify-between p-3 rounded-lg border transition-all hover:scale-[1.02] ${getBookingProviderColor(widget.type)}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0">
                              {getBookingIcon(widget.type)}
                            </div>
                            <div>
                              <span className="font-medium block">{widget.title}</span>
                              <span className="text-xs text-dark-400">{getBookingProviderName(widget.type)}</span>
                            </div>
                          </div>
                          <ExternalLink size={18} className="text-dark-400 group-hover:text-primary-400 transition-colors flex-shrink-0" />
                        </a>
                      ) : (
                        <div key={widget.id} className={`p-3 rounded-lg border ${getBookingProviderColor(widget.type)}`}>
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0">
                              {getBookingIcon(widget.type)}
                            </div>
                            <div>
                              <span className="font-medium block">{widget.title}</span>
                              <span className="text-xs text-dark-400">{getBookingProviderName(widget.type)}</span>
                            </div>
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Contact Form & Embedded Booking */}
            <div className="lg:col-span-2 space-y-6">
              {/* Embedded Booking Widgets (iFrames) */}
              {visibleBookingWidgets.filter(w => w.embedType === 'iframe' && w.url).map((widget) => (
                <div key={widget.id} className="card">
                  <div className={`flex items-center gap-3 mb-4 p-3 rounded-lg border ${getBookingProviderColor(widget.type)}`}>
                    <div className="flex-shrink-0">
                      {getBookingIcon(widget.type)}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{widget.title}</h2>
                      <span className="text-sm text-dark-400">{getBookingProviderName(widget.type)}</span>
                    </div>
                  </div>
                  <div className="rounded-lg overflow-hidden bg-white">
                    <iframe
                      src={widget.url}
                      width="100%"
                      height="600"
                      frameBorder="0"
                      className="w-full"
                      title={widget.title}
                      allow="camera; microphone; fullscreen; payment"
                    />
                  </div>
                </div>
              ))}

              {/* Contact Form */}
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
                        maxLength={100}
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
                        maxLength={254}
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
                      maxLength={200}
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
                      maxLength={5000}
                    />
                    <p className="text-xs text-dark-400 mt-1">{formData.message.length}/5000 Zeichen</p>
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
        bookingWidgets={bookingWidgets}
      />
    </div>
  )
}
