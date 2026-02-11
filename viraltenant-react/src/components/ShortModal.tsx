import { useState, useEffect, useRef } from 'react';
import { X, Upload, Video, Smartphone, Hash, Settings, Music2, CheckCircle, AlertCircle, Eye, Ban } from 'lucide-react';
import { newsfeedService, CreatePostData } from '../services/newsfeed.service';
import { slotsService } from '../services/slots.service';
import { crosspostService, TikTokSettings } from '../services/crosspost.service';
import { toast } from '../utils/toast-alert';
import { useTenant } from '../providers/TenantProvider';
import { useAuthStore } from '../store/authStore';
import { extractFramesFromVideoFile, ExtractedFrame, cleanupFrameUrls } from '../utils/videoFrameExtractor';
import { ShortThumbnailGenerator } from './ShortThumbnailGenerator';
import { SlotSelector } from './SlotSelector';
import { SlotManagerModal } from './SlotManagerModal';
import { prefetchService } from '../services/prefetch.service';

interface ShortModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DEFAULT_MAX_DURATION = 90; // Default 90 seconds for cross-platform compatibility

export function ShortModal({ isOpen, onClose, onSuccess }: ShortModalProps) {
  const { tenantId } = useTenant();
  const { accessToken } = useAuthStore();
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string>('');
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [videoAspectRatio, setVideoAspectRatio] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [extractedFrames, setExtractedFrames] = useState<ExtractedFrame[]>([]);
  const [extractingFrames, setExtractingFrames] = useState(false);
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState<string | null>(null);
  const [publishOption, setPublishOption] = useState<'now' | 'slot' | 'schedule'>('now');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [hasSlots, setHasSlots] = useState(false);
  const [showSlotManager, setShowSlotManager] = useState(false);
  const [enabledChannels, setEnabledChannels] = useState<{ id: string; name: string; displayName: string }[]>([]);
  // AUSKOMMENTIERT FÜR TESTS - showTikTokSettings wird nicht mehr verwendet
  // const [showTikTokSettings, setShowTikTokSettings] = useState(false);
  const [tiktokSettings, setTiktokSettings] = useState<TikTokSettings | null>(null);
  const [tiktokPrivacy, setTiktokPrivacy] = useState<'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY' | ''>('');
  const [tiktokAllowComment, setTiktokAllowComment] = useState(false);
  const [tiktokAllowDuet, setTiktokAllowDuet] = useState(false);
  const [tiktokAllowStitch, setTiktokAllowStitch] = useState(false);
  const [tiktokCommercialContent, setTiktokCommercialContent] = useState(false);
  const [tiktokBrandOrganic, setTiktokBrandOrganic] = useState(false);
  const [tiktokBrandedContent, setTiktokBrandedContent] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  // AUSKOMMENTIERT FÜR TESTS - consentGiven wird nicht mehr verwendet
  // const [consentGiven, setConsentGiven] = useState(true);
  const [tiktokPostingBlocked, setTiktokPostingBlocked] = useState(false);
  const [tiktokBlockedMessage, setTiktokBlockedMessage] = useState('');
  const [maxVideoDuration, setMaxVideoDuration] = useState(DEFAULT_MAX_DURATION);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!isOpen) {
      if (extractedFrames.length > 0) {
        cleanupFrameUrls(extractedFrames);
      }
      setVideoFile(null);
      setVideoPreview('');
      setVideoDuration(0);
      setVideoAspectRatio('');
      setTitle('');
      setDescription('');
      setTags([]);
      setTagInput('');
      setError('');
      setExtractedFrames([]);
      setExtractingFrames(false);
      setThumbnailDataUrl(null);
      setUploadProgress(0);
      setPublishOption('now');
      // AUSKOMMENTIERT FÜR TESTS
      // setShowTikTokSettings(false);
      setTiktokSettings(null);
      setShowPreview(false);
      // AUSKOMMENTIERT FÜR TESTS
      // setConsentGiven(false);
      setTiktokPostingBlocked(false);
      setTiktokBlockedMessage('');
      setMaxVideoDuration(DEFAULT_MAX_DURATION);
    } else {
      // Set default to tomorrow at 12:00
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(12, 0, 0, 0);
      setScheduledDate(tomorrow.toISOString().split('T')[0]);
      setScheduledTime('12:00');
      
      // Check if slots are available - reload every time modal opens
      if (isOpen) {
        loadSlotsAvailability();
        loadEnabledChannels();
        loadTikTokSettings();
      }
    }
  }, [isOpen]);

  const loadEnabledChannels = async () => {
    if (!accessToken) return;
    try {
      const channels = await crosspostService.getEnabledVideoChannels(accessToken);
      setEnabledChannels(channels);
    } catch (err) {
      console.error('Error loading enabled channels:', err);
    }
  };

  const loadTikTokSettings = async () => {
    if (!accessToken) return;
    try {
      const settings = await crosspostService.getTikTokSettings(accessToken);
      if (settings && settings.enabled) {
        setTiktokSettings(settings);
        // Privacy: TEMPORÄR auf PUBLIC_TO_EVERYONE gesetzt für Tests (ursprünglich: '')
        setTiktokPrivacy('PUBLIC_TO_EVERYONE');
        // Interactions: All unchecked by default - user must manually enable
        setTiktokAllowComment(false);
        setTiktokAllowDuet(false);
        setTiktokAllowStitch(false);
        // Commercial content: Always disabled by default per TikTok API compliance
        setTiktokCommercialContent(false);
        setTiktokBrandOrganic(false);
        setTiktokBrandedContent(false);
        
        // Set max video duration from creator_info API (or use default)
        if (settings.maxVideoDuration && settings.maxVideoDuration > 0) {
          setMaxVideoDuration(settings.maxVideoDuration);
        } else {
          setMaxVideoDuration(DEFAULT_MAX_DURATION);
        }
        
        // Check if creator can post videos right now
        if (settings.canPostVideo === false) {
          setTiktokPostingBlocked(true);
          setTiktokBlockedMessage(settings.postingLimitMessage || 'Du hast das tägliche Posting-Limit für TikTok erreicht. Bitte versuche es später erneut.');
        } else {
          setTiktokPostingBlocked(false);
          setTiktokBlockedMessage('');
        }
      }
    } catch (err) {
      console.error('Error loading TikTok settings:', err);
    }
  };

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
        setError('Bitte wähle ein Video aus');
        return;
      }
      if (file.size > 100 * 1024 * 1024) {
        setError('Video ist zu groß (max. 100MB)');
        return;
      }
      
      setError('');
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoPreview(url);
      
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        const duration = video.duration;
        const width = video.videoWidth;
        const height = video.videoHeight;
        
        setVideoDuration(duration);
        
        const ratio = height / width;
        if (ratio >= 1.5) {
          setVideoAspectRatio('vertical');
        } else if (ratio >= 0.9 && ratio < 1.5) {
          setVideoAspectRatio('square');
        } else {
          setVideoAspectRatio('horizontal');
          setError('⚠️ Shorts sollten hochkant (9:16) sein.');
        }
        
        // Check against TikTok's max_video_post_duration_sec from creator_info API
        if (duration > maxVideoDuration) {
          setError(`⚠️ Video ist zu lang für TikTok. Maximale Dauer: ${maxVideoDuration} Sekunden. Dein Video: ${Math.round(duration)} Sekunden.`);
        }
      };
      video.src = url;
      
      setExtractingFrames(true);
      try {
        const frames = await extractFramesFromVideoFile(file, {
          percentages: [0.1, 0.3, 0.5, 0.7, 0.9],
          maxWidth: 1080,
          maxHeight: 1920,
          quality: 0.9
        });
        setExtractedFrames(frames);
      } catch (err: any) {
        console.error('Frame extraction failed:', err);
      } finally {
        setExtractingFrames(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!videoFile) {
      setError('Bitte wähle ein Video aus');
      return;
    }
    
    if (!title.trim()) {
      setError('Bitte gib einen Titel ein');
      return;
    }

    setUploading(true);
    setError('');
    setUploadProgress(0);

    try {
      const postData: CreatePostData = {
        title: title.trim(),
        description: description.trim(),
        isShort: true,
        tags: tags.length > 0 ? tags : undefined,
        status: (publishOption === 'schedule' || publishOption === 'slot') ? 'scheduled' : 'published',
        scheduledAt: (publishOption === 'schedule' || publishOption === 'slot') 
          ? new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString() 
          : undefined,
        // Include TikTok settings if TikTok is enabled
        tiktokSettings: tiktokSettings?.enabled ? {
          privacy: tiktokPrivacy,
          allowComment: tiktokAllowComment,
          allowDuet: tiktokAllowDuet,
          allowStitch: tiktokAllowStitch,
          commercialContentEnabled: tiktokCommercialContent,
          brandOrganic: tiktokBrandOrganic,
          brandedContent: tiktokBrandedContent
        } : undefined
      };

      let thumbnailFile: File | undefined;
      if (thumbnailDataUrl) {
        const response = await fetch(thumbnailDataUrl);
        const blob = await response.blob();
        thumbnailFile = new File([blob], 'thumbnail.png', { type: 'image/png' });
      }

      await newsfeedService.createPost(postData, undefined, videoFile, (progress) => {
        setUploadProgress(progress);
      }, thumbnailFile);
      
      // Show appropriate success message based on TikTok status
      if (tiktokSettings?.enabled) {
        toast.success('Short erfolgreich hochgeladen! 🎬 Die Verarbeitung auf TikTok kann einige Minuten dauern.');
      } else {
        toast.success('Short erfolgreich veröffentlicht! 🎬');
      }
      
      // Invalidate cache before calling onSuccess
      prefetchService.invalidate('newsfeed');
      
      setUploading(false);
      
      // Close modal first, then refresh data
      onClose();
      
      // Call onSuccess after modal is closed to ensure data refresh
      setTimeout(() => {
        onSuccess();
      }, 100);
    } catch (err: any) {
      console.error('Failed to create short:', err);
      setError(err.message || 'Fehler beim Erstellen des Shorts');
      toast.error('Fehler beim Erstellen');
    } finally {
      setUploading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRemoveVideo = () => {
    if (extractedFrames.length > 0) {
      cleanupFrameUrls(extractedFrames);
    }
    setVideoFile(null);
    setVideoPreview('');
    setVideoDuration(0);
    setVideoAspectRatio('');
    setExtractedFrames([]);
    setThumbnailDataUrl(null);
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-dark-900 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden border border-dark-700 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl">
              <Smartphone size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Short erstellen</h2>
              <p className="text-sm text-dark-400">
                Hochkant-Video (9:16) • Max. {maxVideoDuration}s
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-dark-800 rounded-lg transition-colors" style={{ color: 'rgb(var(--color-text-secondary))' }}>
            <X size={24} />
          </button>
        </div>

        {/* TikTok Posting Blocked Warning */}
        {tiktokSettings?.enabled && tiktokPostingBlocked && (
          <div className="px-4 py-4 bg-red-500/10 border-b border-red-500/30">
            <div className="flex items-start gap-3">
              <Ban size={24} className="text-red-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-400">TikTok Posting nicht möglich</p>
                <p className="text-xs text-dark-300 mt-1">{tiktokBlockedMessage}</p>
                <p className="text-xs text-dark-400 mt-2">Du kannst das Video trotzdem für andere Plattformen hochladen oder es später erneut versuchen.</p>
              </div>
            </div>
          </div>
        )}

        {/* Active Platforms Section - 4 Column Grid */}
        {enabledChannels.length > 0 && (
          <div className="px-4 py-3 bg-dark-800/50 border-b border-dark-700">
            <p className="text-xs text-dark-400 mb-2">Wird veröffentlicht auf:</p>
            <div className="grid grid-cols-4 gap-3">
              {enabledChannels.map(ch => (
                <div key={ch.id} className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                  <span className="text-dark-300">{ch.name}:</span>
                  <span className="font-medium text-white truncate">{ch.displayName}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content - Two Column Layout */}
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
                  placeholder="Gib deinem Short einen Titel"
                  className="input w-full"
                  maxLength={100}
                />
                <p className="text-xs text-dark-500 mt-1">{title.length}/100</p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-2">Beschreibung</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Beschreibe deinen Short... #hashtags"
                  className="input w-full h-32 resize-none"
                  maxLength={500}
                />
                <p className="text-xs text-dark-500 mt-1">{description.length}/500</p>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Hash size={16} className="text-pink-400" />
                  Tags
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map((tag, index) => (
                    <span
                      key={index}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-800/80 text-sm"
                    >
                      <span className="text-pink-400">#</span>
                      <span className="text-white">{tag}</span>
                      <button
                        type="button"
                        onClick={() => setTags(tags.filter((_, i) => i !== index))}
                        className="ml-1 p-0.5 hover:bg-dark-700 rounded transition-colors"
                      >
                        <X size={12} className="text-dark-400 hover:text-white" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Check if comma was typed
                      if (value.includes(',')) {
                        const tag = value.replace(',', '').replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '').trim();
                        if (tag && !tags.includes(tag) && tags.length < 5) {
                          setTags([...tags, tag]);
                        }
                        setTagInput('');
                      } else {
                        setTagInput(value.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, ''));
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && tagInput.trim()) {
                        e.preventDefault();
                        if (!tags.includes(tagInput.trim()) && tags.length < 5) {
                          setTags([...tags, tagInput.trim()]);
                          setTagInput('');
                        }
                      }
                    }}
                    placeholder="Tag eingeben, Enter oder Komma"
                    className="input flex-1"
                    maxLength={20}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (tagInput.trim() && !tags.includes(tagInput.trim()) && tags.length < 5) {
                        setTags([...tags, tagInput.trim()]);
                        setTagInput('');
                      }
                    }}
                    disabled={!tagInput.trim() || tags.length >= 5}
                    className="btn-secondary px-4 disabled:opacity-50"
                  >
                    +
                  </button>
                </div>
                <p className="text-xs text-dark-500 mt-1">{tags.length}/5 Tags</p>
              </div>

              {/* Frame Extraction Status */}
              {extractingFrames && (
                <div className="p-3 bg-primary-500/10 border border-primary-500/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
                    <span className="text-sm text-primary-400">Extrahiere Frames für AI Thumbnail...</span>
                  </div>
                </div>
              )}

              {/* AI Thumbnail Generator */}
              {videoFile && extractedFrames.length > 0 && !extractingFrames && (
                <ShortThumbnailGenerator
                  videoTitle={title}
                  tenantId={tenantId}
                  preExtractedFrames={extractedFrames}
                  onThumbnailGenerated={(url: string) => setThumbnailDataUrl(url)}
                />
              )}

              {/* TikTok Settings Section - AUSKOMMENTIERT FÜR TESTS */}
              {/*
              {tiktokSettings?.enabled && (
                <div className="border border-dark-700 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowTikTokSettings(!showTikTokSettings)}
                    className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-pink-500/10 to-cyan-500/10 hover:from-pink-500/20 hover:to-cyan-500/20 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Music2 size={20} className="text-pink-400" />
                      <span className="font-medium">TikTok Einstellungen</span>
                      {tiktokSettings.displayName && (
                        <span className="text-xs text-dark-400">@{tiktokSettings.displayName}</span>
                      )}
                    </div>
                    {showTikTokSettings ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                  
                  {showTikTokSettings && (
                    <div className="p-4 space-y-4 bg-dark-800/30">
                      AUSKOMMENTIERT FÜR TESTS - Sichtbarkeit, Interaktionen, Kommerzieller Inhalt
                      Privacy Setting - No default, user must select from dropdown
                      
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Sichtbarkeit <span className="text-red-400">*</span>
                        </label>
                        
                        <select
                          value={tiktokPrivacy}
                          onChange={(e) => {
                            const value = e.target.value as 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY' | '';
                            // Branded Content kann nicht privat sein
                            if (value === 'SELF_ONLY' && tiktokBrandedContent) {
                              toast.error('Branded Content kann nicht auf privat gesetzt werden');
                              return;
                            }
                            setTiktokPrivacy(value);
                          }}
                          className={`w-full p-3 rounded-lg bg-dark-800 border transition-colors ${
                            !tiktokPrivacy 
                              ? 'border-amber-500/50 text-dark-400' 
                              : 'border-dark-600 text-white'
                          }`}
                        >
                          <option value="" disabled>Bitte auswählen...</option>
                          {(!tiktokSettings.privacyLevelOptions || tiktokSettings.privacyLevelOptions.length === 0 || tiktokSettings.privacyLevelOptions.includes('PUBLIC_TO_EVERYONE')) && (
                            <option value="PUBLIC_TO_EVERYONE">Öffentlich - Jeder kann dein Video sehen</option>
                          )}
                          {(!tiktokSettings.privacyLevelOptions || tiktokSettings.privacyLevelOptions.length === 0 || tiktokSettings.privacyLevelOptions.includes('MUTUAL_FOLLOW_FRIENDS')) && (
                            <option value="MUTUAL_FOLLOW_FRIENDS">Freunde - Nur gegenseitige Follower</option>
                          )}
                          {(!tiktokSettings.privacyLevelOptions || tiktokSettings.privacyLevelOptions.length === 0 || tiktokSettings.privacyLevelOptions.includes('SELF_ONLY')) && (
                            <option value="SELF_ONLY" disabled={tiktokBrandedContent}>
                              Privat - Nur du {tiktokBrandedContent ? '(nicht verfügbar bei Branded Content)' : ''}
                            </option>
                          )}
                        </select>
                        
                        {!tiktokPrivacy && (
                          <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                            <AlertCircle size={12} />
                            Du musst eine Sichtbarkeitseinstellung auswählen
                          </p>
                        )}
                        
                        {tiktokSettings.privacyLevelOptions && tiktokSettings.privacyLevelOptions.length > 0 && (
                          <p className="text-xs text-green-400 mt-2 flex items-center gap-1">
                            <CheckCircle size={12} />
                            Optionen basierend auf deinem TikTok-Account
                          </p>
                        )}
                        
                        {tiktokBrandedContent && tiktokPrivacy && tiktokPrivacy !== 'SELF_ONLY' && (
                          <p className="text-xs text-cyan-400 mt-2 flex items-center gap-1">
                            <Info size={12} />
                            Branded Content ist nur mit öffentlicher oder Freunde-Sichtbarkeit verfügbar
                          </p>
                        )}
                      </div>
                      */}

                      {/* Interaction Settings - AUSKOMMENTIERT FÜR TESTS */}
                      {/*
                      <div className="space-y-2">
                        <label className="block text-sm font-medium mb-1">Interaktionen</label>
                        <p className="text-xs text-dark-400 mb-3">Aktiviere die gewünschten Interaktionen (standardmäßig deaktiviert)</p>
                        <div className="grid grid-cols-3 gap-2">
                          <label className={`flex items-center gap-2 p-3 rounded-lg transition-colors ${
                            tiktokSettings.commentDisabledByCreator 
                              ? 'opacity-50 cursor-not-allowed bg-dark-800' 
                              : tiktokAllowComment 
                                ? 'bg-green-500/20 border border-green-500/50 cursor-pointer'
                                : 'bg-dark-800 hover:bg-dark-700 cursor-pointer'
                          }`}>
                            <input
                              type="checkbox"
                              checked={tiktokAllowComment}
                              onChange={(e) => setTiktokAllowComment(e.target.checked)}
                              disabled={tiktokSettings.commentDisabledByCreator}
                              className="w-4 h-4 rounded accent-green-500"
                            />
                            <div>
                              <span className="text-xs font-medium">Kommentare</span>
                              {tiktokSettings.commentDisabledByCreator && (
                                <p className="text-xs text-amber-400">Deaktiviert</p>
                              )}
                            </div>
                          </label>
                          <label className={`flex items-center gap-2 p-3 rounded-lg transition-colors ${
                            tiktokSettings.duetDisabledByCreator 
                              ? 'opacity-50 cursor-not-allowed bg-dark-800' 
                              : tiktokAllowDuet 
                                ? 'bg-green-500/20 border border-green-500/50 cursor-pointer'
                                : 'bg-dark-800 hover:bg-dark-700 cursor-pointer'
                          }`}>
                            <input
                              type="checkbox"
                              checked={tiktokAllowDuet}
                              onChange={(e) => setTiktokAllowDuet(e.target.checked)}
                              disabled={tiktokSettings.duetDisabledByCreator}
                              className="w-4 h-4 rounded accent-green-500"
                            />
                            <div>
                              <span className="text-xs font-medium">Duett</span>
                              {tiktokSettings.duetDisabledByCreator && (
                                <p className="text-xs text-amber-400">Deaktiviert</p>
                              )}
                            </div>
                          </label>
                          <label className={`flex items-center gap-2 p-3 rounded-lg transition-colors ${
                            tiktokSettings.stitchDisabledByCreator 
                              ? 'opacity-50 cursor-not-allowed bg-dark-800' 
                              : tiktokAllowStitch 
                                ? 'bg-green-500/20 border border-green-500/50 cursor-pointer'
                                : 'bg-dark-800 hover:bg-dark-700 cursor-pointer'
                          }`}>
                            <input
                              type="checkbox"
                              checked={tiktokAllowStitch}
                              onChange={(e) => setTiktokAllowStitch(e.target.checked)}
                              disabled={tiktokSettings.stitchDisabledByCreator}
                              className="w-4 h-4 rounded accent-green-500"
                            />
                            <div>
                              <span className="text-xs font-medium">Stitch</span>
                              {tiktokSettings.stitchDisabledByCreator && (
                                <p className="text-xs text-amber-400">Deaktiviert</p>
                              )}
                            </div>
                          </label>
                        </div>
                        {(tiktokSettings.commentDisabledByCreator || tiktokSettings.duetDisabledByCreator || tiktokSettings.stitchDisabledByCreator) && (
                          <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                            <Info size={12} />
                            Einige Optionen sind in deinen TikTok-Einstellungen deaktiviert
                          </p>
                        )}
                      </div>
                      */}

                      {/* Commercial Content Disclosure - AUSKOMMENTIERT FÜR TESTS */}
                      {/*
                      <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer p-3 bg-dark-800 rounded-lg hover:bg-dark-700 transition-colors">
                          <input
                            type="checkbox"
                            checked={tiktokCommercialContent}
                            onChange={(e) => {
                              const enabled = e.target.checked;
                              setTiktokCommercialContent(enabled);
                              if (!enabled) {
                                setTiktokBrandOrganic(false);
                                setTiktokBrandedContent(false);
                              }
                            }}
                            className="w-5 h-5 rounded accent-pink-500"
                          />
                          <div>
                            <span className="text-sm font-medium">Kommerzieller Inhalt</span>
                            <p className="text-xs text-dark-400">Inhalt bewirbt dich, eine Marke, ein Produkt oder eine Dienstleistung</p>
                            <p className="text-xs text-dark-500 mt-1">Standardmäßig deaktiviert</p>
                          </div>
                        </label>

                        {tiktokCommercialContent && (
                          <div className="ml-4 space-y-3 p-3 bg-dark-800/50 rounded-lg border border-dark-700">
                            <p className="text-xs text-dark-400 mb-2">Wähle mindestens eine Option:</p>
                            
                            <label className="flex items-start gap-3 cursor-pointer p-3 bg-dark-800 rounded-lg hover:bg-dark-700 transition-colors">
                              <input
                                type="checkbox"
                                checked={tiktokBrandOrganic}
                                onChange={(e) => setTiktokBrandOrganic(e.target.checked)}
                                className="w-5 h-5 rounded accent-pink-500 mt-0.5"
                              />
                              <div className="flex-1">
                                <span className="text-sm font-medium">Deine Marke</span>
                                <p className="text-xs text-dark-400">Du bewirbst dich selbst oder dein eigenes Geschäft</p>
                                {tiktokBrandOrganic && !tiktokBrandedContent && (
                                  <div className="mt-2 p-2 bg-pink-500/10 border border-pink-500/30 rounded-lg">
                                    <p className="text-xs text-pink-400 flex items-center gap-1">
                                      <Info size={12} />
                                      Dein Video wird als "Werblicher Inhalt" gekennzeichnet
                                    </p>
                                  </div>
                                )}
                              </div>
                            </label>
                            
                            <label className="flex items-start gap-3 cursor-pointer p-3 bg-dark-800 rounded-lg hover:bg-dark-700 transition-colors">
                              <input
                                type="checkbox"
                                checked={tiktokBrandedContent}
                                onChange={(e) => {
                                  const branded = e.target.checked;
                                  setTiktokBrandedContent(branded);
                                  if (branded && tiktokPrivacy === 'SELF_ONLY') {
                                    setTiktokPrivacy('PUBLIC_TO_EVERYONE');
                                    toast.info('Sichtbarkeit auf "Öffentlich" geändert - Branded Content kann nicht privat sein');
                                  }
                                }}
                                className="w-5 h-5 rounded accent-cyan-500 mt-0.5"
                              />
                              <div className="flex-1">
                                <span className="text-sm font-medium">Branded Content</span>
                                <p className="text-xs text-dark-400">Du bewirbst eine andere Marke oder einen Dritten</p>
                                {tiktokBrandedContent && (
                                  <div className="mt-2 p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                                    <p className="text-xs text-cyan-400 flex items-center gap-1">
                                      <Info size={12} />
                                      Dein Video wird als "Bezahlte Partnerschaft" gekennzeichnet
                                    </p>
                                  </div>
                                )}
                              </div>
                            </label>

                            {tiktokCommercialContent && !tiktokBrandOrganic && !tiktokBrandedContent && (
                              <div className="relative group">
                                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                                  <p className="text-xs text-amber-400 flex items-center gap-2">
                                    <AlertCircle size={14} />
                                    Bitte wähle mindestens eine Option aus, um fortzufahren
                                  </p>
                                </div>
                                <div className="absolute left-0 right-0 -bottom-1 translate-y-full opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                                  <div className="bg-dark-900 border border-amber-500/50 text-amber-400 text-xs p-2 rounded-lg shadow-lg">
                                    Du musst angeben, ob dein Inhalt dich selbst, einen Dritten oder beides bewirbt.
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      */}

                      {/* Compliance Declaration - AUSKOMMENTIERT FÜR TESTS */}
                      {/*
                      {tiktokCommercialContent && (tiktokBrandOrganic || tiktokBrandedContent) && (
                        <div className="p-3 bg-dark-800 rounded-lg border border-dark-600">
                          <div className="flex items-start gap-2">
                            <Info size={16} className="text-cyan-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-dark-300">
                              {tiktokBrandedContent ? (
                                <>
                                  Mit dem Posten stimmst du der{' '}
                                  <a href="https://www.tiktok.com/legal/page/global/bc-policy/en" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300">
                                    TikTok Branded Content Policy
                                  </a>
                                  {' '}und der{' '}
                                  <a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300">
                                    Music Usage Confirmation
                                  </a>
                                  {' '}zu.
                                </>
                              ) : (
                                <>
                                  Mit dem Posten stimmst du der{' '}
                                  <a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300">
                                    TikTok Music Usage Confirmation
                                  </a>
                                  {' '}zu.
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                      )}
                      
                    </div>
                  )}
                </div>
              )}
              */}

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
                    key={`slot-short-${isOpen}`}
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
                      📅 Short wird veröffentlicht am {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString('de-DE', { 
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

              {/* Error */}
              {error && (
                <div className={`p-3 rounded-lg text-sm ${error.startsWith('⚠️') ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>
                  {error}
                </div>
              )}

              {/* Upload Progress */}
              {uploading && uploadProgress > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-400">Upload-Fortschritt</span>
                    <span className="text-primary-400">{uploadProgress}%</span>
                  </div>
                  <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-pink-500 to-purple-600 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* TikTok Processing Time Notice - VERSCHOBEN nach unten in die Info Box */}
              {/*
              {tiktokSettings?.enabled && (
                <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Clock size={16} className="text-cyan-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-dark-300">
                      Nach dem Veröffentlichen kann es einige Minuten dauern, bis dein Video auf TikTok verarbeitet und in deinem Profil sichtbar ist.
                    </p>
                  </div>
                </div>
              )}
              */}

              {/* TikTok Music Usage Confirmation Declaration - AUSKOMMENTIERT FÜR TESTS */}
              {/*
              {tiktokSettings?.enabled && videoFile && (
                <div className="p-4 bg-gradient-to-r from-pink-500/10 to-cyan-500/10 border border-pink-500/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <Music2 size={20} className="text-pink-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-3 flex-1">
                      <p className="text-sm text-dark-200">
                        Mit dem Posten stimmst du der{' '}
                        <a 
                          href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-pink-400 underline hover:text-pink-300"
                        >
                          TikTok Music Usage Confirmation
                        </a>
                        {' '}zu.
                      </p>
                      
                      <label className="flex items-start gap-3 p-3 bg-dark-800/50 rounded-lg cursor-pointer border border-dark-700 hover:border-primary-500/50 transition-colors">
                        <input
                          type="checkbox"
                          checked={consentGiven}
                          onChange={(e) => setConsentGiven(e.target.checked)}
                          className="w-5 h-5 rounded accent-primary-500 mt-0.5 flex-shrink-0"
                        />
                        <div>
                          <span className="text-sm font-medium">Ich stimme zu und bestätige den Upload</span>
                          <p className="text-xs text-dark-400 mt-1">
                            Ich habe die Vorschau überprüft und stimme zu, dass dieses Video mit den oben angegebenen Einstellungen auf TikTok veröffentlicht wird.
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              )}
              */}

              {/* TikTok Info Box - AUSKOMMENTIERT FÜR TESTS */}
              {/*
              {tiktokSettings?.enabled && (
                <div className="p-4 bg-gradient-to-r from-pink-500/10 to-cyan-500/10 border border-pink-500/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <Music2 size={24} className="text-pink-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-white mb-2">Was wird auf TikTok veröffentlicht?</h4>
                      <ul className="text-sm text-dark-300 space-y-1">
                        <li className="flex items-center gap-2">
                          <span className="text-green-400">✓</span>
                          <span><strong>9:16 Videos</strong> → optimales Format für TikTok</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-green-400">✓</span>
                          <span><strong>1:1 Videos</strong> → werden unterstützt</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-yellow-400">⚠</span>
                          <span><strong>16:9 Videos</strong> → werden mit Letterboxing gepostet</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-red-400">✗</span>
                          <span><strong>Bilder/Text</strong> → werden NICHT gepostet (TikTok nur Videos)</span>
                        </li>
                      </ul>
                      <p className="text-xs text-dark-400 mt-2">
                        Nach dem Veröffentlichen kann es einige Minuten dauern, bis dein Video auf TikTok verarbeitet und sichtbar ist.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              */}

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary flex-1"
                  disabled={uploading}
                >
                  Abbrechen
                </button>
                {/* Preview Button */}
                {videoFile && !uploading && (
                  <button
                    type="button"
                    onClick={() => setShowPreview(true)}
                    className="btn-secondary flex items-center justify-center gap-2 px-4"
                  >
                    <Eye size={18} />
                    Vorschau
                  </button>
                )}
                {/* Submit Button with all validations */}
                <div className="relative group flex-1">
                  <button
                    type="submit"
                    className="btn-primary w-full flex items-center justify-center gap-2"
                    disabled={
                      uploading || 
                      !videoFile
                      // TikTok-spezifische Validierungen temporär deaktiviert
                      // (tiktokSettings?.enabled && !consentGiven) ||
                      // (tiktokSettings?.enabled && !tiktokPrivacy) ||
                      // (tiktokSettings?.enabled && tiktokCommercialContent && !tiktokBrandOrganic && !tiktokBrandedContent) ||
                      // (tiktokSettings?.enabled && tiktokPostingBlocked) ||
                      // (tiktokSettings?.enabled && videoDuration > maxVideoDuration)
                    }
                  >
                    {uploading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Hochladen...
                      </>
                    ) : (
                      <>
                        <Upload size={20} />
                        Veröffentlichen
                      </>
                    )}
                  </button>
                  {/* Tooltip for disabled states */}
                  {tiktokSettings?.enabled && tiktokPostingBlocked && (
                    <div className="absolute left-0 right-0 -top-1 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                      <div className="bg-dark-900 border border-red-500/50 text-red-400 text-xs p-2 rounded-lg shadow-lg text-center">
                        TikTok Posting ist derzeit nicht möglich. Bitte versuche es später erneut.
                      </div>
                    </div>
                  )}
                  {tiktokSettings?.enabled && !tiktokPostingBlocked && videoDuration > maxVideoDuration && (
                    <div className="absolute left-0 right-0 -top-1 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                      <div className="bg-dark-900 border border-red-500/50 text-red-400 text-xs p-2 rounded-lg shadow-lg text-center">
                        Video ist zu lang für TikTok (max. {maxVideoDuration}s)
                      </div>
                    </div>
                  )}
                  {/* AUSKOMMENTIERT FÜR TESTS - TikTok Privacy Warnung */}
                  {/*
                  {tiktokSettings?.enabled && !tiktokPostingBlocked && videoDuration <= maxVideoDuration && !tiktokPrivacy && (
                    <div className="absolute left-0 right-0 -top-1 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                      <div className="bg-dark-900 border border-amber-500/50 text-amber-400 text-xs p-2 rounded-lg shadow-lg text-center">
                        Bitte wähle eine Sichtbarkeitseinstellung für TikTok
                      </div>
                    </div>
                  )}
                  */}
                  {/* AUSKOMMENTIERT FÜR TESTS - TikTok Commercial Content Warnung */}
                  {/*
                  {tiktokSettings?.enabled && !tiktokPostingBlocked && videoDuration <= maxVideoDuration && tiktokPrivacy && tiktokCommercialContent && !tiktokBrandOrganic && !tiktokBrandedContent && (
                    <div className="absolute left-0 right-0 -top-1 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                      <div className="bg-dark-900 border border-amber-500/50 text-amber-400 text-xs p-2 rounded-lg shadow-lg text-center">
                        Du musst angeben, ob dein Inhalt dich selbst, einen Dritten oder beides bewirbt.
                      </div>
                    </div>
                  )}
                  */}
                </div>
              </div>

              {/* Validation Hints - TEILWEISE AUSKOMMENTIERT FÜR TESTS */}
              {tiktokSettings?.enabled && videoFile && (
                <div className="space-y-1">
                  {tiktokPostingBlocked && (
                    <p className="text-xs text-red-400 text-center">
                      ⚠️ TikTok Posting ist derzeit blockiert
                    </p>
                  )}
                  {!tiktokPostingBlocked && videoDuration > maxVideoDuration && (
                    <p className="text-xs text-red-400 text-center">
                      ⚠️ Video ist zu lang für TikTok (max. {maxVideoDuration}s, dein Video: {Math.round(videoDuration)}s)
                    </p>
                  )}
                  {/* AUSKOMMENTIERT FÜR TESTS - Privacy Warnung */}
                  {/*
                  {!tiktokPostingBlocked && videoDuration <= maxVideoDuration && !tiktokPrivacy && (
                    <p className="text-xs text-amber-400 text-center">
                      ⚠️ Bitte wähle eine Sichtbarkeitseinstellung für TikTok
                    </p>
                  )}
                  */}
                  {/* AUSKOMMENTIERT FÜR TESTS - Consent Warnung */}
                  {/*
                  {!tiktokPostingBlocked && videoDuration <= maxVideoDuration && !consentGiven && tiktokPrivacy && (
                    <p className="text-xs text-amber-400 text-center">
                      ⚠️ Bitte stimme der Music Usage Confirmation zu und bestätige den Upload
                    </p>
                  )}
                  */}
                  {/* AUSKOMMENTIERT FÜR TESTS - Commercial Content Warnung */}
                  {/*
                  {tiktokCommercialContent && !tiktokBrandOrganic && !tiktokBrandedContent && (
                    <p className="text-xs text-amber-400 text-center">
                      ⚠️ Bitte wähle bei kommerziellem Inhalt mindestens eine Option
                    </p>
                  )}
                  */}
                </div>
              )}
            </form>
          </div>

          {/* Right Column - Video Preview (9:16) */}
          <div className="w-80 flex-shrink-0 bg-theme-light flex flex-col items-center justify-center p-4">
            {videoPreview ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <video
                  ref={videoRef}
                  src={videoPreview}
                  controls
                  className="max-h-full w-auto rounded-xl"
                  style={{ aspectRatio: '9/16', maxWidth: '100%' }}
                />
                {/* Video Info Badges */}
                <div className="absolute top-2 right-2 flex flex-col gap-2">
                  {videoDuration > 0 && (
                    <span className={`px-2 py-1 rounded text-xs font-medium ${videoDuration <= maxVideoDuration ? 'bg-green-500/90' : 'bg-amber-500/90'}`}>
                      {formatDuration(videoDuration)}
                    </span>
                  )}
                  {videoAspectRatio && (
                    <span className={`px-2 py-1 rounded text-xs font-medium ${videoAspectRatio === 'vertical' ? 'bg-green-500/90' : 'bg-amber-500/90'}`}>
                      {videoAspectRatio === 'vertical' ? '9:16 ✓' : videoAspectRatio === 'square' ? '1:1' : '16:9'}
                    </span>
                  )}
                </div>
                {/* Remove Button */}
                <button
                  type="button"
                  onClick={handleRemoveVideo}
                  className="absolute top-2 left-2 p-1.5 bg-red-500/80 hover:bg-red-500 rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-full border-2 border-dashed border-dark-600 rounded-xl cursor-pointer hover:border-pink-500 transition-colors">
                <div className="p-6 bg-gradient-to-br from-pink-500/20 to-purple-600/20 rounded-full mb-4">
                  <Video size={48} className="text-pink-400" />
                </div>
                <span className="text-dark-300 font-medium text-lg">Video auswählen</span>
                <span className="text-dark-500 text-sm mt-2">Hochkant (9:16) empfohlen</span>
                <span className="text-dark-500 text-xs mt-1">Max. {maxVideoDuration}s • 100MB</span>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoChange}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>
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

      {/* Content Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          <div className="bg-dark-900 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden border border-dark-700">
            {/* Preview Header */}
            <div className="flex items-center justify-between p-4 border-b border-dark-700">
              <div className="flex items-center gap-3">
                <Eye size={24} className="text-primary-400" />
                <h3 className="text-xl font-bold">Vorschau vor Veröffentlichung</h3>
              </div>
              <button 
                onClick={() => setShowPreview(false)} 
                className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Preview Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Video Preview */}
                <div className="flex flex-col items-center">
                  <p className="text-sm text-dark-400 mb-3">Video-Vorschau</p>
                  {videoPreview && (
                    <video
                      src={videoPreview}
                      controls
                      className="rounded-xl max-h-[400px]"
                      style={{ aspectRatio: '9/16' }}
                    />
                  )}
                  <div className="flex gap-2 mt-3">
                    {videoDuration > 0 && (
                      <span className="px-2 py-1 rounded text-xs bg-dark-700">
                        {formatDuration(videoDuration)}
                      </span>
                    )}
                    {videoAspectRatio && (
                      <span className="px-2 py-1 rounded text-xs bg-dark-700">
                        {videoAspectRatio === 'vertical' ? '9:16' : videoAspectRatio === 'square' ? '1:1' : '16:9'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Content Details */}
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-dark-400 mb-1">Titel</p>
                    <p className="text-lg font-medium">{title || '(Kein Titel)'}</p>
                  </div>

                  <div>
                    <p className="text-xs text-dark-400 mb-1">Beschreibung</p>
                    <p className="text-sm text-dark-300 whitespace-pre-wrap">{description || '(Keine Beschreibung)'}</p>
                  </div>

                  {tags.length > 0 && (
                    <div>
                      <p className="text-xs text-dark-400 mb-2">Tags</p>
                      <div className="flex flex-wrap gap-2">
                        {tags.map((tag, i) => (
                          <span key={i} className="px-2 py-1 rounded bg-dark-700 text-sm">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Platforms - Exclude TikTok as it has its own section below */}
                  {enabledChannels.filter(ch => ch.name !== 'TikTok').length > 0 && (
                    <div>
                      <p className="text-xs text-dark-400 mb-2">Wird veröffentlicht auf</p>
                      <div className="space-y-2">
                        {enabledChannels.filter(ch => ch.name !== 'TikTok').map(ch => (
                          <div key={ch.id} className="flex items-center gap-2 text-sm p-2 bg-dark-800 rounded-lg">
                            <CheckCircle size={16} className="text-green-400" />
                            <span className="text-dark-300">{ch.name}:</span>
                            <span className="font-medium">{ch.displayName}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TikTok Settings Summary */}
                  {tiktokSettings?.enabled && (
                    <div className="p-4 bg-gradient-to-r from-pink-500/10 to-cyan-500/10 rounded-xl border border-pink-500/30">
                      <div className="flex items-center gap-2 mb-3">
                        <Music2 size={18} className="text-pink-400" />
                        <span className="font-medium">TikTok Einstellungen</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-dark-400">Sichtbarkeit:</span>
                          <span>{tiktokPrivacy === 'PUBLIC_TO_EVERYONE' ? 'Öffentlich' : tiktokPrivacy === 'MUTUAL_FOLLOW_FRIENDS' ? 'Freunde' : 'Privat'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-dark-400">Kommentare:</span>
                          <span>{tiktokAllowComment ? '✓ Erlaubt' : '✗ Deaktiviert'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-dark-400">Duett:</span>
                          <span>{tiktokAllowDuet ? '✓ Erlaubt' : '✗ Deaktiviert'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-dark-400">Stitch:</span>
                          <span>{tiktokAllowStitch ? '✓ Erlaubt' : '✗ Deaktiviert'}</span>
                        </div>
                        {tiktokCommercialContent && (
                          <>
                            <div className="border-t border-dark-600 pt-2 mt-2">
                              <span className="text-pink-400 text-xs font-medium">Kommerzieller Inhalt</span>
                            </div>
                            {tiktokBrandOrganic && (
                              <div className="flex items-center gap-2">
                                <CheckCircle size={14} className="text-pink-400" />
                                <span>Deine Marke</span>
                              </div>
                            )}
                            {tiktokBrandedContent && (
                              <div className="flex items-center gap-2">
                                <CheckCircle size={14} className="text-cyan-400" />
                                <span>Branded Content</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Processing Time Notice */}
                  {tiktokSettings?.enabled && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-dark-300">
                          Nach dem Veröffentlichen kann es einige Minuten dauern, bis dein Video auf TikTok verarbeitet und sichtbar ist. Du kannst den Status in deinem Newsfeed verfolgen.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Preview Footer */}
            <div className="flex justify-end gap-3 p-4 border-t border-dark-700">
              <button
                onClick={() => setShowPreview(false)}
                className="btn-secondary"
              >
                Zurück zum Bearbeiten
              </button>
              <button
                onClick={() => {
                  setShowPreview(false);
                  // AUSKOMMENTIERT FÜR TESTS
                  // setConsentGiven(true);
                }}
                className="btn-primary flex items-center gap-2"
              >
                <CheckCircle size={18} />
                Vorschau bestätigen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
