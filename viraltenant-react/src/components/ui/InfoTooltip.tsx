import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'

interface InfoTooltipProps {
  text: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  size?: number
  className?: string
}

export const InfoTooltip = ({ 
  text, 
  position = 'top', 
  size = 14,
  className = ''
}: InfoTooltipProps) => {
  const [isVisible, setIsVisible] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const iconRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isVisible && iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect()
      const tooltipWidth = 256 // w-64 = 16rem = 256px
      const tooltipHeight = 60 // approximate height
      const margin = 8

      let top = 0
      let left = 0

      switch (position) {
        case 'top':
          top = rect.top - tooltipHeight - margin
          left = rect.left + rect.width / 2 - tooltipWidth / 2
          break
        case 'bottom':
          top = rect.bottom + margin
          left = rect.left + rect.width / 2 - tooltipWidth / 2
          break
        case 'left':
          top = rect.top + rect.height / 2 - tooltipHeight / 2
          left = rect.left - tooltipWidth - margin
          break
        case 'right':
          top = rect.top + rect.height / 2 - tooltipHeight / 2
          left = rect.right + margin
          break
      }

      // Keep tooltip within viewport
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      // Horizontal bounds
      if (left < 8) left = 8
      if (left + tooltipWidth > viewportWidth - 8) left = viewportWidth - tooltipWidth - 8

      // Vertical bounds - flip if needed
      if (top < 8 && position === 'top') {
        top = rect.bottom + margin
      }
      if (top + tooltipHeight > viewportHeight - 8 && position === 'bottom') {
        top = rect.top - tooltipHeight - margin
      }

      setTooltipPosition({ top, left })
    }
  }, [isVisible, position])

  const arrowStyle = {
    top: { bottom: '-8px', left: '50%', transform: 'translateX(-50%)', borderWidth: '4px', borderStyle: 'solid', borderColor: '#374151 transparent transparent transparent' },
    bottom: { top: '-8px', left: '50%', transform: 'translateX(-50%)', borderWidth: '4px', borderStyle: 'solid', borderColor: 'transparent transparent #374151 transparent' },
    left: { right: '-8px', top: '50%', transform: 'translateY(-50%)', borderWidth: '4px', borderStyle: 'solid', borderColor: 'transparent transparent transparent #374151' },
    right: { left: '-8px', top: '50%', transform: 'translateY(-50%)', borderWidth: '4px', borderStyle: 'solid', borderColor: 'transparent #374151 transparent transparent' }
  }

  return (
    <>
      <div 
        ref={iconRef}
        className={`relative inline-flex items-center ${className}`}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        <div className="p-1 rounded-full hover:bg-dark-700/50 transition-colors cursor-help">
          <Info size={size} className="text-dark-400 hover:text-primary-400 transition-colors" />
        </div>
      </div>
      
      {isVisible && createPortal(
        <div 
          className="fixed animate-in fade-in duration-150 pointer-events-none"
          style={{ 
            top: tooltipPosition.top, 
            left: tooltipPosition.left,
            zIndex: 99999
          }}
          onMouseEnter={() => setIsVisible(true)}
          onMouseLeave={() => setIsVisible(false)}
        >
          <div className="bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 shadow-xl w-64">
            <p className="text-sm text-dark-200 whitespace-normal leading-relaxed">{text}</p>
          </div>
          <div 
            className="absolute w-0 h-0"
            style={arrowStyle[position]}
          />
        </div>,
        document.body
      )}
    </>
  )
}
