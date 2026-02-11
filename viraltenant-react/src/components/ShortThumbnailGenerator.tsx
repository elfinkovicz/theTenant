import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Sparkles, Loader2, Check, X, ZoomIn } from 'lucide-react';
import { awsConfig } from '../config/aws-config';
import { useAuthStore } from '../store/authStore';
import { ExtractedFrame } from '../utils/videoFrameExtractor';

interface VideoFrame {
  timestamp: number;
  dataUrl: string;
}

interface GeneratedThumbnail {
  style: 'lustig' | 'reisserisch' | 'seriös' | 'frame';
  dataUrl: string;
}

interface ShortThumbnailGeneratorProps {
  videoTitle: string;
  tenantId: string;
  preExtractedFrames?: ExtractedFrame[];
  onThumbnailGenerated: (thumbnailDataUrl: string) => void;
}

const API_BASE_URL = awsConfig.api.user;

export function ShortThumbnailGenerator({ 
  videoTitle, 
  tenantId,
  preExtractedFrames,
  onThumbnailGenerated 
}: ShortThumbnailGeneratorProps) {
  const { accessToken } = useAuthStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [frames, setFrames] = useState<VideoFrame[]>([]);
  const [selectedFrame, setSelectedFrame] = useState<VideoFrame | null>(null);
  const [generatingThumbnail, setGeneratingThumbnail] = useState(false);
  const [generatedThumbnails, setGeneratedThumbnails] = useState<GeneratedThumbnail[]>([]);
  const [selectedThumbnail, setSelectedThumbnail] = useState<GeneratedThumbnail | null>(null);
  const [previewThumbnail, setPreviewThumbnail] = useState<GeneratedThumbnail | null>(null);
  const [error, setError] = useState('');

  // Convert pre-extracted frames when expanded
  useEffect(() => {
    const convertFrames = async () => {
      if (preExtractedFrames && preExtractedFrames.length > 0 && frames.length === 0 && isExpanded) {
        console.log(`Converting ${preExtractedFrames.length} pre-extracted frames for Short`);
        
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

  const handleToggle = async () => {
    const willExpand = !isExpanded;
    setIsExpanded(willExpand);
    
    if (willExpand && frames.length === 0 && preExtractedFrames && preExtractedFrames.length > 0) {
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
      
      if (localFrames.length > 0) {
        const middleIndex = Math.floor(localFrames.length / 2);
        setSelectedFrame(localFrames[middleIndex]);
      }
    }
  };

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
      setError('Bitte gib einen Titel ein');
      return;
    }

    setGeneratingThumbnail(true);
    setError('');

    try {
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
          tenantId,
          aspectRatio: '9:16' // Request vertical format for Shorts
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Thumbnail-Generierung fehlgeschlagen');
      }

      const data = await response.json();
      
      const newThumbnail: GeneratedThumbnail = {
        style,
        dataUrl: `data:image/png;base64,${data.imageBase64}`
      };
      
      setGeneratedThumbnails(prev => {
        const filtered = prev.filter(t => t.style !== style);
        return [...filtered, newThumbnail];
      });
      
      setSelectedThumbnail(newThumbnail);
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
      case 'frame': return '🖼️ Frame';
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
          <Sparkles className="w-5 h-5 text-pink-400" />
          <span className="font-medium" style={{ color: 'rgb(var(--color-text))' }}>AI Thumbnail (9:16)</span>
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

          {/* Frame Selection - Click to select as thumbnail */}
          {frames.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">
                1. Wähle ein Thumbnail (Klick zum Auswählen)
              </label>
              <div className="overflow-x-auto pb-2">
                <div className="flex gap-2">
                  {frames.map((frame, index) => (
                    <button
                      key={`${frame.timestamp}-${index}`}
                      type="button"
                      onClick={() => {
                        setSelectedFrame(frame);
                        // Directly use frame as thumbnail
                        const frameThumbnail: GeneratedThumbnail = {
                          style: 'frame',
                          dataUrl: frame.dataUrl
                        };
                        setGeneratedThumbnails(prev => {
                          const filtered = prev.filter(t => t.style !== 'frame');
                          return [...filtered, frameThumbnail];
                        });
                        setSelectedThumbnail(frameThumbnail);
                        onThumbnailGenerated(frame.dataUrl);
                      }}
                      className={`flex-shrink-0 relative rounded-lg overflow-hidden transition-all ${
                        selectedThumbnail?.style === 'frame' && selectedFrame?.timestamp === frame.timestamp
                          ? 'ring-2 ring-pink-500 scale-105'
                          : 'ring-1 ring-dark-600 hover:ring-pink-400 hover:scale-102'
                      }`}
                    >
                      <img
                        src={frame.dataUrl}
                        alt={`Frame at ${formatTime(frame.timestamp)}`}
                        className="w-16 h-28 object-cover" // 9:16 aspect ratio
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5 text-xs text-center">
                        {formatTime(frame.timestamp)}
                      </div>
                      {selectedThumbnail?.style === 'frame' && selectedFrame?.timestamp === frame.timestamp && (
                        <div className="absolute top-1 right-1 bg-pink-500 rounded-full p-0.5">
                          <Check className="w-2 h-2 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              {selectedThumbnail?.style === 'frame' && (
                <p className="text-xs text-green-400 mt-1">
                  ✓ Frame als Thumbnail ausgewählt
                </p>
              )}
            </div>
          )}

          {/* AI Generation (Optional) */}
          {selectedFrame && (
            <div>
              <label className="block text-sm font-medium mb-2">
                2. AI Thumbnail generieren <span className="text-dark-400 font-normal">(optional)</span>
              </label>
              
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => generateAIThumbnail('lustig')}
                  disabled={generatingThumbnail}
                  className="relative p-3 rounded-lg border-2 border-dark-600 hover:border-yellow-500 transition-all disabled:opacity-50"
                >
                  <div className="text-2xl mb-1">😄</div>
                  <div className="text-sm font-medium">Lustig</div>
                  {getThumbnailByStyle('lustig') && (
                    <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5">
                      <Check className="w-2 h-2 text-white" />
                    </div>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => generateAIThumbnail('reisserisch')}
                  disabled={generatingThumbnail}
                  className="relative p-3 rounded-lg border-2 border-dark-600 hover:border-red-500 transition-all disabled:opacity-50"
                >
                  <div className="text-2xl mb-1">🔥</div>
                  <div className="text-sm font-medium">Reißerisch</div>
                  {getThumbnailByStyle('reisserisch') && (
                    <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5">
                      <Check className="w-2 h-2 text-white" />
                    </div>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => generateAIThumbnail('seriös')}
                  disabled={generatingThumbnail}
                  className="relative p-3 rounded-lg border-2 border-dark-600 hover:border-blue-500 transition-all disabled:opacity-50"
                >
                  <div className="text-2xl mb-1">📊</div>
                  <div className="text-sm font-medium">Seriös</div>
                  {getThumbnailByStyle('seriös') && (
                    <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5">
                      <Check className="w-2 h-2 text-white" />
                    </div>
                  )}
                </button>
              </div>

              {generatingThumbnail && (
                <div className="mt-3 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-pink-400" />
                  <p className="text-xs text-dark-400">Generiere AI Thumbnail (9:16)...</p>
                </div>
              )}
            </div>
          )}

          {/* Generated Thumbnails - Vertical layout */}
          {generatedThumbnails.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">
                3. Wähle dein Thumbnail
              </label>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {generatedThumbnails.map((thumbnail) => (
                  <button
                    key={thumbnail.style}
                    type="button"
                    onClick={() => handleThumbnailSelect(thumbnail)}
                    className={`flex-shrink-0 relative rounded-lg overflow-hidden border-2 transition-all group ${
                      selectedThumbnail?.style === thumbnail.style
                        ? 'border-pink-500 ring-2 ring-pink-500/50'
                        : 'border-dark-600 hover:border-dark-500'
                    }`}
                  >
                    <img 
                      src={thumbnail.dataUrl} 
                      alt={getStyleLabel(thumbnail.style)} 
                      className="w-20 h-36 object-cover" // 9:16 aspect ratio
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5 text-xs text-center">
                      {getStyleLabel(thumbnail.style)}
                    </div>
                    {selectedThumbnail?.style === thumbnail.style && (
                      <div className="absolute top-1 right-1 bg-pink-500 rounded-full p-0.5">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewThumbnail(thumbnail);
                      }}
                      className="absolute top-1 left-1 bg-black/70 hover:bg-black/90 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ZoomIn className="w-3 h-3 text-white" />
                    </button>
                  </button>
                ))}
              </div>
              {selectedThumbnail && (
                <p className="text-xs text-green-400 mt-1">
                  ✓ Thumbnail wird mit dem Short hochgeladen
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Preview Modal */}
      {previewThumbnail && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewThumbnail(null)}
        >
          <div className="relative max-h-[90vh]">
            <button
              onClick={() => setPreviewThumbnail(null)}
              className="absolute -top-10 right-0 text-white hover:text-pink-400 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <img 
              src={previewThumbnail.dataUrl} 
              alt={getStyleLabel(previewThumbnail.style)}
              className="max-h-[80vh] rounded-lg shadow-2xl"
              style={{ aspectRatio: '9/16' }}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute bottom-4 left-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{getStyleLabel(previewThumbnail.style)}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleThumbnailSelect(previewThumbnail);
                    setPreviewThumbnail(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedThumbnail?.style === previewThumbnail.style
                      ? 'bg-green-600 text-white'
                      : 'bg-pink-600 hover:bg-pink-700 text-white'
                  }`}
                >
                  {selectedThumbnail?.style === previewThumbnail.style ? '✓ Ausgewählt' : 'Auswählen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
