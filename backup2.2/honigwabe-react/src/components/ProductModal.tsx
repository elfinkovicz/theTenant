import { useState, useEffect } from 'react'
import { X, Upload, Trash2, Save, Link as LinkIcon } from 'lucide-react'
import { productService, Product } from '../services/product.service'
import { useAuthStore } from '../store/authStore'

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
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  useEffect(() => {
    if (product && mode === 'edit') {
      setName(product.name)
      setDescription(product.description)
      setPrice(product.price.toString())
      setExternalLink(product.externalLink || '')
      setCategory(product.category)
      setStock(product.stock.toString())
      setFeatured(product.featured)
      setImagePreview(product.imageUrl || null)
    } else {
      resetForm()
    }
  }, [product, mode])

  const resetForm = () => {
    setName('')
    setDescription('')
    setPrice('')
    setExternalLink('')
    setCategory('merch')
    setStock('0')
    setFeatured(false)
    setImageFile(null)
    setImagePreview(null)
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
        const { uploadUrl, imageKey: newImageKey } = await productService.generateUploadUrl(
          imageFile.name,
          imageFile.type
        )
        await productService.uploadToS3(uploadUrl, imageFile)
        imageKey = newImageKey
      }

      const productData = {
        name,
        description,
        price: parseFloat(price) || 0,
        externalLink: externalLink || null,
        category,
        stock: parseInt(stock) || 0,
        featured,
        imageKey: imageKey || null
      }

      if (mode === 'create') {
        await productService.createProduct(productData)
      } else if (product) {
        await productService.updateProduct(product.productId, productData)
      }

      onSuccess()
      onClose()
      resetForm()
    } catch (error: any) {
      console.error('Failed to save product:', error)
      alert(`Fehler beim Speichern: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-dark-800 flex items-center justify-between">
          <h2 className="text-2xl font-bold">
            {mode === 'create' ? 'Produkt hinzufügen' : 'Produkt bearbeiten'}
          </h2>
          <button onClick={onClose} className="text-dark-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
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
            <label className="block text-sm font-medium mb-2">Produktname *</label>
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
            <label className="block text-sm font-medium mb-2">Preis (€) *</label>
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

          {/* Featured */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="featured"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="w-5 h-5 rounded border-dark-700 bg-dark-800 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="featured" className="text-sm font-medium cursor-pointer">
              Als Featured-Produkt markieren
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
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
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-secondary flex-1"
            >
              Abbrechen
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
