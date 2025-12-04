import { useState, useEffect } from 'react';
import { Upload, Search, Filter } from 'lucide-react';
import { Video, videoService } from '../services/video.service';
import { useAdmin } from '../hooks/useAdmin';
import { VideoCard } from '../components/VideoCard';
import { VideoUploadModal } from '../components/VideoUploadModal';
import { VideoEditModal } from '../components/VideoEditModal';
import { VideoPlayerModal } from '../components/VideoPlayerModal';

export function Videos() {
  const { isAdmin } = useAdmin();
  const [videos, setVideos] = useState<Video[]>([]);
  const [filteredVideos, setFilteredVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Alle');
  
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [playerModalOpen, setPlayerModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  const categories = ['Alle', 'Gaming', 'Tutorials', 'Vlogs', 'Reviews', 'Highlights', 'Sonstiges'];

  useEffect(() => {
    loadVideos();
  }, []);

  useEffect(() => {
    filterVideos();
  }, [videos, searchQuery, selectedCategory]);

  const loadVideos = async () => {
    try {
      setLoading(true);
      const data = await videoService.getVideos();
      setVideos(data);
      setError('');
    } catch (err: any) {
      console.error('Error loading videos:', err);
      setError('Videos konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  };

  const filterVideos = () => {
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
      await loadVideos();
    } catch (err: any) {
      console.error('Error deleting video:', err);
      alert('Löschen fehlgeschlagen: ' + (err.response?.data?.error || err.message));
    }
  };

  const handlePlay = (video: Video) => {
    setSelectedVideo(video);
    setPlayerModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Background - durchgehend */}
      <div className="fixed inset-0 bg-gradient-to-br from-primary-900/20 via-dark-950 to-dark-950 -z-10" />
      
      {/* Header */}
      <section className="relative py-20 overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">
                <span className="glow-text">Videos</span>
              </h1>
              <p className="text-dark-400 text-lg">
                Alle Videos und Highlights
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
          </div>
        </div>
      </section>

      {/* Filters - transparent background */}
      <div className="relative">
        <div className="container mx-auto px-4 py-4">
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
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
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
            <div className="mb-4 text-dark-400">
              {filteredVideos.length} {filteredVideos.length === 1 ? 'Video' : 'Videos'}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredVideos.map((video) => (
                <VideoCard
                  key={video.videoId}
                  video={video}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onClick={handlePlay}
                />
              ))}
            </div>
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
    </div>
  );
}
