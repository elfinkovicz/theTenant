import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, ExternalLink, MapPin, Image as ImageIcon, Video, Settings, Send, Hash, Mail, MessageCircle, Link as LinkIcon, Smartphone } from 'lucide-react';
import { newsfeedService, NewsfeedPost } from '../services/newsfeed.service';
import { prefetchService } from '../services/prefetch.service';
import { NewsfeedModal } from '../components/NewsfeedModal';
import { NewsfeedDetailModal } from '../components/NewsfeedDetailModal';
import { NewsfeedSettings } from '../components/NewsfeedSettings';
import { ShortModal } from '../components/ShortModal';
import { LoadMoreButton } from '../components/LoadMoreButton';
import { PageBanner } from '../components/PageBanner';
import { useAdmin } from '../hooks/useAdmin';
import { usePagination } from '../hooks/usePagination';
import { usePageTitle } from '../hooks/usePageTitle';
import { toast } from '../utils/toast-alert';

// Channel definitions for animated neon background
const channels = [
  { id: 'telegram', icon: Send, color: '#3b82f6' },
  { id: 'discord', icon: Hash, color: '#6366f1' },
  { id: 'slack', icon: Hash, color: '#10b981' },
  { id: 'xtwitter', icon: Send, color: '#9ca3af' },
  { id: 'linkedin', icon: LinkIcon, color: '#2563eb' },
  { id: 'email', icon: Mail, color: '#8b5cf6' },
  { id: 'facebook', icon: MessageCircle, color: '#2563eb' },
  { id: 'instagram', icon: MessageCircle, color: '#ec4899' },
  { id: 'whatsapp', icon: MessageCircle, color: '#22c55e' },
  { id: 'signal', icon: MessageCircle, color: '#60a5fa' },
];

