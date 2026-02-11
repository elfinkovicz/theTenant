import { useState, useEffect } from 'react'
import { X, Save, Plus, Trash2, Calendar } from 'lucide-react'
import { ContactInfo, BookingWidget, contactInfoService } from '../services/contactInfo.service'

interface ContactInfoModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  contactInfo: ContactInfo[]
  bookingWidgets?: BookingWidget[]
}

const BOOKING_TYPES = [
  { value: 'calendly', label: 'Calendly', icon: '📅' },
  { value: 'microsoft', label: 'Microsoft Bookings', icon: '📆' },
  { value: 'zoom', label: 'Zoom', icon: '🎥' },
  { value: 'simplybook', label: 'SimplyBook.me', icon: '📋' },
  { value: 'custom', label: 'Eigener Link', icon: '🔗' },
]

export const ContactInfoModal = ({ isOpen, onClose, onSuccess, contactInfo, bookingWidgets = [] }: ContactInfoModalProps) => {
  const [editedInfo, setEditedInfo] = useState<ContactInfo[]>([])
  const [editedBookings, setEditedBookings] = useState<BookingWidget[]>([])
  const [activeTab, setActiveTab] = useState<'contact' | 'booking'>('contact')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setEditedInfo(JSON.parse(JSON.stringify(contactInfo)))
      setEditedBookings(JSON.parse(JSON.stringify(bookingWidgets || [])))
      setError('')
    }
  }, [isOpen, contactInfo, bookingWidgets])

  const handleToggle = (infoId: string) => {
    setEditedInfo(prev =>
      prev.map(info =>
        info.id === infoId ? { ...info, enabled: !info.enabled } : info
      )
    )
  }

  const handleChange = (infoId: string, field: 'title' | 'value', value: string) => {
    setEditedInfo(prev =>
      prev.map(info =>
        info.id === infoId ? { ...info, [field]: value } : info
      )
    )
  }

  // Booking Widget Handlers
  const handleBookingToggle = (widgetId: string) => {
    setEditedBookings(prev =>
      prev.map(widget =>
        widget.id === widgetId ? { ...widget, enabled: !widget.enabled } : widget
      )
    )
  }

  const handleBookingChange = (widgetId: string, field: keyof BookingWidget, value: string) => {
    setEditedBookings(prev =>
      prev.map(widget =>
        widget.id === widgetId ? { ...widget, [field]: value } : widget
      )
    )
  }

  const handleAddBooking = () => {
    const newWidget: BookingWidget = {
      id: `booking-${Date.now()}`,
      type: 'calendly',
      title: 'Termin buchen',
      url: '',
      embedType: 'link',
      enabled: true
    }
    setEditedBookings(prev => [...prev, newWidget])
  }

  const handleDeleteBooking = (widgetId: string) => {
    setEditedBookings(prev => prev.filter(w => w.id !== widgetId))
  }

  const handleSave = async () => {
    setLoading(true)
    setError('')

    try {
      await contactInfoService.updateContactInfo(editedInfo, undefined, editedBookings)
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Failed to update contact info:', err)
      setError(err.response?.data?.error || 'Fehler beim Speichern')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="bg-dark-900 rounded-xl border border-dark-700 w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-700">
          <h2 className="text-2xl font-bold">Kontakt & Booking verwalten</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-dark-700">
          <button
            onClick={() => setActiveTab('contact')}
            className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
              activeTab === 'contact'
                ? 'text-primary-400 border-b-2 border-primary-400'
                : 'text-dark-400 hover:text-white'
            }`}
          >
            Kontaktdaten
          </button>
          <button
            onClick={() => setActiveTab('booking')}
            className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
              activeTab === 'booking'
                ? 'text-primary-400 border-b-2 border-primary-400'
                : 'text-dark-400 hover:text-white'
            }`}
          >
            Booking & Termine
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
              {error}
            </div>
          )}

          {activeTab === 'contact' ? (
            <div className="space-y-4">
              {editedInfo.map((info) => (
                <div
                  key={info.id}
                  className="p-4 bg-dark-800 rounded-lg border border-dark-700"
                >
                  <div className="flex items-start gap-4">
                    {/* Toggle Switch */}
                    <div className="flex-shrink-0 pt-1">
                      <button
                        onClick={() => handleToggle(info.id)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          info.enabled ? 'bg-primary-600' : 'bg-dark-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            info.enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Info Fields */}
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold capitalize">{info.type}</span>
                      </div>

                      {/* Title Input */}
                      <div>
                        <label className="block text-sm text-dark-400 mb-1">
                          Titel
                        </label>
                        <input
                          type="text"
                          value={info.title}
                          onChange={(e) => handleChange(info.id, 'title', e.target.value)}
                          className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500"
                          placeholder="Titel"
                        />
                      </div>

                      {/* Value Input */}
                      <div>
                        <label className="block text-sm text-dark-400 mb-1">
                          {info.type === 'address' ? 'Adresse' : 'Wert'}
                        </label>
                        {info.type === 'address' ? (
                          <textarea
                            value={info.value}
                            onChange={(e) => handleChange(info.id, 'value', e.target.value)}
                            className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500 resize-none"
                            rows={3}
                            placeholder="Straße&#10;PLZ Stadt&#10;Land"
                          />
                        ) : (
                          <input
                            type="text"
                            value={info.value}
                            onChange={(e) => handleChange(info.id, 'value', e.target.value)}
                            className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500"
                            placeholder={info.type === 'email' ? 'email@example.com' : '+49 123 456789'}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-dark-400 text-sm">
                  Füge Booking-Links hinzu (Calendly, Microsoft Bookings, Zoom, etc.)
                </p>
                <button
                  onClick={handleAddBooking}
                  className="btn-primary flex items-center gap-2 py-2 px-3 text-sm"
                >
                  <Plus size={16} />
                  Hinzufügen
                </button>
              </div>

              {editedBookings.length === 0 ? (
                <div className="text-center py-8 text-dark-400">
                  <Calendar size={48} className="mx-auto mb-3 opacity-50" />
                  <p>Noch keine Booking-Widgets konfiguriert</p>
                  <button
                    onClick={handleAddBooking}
                    className="btn-secondary mt-4"
                  >
                    Erstes Widget hinzufügen
                  </button>
                </div>
              ) : (
                editedBookings.map((widget) => (
                  <div
                    key={widget.id}
                    className="p-4 bg-dark-800 rounded-lg border border-dark-700"
                  >
                    <div className="flex items-start gap-4">
                      {/* Toggle Switch */}
                      <div className="flex-shrink-0 pt-1">
                        <button
                          onClick={() => handleBookingToggle(widget.id)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            widget.enabled ? 'bg-primary-600' : 'bg-dark-600'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              widget.enabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Widget Fields */}
                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          {/* Type */}
                          <div>
                            <label className="block text-sm text-dark-400 mb-1">Typ</label>
                            <select
                              value={widget.type}
                              onChange={(e) => handleBookingChange(widget.id, 'type', e.target.value)}
                              className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500"
                            >
                              {BOOKING_TYPES.map(type => (
                                <option key={type.value} value={type.value}>
                                  {type.icon} {type.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Embed Type */}
                          <div>
                            <label className="block text-sm text-dark-400 mb-1">Anzeige</label>
                            <select
                              value={widget.embedType}
                              onChange={(e) => handleBookingChange(widget.id, 'embedType', e.target.value)}
                              className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500"
                            >
                              <option value="link">🔗 Als Button/Link</option>
                              <option value="iframe">📋 Eingebettet (iFrame)</option>
                            </select>
                          </div>
                        </div>

                        {/* Title */}
                        <div>
                          <label className="block text-sm text-dark-400 mb-1">Button-Text</label>
                          <input
                            type="text"
                            value={widget.title}
                            onChange={(e) => handleBookingChange(widget.id, 'title', e.target.value)}
                            className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500"
                            placeholder="z.B. Termin buchen"
                          />
                        </div>

                        {/* URL */}
                        <div>
                          <label className="block text-sm text-dark-400 mb-1">URL</label>
                          <input
                            type="url"
                            value={widget.url}
                            onChange={(e) => handleBookingChange(widget.id, 'url', e.target.value)}
                            className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500"
                            placeholder="https://calendly.com/dein-name"
                          />
                          <p className="text-xs text-dark-500 mt-1">
                            {widget.type === 'calendly' && 'z.B. https://calendly.com/dein-name'}
                            {widget.type === 'microsoft' && 'z.B. https://outlook.office365.com/book/...'}
                            {widget.type === 'zoom' && 'z.B. https://zoom.us/meeting/schedule/...'}
                            {widget.type === 'simplybook' && 'z.B. https://dein-name.simplybook.me'}
                            {widget.type === 'custom' && 'Beliebiger Booking-Link'}
                          </p>
                        </div>
                      </div>

                      {/* Delete Button */}
                      <button
                        onClick={() => handleDeleteBooking(widget.id)}
                        className="p-2 text-dark-400 hover:text-red-500 hover:bg-dark-700 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-dark-700">
          <button
            onClick={onClose}
            className="btn-secondary flex-1"
            disabled={loading}
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Speichern...
              </>
            ) : (
              <>
                <Save size={20} />
                Speichern
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
