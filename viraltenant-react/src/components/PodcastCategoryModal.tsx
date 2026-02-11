import { useState, useEffect } from 'react';
import { X, Plus, Trash2, GripVertical } from 'lucide-react';
import { toast } from '../utils/toast-alert';

interface PodcastCategoryModalProps {
  isOpen: boolean;
  categories: string[];
  onClose: () => void;
  onSave: (categories: string[]) => Promise<void>;
}

export function PodcastCategoryModal({ isOpen, categories, onClose, onSave }: PodcastCategoryModalProps) {
  const [editableCategories, setEditableCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Filter out 'Alle' as it's always added automatically
    setEditableCategories(categories.filter(c => c !== 'Alle'));
  }, [categories]);

  const handleAddCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    
    if (editableCategories.includes(trimmed)) {
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

  const handleSave = async () => {
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="card w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Kategorien verwalten</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-dark-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Add new category */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
              className="input flex-1"
              placeholder="Neue Kategorie..."
            />
            <button
              onClick={handleAddCategory}
              className="btn-primary px-4"
              disabled={!newCategory.trim()}
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Category list */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {editableCategories.length === 0 ? (
              <p className="text-center text-dark-400 py-4">
                Keine Kategorien vorhanden
              </p>
            ) : (
              editableCategories.map((cat, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-3 rounded-lg bg-dark-800"
                >
                  <GripVertical className="w-4 h-4 text-dark-500" />
                  <span className="flex-1" style={{ color: 'rgb(var(--color-text))' }}>{cat}</span>
                  <button
                    onClick={() => handleRemoveCategory(index)}
                    className="p-1.5 rounded hover:bg-red-600/20 text-dark-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={saving}
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              className="btn-primary flex-1"
              disabled={saving}
            >
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
