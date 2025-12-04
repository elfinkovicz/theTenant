import { useState, useEffect } from 'react'
import { Image, Link, Upload, Trash2, Save, X } from 'lucide-react'
import { advertisementService, Advertisement } from '../services/advertisement.service'
import { useAuthStore } from '../store/authStore'

interface AdManagementProps {
  onClose: () => void
}

export const AdManagement = ({ onClose }: AdManagementProps) => {
  const { accessToken } = useAuthStore()
  const [ad, setAd] = useState<Advertisement | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  useEffect(() => {
    loadAdvertisement()
  }, [])

  const loadAdvertisement = async () => {
    try {
      const advertisement = await advertisementService.getAdvertisement()
      if (advertisement) {
        setAd(advertisement)
        setLinkUrl(advertisement.linkUrl || '')
        setEnabled(advertisement.enabled)
        setImagePreview(advertisement.imageUrl || null)
      }
    } catch (error) {
      console.error('Failed to load advertisement:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview(null)
  }

  const handleSave = async () => {
    if (!accessToken) {
      alert('Nicht eingeloggt. Bitte melde dich als Admin an.')
      return
    }

    setSaving(true)
    try {
      let imageKey = ad?.imageKey

      // Upload new image if selected
      if (imageFile) {
        try {
          const { imageKey: newImageKey } = await advertisementService.uploadImage(imageFile, accessToken)
          imageKey = newImageKey
        } catch (uploadError: any) {
          console.error('Upload error:', uploadError)
          if (uploadError.message.includes('401') || uploadError.message.includes('403')) {
            alert('Keine Berechtigung. Bitte stelle sicher, dass du als Admin eingeloggt bist.')
          } else {
            alert(`Fehler beim Hochladen: ${uploadError.message}`)
          }
          setSaving(false)
          return
        }
      } else if (!imagePreview && ad?.imageKey) {
        // Delete image if removed
        try {
          await advertisementService.deleteImage(accessToken)
          imageKey = null
        } catch (deleteError) {
          console.warn('Could not delete old image:', deleteError)
          // Continue anyway
        }
      }

      // Update advertisement
      await advertisementService.updateAdvertisement({
        imageKey: imageKey || null,
        linkUrl: linkUrl || null,
        enabled
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

        <div className="p-6 space-y-6">
          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium mb-2">
              <Image size={16} className="inline mr-2" />
              Werbebanner-Bild (1920x240px empfohlen)
            </label>
            
            {imagePreview ? (
              <div className="relative">
                <img 
                  src={imagePreview} 
                  alt="Advertisement Preview" 
                  className="w-full h-48 object-cover rounded-lg"
                />
                <button
                  onClick={handleRemoveImage}
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
                  onChange={handleImageSelect}
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

          {/* Link URL */}
          <div>
            <label className="block text-sm font-medium mb-2">
              <Link size={16} className="inline mr-2" />
              Link-URL (optional)
            </label>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              className="input w-full"
            />
            <p className="text-sm text-dark-400 mt-1">
              Wenn gesetzt, wird das Banner anklickbar
            </p>
          </div>

          {/* Enabled Toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-5 h-5 rounded border-dark-700 bg-dark-800 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="enabled" className="text-sm font-medium cursor-pointer">
              Werbebanner aktiviert
            </label>
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
