import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Sparkles, Loader2, Check, X, ZoomIn } from 'lucide-react';
import { awsConfig } from '../config/aws-config';
import { useAuthStore } from '../store/authStore';
import { ExtractedFrame } from '../utils/videoFrameExtractor';

interface VideoFrame {
  timestamp: number;
  dataUrl: string; // Base64 data URL for local display
}

interface GeneratedThumbnail {
  style: 'lustig' | 'reisserisch' | 'seriös';
  dataUrl: string; // Base64 data URL from Bedrock
}

interface AIThumbnailGeneratorProps {
  videoKey: string | null;
  videoTitle: string;
  tenantId: string;
  videoUrl?: string;
  preExtractedFrames?: ExtractedFrame[];
  isExtracting?: boolean;
  onExtractFrames?: () => void;
  onThumbnailGenerated: (thumbnailDataUrl: string) => void;
}

const API_BASE_URL = awsConfig.api.user;

export function AIThumbnailGenerator({ 
  videoTitle, 
  tenantId,
  videoUrl,
  preExtractedFrames,
  isExtracting = false,
  onExtractFrames,
  onThumbnailGenerated 
}: AIThumbnailGeneratorProps) {
  const { accessToken } = useAuthStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [frames, setFrames] = useState<VideoFrame[]>([]);
  const [selectedFrame, setSelectedFrame] = useState<VideoFrame | null>(null);
  const [generatingThumbnail, setGeneratingThumbnail] = useState(false);
  const [generatedThumbnails, setGeneratedThumbnails] = useState<GeneratedThumbnail[]>([]);
  const [selectedThumbnail, setSelectedThumbnail] = useState<GeneratedThumbnail | null>(null);
  const [previewThumbnail, setPreviewThumbnail] = useState<GeneratedThumbnail | null>(null);
  const [error, setError] = useState('');

  // Convert pre-extracted frames when they become available
  useEffect(() => {
    const convertFrames = async () => {
      if (preExtractedFrames && preExtractedFrames.length > 0 && frames.length === 0 && isExpanded) {
        console.log(`Converting ${preExtractedFrames.length} pre-extracted frames`);
        
        const localFrames: VideoFrame[] = [];
        
        for (const frame of preExtractedFrames) {
          try {
            const dataUrl = await blobToDataUrl(frame.blob);
            localFrames.push({
              timestamp: frame.timestamp,
              dataUrl
            });
          } catch (err) {
            console.error('Failed to convert frame:', err);
          }
        }
        
        setFrames(localFrames);
        
        // Auto-select middle frame
        if (localFrames.length > 0) {
          const middleIndex = Math.floor(localFrames.length / 2);
          setSelectedFrame(localFrames[middleIndex]);
        }
      }
    };
    
    convertFrames();
  }, [preExtractedFrames, isExpanded, frames.length]);

  // Convert pre-extracted frames to local format when component opens
  const handleToggle = async () => {
    const willExpand = !isExpanded;
    setIsExpanded(willExpand);
    
    if (willExpand && frames.length === 0) {
      // Check if we have pre-extracted frames
      if (preExtractedFrames && preExtractedFrames.length > 0) {
        console.log(`Using ${preExtractedFrames.length} pre-extracted frames (kept locally)`);
        
        // Convert blob URLs to data URLs for persistence
        const localFrames: VideoFrame[] = [];
        
        for (const frame of preExtractedFrames) {
          try {
            // Convert blob to data URL
            const dataUrl = await blobToDataUrl(frame.blob);
            localFrames.push({
              timestamp: frame.timestamp,
              dataUrl
            });
          } catch (err) {
            console.error('Failed to convert frame:', err);
          }
        }
        
        setFrames(localFrames);
        
        // Auto-select middle frame
        if (localFrames.length > 0) {
          const middleIndex = Math.floor(localFrames.length / 2);
          setSelectedFrame(localFrames[middleIndex]);
        }
      } 
      // If we have a video URL and extraction function, trigger extraction
      else if (videoUrl && onExtractFrames) {
        console.log('Triggering frame extraction from uploaded video');
        onExtractFrames();
      } 
      else {
        setError('Keine Frames verfügbar. Bitte lade zuerst ein Video hoch.');
      }
    }
  };

  // Helper function to convert blob to data URL
  const blobToDataUrl = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const generateAIThumbnail = async (style: 'lustig' | 'reisserisch' | 'seriös') => {
    if (!selectedFrame) {
      setError('Bitte wähle zuerst einen Frame aus');
      return;
    }

    if (!videoTitle.trim()) {
      setError('Bitte gib einen Video-Titel ein');
      return;
    }

    setGeneratingThumbnail(true);
    setError('');

    try {
      // Convert data URL to base64 (remove data:image/jpeg;base64, prefix)
      const base64Data = selectedFrame.dataUrl.split(',')[1];
      
      const response = await fetch(`${API_BASE_URL}/tenants/${tenantId}/videos/generate-ai-thumbnail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'X-Creator-ID': tenantId
        },
        body: JSON.stringify({
          frameBase64: base64Data,
          title: videoTitle,
          style,
          tenantId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Thumbnail-Generierung fehlgeschlagen');
      }

      const data = await response.json();
      
      // Store generated thumbnail locally (as data URL)
      const newThumbnail: GeneratedThumbnail = {
        style,
        dataUrl: `data:image/png;base64,${data.imageBase64}`
      };
      
      // Replace existing thumbnail of same style or add new one
      setGeneratedThumbnails(prev => {
        const filtered = prev.filter(t => t.style !== style);
        return [...filtered, newThumbnail];
      });
      
      // Auto-select the newly generated thumbnail
      setSelectedThumbnail(newThumbnail);
      
      // Notify parent that we have a generated thumbnail (but not uploaded yet)
      onThumbnailGenerated(newThumbnail.dataUrl);
      
    } catch (err: any) {
      console.error('Thumbnail generation error:', err);
      setError(err.message || 'Fehler beim Generieren des Thumbnails');
    } finally {
      setGeneratingThumbnail(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getThumbnailByStyle = (style: string) => {
    return generatedThumbnails.find(t => t.style === style);
  };

  const handleThumbnailSelect = (thumbnail: GeneratedThumbnail) => {
    setSelectedThumbnail(thumbnail);
    onThumbnailGenerated(thumbnail.dataUrl);
  };

  const getStyleLabel = (style: string) => {
    switch (style) {
      case 'lustig': return '😄 Lustig';
      case 'reisserisch': return '🔥 Reißerisch';
      case 'seriös': return '📊 Seriös';
      default: return style;
    }
  };

  return (
    <div className="border border-dark-700 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between p-4 bg-dark-800 hover:bg-dark-750 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary-400" />
          <span className="font-medium" style={{ color: 'rgb(var(--color-text))' }}>AI Thumbnail Generator</span>
          <span className="text-xs text-dark-400">(Optional)</span>
        </div>
        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-4 bg-dark-850">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Show extraction progress */}
          {isExtracting && frames.length === 0 && (
            <div className="flex items-center gap-3 p-4 bg-dark-800 rounded-lg">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500"></div>
              <div>
                <p className="text-sm font-medium">Extrahiere Frames aus Video...</p>
                <p className="text-xs text-dark-400">Dies kann einige Sekunden dauern</p>
              </div>
            </div>
          )}

          {/* Frame Timeline */}
          {frames.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">
                1. Wähle einen Frame aus dem Video
              </label>
              <div className="overflow-x-auto pb-2">
                <div className="flex gap-2">
                  {frames.map((frame, index) => (
                    <button
                      key={`${frame.timestamp}-${index}`}
                      type="button"
                      onClick={() => setSelectedFrame(frame)}
                      className={`flex-shrink-0 relative rounded-lg overflow-hidden transition-all ${
                        selectedFrame?.timestamp === frame.timestamp
                          ? 'ring-2 ring-primary-500 scale-105'
                          : 'ring-1 ring-dark-600 hover:ring-dark-500'
                      }`}
                    >
                      <img
                        src={frame.dataUrl}
                        alt={`Frame at ${formatTime(frame.timestamp)}`}
                        className="w-32 h-18 object-cover"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1 text-xs text-center">
                        {formatTime(frame.timestamp)}
                      </div>
                      {selectedFrame?.timestamp === frame.timestamp && (
                        <div className="absolute top-1 right-1 bg-primary-500 rounded-full p-1">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Style Selection */}
          {selectedFrame && (
            <div>
              <label className="block text-sm font-medium mb-2">
                2. Wähle einen Stil für dein Thumbnail
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => generateAIThumbnail('lustig')}
                  disabled={generatingThumbnail}
                  className="relative p-4 rounded-lg border-2 border-dark-600 hover:border-yellow-500 transition-all group disabled:opacity-50"
                >
                  <div className="text-3xl mb-2">😄</div>
                  <div className="font-medium mb-1">Lustig</div>
                  <div className="text-xs text-dark-400">Bunt, verspielt, energetisch</div>
                  {getThumbnailByStyle('lustig') && (
                    <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => generateAIThumbnail('reisserisch')}
                  disabled={generatingThumbnail}
                  className="relative p-4 rounded-lg border-2 border-dark-600 hover:border-red-500 transition-all group disabled:opacity-50"
                >
                  <div className="text-3xl mb-2">🔥</div>
                  <div className="font-medium mb-1">Reißerisch</div>
                  <div className="text-xs text-dark-400">Dramatisch, viral, intensiv</div>
                  {getThumbnailByStyle('reisserisch') && (
                    <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => generateAIThumbnail('seriös')}
                  disabled={generatingThumbnail}
                  className="relative p-4 rounded-lg border-2 border-dark-600 hover:border-blue-500 transition-all group disabled:opacity-50"
                >
                  <div className="text-3xl mb-2">📊</div>
                  <div className="font-medium mb-1">Seriös</div>
                  <div className="text-xs text-dark-400">Professionell, elegant, clean</div>
                  {getThumbnailByStyle('seriös') && (
                    <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              </div>

              {generatingThumbnail && (
                <div className="mt-4 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary-400" />
                  <p className="text-sm text-dark-400">Generiere AI Thumbnail... (8-12 Sekunden)</p>
                  <p className="text-xs text-dark-500 mt-1">Kosten: ~$0.008</p>
                </div>
              )}
            </div>
          )}

          {/* Generated Thumbnails Preview */}
          {generatedThumbnails.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">
                3. Wähle dein gewünschtes Thumbnail
              </label>
              <div className="grid grid-cols-3 gap-3">
                {generatedThumbnails.map((thumbnail) => (
                  <button
                    key={thumbnail.style}
                    type="button"
                    onClick={() => handleThumbnailSelect(thumbnail)}
                    className={`relative rounded-lg overflow-hidden border-2 transition-all group ${
                      selectedThumbnail?.style === thumbnail.style
                        ? 'border-primary-500 ring-2 ring-primary-500/50'
                        : 'border-dark-600 hover:border-dark-500'
                    }`}
                  >
                    <img 
                      src={thumbnail.dataUrl} 
                      alt={getStyleLabel(thumbnail.style)} 
                      className="w-full aspect-video object-cover" 
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1 text-xs text-center">
                      {getStyleLabel(thumbnail.style)}
                    </div>
                    {selectedThumbnail?.style === thumbnail.style && (
                      <div className="absolute top-2 right-2 bg-primary-500 rounded-full p-1">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewThumbnail(thumbnail);
                      }}
                      className="absolute top-2 left-2 bg-black/70 hover:bg-black/90 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ZoomIn className="w-4 h-4 text-white" />
                    </button>
                  </button>
                ))}
              </div>
              <p className="text-xs text-dark-400 mt-2">
                {selectedThumbnail 
                  ? `✓ "${getStyleLabel(selectedThumbnail.style)}" wird beim Veröffentlichen hochgeladen`
                  : 'Klicke auf ein Thumbnail um es auszuwählen'
                }
              </p>
            </div>
          )}

          {/* Info */}
          <div className="text-xs text-dark-500 bg-dark-900 p-3 rounded-lg">
            <p className="mb-1">💡 <strong>Tipp:</strong> Wähle einen interessanten Frame aus deinem Video</p>
            <p>Die AI fügt automatisch deinen Titel als Text hinzu und optimiert das Bild für maximale Aufmerksamkeit</p>
          </div>
        </div>
      )}

      {/* Thumbnail Preview Modal */}
      {previewThumbnail && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewThumbnail(null)}
        >
          <div className="relative max-w-6xl w-full">
            <button
              onClick={() => setPreviewThumbnail(null)}
              className="absolute -top-12 right-0 text-white hover:text-primary-400 transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
            <img 
              src={previewThumbnail.dataUrl} 
              alt={getStyleLabel(previewThumbnail.style)}
              className="w-full rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute bottom-4 left-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-white mb-1">
                    {getStyleLabel(previewThumbnail.style)}
                  </h3>
                  <p className="text-sm text-dark-300">{videoTitle}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleThumbnailSelect(previewThumbnail);
                    setPreviewThumbnail(null);
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedThumbnail?.style === previewThumbnail.style
                      ? 'bg-green-600 text-white'
                      : 'bg-primary-600 hover:bg-primary-700 text-white'
                  }`}
                >
                  {selectedThumbnail?.style === previewThumbnail.style ? (
                    <span className="flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      Ausgewählt
                    </span>
                  ) : (
                    'Auswählen'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