// Floating icon component with slow animation
// Media Grid Component: Video left, 2 images stacked right, +X overlay for more
// Uses object-cover with object-center for optimal display of any aspect ratio (16:9, 9:16, 4:3, 1:1, etc.)
// Videos and images are center-cropped to fill the container without black bars
const MediaGrid = ({ videoUrl, images, alt }: { videoUrl?: string, images: string[], alt: string }) => {
  const hasVideo = !!videoUrl;
  const hasImages = images.length > 0;
  const extraCount = images.length > 2 ? images.length - 2 : 0;

  // Only images, no video
  if (!hasVideo && hasImages) {
    if (images.length === 1) {
      // Single image: 16:9 aspect ratio container with center crop
      return (
        <div className="rounded-lg overflow-hidden aspect-video bg-dark-800">
          <img 
            src={images[0]} 
            alt={alt} 
            className="w-full h-full object-cover object-center" 
          />
        </div>
      );
    }
    // 2+ images: 2-column grid with 16:9 aspect ratio each
    return (
      <div className="grid grid-cols-2 gap-2 rounded-lg overflow-hidden">
        <div className="aspect-video bg-dark-800 rounded-lg overflow-hidden">
          <img 
            src={images[0]} 
            alt={alt} 
            className="w-full h-full object-cover object-center" 
          />
        </div>
        <div className="relative aspect-video bg-dark-800 rounded-lg overflow-hidden">
          <img 
            src={images[1]} 
            alt={alt} 
            className="w-full h-full object-cover object-center" 
          />
          {extraCount > 0 && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-3xl font-bold">+{extraCount}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Only video, no images - use object-cover to fill without black bars
  if (hasVideo && !hasImages) {
    return (
      <div className="rounded-lg overflow-hidden aspect-video bg-black">
        <video 
          src={videoUrl} 
          controls 
          className="w-full h-full object-cover object-center" 
          onClick={(e) => e.stopPropagation()} 
        />
      </div>
    );
  }

  // Video + Images: Video left (60%), Images stacked right (40%)
  // Video uses object-cover to fill without black bars (slightly zoomed/cropped)
  if (hasVideo && hasImages) {
    return (
      <div className="flex gap-2 rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
        {/* Video - Left side 60%, object-cover removes black bars */}
        <div className="w-[60%] flex-shrink-0 bg-black rounded-lg overflow-hidden">
          <video 
            src={videoUrl} 
            controls 
            className="w-full h-full object-cover object-center" 
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
        
        {/* Images - Right side 40%, stacked vertically */}
        <div className="w-[40%] flex flex-col gap-2">
          <div className="flex-1 bg-dark-800 rounded-lg overflow-hidden">
            <img 
              src={images[0]} 
              alt={alt} 
              className="w-full h-full object-cover object-center" 
            />
          </div>
          {images.length > 1 ? (
            <div className="relative flex-1 bg-dark-800 rounded-lg overflow-hidden">
              <img 
                src={images[1]} 
                alt={alt} 
                className="w-full h-full object-cover object-center" 
              />
              {extraCount > 0 && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <span className="text-2xl font-bold">+{extraCount}</span>
                </div>
              )}
            </div>
          ) : (
            // Only 1 image: show it larger
            <div className="flex-1" />
          )}
        </div>
      </div>
    );
  }

  return null;
};

const FloatingIcon = ({ channel, index }: { channel: typeof channels[0], index: number }) => {
  const Icon = channel.icon;
  const positions = [
    { left: '5%', top: '15%', size: 80 },
    { right: '8%', top: '25%', size: 60 },
    { left: '12%', top: '45%', size: 70 },
    { right: '5%', top: '55%', size: 55 },
    { left: '3%', top: '75%', size: 65 },
    { right: '15%', top: '70%', size: 50 },
    { left: '20%', top: '30%', size: 45 },
    { right: '3%', top: '85%', size: 60 },
    { left: '8%', top: '90%', size: 55 },
    { right: '12%', top: '40%', size: 50 },
  ];
  const pos = positions[index % positions.length];
  const duration = 15 + (index * 2); // Different speeds for each icon
  const delay = index * 0.5;

  return (
    <motion.div
      className="absolute opacity-[0.08] pointer-events-none"
      style={{
        left: pos.left,
        right: pos.right,
        top: pos.top,
        filter: `drop-shadow(0 0 20px ${channel.color}) drop-shadow(0 0 40px ${channel.color})`,
      }}
      animate={{
        y: [0, -30, 0, 30, 0],
        x: [0, 15, 0, -15, 0],
        rotate: [0, 10, 0, -10, 0],
        scale: [1, 1.1, 1, 0.95, 1],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      <Icon size={pos.size} style={{ color: channel.color }} />
    </motion.div>
  );
};

export const Newsfeed = () => {
  const { title: pageTitle, subtitle: pageSubtitle } = usePageTitle('/newsfeed');
  const [posts, setPosts] = useState<NewsfeedPost[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isShortModalOpen, setIsShortModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<NewsfeedPost | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [expandedScheduled, setExpandedScheduled] = useState<Set<string>>(new Set());
  const { isAdmin } = useAdmin();

  // Pagination - 6 posts initial, load 6 more each time
  const { displayedItems: paginatedPosts, hasMore, remainingCount, loadMore } = usePagination(posts, { initialLimit: 6, increment: 6 });

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      console.log('Loading newsfeed posts...');
      // Use prefetch cache if available
      const result = await prefetchService.getNewsfeed();
      console.log('Loaded posts:', result);
      setPosts(Array.isArray(result.posts) ? result.posts : []);
      setScheduledPosts(result.scheduledPosts || []);
      setError('');
    } catch (error: any) {
      console.error('Failed to load posts:', error);
      console.error('Error details:', error.response?.data || error.message);
      const errorMsg = error.response?.data?.error || error.message || 'Unbekannter Fehler';
      setError(`Fehler beim Laden der Posts: ${errorMsg}`);
      setPosts([]);
      setScheduledPosts([]);
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

    // Optimistic UI update - remove post immediately
    const previousPosts = [...posts];
    setPosts(posts.filter(p => p.postId !== post.postId));

    try {
      await newsfeedService.deletePost(post.postId);
      prefetchService.invalidate('newsfeed');
      toast.success('Post erfolgreich gelöscht');
    } catch (error) {
      console.error('Failed to delete post:', error);
      // Revert on error
      setPosts(previousPosts);
      toast.error('Fehler beim Löschen');
    }
  };

  const handleCancelScheduled = async (scheduleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Geplanten Post wirklich abbrechen?')) return;

    try {
      await newsfeedService.cancelScheduledPost(scheduleId);
      // Refresh posts after successful cancellation
      await loadPosts();
      toast.success('Geplanter Post abgebrochen');
    } catch (error) {
      console.error('Failed to cancel scheduled post:', error);
      toast.error('Fehler beim Abbrechen');
    }
  };

  const handleEditScheduled = (scheduled: any, e: React.MouseEvent) => {
    e.stopPropagation();
    // Convert scheduled post to NewsfeedPost format for editing
    const postForEdit: NewsfeedPost = {
      ...scheduled.post,
      postId: scheduled.schedule_id, // Use schedule_id as postId for update
      isScheduled: true,
      scheduledAt: scheduled.scheduled_at,
      scheduleId: scheduled.schedule_id
    };
    setSelectedPost(postForEdit);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const toggleScheduledExpanded = (scheduleId: string) => {
    setExpandedScheduled(prev => {
      const newSet = new Set(prev);
      if (newSet.has(scheduleId)) {
        newSet.delete(scheduleId);
      } else {
        newSet.add(scheduleId);
      }
      return newSet;
    });
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
    <div className="min-h-screen relative">
      {/* Animated Neon Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {channels.map((channel, index) => (
          <FloatingIcon key={channel.id} channel={channel} index={index} />
        ))}
      </div>

      {/* Page Banner mit Titel */}
      <PageBanner pageId="newsfeed">
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
            onClick={() => setIsSettingsOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Settings size={20} />
            Optionen
          </button>
        )}
      </PageBanner>

      <div className="container mx-auto px-4 py-8">
        {/* Admin Controls */}
        {isAdmin && (
          <div className="mb-6 flex justify-end gap-3">
            <button 
              onClick={() => setIsShortModalOpen(true)} 
              className="btn-primary flex items-center gap-2"
            >
              <Smartphone size={20} />
              Short erstellen
            </button>
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
            {/* Scheduled Posts Section (Admin Only) */}
            {isAdmin && scheduledPosts.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <span className="text-amber-400">📅</span> Geplante Posts ({scheduledPosts.length})
                </h2>
                <div className="space-y-3">
                  {scheduledPosts.map((scheduled) => {
                    const post = scheduled.post;
                    const isExpanded = expandedScheduled.has(scheduled.schedule_id);
                    const scheduledDate = new Date(scheduled.scheduled_at);
                    
                    return (
                      <motion.div
                        key={scheduled.schedule_id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="card bg-amber-500/5 border-amber-500/30 relative"
                      >
                        {/* Minimized View */}
                        <div 
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => toggleScheduledExpanded(scheduled.schedule_id)}
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div className="p-2 bg-amber-500/20 rounded-lg">
                              <span className="text-2xl">📅</span>
                            </div>
                            <div className="flex-1">
                              <h3 className="font-bold text-lg">{post.title}</h3>
                              <p className="text-sm text-dark-400">
                                Geplant für: {scheduledDate.toLocaleString('de-DE', {
                                  day: '2-digit',
                                  month: 'long',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })} Uhr
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => handleEditScheduled(scheduled, e)}
                              className="p-2 rounded-lg bg-primary-500/20 hover:bg-primary-500/30 transition-colors"
                              title="Bearbeiten"
                            >
                              <Edit size={16} className="text-primary-400" />
                            </button>
                            <button
                              onClick={(e) => handleCancelScheduled(scheduled.schedule_id, e)}
                              className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors"
                              title="Löschen"
                            >
                              <Trash2 size={16} className="text-red-400" />
                            </button>
                            <button className="p-2 rounded-lg bg-dark-800 hover:bg-dark-700 transition-colors">
                              {isExpanded ? '▲' : '▼'}
                            </button>
                          </div>
                        </div>

                        {/* Expanded View */}
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mt-4 pt-4 border-t border-amber-500/20"
                          >
                            {/* Media Preview - Video left, Images right grid */}
                            {(post.imageUrl || post.videoUrl || (post.imageUrls && post.imageUrls.length > 0)) && (
                              <div className="mb-4">
                                <MediaGrid 
                                  videoUrl={post.videoUrl} 
                                  images={post.imageUrls && post.imageUrls.length > 0 ? post.imageUrls : (post.imageUrl ? [post.imageUrl] : [])} 
                                  alt={post.title} 
                                />
                              </div>
                            )}

                            {/* Description */}
                            <p className="text-dark-300 whitespace-pre-wrap mb-4">{post.description}</p>

                            {/* Tags */}
                            {post.isShort && post.tags && post.tags.length > 0 && (
                              <div className="flex items-center gap-2 flex-wrap mb-4">
                                {post.tags.map((tag: string, index: number) => (
                                  <span
                                    key={index}
                                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-dark-800/80"
                                  >
                                    <span className="text-pink-400 text-sm">#</span>
                                    <span className="text-sm text-white">{tag}</span>
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Footer Info */}
                            <div className="flex flex-wrap gap-4 pt-4 border-t border-dark-800">
                              {post.location && (
                                <div className="flex items-center gap-2 text-dark-400">
                                  <MapPin size={16} />
                                  <span>{post.location}</span>
                                </div>
                              )}
                              {post.externalLink && (
                                <a
                                  href={post.externalLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-2 text-primary-400 hover:text-primary-300 transition-colors"
                                >
                                  <ExternalLink size={16} />
                                  Mehr erfahren
                                </a>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Published Posts */}
            {posts.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-4">Veröffentlichte Posts</h2>
              </div>
            )}
            
            {paginatedPosts.map((post) => (
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

                {/* Short Post - Two Column Layout with Video behind frame */}
                {post.isShort ? (
                  <div className="relative -m-6 overflow-hidden rounded-xl">
                    {/* Video - Positioned right with padding and matching border radius */}
                    <div className="absolute right-3 top-3 bottom-3 w-[360px] bg-black overflow-hidden z-0 rounded-xl">
                      {post.videoUrl ? (
                        <video 
                          src={post.videoUrl} 
                          controls 
                          poster={post.imageUrl || undefined}
                          className="w-full h-full object-cover rounded-xl"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : post.imageUrl ? (
                        <img 
                          src={post.imageUrl} 
                          alt={post.title} 
                          className="w-full h-full object-cover rounded-xl"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-dark-500">
                          <Smartphone size={48} />
                        </div>
                      )}
                    </div>

                    {/* Content - Above video (z-10) */}
                    <div className="relative z-10 flex-1 flex flex-col min-w-0 p-6 mr-[380px] min-h-[675px]">
                      {/* Post Header */}
                      <div className="mb-4">
                        <div className="flex items-center gap-2">
                          <h2 className="text-2xl font-bold">{post.title}</h2>
                          <span className="px-2 py-0.5 bg-gradient-to-r from-pink-500 to-purple-600 rounded text-xs font-medium">
                            Short
                          </span>
                        </div>
                        <p className="text-sm text-dark-400 mt-1">{formatDate(post.createdAt)}</p>
                      </div>

                      {/* Description */}
                      <div className="flex-1 mb-4">
                        <p className="text-dark-300 whitespace-pre-wrap text-lg leading-relaxed">
                          {truncateText(post.description, 12)}
                          {(post.description.split('\n').length > 12 || post.description.length > 500) && (
                            <span className="text-primary-400 ml-2 font-medium">
                              ... mehr anzeigen
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Tags - Guest Style */}
                      {post.tags && post.tags.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap mb-4">
                          {post.tags.map((tag, index) => (
                            <span
                              key={index}
                              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-dark-800/80"
                            >
                              <span className="text-pink-400 text-sm">#</span>
                              <span className="text-sm text-white">{tag}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Footer Info */}
                      <div className="flex flex-wrap gap-4 pt-4 border-t border-dark-800 mt-auto">
                        {post.location && (
                          <div className="flex items-center gap-2 text-dark-400">
                            <MapPin size={16} />
                            {post.locationUrl ? (
                              <a
                                href={post.locationUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="hover:text-primary-400 transition-colors"
                              >
                                {post.location}
                              </a>
                            ) : (
                              <span>{post.location}</span>
                            )}
                          </div>
                        )}
                        {post.externalLink && (
                          <a
                            href={post.externalLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-2 text-primary-400 hover:text-primary-300 transition-colors"
                          >
                            <ExternalLink size={16} />
                            Mehr erfahren
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Regular Post - Original Layout */
                  <>
                    {/* Post Header */}
                    <div className="mb-4">
                      <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-bold">{post.title}</h2>
                      </div>
                      <p className="text-sm text-dark-400 mt-1">{formatDate(post.createdAt)}</p>
                    </div>

                    {/* Media - Video left, Images right grid */}
                    {(post.videoUrl || post.imageUrl || (post.imageUrls && post.imageUrls.length > 0)) && (
                      <div className="mb-4">
                        <MediaGrid 
                          videoUrl={post.videoUrl} 
                          images={post.imageUrls && post.imageUrls.length > 0 ? post.imageUrls : (post.imageUrl ? [post.imageUrl] : [])} 
                          alt={post.title} 
                        />
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
                      {post.location && (
                        <div className="flex items-center gap-2 text-dark-400">
                          <MapPin size={16} />
                          {post.locationUrl ? (
                            <a
                              href={post.locationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-primary-400 transition-colors"
                            >
                              {post.location}
                            </a>
                          ) : (
                            <span>{post.location}</span>
                          )}
                        </div>
                      )}
                      {post.externalLink && (
                        <a
                          href={post.externalLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-2 text-primary-400 hover:text-primary-300 transition-colors"
                        >
                          <ExternalLink size={16} />
                          Mehr erfahren
                        </a>
                      )}
                      <div className="flex items-center gap-3 ml-auto text-dark-500">
                        {(post.imageUrl || (post.imageUrls && post.imageUrls.length > 0)) && (
                          <div className="flex items-center gap-1">
                            <ImageIcon size={14} />
                            {post.imageUrls && post.imageUrls.length > 1 && (
                              <span className="text-xs">{post.imageUrls.length}</span>
                            )}
                          </div>
                        )}
                        {post.videoUrl && (
                          <div className="flex items-center gap-1">
                            <Video size={14} />
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </motion.article>
            ))}
            
            {hasMore && (
              <LoadMoreButton onClick={loadMore} remainingCount={remainingCount} label="Mehr Posts laden" />
            )}
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
          onSave={() => loadPosts()}
        />
      )}

      {/* Short Modal */}
      <ShortModal
        isOpen={isShortModalOpen}
        onClose={() => setIsShortModalOpen(false)}
        onSuccess={loadPosts}
      />
    </div>
  );
};
