import { useEffect, useState } from 'react'
import { useCartStore } from '../store/cartStore'

/**
 * Hook to ensure Zustand store has hydrated from localStorage
 * Prevents hydration mismatches in SSR/Client rendering
 */
export const useHydration = () => {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // Check if persist middleware has finished rehydrating
    const unsubscribe = useCartStore.persist.onFinishHydration(() => {
      setHydrated(true)
    })

    // Fallback: If already hydrated, set immediately
    if (useCartStore.persist.hasHydrated()) {
      setHydrated(true)
    }

    return unsubscribe
  }, [])

  return hydrated
}
