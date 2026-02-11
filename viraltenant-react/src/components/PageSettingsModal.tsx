import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Plus, Trash2, Eye, EyeOff, GripVertical, FileText, RotateCcw } from 'lucide-react';
import { heroService } from '../services/hero.service';
import { customPageService } from '../services/customPage.service';
import { useAuthStore } from '../store/authStore';
import { toast } from '../utils/toast-alert';

interface PageConfig {
  path: string;
  label: string;
  defaultSubtitle: string;
  customLabel?: string;
  customSubtitle?: string;
  enabled: boolean;
  isCustom?: boolean;
  customPageId?: string;
}

interface PageSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentSettings: {
    disabledPages: string[];
    pageLabels?: Record<string, string>;
    pageSubtitles?: Record<string, string>;
  };
}

const MAX_CUSTOM_PAGES = 3;

const DEFAULT_PAGES: PageConfig[] = [
  { path: '/', label: 'Home', defaultSubtitle: 'Willkommen', enabled: true },
  { path: '/live', label: 'Live', defaultSubtitle: 'Erlebe spannende Live-Inhalte und sei Teil der Community', enabled: true },
  { path: '/videos', label: 'Videos', defaultSubtitle: 'Entdecke unsere Video-Sammlung', enabled: true },
  { path: '/podcasts', label: 'Podcasts', defaultSubtitle: 'Höre unsere neuesten Episoden', enabled: true },
  { path: '/shop', label: 'Shop', defaultSubtitle: 'Exklusive Produkte für echte Unterstützer', enabled: true },
  { path: '/events', label: 'Events', defaultSubtitle: 'Kommende Veranstaltungen und Termine', enabled: true },
  { path: '/newsfeed', label: 'Newsfeed', defaultSubtitle: 'Bleib auf dem Laufenden', enabled: true },
  { path: '/channels', label: 'Channels', defaultSubtitle: 'Folge uns auf allen Plattformen', enabled: true },
  { path: '/team', label: 'Team', defaultSubtitle: 'Lerne unser Team kennen', enabled: true },
  { path: '/contact', label: 'Kontakt', defaultSubtitle: 'Wir freuen uns auf deine Nachricht', enabled: true },
];

