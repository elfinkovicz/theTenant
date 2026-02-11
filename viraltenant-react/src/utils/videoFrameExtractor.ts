/**
 * Video Frame Extraction Utility
 * Extracts frames from video files at specified percentages of the video duration
 */

export interface ExtractedFrame {
  timestamp: number;
  blob: Blob;
  url: string;
}

export interface FrameExtractionOptions {
  percentages?: number[]; // Default: [0.2, 0.4, 0.6, 0.8, 1.0]
  maxWidth?: number; // Default: 1280
  maxHeight?: number; // Default: 720
  quality?: number; // JPEG quality 0-1, Default: 0.85
  timeout?: number; // Timeout in ms, Default: 30000
}

/**
 * Extract frames from a video file at specified percentages of the duration
 */
export async function extractFramesFromVideoFile(
  file: File, 
  options: FrameExtractionOptions = {}
): Promise<ExtractedFrame[]> {
  const {
    percentages = [0.2, 0.4, 0.6, 0.8, 1.0],
    maxWidth = 1280,
    maxHeight = 720,
    quality = 0.85,
    timeout = 30000
  } = options;

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    // Don't set crossOrigin for local blob URLs - it causes issues
    
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    
    const frames: ExtractedFrame[] = [];
    let isProcessing = false;
    let currentTimestampIndex = 0;
    let timestamps: number[] = [];
    
    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('error', onError);
      video.removeEventListener('seeked', onSeeked);
    };
    
    const onError = (e: Event) => {
      console.error('Video loading error:', e);
      cleanup();
      reject(new Error('Video konnte nicht geladen werden. Überprüfe das Video-Format.'));
    };
    
    const onSeeked = async () => {
      if (isProcessing) return;
      isProcessing = true;
      
      try {
        // Wait for frame to be ready
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Check if video has valid dimensions
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          console.warn('Video has no dimensions at', video.currentTime);
          processNextFrame();
          return;
        }
        
        // Create canvas with appropriate dimensions
        const canvas = document.createElement('canvas');
        const aspectRatio = video.videoWidth / video.videoHeight;
        
        // Calculate canvas size maintaining aspect ratio
        if (aspectRatio > maxWidth / maxHeight) {
          canvas.width = maxWidth;
          canvas.height = Math.round(maxWidth / aspectRatio);
        } else {
          canvas.height = maxHeight;
          canvas.width = Math.round(maxHeight * aspectRatio);
        }
        
        const ctx = canvas.getContext('2d', { willReadFrequently: false });
        if (!ctx) {
          console.error('Canvas context not available');
          processNextFrame();
          return;
        }
        
        // Draw frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to blob
        canvas.toBlob(async (blob) => {
          if (blob) {
            frames.push({
              timestamp: video.currentTime,
              blob,
              url: URL.createObjectURL(blob)
            });
            console.log(`Extracted frame at ${video.currentTime.toFixed(2)}s (${Math.round((currentTimestampIndex + 1) / timestamps.length * 100)}%)`);
          } else {
            console.warn('Failed to create blob for frame at', video.currentTime);
          }
          
          processNextFrame();
        }, 'image/jpeg', quality);
        
      } catch (err) {
        console.error('Error processing frame:', err);
        processNextFrame();
      }
    };
    
    const processNextFrame = () => {
      isProcessing = false;
      currentTimestampIndex++;
      
      if (currentTimestampIndex >= timestamps.length) {
        // All frames processed
        cleanup();
        if (frames.length === 0) {
          reject(new Error('Keine Frames konnten extrahiert werden. Das Video-Format wird möglicherweise nicht unterstützt.'));
        } else {
          console.log(`Successfully extracted ${frames.length}/${timestamps.length} frames`);
          resolve(frames);
        }
        return;
      }
      
      // Seek to next timestamp
      const nextTimestamp = timestamps[currentTimestampIndex];
      video.currentTime = nextTimestamp;
    };
    
    const onLoadedMetadata = () => {
      const duration = video.duration;
      
      if (!duration || duration === 0 || !isFinite(duration)) {
        cleanup();
        reject(new Error('Video-Dauer konnte nicht ermittelt werden'));
        return;
      }
      
      console.log(`Video duration: ${duration.toFixed(2)}s, extracting frames at:`, percentages.map(p => `${(p * 100).toFixed(0)}%`));
      
      // Generate timestamps based on percentages
      timestamps = percentages.map(p => {
        // Ensure we don't go past the end and leave some buffer
        const timestamp = Math.min(duration * p, duration - 0.5);
        return Math.max(timestamp, 0.1); // Ensure we don't start at 0
      });
      
      console.log('Extracting frames at timestamps:', timestamps.map(t => `${t.toFixed(2)}s`));
      
      // Start processing first frame
      currentTimestampIndex = 0;
      video.currentTime = timestamps[0];
    };
    
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('error', onError);
    video.addEventListener('seeked', onSeeked);
    
    // Timeout fallback
    setTimeout(() => {
      if (frames.length === 0) {
        cleanup();
        reject(new Error('Frame-Extraktion Timeout. Das Video-Format wird möglicherweise nicht unterstützt.'));
      }
    }, timeout);
  });
}

/**
 * Format timestamp as MM:SS
 */
export function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Clean up frame URLs to prevent memory leaks
 */
export function cleanupFrameUrls(frames: ExtractedFrame[]): void {
  frames.forEach(frame => {
    if (frame.url.startsWith('blob:')) {
      URL.revokeObjectURL(frame.url);
    }
  });
}