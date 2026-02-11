import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Calendar, MapPin, Clock, Ticket, Plus, Edit, Trash2, Users, Twitter, Instagram, Youtube, Twitch, Linkedin, Facebook, Globe, Lock } from 'lucide-react'
import { eventService, Event } from '../services/event.service'
import { prefetchService } from '../services/prefetch.service'
import { EventModal } from '../components/EventModal'
import { EventDetailModal } from '../components/EventDetailModal'
import { LoadMoreButton } from '../components/LoadMoreButton'
import { PageBanner } from '../components/PageBanner'
import { useAdmin } from '../hooks/useAdmin'
import { usePagination } from '../hooks/usePagination'
import { usePageTitle } from '../hooks/usePageTitle'
import { useAuthStore } from '../store/authStore'
import { toast } from '../utils/toast-alert'

// TikTok Icon
const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

// Discord Icon
const DiscordIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

// Spotify Icon
const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

const detectPlatform = (url: string): string => {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) return 'twitter';
  if (lowerUrl.includes('instagram.com')) return 'instagram';
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'youtube';
  if (lowerUrl.includes('twitch.tv')) return 'twitch';
  if (lowerUrl.includes('tiktok.com')) return 'tiktok';
  if (lowerUrl.includes('linkedin.com')) return 'linkedin';
  if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.com')) return 'facebook';
  if (lowerUrl.includes('discord.gg') || lowerUrl.includes('discord.com')) return 'discord';
  if (lowerUrl.includes('spotify.com') || lowerUrl.includes('open.spotify')) return 'spotify';
  return 'website';
};

const getPlatformIcon = (platform: string) => {
  switch (platform) {
    case 'twitter': return <Twitter className="w-3.5 h-3.5" />;
    case 'instagram': return <Instagram className="w-3.5 h-3.5" />;
    case 'youtube': return <Youtube className="w-3.5 h-3.5" />;
    case 'twitch': return <Twitch className="w-3.5 h-3.5" />;
    case 'tiktok': return <TikTokIcon />;
    case 'linkedin': return <Linkedin className="w-3.5 h-3.5" />;
    case 'facebook': return <Facebook className="w-3.5 h-3.5" />;
    case 'discord': return <DiscordIcon />;
    case 'spotify': return <SpotifyIcon />;
    default: return <Globe className="w-3.5 h-3.5" />;
  }
};

const getPlatformColor = (platform: string): string => {
  switch (platform) {
    case 'twitter': return 'hover:bg-sky-500';
    case 'instagram': return 'hover:bg-pink-500';
    case 'youtube': return 'hover:bg-red-600';
    case 'twitch': return 'hover:bg-purple-600';
    case 'tiktok': return 'hover:bg-black';
    case 'linkedin': return 'hover:bg-blue-700';
    case 'facebook': return 'hover:bg-blue-600';
    case 'discord': return 'hover:bg-indigo-600';
    case 'spotify': return 'hover:bg-green-600';
    default: return 'hover:bg-primary-600';
  }
};

