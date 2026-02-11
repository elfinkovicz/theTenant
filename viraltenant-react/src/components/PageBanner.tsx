import React, { useState, useEffect, useRef, ReactNode } from 'react'
import { Upload, Trash2, Settings, Sparkles } from 'lucide-react'
import { bannerService, PageBanner as BannerData } from '../services/banner.service'
import { useAdmin } from '../hooks/useAdmin'
import { useAuthStore } from '../store/authStore'
import { ImageCropper } from './ImageCropper'

interface PageBannerProps {
  pageId: string
  children?: ReactNode
}

export const PageBanner = ({ pageId, children }: PageBannerProps) => {
  const [banner, setBanner] = useState<BannerData | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [overlayOpacity, setOverlayOpacity] = useState(0.5)
  const [blur, setBlur] = useState(0)
  const [imageLoaded, setImageLoaded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const { isAdmin } = useAdmin()
  const { accessToken } = useAuthStore()
  const [cropperImage, setCropperImage] = useState<string | null>(null)

  useEffect(() => {
    loadBanner()
  }, [pageId])

  useEffect(() => {
    if (banner?.bannerUrl) {
      if (bannerService.isImagePreloaded(banner.bannerUrl)) {
        setImageLoaded(true)
      } else {
        setImageLoaded(false)
        const img = new Image()
        img.onload = () => setImageLoaded(true)
        img.src = banner.bannerUrl
      }
    }
  }, [banner?.bannerUrl])

  const loadBanner = async () => {
    try {
      const data = await bannerService.getBanner(pageId)
      setBanner(data)
      if (data?.overlayOpacity !== undefined) setOverlayOpacity(data.overlayOpacity)
      if (data?.blur !== undefined) setBlur(data.blur)
    } catch (error) {
      console.error('Failed to load banner:', error)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !accessToken) return

    const reader = new FileReader()
    reader.onloadend = () => setCropperImage(reader.result as string)
    reader.readAsDataURL(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!accessToken) return
    
    setCropperImage(null)
    setUploading(true)
    
    try {
      const file = new File([croppedBlob], 'banner.png', { type: 'image/png' })
      const { bannerUrl } = await bannerService.uploadBanner(pageId, file, accessToken)
      setBanner(prev => prev ? { ...prev, bannerUrl } : { pageId, bannerUrl })
    } catch (error) {
      console.error('Failed to upload banner:', error)
      alert('Fehler beim Hochladen des Banners')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    if (!accessToken || !confirm('Banner wirklich löschen?')) return
    
    try {
      await bannerService.deleteBanner(pageId, accessToken)
      setBanner(null)
    } catch (error) {
      console.error('Failed to delete banner:', error)
    }
  }

  const handleSaveOverlay = async () => {
    if (!accessToken) return
    try {
      await bannerService.updateBanner(pageId, { overlayOpacity, blur }, accessToken)
      setBanner(prev => prev ? { ...prev, overlayOpacity, blur } : null)
      setShowSettings(false)
    } catch (error) {
      console.error('Failed to save overlay:', error)
    }
  }

  const hasImage = !!banner?.bannerUrl
  const currentOpacity = banner?.overlayOpacity ?? 0.5
  const currentBlur = banner?.blur ?? 0

  return (
    <div className="relative w-full overflow-hidden" style={{ height: '200px' }}>
      {cropperImage && (
        <ImageCropper
          image={cropperImage}
          onCropComplete={handleCropComplete}
          onCancel={() => setCropperImage(null)}
          aspectRatio={1920 / 200}
          cropShape="rect"
          title="Banner zuschneiden (1920×200)"
          preserveFormat={true}
          optimizeForCrossposting={false}
        />
      )}
      
      {hasImage && (
        <div 
          className={`absolute inset-0 bg-cover bg-center transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          style={{ 
            backgroundImage: `url(${banner.bannerUrl})`,
            filter: currentBlur > 0 ? `blur(${currentBlur}px)` : undefined,
            transform: currentBlur > 0 ? 'scale(1.1)' : undefined
          }}
        />
      )}
      
      {hasImage && currentOpacity > 0 && (
        <div className="absolute inset-0 bg-black" style={{ opacity: currentOpacity }} />
      )}

      <div className="relative z-10 h-full flex items-center">
        <div className="flex-shrink-0 pl-4 md:pl-8 lg:pl-16">
          {React.Children.toArray(children)[0]}
        </div>
        {React.Children.count(children) > 1 && (
          <div className="ml-auto pr-4 md:pr-8 lg:pr-16 flex items-center gap-3">
            {React.Children.toArray(children).slice(1)}
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="absolute top-4 right-4 z-20 flex gap-2">
          {hasImage && (
            <>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 rounded-full bg-primary-500/20 hover:bg-primary-500/40 transition-colors"
                title="Overlay anpassen"
              >
                <Settings size={18} className="text-primary-500" />
              </button>
              <button
                onClick={handleDelete}
                className="p-2 rounded-full bg-red-500/20 hover:bg-red-500/40 transition-colors"
                title="Banner löschen"
              >
                <Trash2 size={18} className="text-red-500" />
              </button>
            </>
          )}
          <label className="p-2 rounded-full bg-primary-500/20 hover:bg-primary-500/40 transition-colors cursor-pointer">
            <Upload size={18} className="text-primary-500" />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>
      )}

      {showSettings && isAdmin && (
        <div className="fixed top-24 right-8 z-[9999] bg-dark-900/95 p-4 rounded-lg border border-dark-700 min-w-[250px] shadow-xl">
          <div className="mb-4">
            <div className="text-sm text-dark-300 mb-2">Overlay Transparenz</div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                min={0}
                max={0.9}
                step={0.1}
                className="flex-1"
              />
              <span className="text-white text-sm w-12">{Math.round(overlayOpacity * 100)}%</span>
            </div>
          </div>
          
          <div className="mb-4">
            <div className="text-sm text-dark-300 mb-2 flex items-center gap-2">
              <Sparkles size={14} />
              Hintergrund-Unschärfe
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                value={blur}
                onChange={(e) => setBlur(Number(e.target.value))}
                min={0}
                max={20}
                step={1}
                className="flex-1"
              />
              <span className="text-white text-sm w-12">{blur}px</span>
            </div>
          </div>
          
          <button onClick={handleSaveOverlay} className="btn-primary w-full py-2 text-sm">
            Speichern
          </button>
        </div>
      )}

      {uploading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-30">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  )
}
