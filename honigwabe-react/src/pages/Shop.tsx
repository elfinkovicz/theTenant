import { useState } from 'react'
import { motion } from 'framer-motion'
import { ShoppingCart, Heart, Star } from 'lucide-react'

interface Product {
  id: string
  name: string
  price: number
  image: string
  rating: number
  reviews: number
}

export const Shop = () => {
  const [cart, setCart] = useState<string[]>([])
  
  const products: Product[] = [
    {
      id: '1',
      name: 'Brand T-Shirt',
      price: 29.99,
      image: '/placeholder-product.jpg',
      rating: 4.8,
      reviews: 124
    },
    {
      id: '2',
      name: 'Hoodie Limited Edition',
      price: 59.99,
      image: '/placeholder-product.jpg',
      rating: 4.9,
      reviews: 89
    },
    {
      id: '3',
      name: 'Cap',
      price: 24.99,
      image: '/placeholder-product.jpg',
      rating: 4.7,
      reviews: 156
    },
    {
      id: '4',
      name: 'Tasse',
      price: 14.99,
      image: '/placeholder-product.jpg',
      rating: 4.6,
      reviews: 203
    },
  ]

  const addToCart = (productId: string) => {
    setCart([...cart, productId])
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
              <button className="btn-secondary flex items-center gap-2">
                <ShoppingCart size={20} />
                Warenkorb
                {cart.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-primary-600 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center">
                    {cart.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <motion.div
              key={product.id}
              whileHover={{ y: -5 }}
              className="card group"
            >
              <div className="relative aspect-square bg-dark-800 rounded-lg mb-4 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary-900/20 to-dark-900 flex items-center justify-center">
                  <span className="text-6xl">logo</span>
                </div>
                
                <button className="absolute top-2 right-2 p-2 bg-dark-900/80 rounded-full hover:bg-primary-600 transition-colors">
                  <Heart size={20} />
                </button>
              </div>

              <h3 className="text-lg font-semibold mb-2">{product.name}</h3>
              
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1">
                  <Star size={16} className="fill-yellow-500 text-yellow-500" />
                  <span className="text-sm">{product.rating}</span>
                </div>
                <span className="text-sm text-dark-400">
                  ({product.reviews} Bewertungen)
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-primary-400">
                  €{product.price}
                </span>
                <button
                  onClick={() => addToCart(product.id)}
                  className="btn-primary py-2 px-4 text-sm"
                >
                  In den Warenkorb
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
