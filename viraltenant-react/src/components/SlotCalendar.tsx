import { useState } from 'react';
import { Plus, Trash2, Clock, Check, X } from 'lucide-react';
import { PostingSlot } from '../services/slots.service';

interface SlotCalendarProps {
  slots: PostingSlot[];
  onSlotsChange: (slots: PostingSlot[]) => void;
  timezone?: string;
}

const DAYS = [
  { id: 0, name: 'So', fullName: 'Sonntag' },
  { id: 1, name: 'Mo', fullName: 'Montag' },
  { id: 2, name: 'Di', fullName: 'Dienstag' },
  { id: 3, name: 'Mi', fullName: 'Mittwoch' },
  { id: 4, name: 'Do', fullName: 'Donnerstag' },
  { id: 5, name: 'Fr', fullName: 'Freitag' },
  { id: 6, name: 'Sa', fullName: 'Samstag' },
];

export function SlotCalendar({ slots, onSlotsChange, timezone = 'Europe/Berlin' }: SlotCalendarProps) {
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [newSlotDay, setNewSlotDay] = useState<number | null>(null);
  const [newSlotTime, setNewSlotTime] = useState('12:00');
  const [newSlotLabel, setNewSlotLabel] = useState('');

  const getSlotsForDay = (day: number) => {
    return slots.filter(s => s.day === day).sort((a, b) => a.time.localeCompare(b.time));
  };

  const addSlot = (day: number) => {
    const newSlot: PostingSlot = {
      id: `slot-${Date.now()}`,
      day,
      time: newSlotTime,
      enabled: true,
      label: newSlotLabel || undefined
    };
    
    onSlotsChange([...slots, newSlot]);
    setNewSlotDay(null);
    setNewSlotTime('12:00');
    setNewSlotLabel('');
  };

  const removeSlot = (slotId: string) => {
    onSlotsChange(slots.filter(s => s.id !== slotId));
  };

  const toggleSlot = (slotId: string) => {
    onSlotsChange(slots.map(s => 
      s.id === slotId ? { ...s, enabled: !s.enabled } : s
    ));
  };

  const updateSlot = (slotId: string, updates: Partial<PostingSlot>) => {
    onSlotsChange(slots.map(s => 
      s.id === slotId ? { ...s, ...updates } : s
    ));
  };

  const saveSlotEdit = () => {
    setEditingSlot(null);
  };

  const enableAll = () => {
    onSlotsChange(slots.map(s => ({ ...s, enabled: true })));
  };

  const disableAll = () => {
    onSlotsChange(slots.map(s => ({ ...s, enabled: false })));
  };

  return (
    <div className="space-y-4">
      {/* Timezone Info */}
      <div className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg border border-dark-700">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-dark-400" />
          <span className="text-sm text-dark-400">Zeitzone:</span>
          <span className="text-sm font-medium">{timezone}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={enableAll}
            className="text-xs text-primary-400 hover:text-primary-300"
          >
            Alle aktivieren
          </button>
          <span className="text-dark-600">|</span>
          <button
            onClick={disableAll}
            className="text-xs text-dark-400 hover:text-dark-300"
          >
            Alle deaktivieren
          </button>
        </div>
      </div>

      {/* Weekly Calendar */}
      <div className="grid grid-cols-7 gap-2">
        {DAYS.map(day => (
          <div key={day.id} className="space-y-2">
            {/* Day Header */}
            <div className="text-center p-2 bg-dark-800 rounded-lg border border-dark-700">
              <div className="font-bold text-sm">{day.name}</div>
              <div className="text-xs text-dark-500">{day.fullName}</div>
            </div>

            {/* Slots for this day */}
            <div className="space-y-2 min-h-[100px]">
              {getSlotsForDay(day.id).map(slot => (
                <div
                  key={slot.id}
                  className={`p-2 rounded-lg border transition-all ${
                    slot.enabled
                      ? 'bg-primary-500/10 border-primary-500/30'
                      : 'bg-dark-800/50 border-dark-700 opacity-50'
                  }`}
                >
                  {editingSlot === slot.id ? (
                    // Edit Mode
                    <div className="space-y-2">
                      <input
                        type="time"
                        value={slot.time}
                        onChange={(e) => updateSlot(slot.id, { time: e.target.value })}
                        className="input w-full text-xs p-1"
                      />
                      <input
                        type="text"
                        value={slot.label || ''}
                        onChange={(e) => updateSlot(slot.id, { label: e.target.value })}
                        placeholder="Label"
                        className="input w-full text-xs p-1"
                      />
                      <div className="flex gap-1">
                        <button
                          onClick={() => saveSlotEdit()}
                          className="flex-1 p-1 bg-primary-500 hover:bg-primary-600 rounded text-xs"
                        >
                          <Check className="w-3 h-3 mx-auto" />
                        </button>
                        <button
                          onClick={() => setEditingSlot(null)}
                          className="flex-1 p-1 bg-dark-700 hover:bg-dark-600 rounded text-xs"
                        >
                          <X className="w-3 h-3 mx-auto" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold">{slot.time}</span>
                        <button
                          onClick={() => toggleSlot(slot.id)}
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                            slot.enabled
                              ? 'border-primary-500 bg-primary-500'
                              : 'border-dark-600'
                          }`}
                        >
                          {slot.enabled && <Check className="w-3 h-3" />}
                        </button>
                      </div>
                      {slot.label && (
                        <div className="text-xs text-dark-400 mb-1 truncate">
                          {slot.label}
                        </div>
                      )}
                      <div className="flex gap-1">
                        <button
                          onClick={() => setEditingSlot(slot.id)}
                          className="flex-1 text-xs text-primary-400 hover:text-primary-300"
                        >
                          Bearbeiten
                        </button>
                        <button
                          onClick={() => removeSlot(slot.id)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {/* Add Slot Button */}
              {newSlotDay === day.id ? (
                <div className="p-2 bg-dark-800 rounded-lg border border-primary-500/30 space-y-2">
                  <input
                    type="time"
                    value={newSlotTime}
                    onChange={(e) => setNewSlotTime(e.target.value)}
                    className="input w-full text-xs p-1"
                  />
                  <input
                    type="text"
                    value={newSlotLabel}
                    onChange={(e) => setNewSlotLabel(e.target.value)}
                    placeholder="Label (optional)"
                    className="input w-full text-xs p-1"
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={() => addSlot(day.id)}
                      className="flex-1 p-1 bg-primary-500 hover:bg-primary-600 rounded text-xs"
                    >
                      Hinzufügen
                    </button>
                    <button
                      onClick={() => setNewSlotDay(null)}
                      className="flex-1 p-1 bg-dark-700 hover:bg-dark-600 rounded text-xs"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setNewSlotDay(day.id)}
                  className="w-full p-2 border-2 border-dashed border-dark-700 hover:border-primary-500/50 rounded-lg text-dark-500 hover:text-primary-400 transition-colors"
                >
                  <Plus className="w-4 h-4 mx-auto" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="p-3 bg-dark-800/50 rounded-lg border border-dark-700">
        <div className="text-sm text-dark-400">
          <span className="font-medium text-white">{slots.length}</span> Slots definiert
          {' • '}
          <span className="font-medium text-primary-400">{slots.filter(s => s.enabled).length}</span> aktiv
          {' • '}
          <span className="font-medium text-dark-500">{slots.filter(s => !s.enabled).length}</span> deaktiviert
        </div>
      </div>
    </div>
  );
}
