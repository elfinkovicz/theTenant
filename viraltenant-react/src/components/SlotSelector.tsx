import { useState, useEffect } from 'react';
import { Calendar, Settings } from 'lucide-react';
import { slotsService, NextSlotInfo } from '../services/slots.service';

interface SlotSelectorProps {
  tenantId?: string;
  onSlotSelected: (datetime: string) => void;
  onManageSlots: () => void;
}

export function SlotSelector({ tenantId, onSlotSelected, onManageSlots }: SlotSelectorProps) {
  const [nextSlot, setNextSlot] = useState<NextSlotInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadKey, setLoadKey] = useState(0); // Force reload trigger

  useEffect(() => {
    loadNextSlot();
  }, [tenantId, loadKey]);

  const loadNextSlot = async () => {
    try {
      setLoading(true);
      setError('');
      const slot = await slotsService.getNextSlot(tenantId);
      setNextSlot(slot);
      
      // Auto-select the slot datetime
      if (slot) {
        onSlotSelected(slot.datetime);
      }
    } catch (err: any) {
      console.error('Error loading next slot:', err);
      setError('Fehler beim Laden des nächsten Slots');
    } finally {
      setLoading(false);
    }
  };

  // Expose reload function
  useEffect(() => {
    (window as any).__reloadSlotSelector = () => setLoadKey(k => k + 1);
  }, []);

  if (loading) {
    return (
      <div className="p-4 bg-primary-500/10 rounded-lg border border-primary-500/30">
        <div className="flex items-center gap-2 text-dark-400">
          <Calendar className="w-5 h-5 animate-pulse" />
          <span>Lade nächsten Slot...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
        <div className="text-red-500 text-sm">{error}</div>
        <button
          onClick={loadNextSlot}
          className="text-sm text-red-400 hover:text-red-300 mt-2"
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  if (!nextSlot) {
    return (
      <div className="p-4 bg-dark-800/50 rounded-lg border border-dark-700">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-dark-400">Keine Slots verfügbar</span>
          <button
            onClick={onManageSlots}
            className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1"
          >
            <Settings className="w-4 h-4" />
            Slots erstellen
          </button>
        </div>
        <p className="text-sm text-dark-500">
          Erstelle Posting-Slots, um Posts automatisch zu planen.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-primary-500/10 rounded-lg border border-primary-500/30">
      <div className="flex items-center justify-between mb-3">
        <span className="font-medium">Nächster Slot</span>
        <button
          onClick={onManageSlots}
          className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1"
        >
          <Settings className="w-4 h-4" />
          Verwalten
        </button>
      </div>
      
      <div className="flex items-start gap-3">
        <div className="p-2 bg-primary-500/20 rounded-lg">
          <Calendar className="w-6 h-6 text-primary-400" />
        </div>
        <div className="flex-1">
          <div className="font-bold text-lg">
            {nextSlot.day_name}, {nextSlot.date}
          </div>
          <div className="text-dark-400">
            um {nextSlot.time} Uhr
          </div>
          {nextSlot.label && (
            <div className="text-sm text-primary-400 mt-1">
              {nextSlot.label}
            </div>
          )}
        </div>
      </div>
      
      <button
        onClick={loadNextSlot}
        className="text-xs text-dark-500 hover:text-dark-400 mt-3"
      >
        Aktualisieren
      </button>
    </div>
  );
}
