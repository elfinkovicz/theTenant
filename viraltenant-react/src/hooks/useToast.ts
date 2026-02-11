import { create } from 'zustand';
import { ToastType } from '../components/Toast';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, type: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  
  addToast: (message: string, type: ToastType, duration = 2000) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    set((state) => ({
      toasts: [...state.toasts, { id, message, type, duration }]
    }));
  },
  
  removeToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id)
    }));
  },
  
  success: (message: string, duration = 2000) => {
    useToastStore.getState().addToast(message, 'success', duration);
  },
  
  error: (message: string, duration = 2000) => {
    useToastStore.getState().addToast(message, 'error', duration);
  },
  
  warning: (message: string, duration = 2000) => {
    useToastStore.getState().addToast(message, 'warning', duration);
  },
  
  info: (message: string, duration = 2000) => {
    useToastStore.getState().addToast(message, 'info', duration);
  }
}));

// Hook for components
export function useToast() {
  const { success, error, warning, info } = useToastStore();
  
  return {
    success,
    error,
    warning,
    info
  };
}

// Global toast function (can be used outside React components)
export const toast = {
  success: (message: string, duration?: number) => useToastStore.getState().success(message, duration),
  error: (message: string, duration?: number) => useToastStore.getState().error(message, duration),
  warning: (message: string, duration?: number) => useToastStore.getState().warning(message, duration),
  info: (message: string, duration?: number) => useToastStore.getState().info(message, duration)
};
