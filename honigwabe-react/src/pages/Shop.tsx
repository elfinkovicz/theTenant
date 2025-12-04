import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ShoppingCart, Plus, Edit, Trash2, ExternalLink, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { productService, Product } from '../services/product.service'
import { ProductModal } from '../components/ProductModal'
import { ShopSettingsModal } from '../components/ShopSettingsModal'
import { useAdmin } from '../hooks/useAdmin'
import { useCartStore } from '../store/cartStore'

export const Shop = () => {
  const navigate = useNavigate()
  const { addItem, getTotalItems } = useCartStore()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const { isAdmin } = useAdmin()

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    try {
      const productList = await productService.getProducts()
      setProducts(productList)
    } catch (error) {
      console.error('Failed to load products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setSelectedProduct(null)
    setModalMode('create')
    setIsModalOpen(true)
  }

  const handleEdit = (product: Product) => {
    setSelectedProduct(product)
    setModalMode('edit')
    setIsModalOpen(true)
  }

  const handleDelete = async (product: Product) => {
    if (!confirm(`Produkt "${product.name}" wirklich löschen?`)) return

    try {
      await productService.deleteProduct(product.productId)
      loadProducts()
    } catch (error) {
      console.error('Failed to delete product:', error)
      alert('Fehler beim Löschen')
    }
  }

  const handleAddToCart = (product: Product) => {
    if (product.stock === 0) {
      alert('Produkt ist ausverkauft')
      return
    }
    
    addItem({
      productId: product.productId,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl
    })
    
    // Optional: Toast notification
    alert(`${product.name} wurde zum Warenkorb hinzugefügt!`)
  }

  const ensureHttps = (url: string): string => {
    // If URL already has protocol, return as is
    if (url.match(/^https?:\/\//i)) {
      return url
    }
    // Otherwise, add https://
    return `https://${url}`
  }

  const handleProductClick = (product: Product) => {
    if (product.externalLink) {
      const url = ensureHttps(product.externalLink)
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="relative py-12 overflow-hidden bg-gradient-to-br from-primary-900/20 via-dark-950 to-dark-950">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">
                <span className="glow-text">Merch Shop</span>
              </h1>
              <p className="text-dark-400 text-lg">
                Exklusive Produkte für echte Fans
              </p>
            </div>
            
            <div className="relative">
              <button
                onClick={() => navigate('/cart')}
                className="btn-secondary flex items-center gap-2"
              >
                <ShoppingCart size={20} />
                Warenkorb
                {getTotalItems() > 0 && (
                  <span className="absolute -top-2 -right-2 bg-primary-600 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center">
                    {getTotalItems()}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <motion.div
                key={product.productId}
                whileHover={{ y: -5 }}
                className="card group relative"
              >
                {/* Admin Actions */}
                {isAdmin && (
                  <div className="absolute top-4 right-4 flex gap-2 z-10">
                    <button
                      onClick={() => handleEdit(product)}
                      className="p-2 rounded-lg bg-dark-800 hover:bg-primary-600 transition-colors"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(product)}
                      className="p-2 rounded-lg bg-dark-800 hover:bg-red-600 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}

                {/* Product Image */}
                <div 
                  className="relative aspect-square bg-dark-800 rounded-lg mb-4 overflow-hidden cursor-pointer"
                  onClick={() => handleProductClick(product)}
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
                
                {product.description && (
                  <p className="text-sm text-dark-400 mb-3 line-clamp-2">
                    {product.description}
                  </p>
                )}

                <div className="flex items-center justify-between mt-auto">
                  <span className="text-2xl font-bold text-primary-400">
                    €{product.price.toFixed(2)}
                  </span>
                  {product.externalLink ? (
                    <a
                      href={ensureHttps(product.externalLink)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary py-2 px-4 text-sm flex items-center gap-2"
                    >
                      Zum Shop
                      <ExternalLink size={14} />
                    </a>
                  ) : (
                    <button
                      onClick={() => handleAddToCart(product)}
                      disabled={product.stock === 0}
                      className="btn-primary py-2 px-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      In den Warenkorb
                    </button>
                  )}
                </div>

                {product.stock === 0 && (
                  <div className="absolute inset-0 bg-dark-900/80 rounded-lg flex items-center justify-center">
                    <span className="text-lg font-semibold">Ausverkauft</span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
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

      {/* Shop Settings Modal */}
      <ShopSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSuccess={() => console.log('Settings saved')}
      />
    </div>
  )
}
