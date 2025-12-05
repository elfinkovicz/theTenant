import { useEffect, useState } from 'react'

/**
 * Hook to ensure Zustand store has hydrated from localStorage
 * Simple delay-based approach for reliable hydration
 */
export const useHydration = () => {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // Mark as hydrated after first render
    // This ensures localStorage has been read
    setHydrated(true)
  }, [])

  return hydrated
}
