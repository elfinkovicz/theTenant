import { useState, useEffect } from 'react'
import { X, Upload, Trash2, Save, Link as LinkIcon, Newspaper, Lock, Settings } from 'lucide-react'
import { productService, Product } from '../services/product.service'
import { newsfeedService } from '../services/newsfeed.service'
import { slotsService } from '../services/slots.service'
import { useAuthStore } from '../store/authStore'
import { ImageCropper } from './ImageCropper'
import { SlotSelector } from './SlotSelector'
import { SlotManagerModal } from './SlotManagerModal'
import { toast } from '../utils/toast-alert'
import { prefetchService } from '../services/prefetch.service'

interface ProductModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  product: Product | null
  mode: 'create' | 'edit'
}

export const ProductModal = ({ isOpen, onClose, onSuccess, product, mode }: ProductModalProps) => {
  const { accessToken } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [externalLink, setExternalLink] = useState('')
  const [category, setCategory] = useState('merch')
  const [stock, setStock] = useState('0')
  const [featured, setFeatured] = useState(false)
  const [isExclusive, setIsExclusive] = useState(false)
  const [publishOption, setPublishOption] = useState<'now' | 'slot' | 'schedule'>('now')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [hasSlots, setHasSlots] = useState(false)
  const [showSlotManager, setShowSlotManager] = useState(false)
  const [publishToNewsfeed, setPublishToNewsfeed] = useState(true)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [cropperImage, setCropperImage] = useState<string | null>(null)

  useEffect(() => {
    if (product && mode === 'edit') {
      setName(product.name)
      setDescription(product.description)
      setPrice(product.price.toString())
      setExternalLink(product.externalLink || '')
      setCategory(product.category)
      setStock(product.stock.toString())
      setFeatured(product.featured)
      setIsExclusive(product.isExclusive || false)
      if (product.status === 'scheduled' && product.scheduledAt) {
        setPublishOption('schedule')
        const scheduledDateTime = new Date(product.scheduledAt)
        setScheduledDate(scheduledDateTime.toISOString().split('T')[0])
        setScheduledTime(scheduledDateTime.toTimeString().slice(0, 5))
      }
      setImagePreview(product.imageUrl || null)
    } else {
      resetForm()
    }
  }, [product, mode])

  // Load slots availability when modal opens
  useEffect(() => {
    if (!isOpen) return
    
    const loadSlotsAvailability = async () => {
      try {
        const slotsData = await slotsService.getSlots()
        const hasActiveSlots = slotsData.slots && slotsData.slots.some(s => s.enabled)
        setHasSlots(hasActiveSlots)
        
        // Set default to slot if slots are available and creating new product
        if (hasActiveSlots && mode === 'create') {
          setPublishOption('slot')
        }
      } catch (err) {
        console.error('Error checking slots:', err)
        setHasSlots(false)
      }
    }

    // Set default scheduled date/time to tomorrow at 12:00
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(12, 0, 0, 0)
    if (!scheduledDate) {
      setScheduledDate(tomorrow.toISOString().split('T')[0])
      setScheduledTime('12:00')
    }
    
    loadSlotsAvailability()
  }, [isOpen, mode])

  const handleSlotSelected = (datetime: string) => {
    const date = new Date(datetime)
    setScheduledDate(date.toISOString().split('T')[0])
    setScheduledTime(date.toTimeString().slice(0, 5))
  }

  const resetForm = () => {
    setName('')
    setDescription('')
    setPrice('')
    setExternalLink('')
    setCategory('merch')
    setStock('0')
    setFeatured(false)
    setIsExclusive(false)
    setPublishOption('now')
    setScheduledDate('')
    setScheduledTime('')
    setPublishToNewsfeed(true)
    setImageFile(null)
    setImagePreview(null)
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Open cropper
      const reader = new FileReader()
      reader.onloadend = () => {
        setCropperImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleCropComplete = (croppedBlob: Blob) => {
    const file = new File([croppedBlob], 'product.png', { type: 'image/png' })
    setImageFile(file)
    setImagePreview(URL.createObjectURL(croppedBlob))
    setCropperImage(null)
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!accessToken) {
      alert('Nicht eingeloggt. Bitte als Admin anmelden.')
      return
    }

    setLoading(true)
    try {
      let imageKey = product?.imageKey

      // Upload new image if selected
      if (imageFile) {
        const { uploadUrl, key: newImageKey } = await productService.generateUploadUrl(
          imageFile.name,
          imageFile.type
        )
        await productService.uploadToS3(uploadUrl, imageFile)
        imageKey = newImageKey
      }

      // Determine status and scheduledAt
      const isScheduling = publishOption === 'slot' || publishOption === 'schedule'
      const scheduledAt = isScheduling && scheduledDate && scheduledTime 
        ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString() 
        : undefined

      const productData = {
        name,
        description,
        price: parseFloat(price) || 0,
        externalLink: externalLink || null,
        category,
        stock: parseInt(stock) || 0,
        featured,
        isExclusive,
        imageKey: imageKey || null,
        status: (isScheduling && scheduledAt ? 'scheduled' : 'published') as 'draft' | 'published' | 'scheduled',
        scheduledAt
      }

      if (mode === 'create') {
        await productService.createProduct(productData)
        
        // Create newsfeed post if checkbox is checked (only if not scheduled)
        if (publishToNewsfeed && publishOption === 'now') {
          try {
            const priceStr = `€${(parseFloat(price) || 0).toFixed(2)}`
            await newsfeedService.createPost({
              title: `🛍️ Neues Produkt: ${name}`,
              description: description || `Entdecke unser neues Produkt "${name}" für nur ${priceStr}!`,
              imageKey: imageKey || undefined,
              externalLink: externalLink || '/shop',
              status: 'published'
            })
            console.log('Newsfeed post created for product')
          } catch (newsfeedError) {
            console.error('Failed to create newsfeed post:', newsfeedError)
          }
        }
      } else if (product) {
        await productService.updateProduct(product.productId, productData)
      }

      toast.success('Produkt erfolgreich gespeichert!');

      prefetchService.invalidate('products');
      onSuccess()
      onClose()
      resetForm()
    } catch (error: any) {
      console.error('Failed to save product:', error)
      toast.error('Fehler beim Speichern des Produkts');
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      {/* Image Cropper Modal */}
      {cropperImage && (
        <ImageCropper
          image={cropperImage}
          onCropComplete={handleCropComplete}
          onCancel={() => setCropperImage(null)}
          aspectRatio={1}
          cropShape="rect"
          title="Produktfoto zuschneiden (1:1)"
          preserveFormat={true}
          optimizeForCrossposting={false}
        />
      )}
      
      <div className="bg-dark-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-dark-800 flex items-center justify-between flex-shrink-0">
          <h2 className="text-2xl font-bold">
            {mode === 'create' ? 'Produkt hinzufügen' : 'Produkt bearbeiten'}
          </h2>
          <button 
            type="button"
            onClick={onClose} 
            className="p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Product Image */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Produktfoto (optional)
            </label>
            
            {imagePreview ? (
              <div className="relative">
                <img 
                  src={imagePreview} 
                  alt="Product Preview" 
                  className="w-full h-64 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-700 rounded-lg"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ) : (
              <label className="block w-full h-64 border-2 border-dashed border-dark-700 rounded-lg hover:border-primary-500 cursor-pointer transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <div className="h-full flex flex-col items-center justify-center text-dark-400">
                  <Upload size={48} className="mb-2" />
                  <p>Produktfoto hochladen (optional)</p>
                  <p className="text-sm">PNG, JPG bis 5MB</p>
                  <p className="text-xs mt-2">Kann auch später hinzugefügt werden</p>
                </div>
              </label>
            )}
          </div>

          {/* Product Name */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Produktname <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input w-full"
              required
              placeholder="z.B. Brand T-Shirt"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">Beschreibung</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input w-full h-24 resize-none"
              placeholder="Produktbeschreibung..."
            />
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Preis (€) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="input w-full"
              required
              placeholder="29.99"
            />
          </div>

          {/* External Link */}
          <div>
            <label className="block text-sm font-medium mb-2">
              <LinkIcon size={16} className="inline mr-2" />
              Externer Shop-Link
            </label>
            <input
              type="text"
              value={externalLink}
              onChange={(e) => setExternalLink(e.target.value)}
              className="input w-full"
              placeholder="https://shop.example.com/product"
            />
            <p className="text-sm text-dark-400 mt-1">
              Link zu externem Shop (z.B. Spreadshirt, Etsy) - Beliebiger Text möglich
            </p>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium mb-2">Kategorie</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input w-full"
            >
              <option value="merch">Merch</option>
              <option value="clothing">Kleidung</option>
              <option value="accessories">Accessoires</option>
              <option value="digital">Digital</option>
              <option value="other">Sonstiges</option>
            </select>
          </div>

          {/* Stock */}
          <div>
            <label className="block text-sm font-medium mb-2">Lagerbestand</label>
            <input
              type="number"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className="input w-full"
              placeholder="0"
            />
          </div>

          {/* Toggle Options */}
          <div className="space-y-3">
            {/* Publish to Newsfeed - only show in create mode */}
            {mode === 'create' && (
              <div 
                onClick={() => !loading && setPublishToNewsfeed(!publishToNewsfeed)}
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
            )}

            {/* Featured & Exclusive - always side by side */}
            <div className="grid grid-cols-2 gap-3">
              {/* Featured */}
              <div 
                onClick={() => setFeatured(!featured)}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                  featured 
                    ? 'bg-yellow-500/10 border-yellow-500/30 hover:bg-yellow-500/15' 
                    : 'bg-dark-800 border-dark-700 hover:bg-dark-700/50'
                }`}
              >
                <div>
                  <p className={`text-sm font-medium ${featured ? 'text-yellow-400' : ''}`}>Featured Produkt</p>
                  <p className="text-xs text-dark-400">Wird hervorgehoben angezeigt</p>
                </div>
                <div
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                    featured ? 'bg-yellow-500' : 'bg-dark-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      featured ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </div>
              </div>

              {/* Exclusive Content */}
              <div 
                onClick={() => !loading && setIsExclusive(!isExclusive)}
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
                  name="publishOptionProduct"
                  value="now"
                  checked={publishOption === 'now'}
                  onChange={() => setPublishOption('now')}
                  disabled={loading}
                  className="w-4 h-4 text-primary-500"
                />
                <span>Sofort veröffentlichen</span>
              </label>
              {hasSlots && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="publishOptionProduct"
                    value="slot"
                    checked={publishOption === 'slot'}
                    onChange={() => setPublishOption('slot')}
                    disabled={loading}
                    className="w-4 h-4 text-primary-500"
                  />
                  <span>Nächster Slot</span>
                </label>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="publishOptionProduct"
                  value="schedule"
                  checked={publishOption === 'schedule'}
                  onChange={() => setPublishOption('schedule')}
                  disabled={loading}
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
                    disabled={loading}
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
                    disabled={loading}
                    className="input w-full disabled:opacity-50"
                  />
                </div>
                <div className="col-span-2 text-sm text-dark-400">
                  📅 Produkt wird veröffentlicht am {scheduledDate && scheduledTime ? new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString('de-DE', { 
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
          </div>

          {/* Action Buttons - Fixed at bottom */}
          <div className="flex gap-3 p-6 border-t border-dark-800 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-secondary flex-1"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Speichern...
                </>
              ) : (
                <>
                  <Save size={18} />
                  {mode === 'create' ? 'Hinzufügen' : 'Speichern'}
                </>
              )}
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
              const hasActiveSlots = slotsData.slots && slotsData.slots.some(s => s.enabled)
              setHasSlots(hasActiveSlots)
            })
            setShowSlotManager(false)
          }}
        />
      )}
    </div>
  )
}
