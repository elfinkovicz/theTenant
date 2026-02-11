import { X, ShoppingCart, ExternalLink, Star, Package } from 'lucide-react';
import { Product } from '../services/product.service';
import { useCartStore } from '../store/cartStore';

// Currency symbol mapping
const currencySymbols: Record<string, string> = {
  EUR: '€',
  USD: '$',
  CHF: 'CHF',
  GBP: '£'
}

interface ProductDetailModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  currency?: string;
}

export function ProductDetailModal({ product, isOpen, onClose, currency = 'EUR' }: ProductDetailModalProps) {
  const { addItem } = useCartStore();
  const currencySymbol = currencySymbols[currency] || currency;

  if (!isOpen || !product) return null;

  const ensureHttps = (url: string): string => {
    if (url.match(/^https?:\/\//i)) {
      return url;
    }
    return `https://${url}`;
  };

  const handleAddToCart = () => {
    if (product.stock === 0) {
      alert('Produkt ist ausverkauft');
      return;
    }
    
    addItem({
      productId: product.productId,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl
    });
    
    alert(`${product.name} wurde zum Warenkorb hinzugefügt!`);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className={`bg-dark-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto border ${
          product.featured ? 'border-yellow-500/50 shadow-[0_0_40px_rgba(234,179,8,0.3)]' : 'border-dark-800'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-dark-900/80 hover:bg-dark-800 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Featured Badge */}
          {product.featured && (
            <div className="absolute top-4 left-4 z-10 bg-gradient-to-r from-yellow-500 to-amber-500 text-black px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 shadow-lg">
              <Star size={16} fill="currentColor" />
              Featured
            </div>
          )}

          {/* Product Image */}
          <div className="w-full aspect-square md:aspect-[16/9] overflow-hidden rounded-t-lg bg-dark-800">
            {product.imageUrl ? (
              <img 
                src={product.imageUrl} 
                alt={product.name} 
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-24 h-24 text-dark-600" />
              </div>
            )}
          </div>

          {/* Sold Out Overlay */}
          {product.stock === 0 && (
            <div className="absolute inset-0 bg-dark-900/50 flex items-center justify-center rounded-t-lg">
              <span className="text-2xl font-bold bg-dark-900/80 px-6 py-3 rounded-lg">Ausverkauft</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 md:p-8">
          {/* Title & Price */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
            <h2 className="text-3xl md:text-4xl font-bold glow-text">
              {product.name}
            </h2>
            <span className={`text-3xl md:text-4xl font-bold flex-shrink-0 ${
              product.featured ? 'text-yellow-400' : 'text-primary-400'
            }`}>
              {currencySymbol}{product.price.toFixed(2)}
            </span>
          </div>

          {/* Product Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Stock */}
            {product.stock !== undefined && product.stock > 0 && (
              <div className="flex items-start gap-3 p-4 bg-dark-800 rounded-lg">
                <Package className="text-primary-400 flex-shrink-0 mt-1" size={24} />
                <div>
                  <p className="text-sm text-dark-400 mb-1">Verfügbarkeit</p>
                  <p className="font-semibold text-lg">
                    {product.stock > 10 ? 'Auf Lager' : `Nur noch ${product.stock} verfügbar`}
                  </p>
                </div>
              </div>
            )}

            {/* External Link Info */}
            {product.externalLink && (
              <div className="flex items-start gap-3 p-4 bg-dark-800 rounded-lg">
                <ExternalLink className="text-primary-400 flex-shrink-0 mt-1" size={24} />
                <div>
                  <p className="text-sm text-dark-400 mb-1">Bezugsquelle</p>
                  <p className="font-semibold text-lg">Externer Shop</p>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <div className="mb-6">
              <h3 className="text-xl font-bold mb-3">Beschreibung</h3>
              <p className="text-dark-300 whitespace-pre-wrap leading-relaxed">
                {product.description}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {product.externalLink ? (
              <>
                <a
                  href={ensureHttps(product.externalLink)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary flex-1 flex items-center justify-center gap-2 text-lg py-4"
                >
                  <ShoppingCart size={20} />
                  Zum Shop
                </a>
                <a
                  href={ensureHttps(product.externalLink)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary p-4"
                  title="In neuem Tab öffnen"
                >
                  <ExternalLink size={20} />
                </a>
              </>
            ) : product.stock === 0 ? (
              <div className="flex-1 text-center py-4 px-6 bg-dark-800 rounded-lg text-dark-400 text-lg">
                Dieses Produkt ist ausverkauft
              </div>
            ) : (
              <button
                onClick={handleAddToCart}
                className="btn-primary flex-1 flex items-center justify-center gap-2 text-lg py-4"
              >
                <ShoppingCart size={20} />
                In den Warenkorb
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
