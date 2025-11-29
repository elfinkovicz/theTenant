import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Calendar, MapPin, Clock, Ticket, Plus, Edit, Trash2 } from 'lucide-react'
import { eventService, Event } from '../services/event.service'
import { EventModal } from '../components/EventModal'
import { useAdmin } from '../hooks/useAdmin'

export const Events = () => {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const { isAdmin } = useAdmin()

  useEffect(() => {
    loadEvents()
  }, [])

  const loadEvents = async () => {
    try {
      const eventList = await eventService.getEvents()
      setEvents(eventList)
    } catch (error) {
      console.error('Failed to load events:', error)
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setSelectedEvent(null)
    setModalMode('create')
    setIsModalOpen(true)
  }

  const handleEdit = (event: Event) => {
    setSelectedEvent(event)
    setModalMode('edit')
    setIsModalOpen(true)
  }

  const handleDelete = async (event: Event) => {
    if (!confirm(`Event "${event.title}" wirklich löschen?`)) return

    try {
      await eventService.deleteEvent(event.eventId)
      loadEvents()
    } catch (error) {
      console.error('Failed to delete event:', error)
      alert('Fehler beim Löschen')
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  }

  const isUpcoming = (dateString: string) => {
    return new Date(dateString) >= new Date()
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="relative py-12 overflow-hidden bg-gradient-to-br from-primary-900/20 via-dark-950 to-dark-950">
        <div className="container mx-auto px-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold mb-2">
              <span className="glow-text">Events</span>
            </h1>
            <p className="text-dark-400 text-lg">
              Verpasse keine unserer Veranstaltungen
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">
        {/* Admin Controls */}
        {isAdmin && (
          <div className="mb-6 flex justify-end">
            <button onClick={handleCreate} className="btn-primary flex items-center gap-2">
              <Plus size={20} />
              Event hinzufügen
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-dark-400 text-lg">Keine Events geplant</p>
            {isAdmin && (
              <button onClick={handleCreate} className="btn-primary mt-4">
                Erstes Event hinzufügen
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {events.map((event) => (
              <motion.div
                key={event.eventId}
                whileHover={{ y: -5 }}
                className="card relative overflow-hidden"
              >
                {/* Admin Actions */}
                {isAdmin && (
                  <div className="absolute top-4 right-4 flex gap-2 z-10">
                    <button
                      onClick={() => handleEdit(event)}
                      className="p-2 rounded-lg bg-dark-800 hover:bg-primary-600 transition-colors"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(event)}
                      className="p-2 rounded-lg bg-dark-800 hover:bg-red-600 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}

                {/* Event Image */}
                {event.imageUrl && (
                  <div className="w-full h-48 mb-4 rounded-lg overflow-hidden">
                    <img 
                      src={event.imageUrl} 
                      alt={event.title} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Event Info */}
                <div className="flex items-start gap-3 mb-3">
                  <Calendar className="text-primary-400 flex-shrink-0 mt-1" size={20} />
                  <div>
                    <p className="font-semibold">{formatDate(event.eventDate)}</p>
                    {event.eventTime && (
                      <p className="text-sm text-dark-400 flex items-center gap-1 mt-1">
                        <Clock size={14} />
                        {event.eventTime} Uhr
                      </p>
                    )}
                  </div>
                </div>

                <h3 className="text-xl font-bold mb-2">{event.title}</h3>
                <p className="text-dark-400 mb-4 line-clamp-3">{event.description}</p>

                {event.location && (
                  <div className="flex items-center gap-2 text-dark-400 mb-4">
                    <MapPin size={16} />
                    <span className="text-sm">{event.location}</span>
                  </div>
                )}

                {/* Ticket Button */}
                {event.ticketUrl && isUpcoming(event.eventDate) && (
                  <a
                    href={event.ticketUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    <Ticket size={18} />
                    Tickets kaufen
                  </a>
                )}

                {!isUpcoming(event.eventDate) && (
                  <div className="text-center py-2 px-4 bg-dark-800 rounded-lg text-dark-400">
                    Event beendet
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      <EventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadEvents}
        event={selectedEvent}
        mode={modalMode}
      />
    </div>
  )
}
