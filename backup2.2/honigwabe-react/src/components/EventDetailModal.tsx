import { X, Calendar, Clock, MapPin, Ticket, ExternalLink } from 'lucide-react';
import { Event } from '../services/event.service';

interface EventDetailModalProps {
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EventDetailModal({ event, isOpen, onClose }: EventDetailModalProps) {
  if (!isOpen || !event) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const isUpcoming = (dateString: string) => {
    return new Date(dateString) >= new Date();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-dark-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-dark-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-dark-900/80 hover:bg-dark-800 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Event Image */}
          {event.imageUrl && (
            <div className="w-full h-64 md:h-96 overflow-hidden rounded-t-lg">
              <img 
                src={event.imageUrl} 
                alt={event.title} 
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 md:p-8">
          {/* Title */}
          <h2 className="text-3xl md:text-4xl font-bold mb-6 glow-text">
            {event.title}
          </h2>

          {/* Event Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Date */}
            <div className="flex items-start gap-3 p-4 bg-dark-800 rounded-lg">
              <Calendar className="text-primary-400 flex-shrink-0 mt-1" size={24} />
              <div>
                <p className="text-sm text-dark-400 mb-1">Datum</p>
                <p className="font-semibold text-lg">{formatDate(event.eventDate)}</p>
              </div>
            </div>

            {/* Time */}
            {event.eventTime && (
              <div className="flex items-start gap-3 p-4 bg-dark-800 rounded-lg">
                <Clock className="text-primary-400 flex-shrink-0 mt-1" size={24} />
                <div>
                  <p className="text-sm text-dark-400 mb-1">Uhrzeit</p>
                  <p className="font-semibold text-lg">{event.eventTime} Uhr</p>
                </div>
              </div>
            )}

            {/* Location */}
            {event.location && (
              <div className="flex items-start gap-3 p-4 bg-dark-800 rounded-lg md:col-span-2">
                <MapPin className="text-primary-400 flex-shrink-0 mt-1" size={24} />
                <div className="flex-1">
                  <p className="text-sm text-dark-400 mb-1">Ort</p>
                  <p className="font-semibold text-lg mb-2">{event.location}</p>
                  {event.locationUrl && (
                    <a
                      href={event.locationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-primary-400 hover:text-primary-300 transition-colors"
                    >
                      <ExternalLink size={16} />
                      Wegbeschreibung anzeigen
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="mb-6">
            <h3 className="text-xl font-bold mb-3">Beschreibung</h3>
            <p className="text-dark-300 whitespace-pre-wrap leading-relaxed">
              {event.description}
            </p>
          </div>

          {/* Ticket Button */}
          {event.ticketUrl && isUpcoming(event.eventDate) && (
            <div className="flex gap-3">
              <a
                href={event.ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary flex-1 flex items-center justify-center gap-2 text-lg py-4"
              >
                <Ticket size={20} />
                Tickets kaufen
              </a>
              <a
                href={event.ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary p-4"
                title="In neuem Tab öffnen"
              >
                <ExternalLink size={20} />
              </a>
            </div>
          )}

          {!isUpcoming(event.eventDate) && (
            <div className="text-center py-4 px-6 bg-dark-800 rounded-lg text-dark-400 text-lg">
              Dieses Event ist bereits vorbei
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
