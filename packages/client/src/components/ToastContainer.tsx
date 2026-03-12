import { useEffect, useState } from 'react';
import { useToastStore } from '../stores/toast-store.js';

const TYPE_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  success: {
    bg: 'rgba(34, 80, 34, 0.92)',
    border: 'rgba(72, 160, 72, 0.5)',
    text: '#8de08d',
  },
  error: {
    bg: 'rgba(80, 24, 24, 0.92)',
    border: 'rgba(180, 60, 60, 0.5)',
    text: '#e08d8d',
  },
  info: {
    bg: 'rgba(40, 30, 70, 0.92)',
    border: 'rgba(var(--aether-violet-rgb, 128, 90, 213), 0.5)',
    text: 'var(--aether-violet)',
  },
  warning: {
    bg: 'rgba(70, 50, 20, 0.92)',
    border: 'rgba(var(--ember-gold-rgb, 210, 160, 60), 0.5)',
    text: 'var(--ember-gold)',
  },
};

const TYPE_ICONS: Record<string, string> = {
  success: '\u2713',
  error: '\u2717',
  info: '\u2139',
  warning: '\u26A0',
};

interface ToastItemProps {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  onRemove: (id: string) => void;
}

function ToastItem({ id, message, type, onRemove }: ToastItemProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const style = TYPE_STYLES[type] ?? TYPE_STYLES.info;

  useEffect(() => {
    // Trigger slide-in on mount
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleRemove = () => {
    setExiting(true);
    setTimeout(() => onRemove(id), 300);
  };

  return (
    <div
      style={{
        background: style.bg,
        borderColor: style.border,
        transform: visible && !exiting ? 'translateX(0)' : 'translateX(120%)',
        opacity: visible && !exiting ? 1 : 0,
        transition: 'transform 0.3s ease, opacity 0.3s ease',
      }}
      className="flex items-start gap-2 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm max-w-xs pointer-events-auto"
    >
      <span
        className="text-sm font-bold shrink-0 mt-0.5"
        style={{ color: style.text }}
      >
        {TYPE_ICONS[type]}
      </span>
      <span
        className="text-sm flex-1 leading-snug"
        style={{ color: style.text }}
      >
        {message}
      </span>
      <button
        onClick={handleRemove}
        className="text-xs shrink-0 ml-1 mt-0.5 opacity-60 hover:opacity-100 transition-opacity"
        style={{ color: style.text }}
        aria-label="Dismiss notification"
      >
        \u2715
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-14 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          onRemove={removeToast}
        />
      ))}
    </div>
  );
}
