import { useState, useEffect } from 'react';
import { X, Save, Calendar } from 'lucide-react';
import { slotsService, PostingSlot } from '../services/slots.service';
import { SlotCalendar } from './SlotCalendar';
import { toast } from '../utils/toast-alert';

interface SlotManagerModalProps {
  isOpen: boolean;
  tenantId?: string;
  onClose: () => void;
  onSlotsUpdated: () => void;
}

export function SlotManagerModal({ isOpen, tenantId, onClose, onSlotsUpdated }: SlotManagerModalProps) {
  const [slots, setSlots] = useState<PostingSlot[]>([]);
  const [timezone, setTimezone] = useState('Europe/Berlin');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadSlots();
    }
  }, [isOpen, tenantId]);

  const loadSlots = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await slotsService.getSlots(tenantId);
      setSlots(data.slots || []);
      setTimezone(data.timezone || 'Europe/Berlin');
    } catch (err: any) {
      console.error('Error loading slots:', err);
      setError('Fehler beim Laden der Slots');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      await slotsService.updateSlots(slots, timezone, tenantId);
      toast.success('Posting Slots gespeichert!');
      onSlotsUpdated();
      onClose();
    } catch (err: any) {
      console.error('Error saving slots:', err);
      setError('Fehler beim Speichern der Slots');
      toast.error('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden border border-dark-800 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-500/20 rounded-lg">
              <Calendar className="w-6 h-6 text-primary-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Posting Slots verwalten</h2>
              <p className="text-sm text-dark-400">
                Definiere feste Zeiten für automatische Post-Planung
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-dark-400">Lade Slots...</div>
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 text-red-500">
              {error}
              <button
                onClick={loadSlots}
                className="ml-4 text-sm underline hover:no-underline"
              >
                Erneut versuchen
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Info Box */}
              <div className="p-4 bg-primary-500/10 rounded-lg border border-primary-500/30">
                <h3 className="font-medium mb-2">💡 So funktionieren Posting Slots</h3>
                <ul className="text-sm text-dark-400 space-y-1">
                  <li>• Definiere wiederkehrende Zeiten für deine Posts (z.B. Montag, Mittwoch, Freitag um 12:00)</li>
                  <li>• Beim Erstellen eines Posts wählst du "Nächster Slot" anstatt manueller Zeitplanung</li>
                  <li>• Das System findet automatisch den nächsten freien Slot</li>
                  <li>• Slots können jederzeit aktiviert/deaktiviert werden</li>
                </ul>
              </div>

              {/* Timezone Selector */}
              <div>
                <label className="block text-sm font-medium mb-2">Zeitzone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  disabled={saving}
                  className="input w-full max-w-xs disabled:opacity-50"
                >
                  <option value="Europe/Berlin">Europe/Berlin (MEZ/MESZ)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="America/New_York">America/New_York (EST/EDT)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                  <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
                </select>
              </div>

              {/* Slot Calendar */}
              <div>
                <h3 className="text-lg font-medium mb-4">Wochenkalender</h3>
                <SlotCalendar
                  slots={slots}
                  onSlotsChange={setSlots}
                  timezone={timezone}
                />
              </div>

              {/* Examples */}
              {slots.length === 0 && (
                <div className="p-4 bg-dark-800/50 rounded-lg border border-dark-700">
                  <h3 className="font-medium mb-2">📋 Beispiel-Konfigurationen</h3>
                  <div className="space-y-2 text-sm text-dark-400">
                    <div>
                      <strong className="text-white">Täglich:</strong> Montag-Freitag um 12:00
                    </div>
                    <div>
                      <strong className="text-white">3x pro Woche:</strong> Montag, Mittwoch, Freitag um 10:00
                    </div>
                    <div>
                      <strong className="text-white">Mehrmals täglich:</strong> Montag 09:00, Montag 15:00, Montag 18:00
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-dark-700 flex-shrink-0">
          <div className="text-sm text-dark-400">
            {slots.length > 0 ? (
              <>
                {slots.filter(s => s.enabled).length} von {slots.length} Slots aktiv
              </>
            ) : (
              'Noch keine Slots definiert'
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="btn-secondary disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Wird gespeichert...' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
