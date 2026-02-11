import { useState, useEffect, useRef } from 'react';
import { X, Upload, Film, Image as ImageIcon, Newspaper, Lock, Users, Plus, Trash2, Settings } from 'lucide-react';
import { videoService, VideoGuest } from '../services/video.service';
import { newsfeedService } from '../services/newsfeed.service';
import { slotsService } from '../services/slots.service';
import { ImageCropper } from './ImageCropper';
import { AIThumbnailGenerator } from './AIThumbnailGenerator';
import { SlotSelector } from './SlotSelector';
import { SlotManagerModal } from './SlotManagerModal';
import { useTenant } from '../providers/TenantProvider';
import { extractFramesFromVideoFile, ExtractedFrame, cleanupFrameUrls } from '../utils/videoFrameExtractor';
import { toast } from '../utils/toast-alert';
import { prefetchService } from '../services/prefetch.service';

interface VideoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function VideoUploadModal({ isOpen, onClose, onSuccess }: VideoUploadModalProps) {
  const { tenantId } = useTenant();
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadedVideoKey, setUploadedVideoKey] = useState<string | null>(null);
  const [extractedFrames, setExtractedFrames] = useState<ExtractedFrame[]>([]);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [aiThumbnailUrl, setAiThumbnailUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [publishToNewsfeed, setPublishToNewsfeed] = useState(true);
  const [isExclusive, setIsExclusive] = useState(false);
  const [publishOption, setPublishOption] = useState<'now' | 'slot' | 'schedule'>('now');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [hasSlots, setHasSlots] = useState(false);
  const [showSlotManager, setShowSlotManager] = useState(false);
  const [guests, setGuests] = useState<VideoGuest[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [cropperImage, setCropperImage] = useState<string | null>(null);
  const [extractingFrames, setExtractingFrames] = useState(false);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState<number>(0);
  
  // Ref to track if video was successfully published (not affected by closure issues)
  const wasPublishedRef = useRef(false);

  // Load categories when modal opens
  useEffect(() => {
    if (!isOpen) {
      // Reset the published ref when modal closes
      wasPublishedRef.current = false;
      // Clean up frame URLs to prevent memory leaks
      if (extractedFrames.length > 0) {
        cleanupFrameUrls(extractedFrames);
      }
      
      // Reset form when modal closes
      setVideoFile(null);
      setUploadedVideoKey(null);
      setExtractedFrames([]);
      setSelectedFrameIndex(0);
      setThumbnailFile(null);
      setAiThumbnailUrl(null);
      setTitle('');
      setDescription('');
      setCategory('');
      setPublishToNewsfeed(true);
      setIsExclusive(false);
      setPublishOption('now');
      setScheduledDate('');
      setScheduledTime('');
      setHasSlots(false);
      setGuests([]);
      setUploadProgress(0);
      setError('');
      setUploading(false);
      return;
    }

    // Load categories when modal opens
    const loadCategories = async () => {
      try {
        const { categories: cats } = await videoService.getVideos();
        // Filtere 'Alle' aus, da es nur ein Filter ist
        const filteredCats = cats.filter(c => c !== 'Alle');
        setCategories(filteredCats);
        
        // Setze erste Kategorie als Standard
        if (filteredCats.length > 0) {
          setCategory(filteredCats[0]);
        }
      } catch (err) {
        console.error('Failed to load categories:', err);
        setCategories([]);
      }
    };

    // Load slots availability
    const loadSlotsAvailability = async () => {
      try {
        const slotsData = await slotsService.getSlots();
        const hasActiveSlots = slotsData.slots && slotsData.slots.some(s => s.enabled);
        setHasSlots(hasActiveSlots);
        
        // Set default to slot if slots are available
        if (hasActiveSlots) {
          setPublishOption('slot');
        }
      } catch (err) {
        console.error('Error checking slots:', err);
        setHasSlots(false);
      }
    };

    // Set default scheduled date/time to tomorrow at 12:00
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0);
    setScheduledDate(tomorrow.toISOString().split('T')[0]);
    setScheduledTime('12:00');
    
    loadCategories();
    loadSlotsAvailability();
  }, [isOpen]);

  const handleSlotSelected = (datetime: string) => {
    const date = new Date(datetime);
    setScheduledDate(date.toISOString().split('T')[0]);
    setScheduledTime(date.toTimeString().slice(0, 5));
  };

  if (!isOpen) return null;

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        setError('Bitte wähle eine Video-Datei aus');
        return;
      }
      if (file.size > 500 * 1024 * 1024) { // 500MB limit
        setError('Video ist zu groß (max. 500MB)');
        return;
      }
      setVideoFile(file);
      setError('');
      
      // Auto-fill title from filename
      if (!title) {
        const name = file.name.replace(/\.[^/.]+$/, '');
        setTitle(name);
      }

      // Extract frames from local file first
      setExtractingFrames(true);
      setError('');
      try {
        console.log('Starting frame extraction for:', file.name);
        const frames = await extractFramesFromVideoFile(file, {
          percentages: [0.2, 0.4, 0.6, 0.8, 1.0], // 20%, 40%, 60%, 80%, 100%
          maxWidth: 1280,
          maxHeight: 720,
          quality: 0.85,
          timeout: 30000
        });
        setExtractedFrames(frames);
        console.log(`Successfully extracted ${frames.length} frames`);
      } catch (err: any) {
        console.error('Frame extraction failed:', err);
        setError(`Frame-Extraktion fehlgeschlagen: ${err.message}. Du kannst trotzdem ein manuelles Thumbnail hochladen.`);
        // Don't block upload if frame extraction fails
      } finally {
        setExtractingFrames(false);
      }

      // Upload video immediately after selection
      setUploading(true);
      setUploadProgress(0);
      try {
        console.log('Requesting upload URL for:', file.name, file.type);
        const uploadData = await videoService.generateUploadUrl(
          file.name,
          file.type,
          'video'
        );
        console.log('Got upload URL, key:', uploadData.key);
        
        await videoService.uploadToS3(uploadData.uploadUrl, file, (progress) => {
          setUploadProgress(progress * 100);
        });
        console.log('Video uploaded successfully to S3, key:', uploadData.key);
        
        setUploadedVideoKey(uploadData.key);
        setUploadProgress(100);
        setUploading(false);
      } catch (err: any) {
        console.error('Video upload failed:', err);
        console.error('Upload error details:', {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status
        });
        toast.error('Video-Upload fehlgeschlagen: ' + (err.message || 'Unbekannter Fehler'));
        setError('Video-Upload fehlgeschlagen: ' + (err.message || 'Bitte erneut versuchen'));
        setUploading(false);
        setVideoFile(null);
      }
    }
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Bitte wähle ein Bild aus');
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('Thumbnail ist zu groß (max. 5MB)');
        return;
      }
      // Open cropper instead of setting file directly
      const reader = new FileReader();
      reader.onloadend = () => {
        setCropperImage(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError('');
    }
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    const file = new File([croppedBlob], 'thumbnail.png', { type: 'image/png' });
    setThumbnailFile(file);
    setCropperImage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!videoFile || !uploadedVideoKey) {
      setError('Bitte wähle ein Video aus und warte bis es hochgeladen ist');
      return;
    }
    
    if (!title.trim()) {
      setError('Bitte gib einen Titel ein');
      return;
    }

    // Verify the video key looks valid
    if (!uploadedVideoKey.startsWith('tenants/') || !uploadedVideoKey.includes('/videos/')) {
      setError('Video-Upload fehlgeschlagen. Bitte lade das Video erneut hoch.');
      console.error('Invalid video key:', uploadedVideoKey);
      return;
    }

    setUploading(true);
    setError('');
    setUploadProgress(0);

    try {
      // 1. Upload thumbnail if provided (or use AI thumbnail, or use selected frame)
      let thumbnailKey: string | undefined = undefined;
      if (aiThumbnailUrl) {
        // Check if it's a data URL (AI generated thumbnail)
        if (aiThumbnailUrl.startsWith('data:')) {
          console.log('Uploading AI-generated thumbnail to S3...');
          setUploadProgress(20);
          
          // Convert data URL to blob
          const response = await fetch(aiThumbnailUrl);
          const blob = await response.blob();
          const file = new File([blob], `ai-thumbnail-${Date.now()}.png`, { type: 'image/png' });
          
          // Upload to S3
          const thumbnailData = await videoService.generateUploadUrl(
            file.name,
            file.type,
            'thumbnail'
          );
          await videoService.uploadToS3(thumbnailData.uploadUrl, file);
          thumbnailKey = thumbnailData.key;
          console.log('AI thumbnail uploaded to S3:', thumbnailKey);
        } else {
          // It's already an S3 URL (shouldn't happen with new flow, but keep for safety)
          const url = new URL(aiThumbnailUrl);
          thumbnailKey = url.pathname.substring(1); // Remove leading slash
        }
      } else if (thumbnailFile) {
        setUploadProgress(20);
        const thumbnailData = await videoService.generateUploadUrl(
          thumbnailFile.name,
          thumbnailFile.type,
          'thumbnail'
        );
        await videoService.uploadToS3(thumbnailData.uploadUrl, thumbnailFile);
        thumbnailKey = thumbnailData.key;
      } else if (extractedFrames.length > 0) {
        // Use selected frame as thumbnail
        console.log('Using selected frame as thumbnail...');
        setUploadProgress(20);
        
        const selectedFrame = extractedFrames[selectedFrameIndex] || extractedFrames[0];
        const file = new File([selectedFrame.blob], `frame-thumbnail-${Date.now()}.jpg`, { type: 'image/jpeg' });
        
        const thumbnailData = await videoService.generateUploadUrl(
          file.name,
          file.type,
          'thumbnail'
        );
        await videoService.uploadToS3(thumbnailData.uploadUrl, file);
        thumbnailKey = thumbnailData.key;
        console.log('Frame thumbnail uploaded to S3:', thumbnailKey);
      }

      setUploadProgress(50);

      // 2. Get video duration
      const duration = await videoService.getVideoDuration(videoFile);
      console.log('Video duration:', duration, 'seconds');

      setUploadProgress(70);

      // 3. Add video to tenant's video list
      const videoId = `video-${Date.now()}`;
      console.log('Adding video to database:', { videoId, s3Key: uploadedVideoKey, title: title.trim() });
      
      // Determine status and scheduledAt
      const isScheduling = publishOption === 'slot' || publishOption === 'schedule';
      const scheduledAt = isScheduling && scheduledDate && scheduledTime 
        ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString() 
        : undefined;
      const status = isScheduling && scheduledAt ? 'scheduled' : 'published';
      
      await videoService.addVideo({
        videoId,
        title: title.trim(),
        description: description.trim(),
        category,
        s3Key: uploadedVideoKey, // Use already uploaded video key
        thumbnailKey: thumbnailKey || null,
        duration,
        fileSize: videoFile.size,
        status,
        uploadedBy: 'admin',
        isExclusive,
        guests: guests.length > 0 ? guests : undefined,
        scheduledAt
      });
      
      console.log('Video added to database successfully');

      setUploadProgress(90);

      // 4. Create newsfeed post if checkbox is checked (only if not scheduled)
      if (publishToNewsfeed && publishOption === 'now') {
        try {
          await newsfeedService.createPost({
            title: `🎬 Neues Video: ${title.trim()}`,
            description: description.trim() || `Schau dir unser neues Video "${title.trim()}" an!`,
            imageKey: thumbnailKey,
            externalLink: `/videos?v=${videoId}`,
            status: 'published'
          });
          console.log('Newsfeed post created for video');
        } catch (newsfeedError) {
          console.error('Failed to create newsfeed post:', newsfeedError);
          // Don't fail the whole upload if newsfeed post fails
        }
      }

      setUploadProgress(100);
      
      toast.success('Video erfolgreich hochgeladen!');
      
      // Invalidate cache before calling onSuccess
      prefetchService.invalidate('videos');
      
      // Success! Call onSuccess and close directly without cleanup
      // Don't use handleClose() as it might delete the video due to stale closure
      setTimeout(() => {
        onSuccess();
        // Reset state directly without deletion
        setVideoFile(null);
        setUploadedVideoKey(null);
        setExtractedFrames([]);
        setThumbnailFile(null);
        setAiThumbnailUrl(null);
        setTitle('');
        setDescription('');
        setCategory('');
        setPublishToNewsfeed(true);
        setIsExclusive(false);
        setPublishOption('now');
        setScheduledDate('');
        setScheduledTime('');
        setGuests([]);
        setUploadProgress(0);
        setError('');
        setUploading(false);
        onClose();
      }, 500);

    } catch (err: any) {
      console.error('Publish error:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        stack: err.stack
      });
      
      toast.error('Fehler beim Hochladen des Videos');
      
      let errorMessage = 'Veröffentlichung fehlgeschlagen';
      
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.response?.status === 403) {
        errorMessage = 'Keine Admin-Berechtigung. Bitte als Admin einloggen.';
      } else if (err.response?.status === 401) {
        errorMessage = 'Nicht authentifiziert. Bitte neu einloggen.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setUploading(false);
    }
  };

  const handleClose = async () => {
    // Clean up frame URLs to prevent memory leaks
    if (extractedFrames.length > 0) {
      cleanupFrameUrls(extractedFrames);
    }
    
    // Delete uploaded video if user cancels before publishing
    // Only delete if there's an uploadedVideoKey (means video wasn't published yet)
    if (uploadedVideoKey && !uploading) {
      try {
        await videoService.deleteAsset(uploadedVideoKey);
        console.log('Deleted unpublished video:', uploadedVideoKey);
      } catch (err) {
        console.error('Failed to delete video:', err);
        // Don't block closing if deletion fails
      }
    }
    
    // Reset state
    setVideoFile(null);
    setUploadedVideoKey(null);
    setExtractedFrames([]);
    setThumbnailFile(null);
    setAiThumbnailUrl(null);
    setTitle('');
    setDescription('');
    setCategory('');
    setPublishToNewsfeed(true);
    setIsExclusive(false);
    setPublishOption('now');
    setScheduledDate('');
    setScheduledTime('');
    setGuests([]);
    setUploadProgress(0);
    setError('');
    setUploading(false);
    onClose();
  };

  const addGuest = () => {
    setGuests([...guests, { id: crypto.randomUUID(), name: '', links: [''] }]);
  };

  const removeGuest = (guestId: string) => {
    setGuests(guests.filter(g => g.id !== guestId));
  };

  const updateGuest = (guestId: string, field: keyof VideoGuest, value: any) => {
    setGuests(guests.map(g => g.id === guestId ? { ...g, [field]: value } : g));
  };

  const addGuestLink = (guestId: string) => {
    setGuests(guests.map(g => {
      if (g.id === guestId && (g.links?.length || 0) < 7) {
        return { ...g, links: [...(g.links || []), ''] };
      }
      return g;
    }));
  };

  const updateGuestLink = (guestId: string, linkIndex: number, value: string) => {
    setGuests(guests.map(g => {
      if (g.id === guestId) {
        const newLinks = [...(g.links || [])];
        newLinks[linkIndex] = value;
        return { ...g, links: newLinks };
      }
      return g;
    }));
  };

  const removeGuestLink = (guestId: string, linkIndex: number) => {
    setGuests(guests.map(g => {
      if (g.id === guestId) {
        const newLinks = (g.links || []).filter((_, i) => i !== linkIndex);
        return { ...g, links: newLinks };
      }
      return g;
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4">
      {/* Image Cropper Modal */}
      {cropperImage && (
        <ImageCropper
          image={cropperImage}
          onCropComplete={handleCropComplete}
          onCancel={() => setCropperImage(null)}
          aspectRatio={16 / 9}
          cropShape="rect"
          title="Thumbnail zuschneiden (16:9)"
          preserveFormat={true}
          optimizeForCrossposting={false}
        />
      )}
      
      <div className="bg-dark-900 rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col border border-dark-800">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-800">
          <h2 className="text-2xl font-bold">Video hochladen</h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          {/* Scrollable Content */}
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Video Upload */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Video <span className="text-red-500">*</span>
            </label>
            <div className="border-2 border-dashed border-dark-700 rounded-lg p-8 text-center hover:border-primary-600 transition-colors">
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoChange}
                disabled={uploading}
                className="hidden"
                id="video-upload"
              />
              <label
                htmlFor="video-upload"
                className="cursor-pointer flex flex-col items-center gap-3"
              >
                <Film className="w-12 h-12 text-dark-400" />
                {videoFile ? (
                  <div>
                    <p className="font-medium text-primary-400">{videoFile.name}</p>
                    <p className="text-sm text-dark-400">
                      {(videoFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    {uploadedVideoKey && (
                      <p className="text-xs text-green-400 mt-1">✓ Hochgeladen</p>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="font-medium">Video auswählen oder hierher ziehen</p>
                    <p className="text-sm text-dark-400">Max. 500MB - wird automatisch hochgeladen</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Thumbnail Upload */}
          <div>
            <label className="block text-sm font-medium mb-2">Thumbnail (optional)</label>
            <div className="border-2 border-dashed border-dark-700 rounded-lg p-6 text-center hover:border-primary-600 transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={handleThumbnailChange}
                disabled={uploading}
                className="hidden"
                id="thumbnail-upload"
              />
              <label
                htmlFor="thumbnail-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <ImageIcon className="w-8 h-8 text-dark-400" />
                {thumbnailFile ? (
                  <p className="text-sm text-primary-400">{thumbnailFile.name}</p>
                ) : aiThumbnailUrl ? (
                  <p className="text-sm text-green-400">✓ AI Thumbnail generiert</p>
                ) : (
                  <p className="text-sm text-dark-400">Thumbnail hochladen (max. 5MB)</p>
                )}
              </label>
            </div>
          </div>

          {extractingFrames && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-300">Extrahiere Video-Frames...</p>
                  <p className="text-xs text-blue-400">Frames werden bei 20%, 40%, 60%, 80% und 100% der Videolänge extrahiert</p>
                  <div className="mt-2 w-full bg-blue-900/30 rounded-full h-1.5">
                    <div className="bg-blue-400 h-1.5 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {extractedFrames.length > 0 && !extractingFrames && !thumbnailFile && !aiThumbnailUrl && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium">Thumbnail aus Video-Frame wählen</label>
                <span className="text-xs text-dark-400">Frame {selectedFrameIndex + 1} von {extractedFrames.length}</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {extractedFrames.map((frame, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setSelectedFrameIndex(index)}
                    className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                      selectedFrameIndex === index 
                        ? 'border-primary-500 ring-2 ring-primary-500/50' 
                        : 'border-dark-600 hover:border-dark-500'
                    }`}
                  >
                    <img 
                      src={frame.url} 
                      alt={`Frame ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {selectedFrameIndex === index && (
                      <div className="absolute inset-0 bg-primary-500/20 flex items-center justify-center">
                        <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-xs text-dark-400">
                Dieser Frame wird als Thumbnail verwendet, wenn du kein eigenes hochlädst oder AI generierst.
              </p>
            </div>
          )}

          {extractedFrames.length > 0 && !extractingFrames && (thumbnailFile || aiThumbnailUrl) && (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-sm text-green-300">
                  {thumbnailFile ? 'Eigenes Thumbnail hochgeladen' : 'AI Thumbnail generiert'} - {extractedFrames.length} Frames verfügbar
                </p>
              </div>
            </div>
          )}

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
              placeholder="Mein Gaming Video"
              className="input w-full disabled:opacity-50"
              maxLength={100}
            />
          </div>

          {/* AI Thumbnail Generator */}
          {videoFile && uploadedVideoKey && extractedFrames.length > 0 && !extractingFrames && (
            <AIThumbnailGenerator
              videoKey={uploadedVideoKey}
              videoTitle={title}
              tenantId={tenantId}
              preExtractedFrames={extractedFrames}
              onThumbnailGenerated={(url) => {
                setAiThumbnailUrl(url);
                setThumbnailFile(null); // Clear manual thumbnail if AI is used
              }}
            />
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">Beschreibung</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={uploading}
              placeholder="Beschreibe dein Video..."
              rows={6}
              className="input w-full disabled:opacity-50 resize-none"
              maxLength={5000}
            />
            <p className="text-xs text-dark-400 mt-1">{description.length}/5000 Zeichen</p>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium mb-2">Kategorie</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={uploading}
              className="input w-full disabled:opacity-50"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Guests */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4" />
                Gäste
              </label>
              <button
                type="button"
                onClick={addGuest}
                disabled={uploading}
                className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Gast hinzufügen
              </button>
            </div>
            
            {guests.length > 0 && (
              <div className="space-y-4">
                {guests.map((guest, guestIndex) => (
                  <div key={guest.id} className="p-4 bg-dark-800 rounded-lg border border-dark-700">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={guest.name}
                          onChange={(e) => updateGuest(guest.id, 'name', e.target.value)}
                          placeholder={`Gast ${guestIndex + 1} Name`}
                          disabled={uploading}
                          className="input w-full text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeGuest(guest.id)}
                        disabled={uploading}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-xs text-dark-400">Social Media Links (max. 7)</p>
                      {guest.links?.map((link, linkIndex) => (
                        <div key={linkIndex} className="flex gap-2">
                          <input
                            type="url"
                            value={link}
                            onChange={(e) => updateGuestLink(guest.id, linkIndex, e.target.value)}
                            placeholder="https://twitter.com/..."
                            disabled={uploading}
                            className="input flex-1 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => removeGuestLink(guest.id, linkIndex)}
                            disabled={uploading}
                            className="p-2 text-dark-400 hover:text-red-400"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {(guest.links?.length || 0) < 7 && (
                        <button
                          type="button"
                          onClick={() => addGuestLink(guest.id)}
                          disabled={uploading}
                          className="text-xs text-primary-400 hover:text-primary-300"
                        >
                          + Link hinzufügen
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Checkboxes Row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Publish to Newsfeed */}
            <div 
              onClick={() => !uploading && setPublishToNewsfeed(!publishToNewsfeed)}
              className="flex items-center justify-between p-3 bg-dark-800 rounded-lg border border-dark-700 cursor-pointer hover:bg-dark-700/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Newspaper className="w-4 h-4 text-primary-500" />
                <div>
                  <p className="text-sm font-medium">Im Newsfeed veröffentlichen</p>
                  <p className="text-xs text-dark-400">Erstellt automatisch einen Post</p>
                </div>
              </div>
              <div
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                  publishToNewsfeed ? 'bg-primary-600' : 'bg-dark-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    publishToNewsfeed ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </div>
            </div>

            {/* Exclusive Content */}
            <div 
              onClick={() => !uploading && setIsExclusive(!isExclusive)}
              className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                isExclusive 
                  ? 'bg-yellow-500/10 border-yellow-500/30 hover:bg-yellow-500/15' 
                  : 'bg-dark-800 border-dark-700 hover:bg-dark-700/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <Lock className={`w-4 h-4 ${isExclusive ? 'text-yellow-500' : 'text-dark-400'}`} />
                <div>
                  <p className={`text-sm font-medium ${isExclusive ? 'text-yellow-400' : ''}`}>Exklusiver Inhalt</p>
                  <p className="text-xs text-dark-400">Nur für Mitglieder</p>
                </div>
              </div>
              <div
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                  isExclusive ? 'bg-yellow-500' : 'bg-dark-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isExclusive ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </div>
            </div>
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
                  📅 Video wird veröffentlicht am {scheduledDate && scheduledTime ? new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString('de-DE', { 
                    day: '2-digit', 
                    month: 'long', 
                    year: 'numeric', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  }) : '...'} Uhr
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 text-red-500">
              {error}
            </div>
          )}

          {/* Progress */}
          {uploading && (
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>{uploadedVideoKey ? 'Veröffentliche...' : 'Video wird hochgeladen...'}</span>
                <span>{uploadProgress.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-dark-800 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
          </div>

          {/* Fixed Footer with Buttons */}
          <div className="p-6 border-t border-dark-800 flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="btn-secondary flex-1"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={uploading || !uploadedVideoKey || !title.trim()}
              className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Upload className="w-5 h-5" />
              {uploading && !uploadedVideoKey ? 'Video wird hochgeladen...' : uploading ? 'Wird veröffentlicht...' : 'Veröffentlichen'}
            </button>
          </div>
        </form>
      </div>

      {/* Slot Manager Modal */}
      {showSlotManager && (
        <SlotManagerModal
          isOpen={showSlotManager}
          onClose={() => setShowSlotManager(false)}
          onSlotsUpdated={() => {
            // Reload slots availability
            slotsService.getSlots().then(slotsData => {
              const hasActiveSlots = slotsData.slots && slotsData.slots.some(s => s.enabled);
              setHasSlots(hasActiveSlots);
            });
            setShowSlotManager(false);
          }}
        />
      )}
    </div>
  );
}
