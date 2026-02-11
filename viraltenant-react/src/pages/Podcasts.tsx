import { useState, useEffect } from 'react';
import { Upload, Search, Filter, Save, Settings } from 'lucide-react';
import { Podcast, podcastService } from '../services/podcast.service';
import { prefetchService } from '../services/prefetch.service';
import { useAdmin } from '../hooks/useAdmin';
import { usePagination } from '../hooks/usePagination';
import { usePageTitle } from '../hooks/usePageTitle';
import { PodcastCard } from '../components/PodcastCard';
import { PodcastUploadModal } from '../components/PodcastUploadModal';
import { PodcastEditModal } from '../components/PodcastEditModal';
import { PodcastCategoryModal } from '../components/PodcastCategoryModal';
import { LoadMoreButton } from '../components/LoadMoreButton';
import { PageBanner } from '../components/PageBanner';
import { toast } from '../utils/toast-alert';

export function Podcasts() {
  const { isAdmin } = useAdmin();
  const { title: pageTitle, subtitle: pageSubtitle } = usePageTitle('/podcasts');
  
  // Initialize with cached data if available (prevents flash)
  const cachedData = prefetchService.getCachedSync('podcasts');
  const initialPodcasts = cachedData?.podcasts || [];
  const initialCategories = cachedData?.categories?.length > 0 
    ? ['Alle', ...cachedData.categories] 
    : ['Alle', 'Interviews', 'Talks', 'News', 'Tutorials', 'Sonstiges'];
  
  const [podcasts, setPodcasts] = useState<Podcast[]>(initialPodcasts);
  const [filteredPodcasts, setFilteredPodcasts] = useState<Podcast[]>(initialPodcasts);
  const [loading, setLoading] = useState(!cachedData); // Only show loading if no cache
  const [error, setError] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Alle');
  
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedPodcast, setSelectedPodcast] = useState<Podcast | null>(null);
  
  // Drag & Drop State
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [hasOrderChanged, setHasOrderChanged] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  
  // Categories State
  const [categories, setCategories] = useState<string[]>(initialCategories);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [podcastSettings, setPodcastSettings] = useState<object>(cachedData?.settings || {});

  // Pagination - 6 items initial (podcasts are larger cards), load 6 more each time
  const { displayedItems: paginatedPodcasts, hasMore, remainingCount, loadMore, reset } = usePagination(filteredPodcasts, { initialLimit: 6, increment: 6 });

  useEffect(() => {
    loadPodcasts();
  }, []);

  useEffect(() => {
    filterPodcasts();
  }, [podcasts, searchQuery, selectedCategory]);

  // Reset pagination when filters change (but not on initial mount)
  const [isInitialMount, setIsInitialMount] = useState(true);
  useEffect(() => {
    if (isInitialMount) {
      setIsInitialMount(false);
      return;
    }
    reset();
  }, [searchQuery, selectedCategory]);

  const loadPodcasts = async () => {
    try {
      // Use prefetch cache if available
      const data = await prefetchService.getPodcasts();
      
      const podcastsArray = data?.podcasts || [];
      setPodcasts(Array.isArray(podcastsArray) ? podcastsArray : []);
      
      const backendCategories = data?.categories || [];
      if (backendCategories.length > 0) {
        setCategories(['Alle', ...backendCategories]);
      } else {
        setCategories(['Alle', 'Interviews', 'Talks', 'News', 'Tutorials', 'Sonstiges']);
      }
      
      setPodcastSettings(data?.settings || {});
      setError('');
    } catch (err: any) {
      console.error('Error loading podcasts:', err);
      setError('Podcasts konnten nicht geladen werden');
      setPodcasts([]);
    } finally {
      setLoading(false);
    }
  };

  const filterPodcasts = () => {
    if (!podcasts || !Array.isArray(podcasts)) {
      setFilteredPodcasts([]);
      return;
    }
    
    let filtered = [...podcasts];

    if (selectedCategory !== 'Alle') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.title.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
      );
    }

    setFilteredPodcasts(filtered);
  };

  const handleEdit = (podcast: Podcast) => {
    setSelectedPodcast(podcast);
    setEditModalOpen(true);
  };

  const handleDelete = async (podcast: Podcast) => {
    if (!confirm(`Podcast "${podcast.title}" wirklich löschen?`)) {
      return;
    }

    try {
      await podcastService.deletePodcast(podcast.podcastId);
      toast.success('Podcast erfolgreich gelöscht');
      prefetchService.invalidate('podcasts');
      await loadPodcasts();
    } catch (err: any) {
      console.error('Error deleting podcast:', err);
      toast.error('Löschen fehlgeschlagen: ' + (err.response?.data?.error || err.message));
    }
  };

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    setTimeout(() => {
      const target = e.target as HTMLElement;
      target.style.opacity = '0.5';
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.target as HTMLElement;
    target.style.opacity = '1';
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDragOverIndex(null);
      return;
    }

    const newPodcasts = [...podcasts];
    const [draggedPodcast] = newPodcasts.splice(draggedIndex, 1);
    newPodcasts.splice(dropIndex, 0, draggedPodcast);
    
    setPodcasts(newPodcasts);
    setHasOrderChanged(true);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleSaveOrder = async () => {
    try {
      setSavingOrder(true);
      await podcastService.updatePodcasts(podcasts, categories.filter(c => c !== 'Alle'), podcastSettings);
      toast.success('Reihenfolge erfolgreich gespeichert!');
      setHasOrderChanged(false);
    } catch (err: any) {
      console.error('Error saving podcast order:', err);
      toast.error('Fehler beim Speichern der Reihenfolge');
    } finally {
      setSavingOrder(false);
    }
  };

  const handleSaveCategories = async (newCategories: string[]) => {
    await podcastService.updatePodcasts(podcasts, newCategories, podcastSettings);
    toast.success('Kategorien erfolgreich gespeichert!');
    setCategories(['Alle', ...newCategories]);
  };

  const isDragEnabled = isAdmin && selectedCategory === 'Alle' && !searchQuery.trim();

  return (
    <div className="min-h-screen">
      <PageBanner pageId="podcasts">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold mb-2" style={{ color: 'rgb(var(--color-text))' }}>
            <span className="glow-text">{pageTitle}</span>
          </h1>
          <p className="text-lg" style={{ color: 'rgb(var(--color-text-secondary))' }}>
            {pageSubtitle}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setUploadModalOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Upload className="w-5 h-5" />
            Podcast hochladen
          </button>
        )}
      </PageBanner>

      <div className="container mx-auto px-4 py-8">
        {/* Filters */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Podcasts durchsuchen..."
                className="input w-full pl-10"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto">
              <Filter className="w-5 h-5 text-dark-400 flex-shrink-0" />
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                    selectedCategory === category
                      ? 'bg-primary-600 text-white'
                      : 'bg-dark-800 text-dark-400 hover:text-white hover:bg-dark-700'
                  }`}
                >
                  {category}
                </button>
              ))}
              {isAdmin && (
                <button
                  onClick={() => setCategoryModalOpen(true)}
                  className="p-2 rounded-lg bg-dark-800 text-dark-400 hover:text-white hover:bg-dark-700 transition-all"
                  title="Kategorien verwalten"
                >
                  <Settings className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="card bg-red-500/10 border-red-500 text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <button onClick={loadPodcasts} className="btn-primary">
              Erneut versuchen
            </button>
          </div>
        ) : filteredPodcasts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-dark-400 text-lg mb-4">
              {searchQuery || selectedCategory !== 'Alle'
                ? 'Keine Podcasts gefunden'
                : 'Noch keine Podcasts vorhanden'}
            </p>
            {isAdmin && !searchQuery && selectedCategory === 'Alle' && (
              <button onClick={() => setUploadModalOpen(true)} className="btn-primary">
                Ersten Podcast hochladen
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-dark-400">
                {filteredPodcasts.length} {filteredPodcasts.length === 1 ? 'Podcast' : 'Podcasts'}
              </span>
              {isAdmin && hasOrderChanged && (
                <button
                  onClick={handleSaveOrder}
                  disabled={savingOrder}
                  className="btn-primary flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {savingOrder ? 'Speichern...' : 'Reihenfolge speichern'}
                </button>
              )}
            </div>
            
            <div className="space-y-6">
              {paginatedPodcasts.map((podcast, index) => (
                <div
                  key={podcast.podcastId}
                  draggable={isDragEnabled}
                  onDragStart={(e) => isDragEnabled && handleDragStart(e, index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => isDragEnabled && handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => isDragEnabled && handleDrop(e, index)}
                  className={`relative transition-all duration-200 ${
                    isDragEnabled ? 'cursor-grab active:cursor-grabbing' : ''
                  } ${
                    dragOverIndex === index 
                      ? 'ring-2 ring-primary-500 ring-offset-2 ring-offset-dark-900 scale-[1.01]' 
                      : ''
                  } ${
                    draggedIndex === index ? 'opacity-50' : ''
                  }`}
                >
                  <PodcastCard
                    podcast={podcast}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                </div>
              ))}
            </div>
            
            {hasMore && (
              <LoadMoreButton onClick={loadMore} remainingCount={remainingCount} label="Mehr Podcasts laden" />
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <PodcastUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={loadPodcasts}
        categories={categories}
      />

      <PodcastEditModal
        isOpen={editModalOpen}
        podcast={selectedPodcast}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedPodcast(null);
        }}
        onSuccess={loadPodcasts}
        categories={categories}
      />

      <PodcastCategoryModal
        isOpen={categoryModalOpen}
        categories={categories}
        onClose={() => setCategoryModalOpen(false)}
        onSave={handleSaveCategories}
      />
    </div>
  );
}
