import { useState, useEffect } from 'react';
import { Upload, Search, Filter, Save, Settings } from 'lucide-react';
import { Video, videoService } from '../services/video.service';
import { prefetchService } from '../services/prefetch.service';
import { useAdmin } from '../hooks/useAdmin';
import { usePagination } from '../hooks/usePagination';
import { usePageTitle } from '../hooks/usePageTitle';
import { VideoCard } from '../components/VideoCard';
import { VideoUploadModal } from '../components/VideoUploadModal';
import { VideoEditModal } from '../components/VideoEditModal';
import { VideoPlayerModal } from '../components/VideoPlayerModal';
import { VideoCategoryModal } from '../components/VideoCategoryModal';
import { LoadMoreButton } from '../components/LoadMoreButton';
import { PageBanner } from '../components/PageBanner';
import { toast } from '../utils/toast-alert';

export function Videos() {
  const { isAdmin } = useAdmin();
  const { title: pageTitle, subtitle: pageSubtitle } = usePageTitle('/videos');
  
  // Initialize with cached data if available (prevents flash)
  const cachedData = prefetchService.getCachedSync('videos');
  const initialVideos = cachedData?.videos || [];
  const initialCategories = cachedData?.categories?.length > 0 
    ? ['Alle', ...cachedData.categories] 
    : ['Alle', 'Gaming', 'Tutorials', 'Vlogs', 'Reviews', 'Highlights', 'Sonstiges'];
  
  const [videos, setVideos] = useState<Video[]>(initialVideos);
  const [filteredVideos, setFilteredVideos] = useState<Video[]>(initialVideos);
  const [loading, setLoading] = useState(!cachedData); // Only show loading if no cache
  const [error, setError] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Alle');
  
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [playerModalOpen, setPlayerModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  
  // Drag & Drop State
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [hasOrderChanged, setHasOrderChanged] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  
  // Categories State
  const [categories, setCategories] = useState<string[]>(initialCategories);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [videoSettings, setVideoSettings] = useState<object>(cachedData?.settings || {});

  // Pagination - 12 items initial (3 rows of 4), load 12 more each time
  const { displayedItems: paginatedVideos, hasMore, remainingCount, loadMore, reset } = usePagination(filteredVideos, { initialLimit: 12, increment: 12 });

  useEffect(() => {
    loadVideos();
  }, []);

  useEffect(() => {
    filterVideos();
  }, [videos, searchQuery, selectedCategory]);

  // Reset pagination when filters change (but not on initial mount)
  const [isInitialMount, setIsInitialMount] = useState(true);
  useEffect(() => {
    if (isInitialMount) {
      setIsInitialMount(false);
      return;
    }
    reset();
  }, [searchQuery, selectedCategory]);

  const loadVideos = async () => {
    try {
      // Use prefetch cache if available
      const data = await prefetchService.getVideos();
      console.log('Loaded videos data:', data);
      
      // Backend returns { videos: [], categories: [], settings: {} }
      const videosArray = data?.videos || [];
      setVideos(Array.isArray(videosArray) ? videosArray : []);
      
      // Load categories from backend (add 'Alle' as first option)
      const backendCategories = data?.categories || [];
      if (backendCategories.length > 0) {
        setCategories(['Alle', ...backendCategories]);
      } else {
        // Default categories if none defined
        setCategories(['Alle', 'Gaming', 'Tutorials', 'Vlogs', 'Reviews', 'Highlights', 'Sonstiges']);
      }
      
      // Store settings for later updates
      setVideoSettings(data?.settings || {});
      
      setError('');
    } catch (err: any) {
      console.error('Error loading videos:', err);
      setError('Videos konnten nicht geladen werden');
      setVideos([]); // Ensure videos is always an array
    } finally {
      setLoading(false);
    }
  };

  const filterVideos = () => {
    if (!videos || !Array.isArray(videos)) {
      setFilteredVideos([]);
      return;
    }
    
    let filtered = [...videos];

    // Filter by category
    if (selectedCategory !== 'Alle') {
      filtered = filtered.filter(v => v.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(v =>
        v.title.toLowerCase().includes(query) ||
        v.description?.toLowerCase().includes(query)
      );
    }

    // Keep original order (no sorting) to preserve drag & drop order
    setFilteredVideos(filtered);
  };

  const handleEdit = (video: Video) => {
    setSelectedVideo(video);
    setEditModalOpen(true);
  };

  const handleDelete = async (video: Video) => {
    if (!confirm(`Video "${video.title}" wirklich löschen?`)) {
      return;
    }

    try {
      await videoService.deleteVideo(video.videoId);
      toast.success('Video erfolgreich gelöscht');
      prefetchService.invalidate('videos');
      await loadVideos();
    } catch (err: any) {
      console.error('Error deleting video:', err);
      toast.error('Löschen fehlgeschlagen: ' + (err.response?.data?.error || err.message));
    }
  };

  const handlePlay = (video: Video) => {
    setSelectedVideo(video);
    setPlayerModalOpen(true);
  };

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    // Add a slight delay to show the dragging state
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

    // Reorder videos
    const newVideos = [...videos];
    const [draggedVideo] = newVideos.splice(draggedIndex, 1);
    newVideos.splice(dropIndex, 0, draggedVideo);
    
    setVideos(newVideos);
    setHasOrderChanged(true);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleSaveOrder = async () => {
    try {
      setSavingOrder(true);
      await videoService.updateVideos(videos, categories.filter(c => c !== 'Alle'), videoSettings);
      toast.success('Reihenfolge erfolgreich gespeichert!');
      setHasOrderChanged(false);
    } catch (err: any) {
      console.error('Error saving video order:', err);
      toast.error('Fehler beim Speichern der Reihenfolge');
    } finally {
      setSavingOrder(false);
    }
  };

  const handleSaveCategories = async (newCategories: string[]) => {
    await videoService.updateVideos(videos, newCategories, videoSettings);
    toast.success('Kategorien erfolgreich gespeichert!');
    setCategories(['Alle', ...newCategories]);
  };

  // Check if drag & drop should be enabled (admin + no filters active)
  const isDragEnabled = isAdmin && selectedCategory === 'Alle' && !searchQuery.trim();

  return (
    <div className="min-h-screen">
      {/* Page Banner mit Titel */}
      <PageBanner pageId="videos">
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
            Video hochladen
          </button>
        )}
      </PageBanner>

      <div className="container mx-auto px-4 py-8">
        {/* Filters */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Videos durchsuchen..."
                className="input w-full pl-10"
              />
            </div>

            {/* Category Filter */}
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
            <button
              onClick={loadVideos}
              className="btn-primary"
            >
              Erneut versuchen
            </button>
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-dark-400 text-lg mb-4">
              {searchQuery || selectedCategory !== 'Alle'
                ? 'Keine Videos gefunden'
                : 'Noch keine Videos vorhanden'}
            </p>
            {isAdmin && !searchQuery && selectedCategory === 'Alle' && (
              <button
                onClick={() => setUploadModalOpen(true)}
                className="btn-primary"
              >
                Erstes Video hochladen
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-dark-400">
                {filteredVideos.length} {filteredVideos.length === 1 ? 'Video' : 'Videos'}
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {paginatedVideos.map((video, index) => (
                <div
                  key={video.videoId}
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
                      ? 'ring-2 ring-primary-500 ring-offset-2 ring-offset-dark-900 scale-[1.02]' 
                      : ''
                  } ${
                    draggedIndex === index ? 'opacity-50' : ''
                  }`}
                >
                  <VideoCard
                    video={video}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onClick={handlePlay}
                  />
                </div>
              ))}
            </div>
            
            {hasMore && (
              <LoadMoreButton onClick={loadMore} remainingCount={remainingCount} label="Mehr Videos laden" />
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <VideoUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={loadVideos}
      />

      <VideoEditModal
        isOpen={editModalOpen}
        video={selectedVideo}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedVideo(null);
        }}
        onSuccess={loadVideos}
      />

      <VideoPlayerModal
        isOpen={playerModalOpen}
        video={selectedVideo}
        onClose={() => {
          setPlayerModalOpen(false);
          setSelectedVideo(null);
        }}
      />

      <VideoCategoryModal
        isOpen={categoryModalOpen}
        categories={categories}
        onClose={() => setCategoryModalOpen(false)}
        onSave={handleSaveCategories}
      />
    </div>
  );
}
