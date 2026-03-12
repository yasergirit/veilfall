import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../stores/auth-store.js';

interface Notification {
  id: string;
  type: 'building' | 'combat' | 'march' | 'research' | 'trade' | 'system';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

const TYPE_ICONS: Record<Notification['type'], string> = {
  building: '\u{1F3D7}',
  combat: '\u2694\uFE0F',
  march: '\u{1F3C3}',
  research: '\u{1F52C}',
  trade: '\u{1F4B0}',
  system: '\u{1F4E2}',
};

const POLL_INTERVAL = 5_000;

function formatRelativeTime(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffSeconds = Math.max(0, Math.floor((now - then) / 1000));

  if (diffSeconds < 60) return 'just now';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Fetch notifications from the API
  const fetchNotifications = useCallback(async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    try {
      const res = await fetch('/api/notifications?limit=20&unreadOnly=false', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(Array.isArray(data) ? data : data.notifications ?? []);
    } catch {
      // Silently ignore network errors during polling
    }
  }, []);

  // Poll every 5 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Mark a single notification as read
  const markAsRead = async (id: string) => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );

    try {
      await fetch(`/api/notifications/read/${id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Revert on failure
      fetchNotifications();
    }
  };

  // Mark all as read
  const markAllRead = async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    setLoading(true);
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    try {
      await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      fetchNotifications();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative text-sm px-2 py-1 rounded border transition-colors bg-[var(--veil-blue)]/50 border-[var(--ruin-grey)]/20 text-[var(--parchment-dim)] hover:text-[var(--parchment)]"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {'\u{1F514}'}
        {unreadCount > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold leading-none"
            style={{
              background: 'var(--ember-gold)',
              color: 'var(--veil-blue)',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute top-full right-0 mt-2 w-80 rounded-lg border border-[var(--ruin-grey)]/30 backdrop-blur-sm z-50 flex flex-col overflow-hidden"
          style={{
            background: 'rgba(26, 39, 68, 0.95)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          }}
          role="region"
          aria-label="Notification panel"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--ruin-grey)]/20">
            <h3
              className="text-sm font-semibold text-[var(--parchment)]"
              style={{ fontFamily: 'Cinzel, serif' }}
            >
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                disabled={loading}
                className="text-[11px] text-[var(--aether-violet)] hover:text-[var(--parchment)] transition-colors disabled:opacity-40"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-[var(--ruin-grey)] italic">
                  No notifications yet
                </p>
              </div>
            ) : (
              <ul role="list">
                {notifications.map((notification) => (
                  <li key={notification.id}>
                    <button
                      onClick={() => {
                        if (!notification.read) markAsRead(notification.id);
                      }}
                      className="w-full text-left px-4 py-3 flex gap-3 items-start transition-colors hover:bg-white/5"
                      style={{
                        borderLeft: notification.read
                          ? '3px solid transparent'
                          : '3px solid var(--aether-violet)',
                      }}
                    >
                      {/* Type icon */}
                      <span className="text-base shrink-0 mt-0.5" aria-hidden="true">
                        {TYPE_ICONS[notification.type] ?? TYPE_ICONS.system}
                      </span>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-xs leading-snug truncate ${
                            notification.read
                              ? 'text-[var(--parchment-dim)]'
                              : 'text-[var(--parchment)] font-semibold'
                          }`}
                        >
                          {notification.title}
                        </p>
                        <p className="text-[11px] text-[var(--ruin-grey)] leading-snug mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                      </div>

                      {/* Time */}
                      <span className="text-[10px] text-[var(--ruin-grey)] shrink-0 mt-0.5 tabular-nums">
                        {formatRelativeTime(notification.createdAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