export const Events = () => {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const { isAdmin } = useAdmin()
  const { isAuthenticated } = useAuthStore()
  const { title: pageTitle, subtitle: pageSubtitle } = usePageTitle('/events')

  // Pagination - 9 events initial (3 rows of 3), load 9 more each time
  const { displayedItems: paginatedEvents, hasMore, remainingCount, loadMore } = usePagination(events, { initialLimit: 9, increment: 9 })

  useEffect(() => {
    loadEvents()
  }, [])

  const loadEvents = async () => {
    try {
      // Use prefetch cache if available
      const result = await prefetchService.getEvents()
      console.log('Loaded events:', result);
      // getEvents() returns { events: [...], settings: {...} }
      const eventsList = Array.isArray(result.events) ? result.events : []
      
      // Sort events by date (upcoming first, then past events)
      const sortedEvents = eventsList.sort((a: Event, b: Event) => {
        const dateA = new Date(a.eventDate).getTime()
        const dateB = new Date(b.eventDate).getTime()
        const now = Date.now()
        
        // Both upcoming: sort ascending (nearest first)
        if (dateA >= now && dateB >= now) {
          return dateA - dateB
        }
        // Both past: sort descending (most recent first)
        if (dateA < now && dateB < now) {
          return dateB - dateA
        }
        // One upcoming, one past: upcoming comes first
        return dateA >= now ? -1 : 1
      })
      
      setEvents(sortedEvents)
    } catch (error) {
      console.error('Failed to load events:', error)
      setEvents([]) // Ensure events is always an array
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setSelectedEvent(null)
    setModalMode('create')
    setIsModalOpen(true)
  }

  const handleEdit = (event: Event, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedEvent(event)
    setModalMode('edit')
    setIsModalOpen(true)
  }

  const handleViewDetails = (event: Event) => {
    // Check if exclusive and not authenticated
    if (event.isExclusive && !isAuthenticated && !isAdmin) {
      const hostname = window.location.hostname;
      const parts = hostname.split('.');
      const subdomain = parts.length >= 3 && parts[0] !== 'www' ? parts[0] : 'platform';
      window.location.href = `https://${subdomain}.viraltenant.com/login`;
      return;
    }
    setSelectedEvent(event)
    setIsDetailModalOpen(true)
  }

  const handleDelete = async (event: Event, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Event "${event.title}" wirklich löschen?`)) return

    try {
      await eventService.deleteEvent(event.eventId)
      toast.success('Event erfolgreich gelöscht')
      prefetchService.invalidate('events')
      loadEvents()
    } catch (error) {
      console.error('Failed to delete event:', error)
      toast.error('Fehler beim Löschen')
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
      {/* Page Banner mit Titel */}
      <PageBanner pageId="events">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold mb-2" style={{ color: 'rgb(var(--color-text))' }}>
            <span className="glow-text">{pageTitle}</span>
          </h1>
          <p className="text-lg" style={{ color: 'rgb(var(--color-text-secondary))' }}>
            {pageSubtitle}
          </p>
        </div>
      </PageBanner>

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
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {paginatedEvents.map((event) => {
              const isLocked = event.isExclusive && !isAuthenticated && !isAdmin;
              
              return (
              <motion.div
                key={event.eventId}
                whileHover={{ y: -5 }}
                onClick={() => handleViewDetails(event)}
                className={`card relative overflow-hidden cursor-pointer ${
                  event.isExclusive 
                    ? 'shadow-[0_0_40px_rgba(234,179,8,0.6),0_0_80px_rgba(234,179,8,0.3)]' 
                    : ''
                }`}
                style={event.isExclusive ? {
                  border: '2px solid rgba(234, 179, 8, 0.5)'
                } : undefined}
              >
                {/* Exclusive Badge */}
                {event.isExclusive && (
                  <div className="absolute top-0 left-0 z-20 bg-gradient-to-r from-yellow-500 to-amber-500 text-black px-3 py-1 rounded-br-xl text-xs font-bold flex items-center gap-1.5 shadow-lg">
                    <Lock size={12} fill="currentColor" />
                    Exklusiv
                  </div>
                )}

                {/* Exclusive Lock Overlay */}
                {isLocked && (
                  <div className="absolute inset-0 z-10 bg-black/70 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                      <Lock className="w-10 h-10 text-yellow-400" />
                      <p className="text-sm font-medium text-white">Nur für Mitglieder</p>
                      <p className="text-xs text-dark-400">Klicke zum Einloggen</p>
                    </div>
                  </div>
                )}

                {/* Admin Actions */}
                {isAdmin && (
                  <div className="absolute top-4 right-4 flex gap-2 z-20">
                    <button
                      onClick={(e) => handleEdit(event, e)}
                      className="p-2 rounded-lg bg-dark-800 hover:bg-primary-600 transition-colors"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={(e) => handleDelete(event, e)}
                      className="p-2 rounded-lg bg-dark-800 hover:bg-red-600 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}

                {/* Event Image - 16:9 Format */}
                {event.imageUrl && (
                  <div className="w-full aspect-[16/9] mb-4 rounded-lg overflow-hidden">
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

                {/* Guests */}
                {event.guests && event.guests.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap mb-4">
                    <Users className="w-4 h-4 text-dark-400" />
                    {event.guests.slice(0, 3).map((guest) => (
                      <div 
                        key={guest.id} 
                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg border"
                        style={{ 
                          backgroundColor: 'rgb(var(--color-secondary))',
                          borderColor: 'rgb(var(--color-border))',
                          color: 'rgb(var(--color-text))'
                        }}
                      >
                        {guest.imageUrl && (
                          <img src={guest.imageUrl} alt={guest.name} className="w-5 h-5 rounded-full object-cover" />
                        )}
                        <span className="text-sm font-semibold">{guest.name}</span>
                        {guest.links?.slice(0, 7).map((url, idx) => {
                          const platform = detectPlatform(url);
                          return (
                            <a
                              key={idx}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className={`p-1 rounded transition-colors ${getPlatformColor(platform)}`}
                            >
                              {getPlatformIcon(platform)}
                            </a>
                          );
                        })}
                      </div>
                    ))}
                    {event.guests.length > 3 && (
                      <span className="text-sm text-dark-400">+{event.guests.length - 3}</span>
                    )}
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
            )})}
            </div>
            
            {hasMore && (
              <LoadMoreButton onClick={loadMore} remainingCount={remainingCount} label="Mehr Events laden" />
            )}
          </>
        )}
      </div>

      {/* Edit Modal */}
      <EventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadEvents}
        event={selectedEvent}
        mode={modalMode}
      />

      {/* Detail Modal */}
      <EventDetailModal
        event={selectedEvent}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
      />
    </div>
  )
}
