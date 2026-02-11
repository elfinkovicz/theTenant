import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, GripVertical } from 'lucide-react';
import { toast } from '../utils/toast-alert';

interface VideoCategoryModalProps {
  isOpen: boolean;
  categories: string[];
  onClose: () => void;
  onSave: (categories: string[]) => Promise<void>;
}

export function VideoCategoryModal({ isOpen, categories, onClose, onSave }: VideoCategoryModalProps) {
  const [editableCategories, setEditableCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Filter out 'Alle' as it's always added automatically
      setEditableCategories(categories.filter(c => c !== 'Alle'));
      setNewCategory('');
      setError('');
    }
  }, [isOpen, categories]);

  if (!isOpen) return null;

  const handleAddCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) {
      setError('Bitte gib einen Namen ein');
      return;
    }
    if (editableCategories.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      setError('Diese Kategorie existiert bereits');
      return;
    }
    setEditableCategories([...editableCategories, trimmed]);
    setNewCategory('');
    setError('');
  };

  const handleRemoveCategory = (index: number) => {
    setEditableCategories(editableCategories.filter((_, i) => i !== index));
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newCategories = [...editableCategories];
    const [dragged] = newCategories.splice(draggedIndex, 1);
    newCategories.splice(index, 0, dragged);
    setEditableCategories(newCategories);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSave = async () => {
    if (editableCategories.length === 0) {
      setError('Mindestens eine Kategorie erforderlich');
      return;
    }
    
    setSaving(true);
    setError('');
    
    try {
      await onSave(editableCategories);
      toast.success('Kategorien erfolgreich gespeichert');
      onClose();
    } catch (err: any) {
      const errorMsg = err.message || 'Speichern fehlgeschlagen';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCategory();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 rounded-lg max-w-md w-full border border-dark-800">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-800">
          <h2 className="text-xl font-bold">Kategorien verwalten</h2>
          <button
            onClick={onClose}
            disabled={saving}
            className="text-dark-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Add new category */}
          <div>
            <label className="block text-sm font-medium mb-2">Neue Kategorie</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="z.B. Interviews"
                className="input flex-1"
                maxLength={30}
                disabled={saving}
              />
              <button
                type="button"
                onClick={handleAddCategory}
                disabled={saving || !newCategory.trim()}
                className="btn-primary px-4 disabled:opacity-50"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Category list */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Kategorien ({editableCategories.length})
            </label>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {editableCategories.length === 0 ? (
                <p className="text-dark-400 text-sm py-4 text-center">
                  Keine Kategorien vorhanden
                </p>
              ) : (
                editableCategories.map((cat, index) => (
                  <div
                    key={`${cat}-${index}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-2 p-3 bg-dark-800 rounded-lg border border-dark-700 cursor-grab active:cursor-grabbing ${
                      draggedIndex === index ? 'opacity-50' : ''
                    }`}
                  >
                    <GripVertical className="w-4 h-4 text-dark-500 flex-shrink-0" />
                    <span className="flex-1" style={{ color: 'rgb(var(--color-text))' }}>{cat}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCategory(index)}
                      disabled={saving}
                      className="text-dark-400 hover:text-red-500 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
            <p className="text-xs text-dark-400 mt-2">
              "Alle" wird automatisch als Filter hinzugefügt
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500 rounded-lg p-3 text-red-500 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="btn-secondary flex-1 disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex-1 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
