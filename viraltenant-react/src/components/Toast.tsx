import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  onClose: (id: string) => void;
}

export function Toast({ id, message, type, duration = 2000, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  const icons = {
    success: <CheckCircle className="w-16 h-16" />,
    error: <XCircle className="w-16 h-16" />,
    warning: <AlertCircle className="w-16 h-16" />,
    info: <Info className="w-16 h-16" />
  };

  const iconColors = {
    success: 'text-green-400',
    error: 'text-red-400',
    warning: 'text-yellow-400',
    info: 'text-blue-400'
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: -20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: -20 }}
      transition={{ duration: 0.3, type: "spring", stiffness: 200, damping: 20 }}
      className="relative bg-gradient-to-br from-dark-800 via-dark-850 to-dark-900 border border-dark-700 rounded-xl shadow-2xl px-8 py-6 min-w-[400px] max-w-[600px]"
      style={{
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)'
      }}
    >
      {/* Close Button */}
      <button
        onClick={() => onClose(id)}
        className="absolute top-3 right-3 text-dark-400 hover:text-white transition-colors z-10"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Content */}
      <div className="flex flex-col items-center gap-4 text-center">
        {/* Animated Icon */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ 
            delay: 0.1,
            duration: 0.5,
            type: "spring",
            stiffness: 200,
            damping: 15
          }}
          className={`${iconColors[type]} drop-shadow-lg`}
        >
          {icons[type]}
        </motion.div>

        {/* Message */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="text-white font-semibold text-lg leading-relaxed"
        >
          {message}
        </motion.p>
      </div>

      {/* Progress Bar */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 to-primary-600 rounded-b-xl"
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: duration / 1000, ease: "linear" }}
        style={{ transformOrigin: "left" }}
      />
    </motion.div>
  );
}

export interface ToastContainerProps {
  toasts: Array<{
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
  }>;
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-[9999]">
      <div className="flex flex-col gap-4 pointer-events-auto">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <Toast
              key={toast.id}
              id={toast.id}
              message={toast.message}
              type={toast.type}
              duration={toast.duration}
              onClose={onClose}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