export function PageSettingsModal({ isOpen, onClose, onSuccess, currentSettings }: PageSettingsModalProps) {
  const { accessToken } = useAuthStore();
  const [pages, setPages] = useState<PageConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [showNewPageForm, setShowNewPageForm] = useState(false);
  const [creatingPage, setCreatingPage] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Generate slug from title
  const generateSlug = (title: string): string => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with dash
      .replace(/^-+|-+$/g, '') // Remove leading/trailing dashes
      .substring(0, 50); // Limit length
  };

  // Count custom pages
  const customPageCount = pages.filter(p => p.isCustom).length;
  const canAddCustomPage = customPageCount < MAX_CUSTOM_PAGES;

  useEffect(() => {
    if (isOpen) {
      loadPages();
    }
  }, [isOpen, currentSettings]);

  const loadPages = async () => {
    setLoading(true);
    try {
      // Clear the cache to ensure we get fresh data from the server
      localStorage.removeItem('heroContent');
      
      // Fetch fresh hero content to get the latest navSettings
      // This ensures we don't rely on potentially stale props
      let settings = currentSettings;
      try {
        const freshContent = await heroService.getHeroContent();
        console.log('PageSettingsModal: Fetched fresh hero content:', freshContent.navSettings);
        if (freshContent.navSettings) {
          settings = {
            disabledPages: freshContent.navSettings.disabledPages || [],
            pageLabels: freshContent.navSettings.pageLabels || {},
            pageSubtitles: freshContent.navSettings.pageSubtitles || {},
          };
        }
      } catch (fetchError) {
        console.warn('PageSettingsModal: Could not fetch fresh content, using props:', fetchError);
      }
      
      console.log('PageSettingsModal: Using settings:', settings);
      
      // Build pages list from defaults first
      const pagesList: PageConfig[] = DEFAULT_PAGES.map(p => ({
        ...p,
        customLabel: settings.pageLabels?.[p.path] || '',
        customSubtitle: settings.pageSubtitles?.[p.path] || '',
        enabled: !settings.disabledPages.includes(p.path)
      }));

      console.log('PageSettingsModal: Built pagesList:', pagesList.map(p => ({ path: p.path, enabled: p.enabled })));

      // Try to load custom pages (may fail if backend not deployed yet)
      try {
        const customPagesData = await customPageService.getCustomPages();
        // Add custom pages
        customPagesData.forEach(cp => {
          pagesList.push({
            path: `/page/${cp.slug}`,
            label: cp.title,
            defaultSubtitle: '',
            customLabel: settings.pageLabels?.[`/page/${cp.slug}`] || '',
            customSubtitle: settings.pageSubtitles?.[`/page/${cp.slug}`] || '',
            enabled: !settings.disabledPages.includes(`/page/${cp.slug}`),
            isCustom: true,
            customPageId: cp.pageId
          });
        });
      } catch (customPagesError) {
        console.warn('Custom pages not available yet:', customPagesError);
        // Continue without custom pages - standard pages still work
      }

      setPages(pagesList);
    } catch (error) {
      console.error('Failed to load pages:', error);
      // Still show default pages even on error
      const pagesList: PageConfig[] = DEFAULT_PAGES.map(p => ({
        ...p,
        customLabel: currentSettings.pageLabels?.[p.path] || '',
        customSubtitle: currentSettings.pageSubtitles?.[p.path] || '',
        enabled: !currentSettings.disabledPages.includes(p.path)
      }));
      setPages(pagesList);
    } finally {
      setLoading(false);
    }
  };

  const togglePage = (path: string) => {
    setPages(prev => prev.map(p => 
      p.path === path ? { ...p, enabled: !p.enabled } : p
    ));
  };

  const updateLabel = (path: string, label: string) => {
    setPages(prev => prev.map(p => 
      p.path === path ? { ...p, customLabel: label } : p
    ));
  };

  const updateSubtitle = (path: string, subtitle: string) => {
    setPages(prev => prev.map(p => 
      p.path === path ? { ...p, customSubtitle: subtitle } : p
    ));
  };

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDragOverIndex(null);
      setDraggedIndex(null);
      return;
    }

    const newPages = [...pages];
    const [draggedPage] = newPages.splice(draggedIndex, 1);
    newPages.splice(dropIndex, 0, draggedPage);
    
    setPages(newPages);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleReset = () => {
    if (!confirm('Alle Titel, Untertitel und die Reihenfolge auf Standard zurücksetzen?')) return;
    
    // Get current custom pages
    const customPages = pages.filter(p => p.isCustom);
    
    // Reset standard pages to default order and clear custom labels/subtitles
    const resetPages: PageConfig[] = DEFAULT_PAGES.map(p => ({
      ...p,
      customLabel: '',
      customSubtitle: '',
      enabled: !currentSettings.disabledPages.includes(p.path) // Keep enabled state
    }));
    
    // Append custom pages at the end
    customPages.forEach(cp => {
      resetPages.push({
        ...cp,
        customLabel: '',
        customSubtitle: ''
      });
    });
    
    setPages(resetPages);
  };

  const handleSave = async () => {
    if (!accessToken) return;
    setSaving(true);
    try {
      const disabledPages = pages.filter(p => !p.enabled).map(p => p.path);
      const pageLabels: Record<string, string> = {};
      const pageSubtitles: Record<string, string> = {};
      
      pages.forEach(p => {
        if (p.customLabel && p.customLabel.trim()) {
          pageLabels[p.path] = p.customLabel.trim();
        }
        if (p.customSubtitle && p.customSubtitle.trim()) {
          pageSubtitles[p.path] = p.customSubtitle.trim();
        }
      });
      
      // Save page order
      const pageOrder = pages.map(p => p.path);

      console.log('PageSettingsModal: Saving navSettings:', {
        disabledPages,
        pageLabels,
        pageSubtitles,
        pageOrder
      });

      await heroService.updateHeroContent({
        navSettings: { disabledPages, pageLabels, pageSubtitles, pageOrder }
      }, accessToken);

      console.log('PageSettingsModal: Save successful');
      toast.success('Einstellungen erfolgreich gespeichert!');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to save:', error);
      toast.error('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const createCustomPage = async () => {
    if (!newPageTitle.trim()) {
      toast.error('Bitte gib einen Titel ein');
      return;
    }

    const slug = generateSlug(newPageTitle);
    if (!slug) {
      toast.error('Ungültiger Titel');
      return;
    }

    setCreatingPage(true);
    try {
      const newPage = await customPageService.createCustomPage({
        title: newPageTitle.trim(),
        slug: slug,
        blocks: [],
        isPublished: true
      });

      // Add to pages list
      setPages(prev => [...prev, {
        path: `/page/${newPage.slug}`,
        label: newPage.title,
        defaultSubtitle: '',
        customLabel: '',
        customSubtitle: '',
        enabled: true,
        isCustom: true,
        customPageId: newPage.pageId
      }]);

      toast.success('Seite erfolgreich erstellt!');
      setNewPageTitle('');
      setShowNewPageForm(false);
    } catch (error: any) {
      console.error('Failed to create page:', error);
      toast.error(error.response?.data?.error || 'Fehler beim Erstellen');
    } finally {
      setCreatingPage(false);
    }
  };

  const deleteCustomPage = async (pageId: string) => {
    if (!confirm('Diese Seite wirklich löschen? Alle Inhalte gehen verloren.')) return;

    try {
      await customPageService.deleteCustomPage(pageId);
      setPages(prev => prev.filter(p => p.customPageId !== pageId));
      toast.success('Seite erfolgreich gelöscht!');
    } catch (error) {
      console.error('Failed to delete page:', error);
      toast.error('Fehler beim Löschen');
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/80 z-[9999] overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-dark-900 rounded-xl border border-dark-700 w-full max-w-2xl max-h-[85vh] flex flex-col my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-700">
          <h2 className="text-2xl font-bold">Seiten verwalten</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="p-2 text-dark-400 hover:text-yellow-500 hover:bg-dark-800 rounded-lg transition-colors"
              title="Auf Standard zurücksetzen"
            >
              <RotateCcw size={20} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
            </div>
          ) : (
            <div className="space-y-2">
              {pages.map((page, index) => (
                <div
                  key={page.path}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={() => setDragOverIndex(null)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex flex-col gap-2 p-3 rounded-lg border transition-all cursor-move ${
                    dragOverIndex === index 
                      ? 'border-primary-500 bg-primary-500/10' 
                      : draggedIndex === index
                        ? 'opacity-50 border-dark-600 bg-dark-800/50'
                        : page.enabled 
                          ? 'border-dark-700 bg-dark-800/50 hover:bg-dark-800' 
                          : 'border-dark-800 bg-dark-900/50 opacity-50'
                  }`}
                >
                  {/* Top Row: Drag Handle, Toggle, Label */}
                  <div className="flex items-center gap-3">
                    {/* Drag Handle */}
                    <div className="text-dark-500 hover:text-dark-300">
                      <GripVertical size={16} />
                    </div>

                    {/* Toggle */}
                    <button
                      onClick={() => togglePage(page.path)}
                      className={`p-1.5 rounded transition-colors ${
                        page.enabled ? 'bg-green-600/80 text-white' : 'bg-dark-700 text-dark-400'
                      }`}
                    >
                      {page.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>

                    {/* Page Info */}
                    <div className="flex-1 flex items-center gap-3">
                      <div className="flex items-center gap-2 min-w-[100px]">
                        {page.isCustom && (
                          <span className="px-1.5 py-0.5 bg-primary-600/20 text-primary-400 text-xs rounded">
                            Custom
                          </span>
                        )}
                        <span className="text-xs text-dark-400">{page.label}</span>
                      </div>
                      <input
                        type="text"
                        value={page.customLabel || ''}
                        onChange={(e) => updateLabel(page.path, e.target.value)}
                        placeholder={page.label}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="flex-1 bg-dark-900 border border-dark-600 rounded px-2 py-1 text-sm focus:border-primary-500 outline-none"
                      />
                    </div>

                    {/* Delete (only for custom pages) */}
                    {page.isCustom && page.customPageId && (
                      <button
                        onClick={() => deleteCustomPage(page.customPageId!)}
                        className="p-1.5 text-dark-400 hover:text-red-500 hover:bg-dark-700 rounded transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {/* Bottom Row: Subtitle Input */}
                  <div className="flex items-center gap-3 pl-[72px]">
                    <input
                      type="text"
                      value={page.customSubtitle || ''}
                      onChange={(e) => updateSubtitle(page.path, e.target.value)}
                      placeholder={page.defaultSubtitle || 'Untertitel eingeben...'}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="flex-1 bg-dark-900 border border-dark-600 rounded px-2 py-1 text-sm text-dark-400 focus:border-primary-500 focus:text-white outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Custom Page */}
          <div className="mt-6 pt-6 border-t border-dark-700">
            {showNewPageForm ? (
              <div className="bg-dark-800 rounded-lg p-4 space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <FileText size={18} />
                  Neue Custom-Seite erstellen
                </h3>
                <div>
                  <label className="block text-sm text-dark-400 mb-1">Seitentitel</label>
                  <input
                    type="text"
                    value={newPageTitle}
                    onChange={(e) => setNewPageTitle(e.target.value)}
                    placeholder="z.B. Über uns, FAQ, Partner"
                    className="w-full bg-dark-900 border border-dark-600 rounded px-3 py-2 focus:border-primary-500 outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && createCustomPage()}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={createCustomPage}
                    disabled={creatingPage}
                    className="btn-primary flex-1 py-2"
                  >
                    {creatingPage ? 'Erstellen...' : 'Erstellen'}
                  </button>
                  <button
                    onClick={() => { setShowNewPageForm(false); setNewPageTitle(''); }}
                    className="btn-secondary flex-1 py-2"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <button
                  onClick={() => setShowNewPageForm(true)}
                  disabled={!canAddCustomPage}
                  className={`w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg transition-colors ${
                    canAddCustomPage 
                      ? 'border-dark-600 hover:border-primary-500 text-dark-400 hover:text-white cursor-pointer' 
                      : 'border-dark-700 text-dark-600 cursor-not-allowed'
                  }`}
                >
                  <Plus size={20} />
                  Custom-Seite hinzufügen
                </button>
                <p className="text-xs text-dark-500 text-center mt-2">
                  {customPageCount} von {MAX_CUSTOM_PAGES} Custom-Seiten verwendet
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-dark-700">
          <button onClick={onClose} className="btn-secondary flex-1" disabled={saving}>
            Abbrechen
          </button>
          <button onClick={handleSave} className="btn-primary flex-1 flex items-center justify-center gap-2" disabled={saving}>
            <Save size={18} />
            {saving ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
