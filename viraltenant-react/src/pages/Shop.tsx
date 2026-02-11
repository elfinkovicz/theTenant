import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ShoppingCart, Plus, Edit, Trash2, ExternalLink, Settings, Save, Star, Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { productService, Product } from '../services/product.service'
import { prefetchService } from '../services/prefetch.service'
import { shopService } from '../services/shop.service'
import { ProductModal } from '../components/ProductModal'
import { ProductDetailModal } from '../components/ProductDetailModal'
import { ShopSettingsModal } from '../components/ShopSettingsModal'
import { LoadMoreButton } from '../components/LoadMoreButton'
import { PageBanner } from '../components/PageBanner'
import { useAdmin } from '../hooks/useAdmin'
import { usePagination } from '../hooks/usePagination'
import { useCartStore } from '../store/cartStore'
import { useHydration } from '../hooks/useHydration'
import { usePageTitle } from '../hooks/usePageTitle'
import { useAuthStore } from '../store/authStore'
import { toast } from '../utils/toast-alert'

// Currency symbol mapping
const currencySymbols: Record<string, string> = {
  EUR: '€',
  USD: '$',
  CHF: 'CHF',
  GBP: '£'
}

export const Shop = () => {
  const navigate = useNavigate()
  const hydrated = useHydration()
  const { addItem, getTotalItems, setCurrency } = useCartStore()
  const { title: pageTitle, subtitle: pageSubtitle } = usePageTitle('/shop')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [currency, setCurrencyState] = useState('EUR')
  const { isAdmin } = useAdmin()
  const { isAuthenticated } = useAuthStore()
  
  // Drag & Drop State
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [hasOrderChanged, setHasOrderChanged] = useState(false)
  const [savingOrder, setSavingOrder] = useState(false)

  // Pagination - 12 products initial (3 rows of 4), load 12 more each time
  const { displayedItems: paginatedProducts, hasMore, remainingCount, loadMore } = usePagination(products, { initialLimit: 12, increment: 12 })

  useEffect(() => {
    loadShopData()
  }, [])

  const loadShopData = async () => {
    try {
      // Load shop data including currency settings
      const shopData = await shopService.getShop()
      const shopCurrency = shopData.settings?.currency || 'EUR'
      setCurrencyState(shopCurrency)
      setCurrency(shopCurrency) // Update cart store currency
      
      // Use prefetch cache for products
      const productList = await prefetchService.getProducts()
      setProducts(Array.isArray(productList) ? productList : [])
    } catch (error) {
      console.error('Failed to load shop data:', error)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  const loadProducts = async () => {
    try {
      const productList = await prefetchService.getProducts()
      setProducts(Array.isArray(productList) ? productList : [])
    } catch (error) {
      console.error('Failed to load products:', error)
      setProducts([])
    }
  }

  // Get currency symbol
  const currencySymbol = currencySymbols[currency] || currency

  const handleCreate = () => {
    setSelectedProduct(null)
    setModalMode('create')
    setIsModalOpen(true)
  }

  const handleEdit = (product: Product, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setSelectedProduct(product)
    setModalMode('edit')
    setIsModalOpen(true)
  }

  const handleDelete = async (product: Product, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!confirm(`Produkt "${product.name}" wirklich löschen?`)) return

    try {
      await productService.deleteProduct(product.productId)
      toast.success('Produkt erfolgreich gelöscht')
      prefetchService.invalidate('products')
      loadProducts()
    } catch (error) {
      console.error('Failed to delete product:', error)
      toast.error('Fehler beim Löschen')
    }
  }

  const handleViewDetails = (product: Product) => {
    // Check if exclusive and not authenticated
    if (product.isExclusive && !isAuthenticated && !isAdmin) {
      const hostname = window.location.hostname;
      const parts = hostname.split('.');
      const subdomain = parts.length >= 3 && parts[0] !== 'www' ? parts[0] : 'platform';
      window.location.href = `https://${subdomain}.viraltenant.com/login`;
      return;
    }
    setSelectedProduct(product)
    setIsDetailModalOpen(true)
  }

  const handleAddToCart = (product: Product, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (product.stock === 0) {
      alert('Produkt ist ausverkauft')
      return
    }
    
    addItem({
      productId: product.productId,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      stock: product.stock // Stock für Validierung im Warenkorb
    })
    
    // Optional: Toast notification
    alert(`${product.name} wurde zum Warenkorb hinzugefügt!`)
  }

  const handleExternalLink = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation()
    if (product.externalLink) {
      const url = ensureHttps(product.externalLink)
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  const ensureHttps = (url: string): string => {
    // If URL already has protocol, return as is
    if (url.match(/^https?:\/\//i)) {
      return url
    }
    // Otherwise, add https://
    return `https://${url}`
  }

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index.toString())
    setTimeout(() => {
      const target = e.target as HTMLElement
      target.style.opacity = '0.5'
    }, 0)
  }

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.target as HTMLElement
    target.style.opacity = '1'
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index)
    }
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDragOverIndex(null)
      return
    }

    const newProducts = [...products]
    const [draggedProduct] = newProducts.splice(draggedIndex, 1)
    newProducts.splice(dropIndex, 0, draggedProduct)
    
    setProducts(newProducts)
    setHasOrderChanged(true)
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleSaveOrder = async () => {
    try {
      setSavingOrder(true)
      await productService.updateProducts(products)
      toast.success('Reihenfolge erfolgreich gespeichert!')
      setHasOrderChanged(false)
    } catch (err: any) {
      console.error('Error saving product order:', err)
      toast.error('Fehler beim Speichern der Reihenfolge')
    } finally {
      setSavingOrder(false)
    }
  }

  return (
    <div className="min-h-screen">
      {/* Page Banner mit Titel */}
      <PageBanner pageId="shop">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold mb-2" style={{ color: 'rgb(var(--color-text))' }}>
            <span className="glow-text">{pageTitle}</span>
          </h1>
          <p className="text-lg" style={{ color: 'rgb(var(--color-text-secondary))' }}>
            {pageSubtitle}
          </p>
        </div>
        <button
          onClick={() => navigate('/cart')}
          className="btn-secondary flex items-center gap-2 relative"
        >
          <ShoppingCart size={20} />
          Warenkorb
          {hydrated && getTotalItems() > 0 && (
            <span className="absolute -top-2 -right-2 bg-primary-600 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center">
              {getTotalItems()}
            </span>
          )}
        </button>
      </PageBanner>

      <div className="container mx-auto px-4 py-8">
        {/* Admin Controls */}
        {isAdmin && (
          <div className="mb-6 flex justify-end gap-3">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Settings size={20} />
              Shop-Einstellungen
            </button>
            <button onClick={handleCreate} className="btn-primary flex items-center gap-2">
              <Plus size={20} />
              Produkt hinzufügen
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-dark-400 text-lg">Keine Produkte verfügbar</p>
            {isAdmin && (
              <button onClick={handleCreate} className="btn-primary mt-4">
                Erstes Produkt hinzufügen
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Save Order Button */}
            {isAdmin && hasOrderChanged && (
              <div className="mb-6 flex justify-end">
                <button
                  onClick={handleSaveOrder}
                  disabled={savingOrder}
                  className="btn-primary flex items-center gap-2"
                >
                  <Save size={20} />
                  {savingOrder ? 'Speichern...' : 'Reihenfolge speichern'}
                </button>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {paginatedProducts.map((product, index) => {
                const isLocked = product.isExclusive && !isAuthenticated && !isAdmin;
                
                return (
                <div
                  key={product.productId}
                  draggable={isAdmin}
                  onDragStart={(e) => isAdmin && handleDragStart(e, index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => isAdmin && handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => isAdmin && handleDrop(e, index)}
                  className={`relative transition-all duration-200 ${
                    isAdmin ? 'cursor-grab active:cursor-grabbing' : ''
                  } ${
                    dragOverIndex === index 
                      ? 'ring-2 ring-primary-500 ring-offset-2 ring-offset-dark-900 scale-[1.02]' 
                      : ''
                  } ${
                    draggedIndex === index ? 'opacity-50' : ''
                  }`}
                >
                  <motion.div
                    whileHover={{ y: -5 }}
                    onClick={() => handleViewDetails(product)}
                    className={`card group relative h-full flex flex-col cursor-pointer ${
                      product.isExclusive 
                        ? 'shadow-[0_0_40px_rgba(234,179,8,0.6),0_0_80px_rgba(234,179,8,0.3)]' 
                        : product.featured 
                          ? 'shadow-[0_0_40px_rgba(234,179,8,0.6),0_0_80px_rgba(234,179,8,0.3)]' 
                          : ''
                    }`}
                    style={product.isExclusive ? {
                      border: '2px solid rgba(234, 179, 8, 0.5)'
                    } : undefined}
                  >
                    {/* Exclusive Badge */}
                    {product.isExclusive && (
                      <div className="absolute top-0 left-0 z-20 bg-gradient-to-r from-yellow-500 to-amber-500 text-black px-3 py-1 rounded-br-xl text-xs font-bold flex items-center gap-1.5 shadow-lg">
                        <Lock size={12} fill="currentColor" />
                        Exklusiv
                      </div>
                    )}

                    {/* Exclusive Lock Overlay */}
                    {isLocked && (
                      <div className="absolute inset-0 z-10 bg-black/70 rounded-lg flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                          <Lock className="w-10 h-10 text-yellow-400" />
                          <p className="text-sm font-medium text-white">Nur für Mitglieder</p>
                          <p className="text-xs text-dark-400">Klicke zum Einloggen</p>
                        </div>
                      </div>
                    )}

                    {/* Featured Badge */}
                    {product.featured && !product.isExclusive && (
                      <div className="absolute -top-3 -left-3 z-20 bg-gradient-to-r from-yellow-500 to-amber-500 text-black px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 shadow-lg">
                        <Star size={16} fill="currentColor" />
                        Featured
                      </div>
                    )}

                    {/* Admin Actions */}
                    {isAdmin && (
                      <div className="absolute top-4 right-4 flex gap-2 z-10">
                        <button
                          onClick={(e) => handleEdit(product, e)}
                          className="p-2 rounded-lg bg-dark-800 hover:bg-primary-600 transition-colors"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={(e) => handleDelete(product, e)}
                          className="p-2 rounded-lg bg-dark-800 hover:bg-red-600 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}

                    {/* Product Image */}
                    <div 
                      className="relative aspect-square bg-dark-800 rounded-lg mb-4 overflow-hidden"
                    >
                      {product.imageUrl ? (
                        <img 
                          src={product.imageUrl} 
                          alt={product.name} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-primary-900/20 to-dark-900 flex items-center justify-center">
                          <span className="text-6xl">📦</span>
                        </div>
                      )}
                      
                      {product.externalLink && (
                        <div className="absolute bottom-2 right-2 p-2 bg-dark-900/80 rounded-full">
                          <ExternalLink size={16} />
                        </div>
                      )}
                    </div>

                    <h3 className="text-lg font-semibold mb-2">{product.name}</h3>
                    
                    <p className="text-sm text-dark-400 mb-3 line-clamp-2 flex-grow">
                      {product.description || '\u00A0'}
                    </p>

                    <div className="flex items-center justify-between mt-auto pt-2">
                      <span className={`text-2xl font-bold ${product.featured ? 'text-yellow-400' : 'text-primary-400'}`}>
                        {currencySymbol}{product.price.toFixed(2)}
                      </span>
                      {product.externalLink ? (
                        <button
                          onClick={(e) => handleExternalLink(product, e)}
                          className="btn-primary py-2 px-4 text-sm flex items-center gap-2"
                        >
                          Zum Shop
                          <ExternalLink size={14} />
                        </button>
                      ) : (
                        <button
                          onClick={(e) => handleAddToCart(product, e)}
                          disabled={product.stock === 0}
                          className="btn-primary py-2 px-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          In den Warenkorb
                        </button>
                      )}
                    </div>

                    {product.stock === 0 && (
                      <div className="absolute inset-0 bg-dark-900/50 rounded-lg flex items-center justify-center">
                        <span className="text-lg font-semibold">Ausverkauft</span>
                      </div>
                    )}
                  </motion.div>
                </div>
              )})}
            </div>
            
            {hasMore && (
              <LoadMoreButton onClick={loadMore} remainingCount={remainingCount} label="Mehr Produkte laden" />
            )}
          </>
        )}
      </div>

      {/* Product Modal */}
      <ProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadProducts}
        product={selectedProduct}
        mode={modalMode}
      />

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={selectedProduct}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        currency={currency}
      />

      {/* Shop Settings Modal */}
      <ShopSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSuccess={() => loadProducts()}
      />
    </div>
  )
}
