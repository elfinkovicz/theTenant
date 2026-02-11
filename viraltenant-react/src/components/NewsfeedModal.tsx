import { useState, useEffect } from 'react';
import { X, Image as ImageIcon, Video, Link as LinkIcon, MapPin, Send, Hash, Mail, MessageCircle, Smartphone, Settings, Plus, Trash2, GripVertical } from 'lucide-react';
import { newsfeedService, NewsfeedPost, CreatePostData } from '../services/newsfeed.service';
import { slotsService } from '../services/slots.service';
import { crosspostService } from '../services/crosspost.service';
import { ImageCropper } from './ImageCropper';
import { SlotSelector } from './SlotSelector';
import { SlotManagerModal } from './SlotManagerModal';
import { toast } from '../utils/toast-alert';
import { useAuthStore } from '../store/authStore';
import { prefetchService } from '../services/prefetch.service';

// Media item type for multi-image/video support
interface MediaItem {
  id: string;
  type: 'image' | 'video';
  file?: File;
  preview: string;
  key?: string; // S3 key after upload
}

// Channel definitions for neon background
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

interface NewsfeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  post?: NewsfeedPost | null;
  mode: 'create' | 'edit';
}

export function NewsfeedModal({ isOpen, onClose, onSuccess, post, mode }: NewsfeedModalProps) {
  const { accessToken } = useAuthStore();
  // Legacy single file states (for backwards compatibility with Shorts edit)
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string>('');
  // New multi-media state
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [externalLink, setExternalLink] = useState('');
  const [location, setLocation] = useState('');
  const [locationUrl, setLocationUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [cropperImage, setCropperImage] = useState<string | null>(null);
  const [cropperCallback, setCropperCallback] = useState<((blob: Blob) => void) | null>(null);
  const [publishOption, setPublishOption] = useState<'now' | 'slot' | 'schedule'>('now');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [hasSlots, setHasSlots] = useState(false);
  const [showSlotManager, setShowSlotManager] = useState(false);
  const [enabledChannels, setEnabledChannels] = useState<{ id: string; name: string; displayName: string }[]>([]);

  // Max limits
  const MAX_IMAGES = 35; // TikTok max
  const MAX_VIDEOS = 1; // Most platforms only support 1 video per post

  useEffect(() => {
    if (post && mode === 'edit') {
      setTitle(post.title);
      setDescription(post.description);
      setExternalLink(post.externalLink || '');
      setLocation(post.location || '');
      setLocationUrl(post.locationUrl || '');
      
      // Load existing media into mediaItems
      const existingMedia: MediaItem[] = [];
      if (post.imageUrl) {
        existingMedia.push({
          id: 'existing-image-0',
          type: 'image',
          preview: post.imageUrl,
          key: post.imageKey
        });
      }
      // Load multiple images if available
      if ((post as any).imageUrls && Array.isArray((post as any).imageUrls)) {
        (post as any).imageUrls.forEach((url: string, idx: number) => {
          existingMedia.push({
            id: `existing-image-${idx}`,
            type: 'image',
            preview: url,
            key: (post as any).imageKeys?.[idx]
          });
        });
      }
      if (post.videoUrl) {
        setVideoPreview(post.videoUrl);
        existingMedia.push({
          id: 'existing-video-0',
          type: 'video',
          preview: post.videoUrl,
          key: post.videoKey
        });
      }
      setMediaItems(existingMedia);
      
      if (post.status === 'scheduled' && post.scheduledAt) {
        setPublishOption('schedule');
        const date = new Date(post.scheduledAt);
        setScheduledDate(date.toISOString().split('T')[0]);
        setScheduledTime(date.toTimeString().slice(0, 5));
      }
    } else {
      // Reset for new post
      setMediaItems([]);
      // Set default to tomorrow at 12:00
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(12, 0, 0, 0);
      setScheduledDate(tomorrow.toISOString().split('T')[0]);
      setScheduledTime('12:00');
    }
    
    // Check if slots are available - reload every time modal opens
    if (isOpen) {
      loadSlotsAvailability();
      loadEnabledChannels();
    }
  }, [post, mode, isOpen]);

  const loadEnabledChannels = async () => {
    if (!accessToken) return;
    try {
      const channels = await crosspostService.getEnabledChannels(accessToken);
      setEnabledChannels(channels);
    } catch (err) {
      console.error('Error loading enabled channels:', err);
    }
  };

  const loadSlotsAvailability = async () => {
    try {
      const slotsData = await slotsService.getSlots();
      const hasActiveSlots = slotsData.slots && slotsData.slots.some(s => s.enabled);
      setHasSlots(hasActiveSlots);
      
      // Set default to slot if slots are available and creating new post
      if (hasActiveSlots && mode === 'create' && !post) {
        setPublishOption('slot');
      }
    } catch (err) {
      console.error('Error checking slots:', err);
      setHasSlots(false);
    }
  };

  const handleSlotSelected = (datetime: string) => {
    const date = new Date(datetime);
    setScheduledDate(date.toISOString().split('T')[0]);
    setScheduledTime(date.toTimeString().slice(0, 5));
  };

  if (!isOpen) return null;

  // Add images to media items (with cropper)
  const handleQuickImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const currentImageCount = mediaItems.filter(m => m.type === 'image').length;
    const remainingSlots = MAX_IMAGES - currentImageCount;

    if (remainingSlots <= 0) {
      setError(`Maximal ${MAX_IMAGES} Bilder erlaubt`);
      return;
    }

    Array.from(files).slice(0, remainingSlots).forEach((file, index) => {
      if (!file.type.startsWith('image/')) return;
      if (file.size > 20 * 1024 * 1024) {
        setError(`Bild "${file.name}" ist zu groß (max. 20MB)`);
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setCropperImage(reader.result as string);
        setCropperCallback(() => (croppedBlob: Blob) => {
          const croppedFile = new File([croppedBlob], `image-${Date.now()}-${index}.jpg`, { type: 'image/jpeg' });
          const newItem: MediaItem = {
            id: `image-${Date.now()}-${index}`,
            type: 'image',
            file: croppedFile,
            preview: URL.createObjectURL(croppedBlob)
          };
          setMediaItems(prev => [...prev, newItem]);
          setCropperImage(null);
          setCropperCallback(null);
        });
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  // Add video to media items
  const handleMultiVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const currentVideoCount = mediaItems.filter(m => m.type === 'video').length;
    if (currentVideoCount >= MAX_VIDEOS) {
      setError(`Maximal ${MAX_VIDEOS} Video pro Post erlaubt`);
      return;
    }

    if (!file.type.startsWith('video/')) {
      setError('Bitte wähle ein Video aus');
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setError('Video ist zu groß (max. 100MB)');
      return;
    }

    const newItem: MediaItem = {
      id: `video-${Date.now()}`,
      type: 'video',
      file: file,
      preview: URL.createObjectURL(file)
    };
    setMediaItems(prev => [...prev, newItem]);
    setError('');
    e.target.value = '';
  };

  // Remove media item
  const handleRemoveMedia = (id: string) => {
    setMediaItems(prev => prev.filter(m => m.id !== id));
  };

  // Move media item (for reordering)
  const handleMoveMedia = (id: string, direction: 'up' | 'down') => {
    setMediaItems(prev => {
      const index = prev.findIndex(m => m.id === id);
      if (index === -1) return prev;
      
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      
      const newItems = [...prev];
      [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
      return newItems;
    });
  };

  // Helper: Ensure URL has protocol
  const ensureProtocol = (url: string): string => {
    if (!url) return url;
    const trimmed = url.trim();
    if (!trimmed) return trimmed;
    
    // Check if URL already has a protocol
    if (trimmed.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//)) {
      return trimmed;
    }
    
    // Add https:// if missing
    return `https://${trimmed}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('Submit clicked!', { title, description, mediaItems: mediaItems.length });

    if (!title.trim() || !description.trim()) {
      setError('Titel und Beschreibung sind erforderlich');
      return;
    }

    setUploading(true);
    setError('');
    console.log('Starting upload...');

    try {
      let imageKey = post?.imageKey;
      let videoKey = post?.videoKey;
      let imageKeys: string[] = [];
      let imageUrls: string[] = [];

      // Upload legacy single image if selected (backwards compatibility)
      if (imageFile) {
        const uploadData = await newsfeedService.generateUploadUrl(
          imageFile.name,
          imageFile.type,
          'image'
        );
        await newsfeedService.uploadToS3(uploadData.uploadUrl, imageFile);
        imageKey = uploadData.key;
      }

      // Upload legacy single video if selected (backwards compatibility)
      if (videoFile) {
        const uploadData = await newsfeedService.generateUploadUrl(
          videoFile.name,
          videoFile.type,
          'video'
        );
        await newsfeedService.uploadToS3(uploadData.uploadUrl, videoFile);
        videoKey = uploadData.key;
      }

      // Upload all media items (new multi-media support)
      for (const item of mediaItems) {
        if (item.file) {
          // New file to upload
          const uploadData = await newsfeedService.generateUploadUrl(
            item.file.name,
            item.file.type,
            item.type
          );
          await newsfeedService.uploadToS3(uploadData.uploadUrl, item.file);
          
          if (item.type === 'image') {
            imageKeys.push(uploadData.key);
            imageUrls.push(uploadData.publicUrl || `https://viraltenant.com/${uploadData.key}`);
          } else if (item.type === 'video') {
            videoKey = uploadData.key;
          }
        } else if (item.key) {
          // Existing media (from edit mode)
          if (item.type === 'image') {
            imageKeys.push(item.key);
            imageUrls.push(item.preview);
          } else if (item.type === 'video') {
            videoKey = item.key;
          }
        }
      }

      // Use first image as main imageKey for backwards compatibility
      if (imageKeys.length > 0 && !imageKey) {
        imageKey = imageKeys[0];
      }

      // Ensure URLs have protocol
      const finalExternalLink = externalLink.trim() ? ensureProtocol(externalLink.trim()) : undefined;
      const finalLocationUrl = locationUrl.trim() ? ensureProtocol(locationUrl.trim()) : undefined;

      const data: CreatePostData = {
        title: title.trim(),
        description: description.trim(),
        imageKey,
        videoKey,
        // New multi-image fields
        imageKeys: imageKeys.length > 0 ? imageKeys : undefined,
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        externalLink: finalExternalLink,
        location: location.trim() || undefined,
        locationUrl: finalLocationUrl,
        status: (publishOption === 'schedule' || publishOption === 'slot') ? 'scheduled' : 'published',
        scheduledAt: (publishOption === 'schedule' || publishOption === 'slot') 
          ? new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString() 
          : undefined
      };

      console.log('Creating post with data:', data);
      
      if (mode === 'create') {
        const result = await newsfeedService.createPost(data);
        console.log('Post created:', result);
        
        // Reload slots availability after creating a scheduled post
        if (publishOption === 'slot' || publishOption === 'schedule') {
          await loadSlotsAvailability();
        }
      } else if (post) {
        // Check if this is a scheduled post (has scheduleId)
        if ((post as any).scheduleId) {
          const scheduleId = (post as any).scheduleId;
          const scheduledAt = data.scheduledAt || (post as any).scheduledAt;
          
          // Build the updated post object
          const updatedPost = {
            ...post,
            title: data.title,
            description: data.description,
            imageKey: data.imageKey,
            videoKey: data.videoKey,
            imageKeys: data.imageKeys,
            imageUrls: data.imageUrls,
            externalLink: data.externalLink,
            location: data.location,
            locationUrl: data.locationUrl
          };
          
          await newsfeedService.updateScheduledPost(scheduleId, updatedPost, scheduledAt);
          console.log('Scheduled post updated');
        } else {
          await newsfeedService.updatePost(post.postId, data);
          console.log('Post updated');
        }
      }

      toast.success(mode === 'create' ? 'Post erfolgreich erstellt!' : 'Post erfolgreich aktualisiert!');
      
      // Invalidate cache before calling onSuccess
      prefetchService.invalidate('newsfeed');
      
      setUploading(false);
      
      // Reset form state
      setImageFile(null);
      setVideoFile(null);
      setVideoPreview('');
      setMediaItems([]);
      setTitle('');
      setDescription('');
      setExternalLink('');
      setLocation('');
      setLocationUrl('');
      setError('');
      
      // Close modal first, then refresh data
      onClose();
      
      // Call onSuccess after modal is closed to ensure data refresh
      setTimeout(() => {
        onSuccess();
      }, 100);
    } catch (err: any) {
      console.error('Error creating post:', err);
      console.error('Error response:', err.response);
      const errorMessage = err.response?.data?.error || err.message || 'Fehler beim Speichern';
      setError(errorMessage);
      toast.error('Fehler beim Erstellen des Posts');
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setImageFile(null);
      setVideoFile(null);
      setVideoPreview('');
      setMediaItems([]);
      setTitle('');
      setDescription('');
      setExternalLink('');
      setLocation('');
      setLocationUrl('');
      setError('');
      setUploading(false);
      setCropperImage(null);
      setCropperCallback(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      {/* Image Cropper Modal */}
      {cropperImage && cropperCallback && (
        <ImageCropper
          image={cropperImage}
          onCropComplete={cropperCallback}
          onCancel={() => {
            setCropperImage(null);
            setCropperCallback(null);
          }}
          aspectRatio={16 / 9}
          cropShape="rect"
          title="Bild zuschneiden (16:9)"
          optimizeForCrossposting={true}
        />
      )}
      
      <div className={`bg-dark-900 rounded-lg w-full max-h-[90vh] overflow-hidden border border-dark-800 relative flex flex-col ${post?.isShort ? 'max-w-5xl' : 'max-w-3xl'}`}>
        {/* Neon Background Icons - Only for regular posts */}
        {!post?.isShort && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {channels.map((channel, index) => {
              const Icon = channel.icon
              const positions = [
                { top: '8%', right: '3%', rotate: '15deg', size: 70 },
                { top: '55%', right: '5%', rotate: '-20deg', size: 55 },
                { bottom: '12%', right: '2%', rotate: '25deg', size: 60 },
                { top: '30%', right: '8%', rotate: '-10deg', size: 45 },
                { bottom: '35%', right: '4%', rotate: '30deg', size: 50 },
                { top: '70%', right: '10%', rotate: '-5deg', size: 40 },
                { bottom: '60%', right: '1%', rotate: '20deg', size: 55 },
                { top: '15%', right: '12%', rotate: '-15deg', size: 35 },
                { bottom: '8%', right: '12%', rotate: '10deg', size: 45 },
                { top: '45%', right: '0%', rotate: '-25deg', size: 50 },
              ]
              const pos = positions[index % positions.length]
              return (
                <div
                  key={channel.id}
                  className="absolute opacity-[0.12]"
                  style={{
                    top: pos.top,
                    right: pos.right,
                    bottom: pos.bottom,
                    transform: `rotate(${pos.rotate})`,
                    filter: `drop-shadow(0 0 15px ${channel.color}) drop-shadow(0 0 30px ${channel.color}) drop-shadow(0 0 45px ${channel.color})`,
                  }}
                >
                  <Icon size={pos.size} style={{ color: channel.color }} />
                </div>
              )
            })}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-700 flex-shrink-0 relative z-10">
          <div className="flex items-center gap-3">
            {post?.isShort && (
              <div className="p-2 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl">
                <Smartphone size={24} />
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold">
                {mode === 'create' ? 'Newsfeed-Post erstellen' : post?.isShort ? 'Short bearbeiten' : 'Post bearbeiten'}
              </h2>
              {post?.isShort && (
                <p className="text-sm text-dark-400">Hochkant-Video (9:16)</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={uploading}
            className="p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Active Platforms Section */}
        {mode === 'create' && enabledChannels.length > 0 && !post?.isShort && (
          <div className="px-4 py-3 bg-dark-800/50 border-b border-dark-700 relative z-10">
            <p className="text-xs text-dark-400 mb-2">Wird veröffentlicht auf:</p>
            <div className="flex flex-wrap gap-3">
              {enabledChannels.map(ch => (
                <div key={ch.id} className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-dark-300">{ch.name}:</span>
                  <span className="text-white font-medium">{ch.displayName}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content - Two Column Layout for Shorts */}
        {post?.isShort ? (
          <div className="flex flex-1 overflow-hidden">
            {/* Left Column - Form Fields */}
            <div className="flex-1 p-6 overflow-y-auto border-r border-dark-700">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Titel <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={uploading}
                    placeholder="Gib deinem Short einen Titel"
                    className="input w-full disabled:opacity-50"
                    maxLength={100}
                  />
                  <p className="text-xs text-dark-500 mt-1">{title.length}/100</p>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Beschreibung <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={uploading}
                    placeholder="Beschreibe deinen Short... #hashtags"
                    className="input w-full h-32 resize-none disabled:opacity-50"
                    maxLength={500}
                  />
                  <p className="text-xs text-dark-500 mt-1">{description.length}/500</p>
                </div>

                {/* External Link */}
                <div>
                  <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                    <LinkIcon size={16} />
                    Externer Link (optional)
                  </label>
                  <input
                    type="text"
                    value={externalLink}
                    onChange={(e) => setExternalLink(e.target.value)}
                    disabled={uploading}
                    placeholder="example.com oder https://example.com"
                    className="input w-full disabled:opacity-50"
                  />
                </div>

                {/* Publish Options */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium">Veröffentlichung</label>
                    <button
                      type="button"
                      onClick={() => setShowSlotManager(true)}
                      className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1"
                    >
                      <Settings className="w-3 h-3" />
                      Slots verwalten
                    </button>
                  </div>
                  <div className="flex gap-4 mb-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="publishOption"
                        value="now"
                        checked={publishOption === 'now'}
                        onChange={() => setPublishOption('now')}
                        disabled={uploading}
                        className="w-4 h-4 text-primary-500"
                      />
                      <span>Sofort veröffentlichen</span>
                    </label>
                    {hasSlots && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="publishOption"
                          value="slot"
                          checked={publishOption === 'slot'}
                          onChange={() => setPublishOption('slot')}
                          disabled={uploading}
                          className="w-4 h-4 text-primary-500"
                        />
                        <span>Nächster Slot</span>
                      </label>
                    )}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="publishOption"
                        value="schedule"
                        checked={publishOption === 'schedule'}
                        onChange={() => setPublishOption('schedule')}
                        disabled={uploading}
                        className="w-4 h-4 text-primary-500"
                      />
                      <span>Zeitplanung</span>
                    </label>
                  </div>

                  {/* Slot Selector */}
                  {publishOption === 'slot' && (
                    <SlotSelector
                      onSlotSelected={handleSlotSelected}
                      onManageSlots={() => setShowSlotManager(true)}
                    />
                  )}

                  {/* Schedule Date/Time */}
                  {publishOption === 'schedule' && (
                    <div className="grid grid-cols-2 gap-4 p-4 bg-dark-800/50 rounded-lg border border-dark-700">
                      <div>
                        <label className="block text-sm font-medium mb-2">Datum</label>
                        <input
                          type="date"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          disabled={uploading}
                          min={new Date().toISOString().split('T')[0]}
                          className="input w-full disabled:opacity-50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Uhrzeit</label>
                        <input
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          disabled={uploading}
                          className="input w-full disabled:opacity-50"
                        />
                      </div>
                      <div className="col-span-2 text-sm text-dark-400">
                        📅 Post wird veröffentlicht am {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString('de-DE', { 
                          day: '2-digit', 
                          month: 'long', 
                          year: 'numeric', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })} Uhr
                      </div>
                    </div>
                  )}
                </div>

                {/* Location */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                      <MapPin size={16} />
                      Ort (optional)
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      disabled={uploading}
                      placeholder="z.B. Berlin"
                      className="input w-full disabled:opacity-50"
                      maxLength={200}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Maps Link</label>
                    <input
                      type="text"
                      value={locationUrl}
                      onChange={(e) => setLocationUrl(e.target.value)}
                      disabled={uploading}
                      placeholder="maps.google.com/..."
                      className="input w-full disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="bg-red-500/10 border border-red-500 rounded-lg p-3 text-red-500 text-sm">
                    {error}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={uploading}
                    className="btn-secondary flex-1 disabled:opacity-50"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={uploading || !title.trim() || !description.trim()}
                    className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? 'Wird gespeichert...' : 'Speichern'}
                  </button>
                </div>
              </form>
            </div>

            {/* Right Column - Video Preview (9:16) */}
            <div className="w-80 flex-shrink-0 bg-black flex flex-col items-center justify-center p-4">
              {videoPreview ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <video
                    src={videoPreview}
                    controls
                    className="max-h-full w-auto rounded-xl"
                    style={{ aspectRatio: '9/16', maxWidth: '100%' }}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center w-full h-full text-dark-500">
                  <Smartphone size={48} className="mb-2" />
                  <span className="text-sm">Kein Video</span>
                </div>
              )}
              <p className="text-xs text-dark-500 mt-3 text-center">
                Short-Video kann nicht geändert werden
              </p>
            </div>
          </div>
        ) : (
          /* Regular Post - Original Layout */
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden relative z-10">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Titel <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={uploading}
                placeholder="Post-Titel"
                className="input w-full disabled:opacity-50"
                maxLength={200}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Beschreibung <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={uploading}
                placeholder="Post-Beschreibung..."
                rows={5}
                className="input w-full disabled:opacity-50 resize-none"
                maxLength={2000}
              />
            </div>

            {/* Media Upload - Multi-Image/Video Support */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium">Medien (optional)</label>
                <div className="flex items-center gap-2 text-xs text-dark-400">
                  <span>{mediaItems.filter(m => m.type === 'image').length}/{MAX_IMAGES} Bilder</span>
                  <span>•</span>
                  <span>{mediaItems.filter(m => m.type === 'video').length}/{MAX_VIDEOS} Video</span>
                </div>
              </div>

              {/* TikTok Hint */}
              {mediaItems.filter(m => m.type === 'image').length === 1 && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-xs text-yellow-400 flex items-start gap-2">
                    <span className="mt-0.5">⚠️</span>
                    <span><strong>TikTok:</strong> Für TikTok Foto-Posts werden mindestens 2 Bilder benötigt. Füge ein weiteres Bild hinzu, um auf TikTok zu posten.</span>
                  </p>
                </div>
              )}

              {/* Media Grid */}
              {mediaItems.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {mediaItems.map((item, index) => (
                    <div key={item.id} className="relative group">
                      <div className="aspect-video rounded-lg bg-dark-800 overflow-hidden">
                        {item.type === 'image' ? (
                          <img src={item.preview} alt={`Media ${index + 1}`} className="w-full h-full object-cover" />
                        ) : (
                          <video src={item.preview} className="w-full h-full object-cover" />
                        )}
                      </div>
                      {/* Media type badge */}
                      <div className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-xs font-medium ${item.type === 'video' ? 'bg-purple-500' : 'bg-blue-500'}`}>
                        {item.type === 'video' ? 'Video' : index + 1}
                      </div>
                      {/* Actions overlay */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        {index > 0 && (
                          <button
                            type="button"
                            onClick={() => handleMoveMedia(item.id, 'up')}
                            className="p-1.5 bg-dark-700 rounded-lg hover:bg-dark-600"
                            title="Nach vorne"
                          >
                            <GripVertical className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveMedia(item.id)}
                          className="p-1.5 bg-red-500/80 rounded-lg hover:bg-red-500"
                          title="Entfernen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Buttons */}
              <div className="flex flex-wrap gap-3">
                {/* Add Images */}
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleQuickImageAdd}
                    disabled={uploading || mediaItems.filter(m => m.type === 'image').length >= MAX_IMAGES}
                    className="hidden"
                    id="multi-image-upload"
                  />
                  <label
                    htmlFor="multi-image-upload"
                    className={`btn-secondary cursor-pointer inline-flex items-center gap-2 text-sm ${mediaItems.filter(m => m.type === 'image').length >= MAX_IMAGES ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Plus className="w-4 h-4" />
                    <ImageIcon className="w-4 h-4" />
                    Bilder hinzufügen
                  </label>
                </div>

                {/* Add Video */}
                <div>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleMultiVideoChange}
                    disabled={uploading || mediaItems.filter(m => m.type === 'video').length >= MAX_VIDEOS}
                    className="hidden"
                    id="multi-video-upload"
                  />
                  <label
                    htmlFor="multi-video-upload"
                    className={`btn-secondary cursor-pointer inline-flex items-center gap-2 text-sm ${mediaItems.filter(m => m.type === 'video').length >= MAX_VIDEOS ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Plus className="w-4 h-4" />
                    <Video className="w-4 h-4" />
                    Video hinzufügen
                  </label>
                </div>
              </div>

              <p className="text-xs text-dark-400">
                Bilder: max. 20MB pro Bild, JPEG/PNG/WebP • Video: max. 100MB, MP4/MOV
              </p>
            </div>

            {/* External Link */}
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <LinkIcon size={16} />
                Externer Link (optional)
              </label>
              <input
                type="text"
                value={externalLink}
                onChange={(e) => setExternalLink(e.target.value)}
                disabled={uploading}
                placeholder="example.com oder https://example.com"
                className="input w-full disabled:opacity-50"
              />
              <p className="text-sm text-dark-400 mt-1">Link zu einer externen Webseite (https:// wird automatisch hinzugefügt)</p>
            </div>

            {/* Publish Options */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium">Veröffentlichung</label>
                <button
                  type="button"
                  onClick={() => setShowSlotManager(true)}
                  className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1"
                >
                  <Settings className="w-3 h-3" />
                  Slots verwalten
                </button>
              </div>
              <div className="flex gap-4 mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="publishOption"
                    value="now"
                    checked={publishOption === 'now'}
                    onChange={() => setPublishOption('now')}
                    disabled={uploading}
                    className="w-4 h-4 text-primary-500"
                  />
                  <span>Sofort veröffentlichen</span>
                </label>
                {hasSlots && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="publishOption"
                      value="slot"
                      checked={publishOption === 'slot'}
                      onChange={() => setPublishOption('slot')}
                      disabled={uploading}
                      className="w-4 h-4 text-primary-500"
                    />
                    <span>Nächster Slot</span>
                  </label>
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="publishOption"
                    value="schedule"
                    checked={publishOption === 'schedule'}
                    onChange={() => setPublishOption('schedule')}
                    disabled={uploading}
                    className="w-4 h-4 text-primary-500"
                  />
                  <span>Zeitplanung</span>
                </label>
              </div>

              {/* Slot Selector */}
              {publishOption === 'slot' && (
                <SlotSelector
                  key={`slot-${isOpen}`}
                  onSlotSelected={handleSlotSelected}
                  onManageSlots={() => setShowSlotManager(true)}
                />
              )}

              {/* Schedule Date/Time */}
              {publishOption === 'schedule' && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-dark-800/50 rounded-lg border border-dark-700">
                  <div>
                    <label className="block text-sm font-medium mb-2">Datum</label>
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      disabled={uploading}
                      min={new Date().toISOString().split('T')[0]}
                      className="input w-full disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Uhrzeit</label>
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      disabled={uploading}
                      className="input w-full disabled:opacity-50"
                    />
                  </div>
                  <div className="col-span-2 text-sm text-dark-400">
                    📅 Post wird veröffentlicht am {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString('de-DE', { 
                      day: '2-digit', 
                      month: 'long', 
                      year: 'numeric', 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })} Uhr
                  </div>
                </div>
              )}
            </div>

            {/* Location */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <MapPin size={16} />
                  Ort (optional)
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  disabled={uploading}
                  placeholder="z.B. Berlin, Deutschland"
                  className="input w-full disabled:opacity-50"
                  maxLength={200}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Google Maps Link (optional)</label>
                <input
                  type="text"
                  value={locationUrl}
                  onChange={(e) => setLocationUrl(e.target.value)}
                  disabled={uploading}
                  placeholder="maps.google.com/... oder https://..."
                  className="input w-full disabled:opacity-50"
                />
                <p className="text-xs text-dark-400 mt-1">https:// wird automatisch hinzugefügt</p>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 text-red-500">
                {error}
              </div>
            )}
            </div>

            {/* Actions - Fixed at bottom */}
            <div className="flex gap-3 p-6 border-t border-dark-800 flex-shrink-0">
              <button
                type="button"
                onClick={handleClose}
                disabled={uploading}
                className="btn-secondary flex-1 disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={uploading || !title.trim() || !description.trim()}
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Wird gespeichert...' : mode === 'create' ? 'Veröffentlichen' : 'Speichern'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Slot Manager Modal */}
      {showSlotManager && (
        <SlotManagerModal
          isOpen={showSlotManager}
          onClose={() => setShowSlotManager(false)}
          onSlotsUpdated={() => {
            loadSlotsAvailability();
            setShowSlotManager(false);
          }}
        />
      )}
    </div>
  );
}
