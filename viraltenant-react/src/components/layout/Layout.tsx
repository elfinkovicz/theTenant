import { ReactNode, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'

interface LayoutProps {
  children: ReactNode
}

export const Layout = ({ children }: LayoutProps) => {
  const location = useLocation()
  const [isVisible, setIsVisible] = useState(true)
  const [displayedChildren, setDisplayedChildren] = useState(children)

  useEffect(() => {
    // Quick fade out
    setIsVisible(false)
    
    // After fade out, swap content and fade in
    const timer = setTimeout(() => {
      setDisplayedChildren(children)
      setIsVisible(true)
    }, 100) // 100ms fade out

    return () => clearTimeout(timer)
  }, [location.pathname])

  // Update children immediately if same route (e.g., state changes)
  useEffect(() => {
    if (isVisible) {
      setDisplayedChildren(children)
    }
  }, [children, isVisible])

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main 
        className="flex-1 transition-opacity duration-100"
        style={{ opacity: isVisible ? 1 : 0 }}
      >
        {displayedChildren}
      </main>
      <Footer />
    </div>
  )
}
