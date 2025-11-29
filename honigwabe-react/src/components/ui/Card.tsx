import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
}

export const Card = ({ children, className, hover = true }: CardProps) => {
  return (
    <motion.div
      whileHover={hover ? { y: -5 } : undefined}
      className={clsx('card', className)}
    >
      {children}
    </motion.div>
  )
}
