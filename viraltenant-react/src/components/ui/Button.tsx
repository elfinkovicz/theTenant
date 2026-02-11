import { ReactNode } from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'
import clsx from 'clsx'

interface ButtonProps extends Omit<HTMLMotionProps<"button">, 'children'> {
  children: ReactNode
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
}

export const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md',
  className,
  ...props 
}: ButtonProps) => {
  const baseClass = variant === 'primary' ? 'btn-primary' : 'btn-secondary'
  
  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3',
    lg: 'px-8 py-4 text-lg'
  }
  
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={clsx(baseClass, sizeClasses[size], className)}
      {...props}
    >
      {children}
    </motion.button>
  )
}
