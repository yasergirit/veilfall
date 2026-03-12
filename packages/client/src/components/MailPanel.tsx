import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api.js';
import { useToastStore } from '../stores/toast-store.js';

/* --- Types --- */

interface MailMessage {
  id: string;
  fromUsername: string;
  toUsername: string;
  subject: string;
  body: string;
  read: boolean;
  starred: boolean;
  createdAt: string;
}

/* --- Helpers --- */

function relativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/* --- Compose Form --- */

function ComposeForm({ onSent, onCancel }: { onSent: () => void; onCancel: () => void }) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const addToast = useToastStore((s) => s.addToast);

  const handleSend = async () => {
    if (!to.trim() || !subject.trim()) {
      addToast({ message: 'Recipient and subject are required', type: 'error' });
      return;
    }
    setSending(true);
    try {
      await api.sendMail(to.trim(), subject.trim(), body.trim());
      addToast({ message: 'Mail sent', type: 'success' });
      onSent();
    } catch (err) {
      addToast({ message: err instanceof Error ? err.message : 'Failed to send mail', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-5 rounded-lg border border-[var(--aether-violet)]/30 bg-[var(--veil-blue)]/40">
      <h3
        className="text-base mb-4"
        style={{ fontFamily: 'Cinzel, serif', color: 'var(--ember-gold)' }}
      >
        Compose Message
      </h3>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-[var(--parchment-dim)] block mb-1">To (username)</label>
          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="Enter recipient username..."
            className="w-full px-3 py-2 rounded bg-[var(--veil-blue-deep)] border border-[var(--ruin-grey)]/30 text-sm text-[var(--parchment)] placeholder:text-[var(--ruin-grey)]/50 focus:border-[var(--aether-violet)]/50 focus:outline-none transition-colors"
          />
        </div>

        <div>
          <label className="text-xs text-[var(--parchment-dim)] block mb-1">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject..."
            className="w-full px-3 py-2 rounded bg-[var(--veil-blue-deep)] border border-[var(--ruin-grey)]/30 text-sm text-[var(--parchment)] placeholder:text-[var(--ruin-grey)]/50 focus:border-[var(--aether-violet)]/50 focus:outline-none transition-colors"
          />
        </div>

        <div>
          <label className="text-xs text-[var(--parchment-dim)] block mb-1">Body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message..."
            rows={5}
            className="w-full px-3 py-2 rounded bg-[var(--veil-blue-deep)] border border-[var(--ruin-grey)]/30 text-sm text-[var(--parchment)] placeholder:text-[var(--ruin-grey)]/50 focus:border-[var(--aether-violet)]/50 focus:outline-none transition-colors resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded text-xs text-[var(--parchment-dim)] border border-[var(--ruin-grey)]/30 hover:border-[var(--ruin-grey)]/50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="px-4 py-2 rounded text-xs text-[var(--parchment)] bg-[var(--aether-violet)]/80 hover:bg-[var(--aether-violet)] border border-[var(--aether-violet)]/50 transition-colors disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send Mail'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* --- Mail Item Row --- */

function MailRow({
  mail,
  isExpanded,
  onToggle,
  onStar,
  onDelete,
  isSent,
}: {
  mail: MailMessage;
  isExpanded: boolean;
  onToggle: () => void;
  onStar: () => void;
  onDelete: () => void;
  isSent: boolean;
}) {
  return (
    <div
      className={`rounded-lg border overflow-hidden transition-all ${
        !mail.read && !isSent
          ? 'border-l-[3px] border-l-[var(--aether-violet)] border-t-[var(--ruin-grey)]/30 border-r-[var(--ruin-grey)]/30 border-b-[var(--ruin-grey)]/30'
          : 'border-[var(--ruin-grey)]/20'
      }`}
      style={{ background: !mail.read && !isSent ? 'rgba(123, 79, 191, 0.06)' : 'rgba(26, 39, 68, 0.4)' }}
    >
      {/* Header row - clickable */}
      <button
        onClick={onToggle}
        className="w-full p-3 text-left hover:bg-[var(--veil-blue)]/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          {/* Star toggle */}
          {!isSent && (
            <span
              onClick={(e) => { e.stopPropagation(); onStar(); }}
              className="shrink-0 cursor-pointer text-sm transition-colors hover:scale-110"
              role="button"
              aria-label={mail.starred ? 'Unstar mail' : 'Star mail'}
              style={{ color: mail.starred ? '#D4A843' : 'var(--ruin-grey)' }}
            >
              {mail.starred ? '\u2605' : '\u2606'}
            </span>
          )}

          {/* From / To */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span
                className={`text-sm truncate ${
                  !mail.read && !isSent
                    ? 'font-semibold text-[var(--parchment)]'
                    : 'text-[var(--parchment-dim)]'
                }`}
              >
                {isSent ? `To: ${mail.toUsername}` : mail.fromUsername}
              </span>
              <span className="text-xs text-[var(--ruin-grey)] shrink-0">
                {relativeTime(mail.createdAt)}
              </span>
            </div>
            <p
              className={`text-xs truncate mt-0.5 ${
                !mail.read && !isSent
                  ? 'font-medium text-[var(--parchment)]'
                  : 'text-[var(--parchment-dim)]'
              }`}
            >
              {mail.subject}
            </p>
          </div>

          {/* Delete */}
          <span
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="shrink-0 cursor-pointer text-xs text-[var(--ruin-grey)] hover:text-red-400 transition-colors px-1"
            role="button"
            aria-label="Delete mail"
          >
            {'\u2715'}
          </span>

          {/* Expand indicator */}
          <span className="text-xs text-[var(--ruin-grey)] shrink-0">
            {isExpanded ? '\u25B2' : '\u25BC'}
          </span>
        </div>
      </button>

      {/* Expanded body */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-[var(--ruin-grey)]/15">
          <div className="mt-3 p-4 rounded bg-[var(--veil-blue-deep)]/50 border border-[var(--ruin-grey)]/10">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[var(--ruin-grey)]/15">
              <span className="text-xs text-[var(--ruin-grey)]">
                {isSent ? 'To' : 'From'}:
              </span>
              <span className="text-xs text-[var(--parchment)]">
                {isSent ? mail.toUsername : mail.fromUsername}
              </span>
              <span className="text-xs text-[var(--ruin-grey)] ml-auto">
                {new Date(mail.createdAt).toLocaleString()}
              </span>
            </div>
            <h4
              className="text-sm mb-2"
              style={{ fontFamily: 'Cinzel, serif', color: 'var(--ember-gold)' }}
            >
              {mail.subject}
            </h4>
            <p className="text-sm text-[var(--parchment)] leading-relaxed whitespace-pre-wrap">
              {mail.body || '(No content)'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* --- Main Component --- */

type Tab = 'inbox' | 'sent';

export default function MailPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('inbox');
  const [inbox, setInbox] = useState<MailMessage[]>([]);
  const [sent, setSent] = useState<MailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const addToast = useToastStore((s) => s.addToast);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchInbox = useCallback(async () => {
    try {
      const data = await api.getInbox();
      setInbox(data.mails ?? []);
    } catch {
      // silently fail for polling
    }
  }, []);

  const fetchSent = useCallback(async () => {
    try {
      const data = await api.getSentMail();
      setSent(data.mails ?? []);
    } catch {
      // silently fail
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await api.getUnreadMailCount();
      setUnreadCount(data.count ?? 0);
    } catch {
      // silently fail
    }
  }, []);

  // Initial load
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchInbox(), fetchSent(), fetchUnreadCount()])
      .finally(() => setLoading(false));
  }, [fetchInbox, fetchSent, fetchUnreadCount]);

  // Poll unread count every 15 seconds
  useEffect(() => {
    pollRef.current = setInterval(() => {
      fetchUnreadCount();
    }, 15_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchUnreadCount]);

  const handleToggleExpand = async (mail: MailMessage) => {
    if (expandedId === mail.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(mail.id);
    // Mark as read when expanding an unread inbox mail
    if (!mail.read && activeTab === 'inbox') {
      try {
        await api.markMailRead(mail.id);
        setInbox((prev) =>
          prev.map((m) => (m.id === mail.id ? { ...m, read: true } : m))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // ignore
      }
    }
  };

  const handleStar = async (id: string) => {
    try {
      await api.toggleMailStar(id);
      setInbox((prev) =>
        prev.map((m) => (m.id === id ? { ...m, starred: !m.starred } : m))
      );
    } catch {
      addToast({ message: 'Failed to update star', type: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteMail(id);
      setInbox((prev) => prev.filter((m) => m.id !== id));
      setSent((prev) => prev.filter((m) => m.id !== id));
      if (expandedId === id) setExpandedId(null);
      addToast({ message: 'Mail deleted', type: 'success' });
      fetchUnreadCount();
    } catch {
      addToast({ message: 'Failed to delete mail', type: 'error' });
    }
  };

  const handleComposeSent = () => {
    setComposing(false);
    fetchSent();
    fetchInbox();
  };

  const mails = activeTab === 'inbox' ? inbox : sent;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-2xl" style={{ fontFamily: 'Cinzel, serif' }}>
            Mail
          </h2>
          <button
            onClick={() => setComposing(!composing)}
            className="px-4 py-2 rounded text-xs text-[var(--parchment)] bg-[var(--aether-violet)]/80 hover:bg-[var(--aether-violet)] border border-[var(--aether-violet)]/50 transition-colors"
          >
            {composing ? 'Close Compose' : 'Compose'}
          </button>
        </div>
        <p className="text-sm text-[var(--parchment-dim)] mb-6">
          Send and receive messages from other players
        </p>

        {/* Compose form */}
        {composing && (
          <div className="mb-6">
            <ComposeForm onSent={handleComposeSent} onCancel={() => setComposing(false)} />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-[var(--ruin-grey)]/20">
          <button
            onClick={() => { setActiveTab('inbox'); setExpandedId(null); }}
            className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'inbox'
                ? 'text-[var(--ember-gold)] border-b-2 border-[var(--ember-gold)]'
                : 'text-[var(--ruin-grey)] hover:text-[var(--parchment-dim)]'
            }`}
          >
            Inbox
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--aether-violet)] text-white min-w-[18px] text-center">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab('sent'); setExpandedId(null); }}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'sent'
                ? 'text-[var(--ember-gold)] border-b-2 border-[var(--ember-gold)]'
                : 'text-[var(--ruin-grey)] hover:text-[var(--parchment-dim)]'
            }`}
          >
            Sent
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[var(--ruin-grey)]">
            Loading mail...
          </div>
        ) : mails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="text-4xl mb-4 opacity-30">{'\u{1F4E8}'}</span>
            <p className="text-[var(--ruin-grey)] text-sm italic">
              {activeTab === 'inbox'
                ? 'Your mailbox is empty'
                : 'No sent messages yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {mails.map((mail) => (
              <MailRow
                key={mail.id}
                mail={mail}
                isExpanded={expandedId === mail.id}
                onToggle={() => handleToggleExpand(mail)}
                onStar={() => handleStar(mail.id)}
                onDelete={() => handleDelete(mail.id)}
                isSent={activeTab === 'sent'}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
