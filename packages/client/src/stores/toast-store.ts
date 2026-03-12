import { create } from 'zustand';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

let toastCounter = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast-${++toastCounter}-${Date.now()}`;
    const duration = toast.duration ?? 4000;
    const newToast: Toast = { ...toast, id, duration };

    set((state) => {
      // Keep max 5 visible toasts
      const updated = [...state.toasts, newToast];
      if (updated.length > 5) {
        return { toasts: updated.slice(updated.length - 5) };
      }
      return { toasts: updated };
    });

    // Auto-dismiss after duration
    setTimeout(() => {
      get().removeToast(id);
    }, duration);
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
