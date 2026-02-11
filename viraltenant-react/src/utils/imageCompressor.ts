/**
 * Image Compressor Utility
 * 
 * Compresses images for different social media platforms.
 * Each platform has different size limits:
 * - Bluesky: ~976KB (strict)
 * - Mastodon: 8MB (images), 40MB (videos)
 * - Slack: No strict limit but recommends < 5MB
 * - General: 10MB
 */

export interface CompressionOptions {
  maxSizeKB: number;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface CompressionResult {
  blob: Blob;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

// Platform-specific presets
export const COMPRESSION_PRESETS = {
  bluesky: {
    maxSizeKB: 900, // Under 976KB limit with buffer
    maxWidth: 2000,
    maxHeight: 2000,
    quality: 0.85,
    format: 'image/jpeg' as const
  },
  mastodon: {
    maxSizeKB: 7500, // Under 8MB limit
    maxWidth: 4096,
    maxHeight: 4096,
    quality: 0.9,
    format: 'image/jpeg' as const
  },
  slack: {
    maxSizeKB: 4500, // Under 5MB recommended
    maxWidth: 3000,
    maxHeight: 3000,
    quality: 0.9,
    format: 'image/jpeg' as const
  },
  general: {
    maxSizeKB: 9500, // Under 10MB
    maxWidth: 4096,
    maxHeight: 4096,
    quality: 0.92,
    format: 'image/jpeg' as const
  }
};

/**
 * Load an image from a Blob or File
 */
async function loadImage(source: Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    
    if (typeof source === 'string') {
      img.src = source;
    } else {
      img.src = URL.createObjectURL(source);
    }
  });
}

/**
 * Calculate new dimensions while maintaining aspect ratio
 */
function calculateDimensions(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let newWidth = width;
  let newHeight = height;

  if (width > maxWidth) {
    newWidth = maxWidth;
    newHeight = Math.round((height * maxWidth) / width);
  }

  if (newHeight > maxHeight) {
    newHeight = maxHeight;
    newWidth = Math.round((width * maxHeight) / height);
  }

  return { width: newWidth, height: newHeight };
}

/**
 * Compress an image to fit within size constraints
 */
export async function compressImage(
  source: Blob | string,
  options: CompressionOptions
): Promise<CompressionResult> {
  const {
    maxSizeKB,
    maxWidth = 4096,
    maxHeight = 4096,
    quality: initialQuality = 0.9,
    format = 'image/jpeg'
  } = options;

  const img = await loadImage(source);
  const originalSize = source instanceof Blob ? source.size : 0;

  // Calculate target dimensions
  const { width, height } = calculateDimensions(
    img.width,
    img.height,
    maxWidth,
    maxHeight
  );

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Draw image
  ctx.drawImage(img, 0, 0, width, height);

  // Try to compress to target size
  let quality = initialQuality;
  let blob: Blob | null = null;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, format, quality);
    });

    if (!blob) throw new Error('Failed to create blob');

    const sizeKB = blob.size / 1024;
    console.log(`Compression attempt ${attempts + 1}: ${sizeKB.toFixed(0)}KB at quality ${(quality * 100).toFixed(0)}%`);

    if (sizeKB <= maxSizeKB) {
      break;
    }

    // Reduce quality for next attempt
    quality -= 0.1;
    if (quality < 0.3) {
      // If quality is too low, also reduce dimensions
      canvas.width = Math.round(canvas.width * 0.8);
      canvas.height = Math.round(canvas.height * 0.8);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      quality = 0.7;
    }

    attempts++;
  }

  if (!blob) throw new Error('Failed to compress image');

  // Clean up object URL if we created one
  if (typeof source !== 'string') {
    URL.revokeObjectURL(img.src);
  }

  return {
    blob,
    width: canvas.width,
    height: canvas.height,
    originalSize,
    compressedSize: blob.size,
    compressionRatio: originalSize > 0 ? blob.size / originalSize : 1
  };
}

/**
 * Compress image for a specific platform
 */
export async function compressForPlatform(
  source: Blob | string,
  platform: keyof typeof COMPRESSION_PRESETS
): Promise<CompressionResult> {
  const preset = COMPRESSION_PRESETS[platform];
  return compressImage(source, preset);
}

/**
 * Compress image for multiple platforms and return the smallest version
 * that satisfies all platform requirements
 */
export async function compressForCrossposting(
  source: Blob | string
): Promise<CompressionResult> {
  // Use Bluesky preset as it's the most restrictive
  return compressForPlatform(source, 'bluesky');
}

/**
 * Check if an image needs compression for a platform
 */
export function needsCompression(
  sizeBytes: number,
  platform: keyof typeof COMPRESSION_PRESETS
): boolean {
  const preset = COMPRESSION_PRESETS[platform];
  return sizeBytes > preset.maxSizeKB * 1024;
}

/**
 * Get human-readable size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
