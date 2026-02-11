import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface CartItem {
  productId: string
  name: string
  price: number
  imageUrl?: string | null
  quantity: number
  stock?: number // Lagerbestand für Validierung
}

interface CartStore {
  items: CartItem[]
  currency: string
  addItem: (product: { productId: string; name: string; price: number; imageUrl?: string | null; stock?: number }) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => boolean // Returns false if stock exceeded
  clearCart: () => void
  getTotalItems: () => number
  getTotalPrice: () => number
  getItemStock: (productId: string) => number | undefined
  setCurrency: (currency: string) => void
  getCurrencySymbol: () => string
}

// Currency symbol mapping
const currencySymbols: Record<string, string> = {
  EUR: '€',
  USD: '$',
  CHF: 'CHF',
  GBP: '£'
}

// Get initial items from localStorage synchronously to prevent flash
const getInitialItems = (): CartItem[] => {
  try {
    const stored = localStorage.getItem('cart-storage')
    if (stored) {
      const parsed = JSON.parse(stored)
      return parsed?.state?.items || []
    }
  } catch (e) {
    console.error('[CartStore] Failed to read initial items:', e)
  }
  return []
}

const getInitialCurrency = (): string => {
  try {
    const stored = localStorage.getItem('cart-storage')
    if (stored) {
      const parsed = JSON.parse(stored)
      return parsed?.state?.currency || 'EUR'
    }
  } catch (e) {
    console.error('[CartStore] Failed to read initial currency:', e)
  }
  return 'EUR'
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: getInitialItems(),
      currency: getInitialCurrency(),

      addItem: (product) => {
        const items = get().items
        const existingItem = items.find(item => item.productId === product.productId)

        if (existingItem) {
          // Check stock before adding
          const newQuantity = existingItem.quantity + 1
          const stock = product.stock ?? existingItem.stock
          if (stock !== undefined && newQuantity > stock) {
            return // Don't add if exceeds stock
          }
          set({
            items: items.map(item =>
              item.productId === product.productId
                ? { ...item, quantity: newQuantity, stock: stock }
                : item
            )
          })
        } else {
          set({
            items: [...items, { ...product, quantity: 1 }]
          })
        }
      },

      removeItem: (productId) => {
        set({ items: get().items.filter(item => item.productId !== productId) })
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId)
          return true
        }

        const item = get().items.find(i => i.productId === productId)
        if (item && item.stock !== undefined && quantity > item.stock) {
          // Quantity exceeds stock - don't update and return false
          return false
        }

        set({
          items: get().items.map(item =>
            item.productId === productId ? { ...item, quantity } : item
          )
        })
        return true
      },

      clearCart: () => {
        set({ items: [] })
      },

      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0)
      },

      getTotalPrice: () => {
        return get().items.reduce((total, item) => total + (item.price * item.quantity), 0)
      },

      getItemStock: (productId) => {
        const item = get().items.find(i => i.productId === productId)
        return item?.stock
      },

      setCurrency: (currency) => {
        set({ currency })
      },

      getCurrencySymbol: () => {
        const currency = get().currency
        return currencySymbols[currency] || currency
      }
    }),
    {
      name: 'cart-storage',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true // We already loaded items synchronously
    }
  )
)
