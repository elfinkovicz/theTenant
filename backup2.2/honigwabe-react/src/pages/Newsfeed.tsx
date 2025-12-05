import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, ExternalLink, MapPin, Image as ImageIcon, Video, Settings } from 'lucide-react';
import { newsfeedService, NewsfeedPost } from '../services/newsfeed.service';
import { NewsfeedModal } from '../components/NewsfeedModal';
import { NewsfeedDetailModal } from '../components/NewsfeedDetailModal';
import { NewsfeedSettings } from '../components/NewsfeedSettings';
import { useAdmin } from '../hooks/useAdmin';

export const Newsfeed = () => {
  const [posts, setPosts] = useState<NewsfeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<NewsfeedPost | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const { isAdmin } = useAdmin();

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      console.log('Loading newsfeed posts...');
      const postList = await newsfeedService.getPosts();
      console.log('Loaded posts:', postList);
      setPosts(postList);
      setError('');
    } catch (error: any) {
      console.error('Failed to load posts:', error);
      console.error('Error details:', error.response?.data || error.message);
      const errorMsg = error.response?.data?.error || error.message || 'Unbekannter Fehler';
      setError(`Fehler beim Laden der Posts: ${errorMsg}`);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedPost(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleEdit = (post: NewsfeedPost, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPost(post);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleDelete = async (post: NewsfeedPost, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Post "${post.title}" wirklich löschen?`)) return;

    try {
      await newsfeedService.deletePost(post.postId);
      loadPosts();
    } catch (error) {
      console.error('Failed to delete post:', error);
      alert('Fehler beim Löschen');
    }
  };

  const handleViewDetails = (post: NewsfeedPost) => {
    setSelectedPost(post);
    setIsDetailModalOpen(true);
  };

  const truncateText = (text: string, maxLines: number = 3) => {
    const lines = text.split('\n');
    if (lines.length > maxLines) {
      return lines.slice(0, maxLines).join('\n');
    }
    // Fallback: Truncate by character count
    if (text.length > 150) {
      return text.substring(0, 150);
    }
    return text;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="relative py-12 overflow-hidden bg-gradient-to-br from-primary-900/20 via-dark-950 to-dark-950">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">
                <span className="glow-text">Newsfeed</span>
              </h1>
              <p className="text-dark-400 text-lg">
                Bleib auf dem Laufenden mit unseren neuesten Updates
              </p>
            </div>
            
            {isAdmin && (
              <div className="flex gap-3">
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="btn-primary flex items-center gap-2"
                >
                  <Settings size={20} />
                  Optionen
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">
        {/* Admin Controls */}
        {isAdmin && (
          <div className="mb-6 flex justify-end">
            <button onClick={handleCreate} className="btn-primary flex items-center gap-2">
              <Plus size={20} />
              Post erstellen
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="card bg-red-500/10 border-red-500 max-w-2xl mx-auto">
              <p className="text-red-400 mb-4">{error}</p>
              <button onClick={loadPosts} className="btn-primary">
                Erneut versuchen
              </button>
            </div>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-dark-400 text-lg">Noch keine Posts vorhanden</p>
            {isAdmin && (
              <button onClick={handleCreate} className="btn-primary mt-4">
                Ersten Post erstellen
              </button>
            )}
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-8">
            {posts.map((post) => (
              <motion.article
                key={post.postId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => handleViewDetails(post)}
                className="card relative cursor-pointer hover:border-primary-500/50 transition-colors"
              >
                {/* Admin Actions */}
                {isAdmin && (
                  <div className="absolute top-4 right-4 flex gap-2 z-10">
                    <button
                      onClick={(e) => handleEdit(post, e)}
                      className="p-2 rounded-lg bg-dark-800 hover:bg-primary-600 transition-colors"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={(e) => handleDelete(post, e)}
                      className="p-2 rounded-lg bg-dark-800 hover:bg-red-600 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}

                {/* Post Header */}
                <div className="mb-4">
                  <h2 className="text-2xl font-bold mb-2">{post.title}</h2>
                  <p className="text-sm text-dark-400">{formatDate(post.createdAt)}</p>
                </div>

                {/* Media */}
                {(post.imageUrl || post.videoUrl) && (
                  <div className="mb-4 rounded-lg overflow-hidden">
                    {post.videoUrl ? (
                      <video 
                        src={post.videoUrl} 
                        controls 
                        className="w-full max-h-[500px] object-contain bg-black"
                      />
                    ) : post.imageUrl ? (
                      <img 
                        src={post.imageUrl} 
                        alt={post.title} 
                        className="w-full max-h-[500px] object-contain bg-dark-800"
                      />
                    ) : null}
                  </div>
                )}

                {/* Description */}
                <div className="mb-4">
                  <p className="text-dark-300 whitespace-pre-wrap">
                    {truncateText(post.description)}
                    {(post.description.split('\n').length > 3 || post.description.length > 150) && (
                      <span className="text-primary-400 ml-2 font-medium">
                        ... mehr anzeigen
                      </span>
                    )}
                  </p>
                </div>

                {/* Footer Info */}
                <div className="flex flex-wrap gap-4 pt-4 border-t border-dark-800">
                  {/* Location */}
                  {post.location && (
                    <div className="flex items-center gap-2 text-dark-400">
                      <MapPin size={16} />
                      {post.locationUrl ? (
                        <a
                          href={post.locationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary-400 transition-colors"
                        >
                          {post.location}
                        </a>
                      ) : (
                        <span>{post.location}</span>
                      )}
                    </div>
                  )}

                  {/* External Link */}
                  {post.externalLink && (
                    <a
                      href={post.externalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-primary-400 hover:text-primary-300 transition-colors"
                    >
                      <ExternalLink size={16} />
                      Mehr erfahren
                    </a>
                  )}

                  {/* Media Indicators */}
                  <div className="flex items-center gap-3 ml-auto text-dark-500">
                    {post.imageUrl && (
                      <div className="flex items-center gap-1">
                        <ImageIcon size={14} />
                      </div>
                    )}
                    {post.videoUrl && (
                      <div className="flex items-center gap-1">
                        <Video size={14} />
                      </div>
                    )}
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <NewsfeedModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadPosts}
        post={selectedPost}
        mode={modalMode}
      />

      {/* Detail Modal */}
      <NewsfeedDetailModal
        post={selectedPost}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
      />

      {/* Settings Modal */}
      {isSettingsOpen && (
        <NewsfeedSettings
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  );
};
