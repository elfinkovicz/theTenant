import { useState, useCallback } from 'react'
import Cropper, { Area, MediaSize } from 'react-easy-crop'
import { X, ZoomIn, ZoomOut, RotateCw, Check, AlertTriangle, Maximize2 } from 'lucide-react'
import { compressForCrossposting, formatFileSize, COMPRESSION_PRESETS } from '../utils/imageCompressor'

interface ImageCropperProps {
  image: string
  onCropComplete: (croppedImage: Blob) => void
  onCancel: () => void
  aspectRatio?: number
  cropShape?: 'rect' | 'round'
  title?: string
  optimizeForCrossposting?: boolean
  preserveFormat?: boolean // Keep PNG format for transparency
}

export function ImageCropper({
  image,
  onCropComplete,
  onCancel,
  aspectRatio = 1,
  cropShape = 'rect',
  title = 'Bild zuschneiden',
  optimizeForCrossposting = true,
  preserveFormat = false
}: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [minZoom, setMinZoom] = useState(0.1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const onCropChange = useCallback((location: { x: number; y: number }) => {
    setCrop(location)
  }, [])

  const onZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom)
  }, [])

  const onCropCompleteCallback = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  // Calculate minimum zoom based on image and crop aspect ratios
  const onMediaLoaded = useCallback((_mediaSize: MediaSize) => {
    // Allow very small zoom to give users full freedom
    setMinZoom(0.1)
  }, [])

  const createCroppedImage = async (): Promise<Blob> => {
    if (!croppedAreaPixels) throw new Error('No crop area')

    const img = new Image()
    img.src = image
    
    await new Promise((resolve) => {
      img.onload = resolve
    })

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('No canvas context')

    // Set canvas size to cropped area
    canvas.width = croppedAreaPixels.width
    canvas.height = croppedAreaPixels.height

    // Keep canvas transparent (don't fill with any color)
    // PNG will preserve transparency

    // Handle rotation
    if (rotation !== 0) {
      const rotRad = (rotation * Math.PI) / 180
      const sin = Math.abs(Math.sin(rotRad))
      const cos = Math.abs(Math.cos(rotRad))
      
      const rotatedWidth = img.width * cos + img.height * sin
      const rotatedHeight = img.width * sin + img.height * cos
      
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = rotatedWidth
      tempCanvas.height = rotatedHeight
      const tempCtx = tempCanvas.getContext('2d')
      if (!tempCtx) throw new Error('No temp canvas context')
      
      tempCtx.translate(rotatedWidth / 2, rotatedHeight / 2)
      tempCtx.rotate(rotRad)
      tempCtx.drawImage(img, -img.width / 2, -img.height / 2)
      
      // Calculate source and destination coordinates
      const sx = Math.max(0, croppedAreaPixels.x)
      const sy = Math.max(0, croppedAreaPixels.y)
      const sw = Math.min(croppedAreaPixels.width, tempCanvas.width - sx)
      const sh = Math.min(croppedAreaPixels.height, tempCanvas.height - sy)
      const dx = croppedAreaPixels.x < 0 ? -croppedAreaPixels.x : 0
      const dy = croppedAreaPixels.y < 0 ? -croppedAreaPixels.y : 0
      
      ctx.drawImage(tempCanvas, sx, sy, sw, sh, dx, dy, sw, sh)
    } else {
      // Calculate source and destination coordinates for non-rotated image
      const sx = Math.max(0, croppedAreaPixels.x)
      const sy = Math.max(0, croppedAreaPixels.y)
      const sw = Math.min(croppedAreaPixels.width, img.width - sx)
      const sh = Math.min(croppedAreaPixels.height, img.height - sy)
      const dx = croppedAreaPixels.x < 0 ? -croppedAreaPixels.x : 0
      const dy = croppedAreaPixels.y < 0 ? -croppedAreaPixels.y : 0
      
      ctx.drawImage(img, sx, sy, sw, sh, dx, dy, sw, sh)
    }

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Canvas to blob failed'))
        },
        'image/png',
        1
      )
    })
  }

  const handleConfirm = async () => {
    setIsProcessing(true)
    try {
      const croppedBlob = await createCroppedImage()
      
      // If preserveFormat is true, skip compression to keep PNG transparency
      if (preserveFormat) {
        console.log(`Preserving PNG format, size: ${formatFileSize(croppedBlob.size)}`)
        onCropComplete(croppedBlob)
        return
      }
      
      // Optimize for crossposting if enabled
      if (optimizeForCrossposting) {
        console.log(`Original cropped size: ${formatFileSize(croppedBlob.size)}`)
        
        // Check if compression is needed (Bluesky limit is ~976KB)
        const blueskyLimit = COMPRESSION_PRESETS.bluesky.maxSizeKB * 1024
        
        if (croppedBlob.size > blueskyLimit) {
          console.log('Compressing image for crossposting compatibility...')
          const result = await compressForCrossposting(croppedBlob)
          console.log(`Compressed: ${formatFileSize(croppedBlob.size)} → ${formatFileSize(result.compressedSize)}`)
          onCropComplete(result.blob)
        } else {
          // Image is already small enough, but convert to JPEG for consistency
          const result = await compressForCrossposting(croppedBlob)
          onCropComplete(result.blob)
        }
      } else {
        onCropComplete(croppedBlob)
      }
    } catch (error) {
      console.error('Error cropping image:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-dark-900 rounded-xl w-full max-w-2xl mx-4 overflow-hidden border border-dark-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-700">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Cropper Area */}
        <div 
          className="relative h-96"
          style={{
            // Checkered pattern for transparency preview
            backgroundColor: '#1a1a1a',
            backgroundImage: `
              linear-gradient(45deg, #2a2a2a 25%, transparent 25%),
              linear-gradient(-45deg, #2a2a2a 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, #2a2a2a 75%),
              linear-gradient(-45deg, transparent 75%, #2a2a2a 75%)
            `,
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
          }}
        >
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            minZoom={minZoom}
            maxZoom={3}
            rotation={rotation}
            aspect={aspectRatio}
            cropShape={cropShape}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropCompleteCallback}
            onMediaLoaded={onMediaLoaded}
            showGrid={true}
            objectFit="contain"
            restrictPosition={false}
          />
        </div>

        {/* Controls */}
        <div className="p-4 space-y-4 border-t border-dark-700">
          {/* Zoom */}
          <div className="flex items-center gap-4">
            <ZoomOut size={18} className="text-dark-400" />
            <input
              type="range"
              min={minZoom}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
            />
            <ZoomIn size={18} className="text-dark-400" />
            <span className="text-sm text-dark-400 w-14">{Math.round(zoom * 100)}%</span>
          </div>

          {/* Fit to frame button */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom(minZoom)}
              className="btn-secondary text-sm py-1.5 px-3 flex items-center gap-2"
              title="Bild einpassen"
            >
              <Maximize2 size={14} />
              Einpassen
            </button>
            <button
              onClick={() => setZoom(1)}
              className="btn-secondary text-sm py-1.5 px-3"
              title="100% Zoom"
            >
              100%
            </button>
            <span className="text-xs text-dark-500 ml-2">
              Bild frei verschieben und positionieren
            </span>
          </div>

          {/* Rotation */}
          <div className="flex items-center gap-4">
            <RotateCw size={18} className="text-dark-400" />
            <input
              type="range"
              min={0}
              max={360}
              step={1}
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
              className="flex-1 h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
            />
            <span className="text-sm text-dark-400 w-12">{rotation}°</span>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onCancel}
              className="btn-secondary flex-1"
              disabled={isProcessing}
            >
              Abbrechen
            </button>
            <button
              onClick={handleConfirm}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Optimiere...
                </>
              ) : (
                <>
                  <Check size={18} />
                  Übernehmen
                </>
              )}
            </button>
          </div>
          
          {/* Crossposting optimization hint */}
          {optimizeForCrossposting && (
            <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm">
              <AlertTriangle size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-blue-300">
                <span className="font-medium">Crossposting-Optimierung aktiv:</span>{' '}
                Bilder werden automatisch für Bluesky, Mastodon & Slack komprimiert (max. 900KB).
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
