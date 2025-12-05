import { useState, useEffect } from 'react'
import { Image, Link, Upload, Trash2, Save, X } from 'lucide-react'
import { advertisementService } from '../services/advertisement.service'
import { useAuthStore } from '../store/authStore'

interface AdManagementProps {
  onClose: () => void
}

type BannerPosition = 'top' | 'bottom'

export const AdManagement = ({ onClose }: AdManagementProps) => {
  const { accessToken } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Top Banner State
  const [topLinkUrl, setTopLinkUrl] = useState('')
  const [topEnabled, setTopEnabled] = useState(true)
  const [topImageFile, setTopImageFile] = useState<File | null>(null)
  const [topImagePreview, setTopImagePreview] = useState<string | null>(null)
  const [topImageKey, setTopImageKey] = useState<string | null>(null)
  
  // Bottom Banner State
  const [bottomLinkUrl, setBottomLinkUrl] = useState('')
  const [bottomEnabled, setBottomEnabled] = useState(true)
  const [bottomImageFile, setBottomImageFile] = useState<File | null>(null)
  const [bottomImagePreview, setBottomImagePreview] = useState<string | null>(null)
  const [bottomImageKey, setBottomImageKey] = useState<string | null>(null)

  useEffect(() => {
    loadAdvertisement()
  }, [])

  const loadAdvertisement = async () => {
    try {
      const data = await advertisementService.getAdvertisements()
      if (data) {
        // Load top banner
        const topBanner = data.topBanner || data.advertisement
        if (topBanner) {
          setTopLinkUrl(topBanner.linkUrl || '')
          setTopEnabled(topBanner.enabled)
          setTopImagePreview(topBanner.imageUrl || null)
          setTopImageKey(topBanner.imageKey || null)
        }
        
        // Load bottom banner
        if (data.bottomBanner) {
          setBottomLinkUrl(data.bottomBanner.linkUrl || '')
          setBottomEnabled(data.bottomBanner.enabled)
          setBottomImagePreview(data.bottomBanner.imageUrl || null)
          setBottomImageKey(data.bottomBanner.imageKey || null)
        }
      }
    } catch (error) {
      console.error('Failed to load advertisement:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleImageSelect = (position: BannerPosition) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        if (position === 'top') {
          setTopImageFile(file)
          setTopImagePreview(reader.result as string)
        } else {
          setBottomImageFile(file)
          setBottomImagePreview(reader.result as string)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveImage = (position: BannerPosition) => () => {
    if (position === 'top') {
      setTopImageFile(null)
      setTopImagePreview(null)
      // Keep imageKey for deletion on save
    } else {
      setBottomImageFile(null)
      setBottomImagePreview(null)
      // Keep imageKey for deletion on save
    }
  }

  const handleSave = async () => {
    if (!accessToken) {
      alert('Nicht eingeloggt. Bitte melde dich als Admin an.')
      return
    }

    setSaving(true)
    try {
      // Save Top Banner
      let finalTopImageKey = topImageKey

      if (topImageFile) {
        // New image uploaded
        try {
          const { imageKey: newImageKey } = await advertisementService.uploadImage(topImageFile, accessToken, 'top')
          finalTopImageKey = newImageKey
        } catch (uploadError: any) {
          console.error('Top banner upload error:', uploadError)
          if (uploadError.message.includes('401') || uploadError.message.includes('403')) {
            alert('Keine Berechtigung. Bitte stelle sicher, dass du als Admin eingeloggt bist.')
          } else {
            alert(`Fehler beim Hochladen (Oberes Banner): ${uploadError.message}`)
          }
          setSaving(false)
          return
        }
      } else if (!topImagePreview && topImageKey) {
        // Image removed
        try {
          await advertisementService.deleteImage(accessToken, 'top')
          finalTopImageKey = null
        } catch (deleteError) {
          console.warn('Could not delete old top image:', deleteError)
        }
      }

      await advertisementService.updateAdvertisement({
        position: 'top',
        imageKey: finalTopImageKey || null,
        linkUrl: topLinkUrl || null,
        enabled: topEnabled
      }, accessToken)

      // Save Bottom Banner
      let finalBottomImageKey = bottomImageKey

      if (bottomImageFile) {
        // New image uploaded
        try {
          const { imageKey: newImageKey } = await advertisementService.uploadImage(bottomImageFile, accessToken, 'bottom')
          finalBottomImageKey = newImageKey
        } catch (uploadError: any) {
          console.error('Bottom banner upload error:', uploadError)
          alert(`Fehler beim Hochladen (Unteres Banner): ${uploadError.message}`)
          setSaving(false)
          return
        }
      } else if (!bottomImagePreview && bottomImageKey) {
        // Image removed
        try {
          await advertisementService.deleteImage(accessToken, 'bottom')
          finalBottomImageKey = null
        } catch (deleteError) {
          console.warn('Could not delete old bottom image:', deleteError)
        }
      }

      await advertisementService.updateAdvertisement({
        position: 'bottom',
        imageKey: finalBottomImageKey || null,
        linkUrl: bottomLinkUrl || null,
        enabled: bottomEnabled
      }, accessToken)

      alert('Werbebanner erfolgreich aktualisiert!')
      onClose()
    } catch (error: any) {
      console.error('Failed to save advertisement:', error)
      if (error.message.includes('401') || error.message.includes('403')) {
        alert('Keine Berechtigung. Bitte stelle sicher, dass du in der "admins" Gruppe bist.')
      } else {
        alert(`Fehler beim Speichern: ${error.message}`)
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-dark-900 rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-dark-800 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Werbebanner verwalten</h2>
          <button onClick={onClose} className="text-dark-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Top Banner Section */}
          <div className="space-y-4 p-4 bg-dark-800 rounded-lg border border-dark-700">
            <h3 className="text-lg font-semibold text-primary-500">Oberes Werbebanner</h3>
            
            {/* Top Image Upload */}
            <div>
              <label className="block text-sm font-medium mb-2">
                <Image size={16} className="inline mr-2" />
                Banner-Bild (1920x240px empfohlen)
              </label>
              
              {topImagePreview ? (
                <div className="relative">
                  <img 
                    src={topImagePreview} 
                    alt="Top Banner Preview" 
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <button
                    onClick={handleRemoveImage('top')}
                    className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-700 rounded-lg"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : (
                <label className="block w-full h-48 border-2 border-dashed border-dark-700 rounded-lg hover:border-primary-500 cursor-pointer transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect('top')}
                    className="hidden"
                  />
                  <div className="h-full flex flex-col items-center justify-center text-dark-400">
                    <Upload size={48} className="mb-2" />
                    <p>Klicken zum Hochladen</p>
                    <p className="text-sm">PNG, JPG bis 5MB</p>
                  </div>
                </label>
              )}
            </div>

            {/* Top Link URL */}
            <div>
              <label className="block text-sm font-medium mb-2">
                <Link size={16} className="inline mr-2" />
                Link-URL (optional)
              </label>
              <input
                type="url"
                value={topLinkUrl}
                onChange={(e) => setTopLinkUrl(e.target.value)}
                placeholder="https://example.com"
                className="input w-full"
              />
              <p className="text-sm text-dark-400 mt-1">
                Wenn gesetzt, wird das Banner anklickbar
              </p>
            </div>

            {/* Top Enabled Toggle */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="top-enabled"
                checked={topEnabled}
                onChange={(e) => setTopEnabled(e.target.checked)}
                className="w-5 h-5 rounded border-dark-700 bg-dark-800 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="top-enabled" className="text-sm font-medium cursor-pointer">
                Oberes Banner aktiviert
              </label>
            </div>
          </div>

          {/* Bottom Banner Section */}
          <div className="space-y-4 p-4 bg-dark-800 rounded-lg border border-dark-700">
            <h3 className="text-lg font-semibold text-primary-500">Unteres Werbebanner</h3>
            
            {/* Bottom Image Upload */}
            <div>
              <label className="block text-sm font-medium mb-2">
                <Image size={16} className="inline mr-2" />
                Banner-Bild (1920x240px empfohlen)
              </label>
              
              {bottomImagePreview ? (
                <div className="relative">
                  <img 
                    src={bottomImagePreview} 
                    alt="Bottom Banner Preview" 
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <button
                    onClick={handleRemoveImage('bottom')}
                    className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-700 rounded-lg"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : (
                <label className="block w-full h-48 border-2 border-dashed border-dark-700 rounded-lg hover:border-primary-500 cursor-pointer transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect('bottom')}
                    className="hidden"
                  />
                  <div className="h-full flex flex-col items-center justify-center text-dark-400">
                    <Upload size={48} className="mb-2" />
                    <p>Klicken zum Hochladen</p>
                    <p className="text-sm">PNG, JPG bis 5MB</p>
                  </div>
                </label>
              )}
            </div>

            {/* Bottom Link URL */}
            <div>
              <label className="block text-sm font-medium mb-2">
                <Link size={16} className="inline mr-2" />
                Link-URL (optional)
              </label>
              <input
                type="url"
                value={bottomLinkUrl}
                onChange={(e) => setBottomLinkUrl(e.target.value)}
                placeholder="https://example.com"
                className="input w-full"
              />
              <p className="text-sm text-dark-400 mt-1">
                Wenn gesetzt, wird das Banner anklickbar
              </p>
            </div>

            {/* Bottom Enabled Toggle */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="bottom-enabled"
                checked={bottomEnabled}
                onChange={(e) => setBottomEnabled(e.target.checked)}
                className="w-5 h-5 rounded border-dark-700 bg-dark-800 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="bottom-enabled" className="text-sm font-medium cursor-pointer">
                Unteres Banner aktiviert
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Speichern...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Speichern
                </>
              )}
            </button>
            <button
              onClick={onClose}
              disabled={saving}
              className="btn-secondary flex-1"
            >
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
