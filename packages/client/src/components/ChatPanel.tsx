import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../lib/api.js';
import { useAuthStore } from '../stores/auth-store.js';
import { useToastStore } from '../stores/toast-store.js';

const FACTION_COLORS: Record<string, string> = {
  ironveil: '#4A6670',
  aetheri: '#9B6ED4',
  thornwatch: '#3A6B35',
  ashen: '#E87D20',
};

interface ChatMessage {
  id: string;
  senderId: string;
  senderUsername: string;
  senderFaction: string;
  content: string;
  timestamp: string;
  isSystem?: boolean;
}

interface Channel {
  type: string;
  id: string;
  label: string;
}

function formatTime(timestamp: string): string {
  const d = new Date(timestamp);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function ChatPanel() {
  const player = useAuthStore((s) => s.player);
  const [expanded, setExpanded] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([
    { type: 'world', id: 'world', label: 'World' },
  ]);
  const [activeChannel, setActiveChannel] = useState<Channel>({ type: 'world', id: 'world', label: 'World' });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const addToast = useToastStore((s) => s.addToast);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  // Fetch available channels
  useEffect(() => {
    api.getChatChannels().then((data) => {
      if (data.channels && data.channels.length > 0) {
        setChannels(data.channels);
      }
    }).catch(() => {
      // Keep default world channel
    });
  }, []);

  // Fetch messages for active channel
  const fetchMessages = useCallback(async () => {
    try {
      const data = await api.getChatMessages(activeChannel.type, activeChannel.id);
      const msgs: ChatMessage[] = data.messages ?? [];
      setMessages(msgs);

      // Track unread when collapsed
      if (!expanded && msgs.length > 0) {
        const lastId = msgs[msgs.length - 1].id;
        if (lastMessageIdRef.current && lastId !== lastMessageIdRef.current) {
          setUnreadCount((prev) => prev + 1);
        }
        lastMessageIdRef.current = lastId;
      }
    } catch {
      // Silently fail on poll
    }
  }, [activeChannel, expanded]);

  // Initial fetch and poll every 5s when expanded
  useEffect(() => {
    fetchMessages();

    if (expanded) {
      pollRef.current = setInterval(fetchMessages, 5000);
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [fetchMessages, expanded]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (expanded) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, expanded]);

  // Clear unread when expanding
  const handleToggle = () => {
    setExpanded((prev) => {
      if (!prev) {
        setUnreadCount(0);
        if (messages.length > 0) {
          lastMessageIdRef.current = messages[messages.length - 1].id;
        }
      }
      return !prev;
    });
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const content = input.trim();
    setInput('');
    setSending(true);
    try {
      await api.sendChatMessage(activeChannel.type, activeChannel.id, content);
      await fetchMessages();
    } catch {
      // Restore input on failure
      setInput(content);
      addToast({ message: 'Failed to send message', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="absolute bottom-0 left-16 z-30 flex flex-col transition-all duration-300 ease-in-out pointer-events-auto"
      style={{
        width: expanded ? '300px' : '180px',
        height: expanded ? '400px' : '32px',
      }}
    >
      {/* Collapsed Bar / Header */}
      <button
        onClick={handleToggle}
        className="flex items-center justify-between px-3 h-8 shrink-0 rounded-t-lg border border-b-0 border-[var(--ruin-grey)]/30 text-sm transition-colors hover:border-[var(--aether-violet)]/40"
        style={{ background: 'rgba(26, 39, 68, 0.95)' }}
      >
        <span className="text-[var(--parchment-dim)] text-xs" style={{ fontFamily: 'Cinzel, serif' }}>
          {expanded ? activeChannel.label + ' Chat' : 'World Chat'}
        </span>
        <div className="flex items-center gap-2">
          {!expanded && unreadCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-[var(--ember-gold)] text-[var(--veil-blue-deep)] text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          <span className="text-[var(--ruin-grey)] text-xs">
            {expanded ? '\u25BC' : '\u25B2'}
          </span>
        </div>
      </button>

      {/* Expanded Panel */}
      {expanded && (
        <div
          className="flex-1 flex flex-col border border-[var(--ruin-grey)]/30 rounded-b-lg overflow-hidden"
          style={{ background: 'rgba(18, 28, 50, 0.97)' }}
        >
          {/* Channel Tabs */}
          <div className="flex border-b border-[var(--ruin-grey)]/20 shrink-0">
            {channels.map((ch) => (
              <button
                key={`${ch.type}-${ch.id}`}
                onClick={() => setActiveChannel(ch)}
                className={`flex-1 px-2 py-1.5 text-[11px] transition-colors ${
                  activeChannel.type === ch.type && activeChannel.id === ch.id
                    ? 'text-[var(--ember-gold)] border-b-2 border-[var(--ember-gold)]'
                    : 'text-[var(--ruin-grey)] hover:text-[var(--parchment-dim)]'
                }`}
              >
                {ch.label}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
            {messages.length === 0 && (
              <p className="text-xs text-[var(--ruin-grey)] text-center mt-8">No messages yet. Be the first to speak.</p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className="text-xs leading-relaxed">
                {msg.isSystem ? (
                  <span className="italic text-[var(--ruin-grey)]">{msg.content}</span>
                ) : (
                  <>
                    <span className="text-[var(--ruin-grey)] opacity-60">[{formatTime(msg.timestamp)}]</span>{' '}
                    <span
                      className="font-semibold"
                      style={{ color: FACTION_COLORS[msg.senderFaction?.toLowerCase()] ?? 'var(--parchment)' }}
                    >
                      {msg.senderUsername}
                    </span>
                    <span className="text-[var(--parchment-dim)]">: {msg.content}</span>
                  </>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex items-center gap-1 p-2 border-t border-[var(--ruin-grey)]/20 shrink-0">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={300}
              className="flex-1 px-2 py-1.5 rounded bg-[var(--veil-blue-deep)] border border-[var(--ruin-grey)]/25 text-[var(--parchment)] text-xs focus:outline-none focus:border-[var(--aether-violet)]/50"
              placeholder="Type a message..."
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              className={`px-2.5 py-1.5 rounded text-xs transition-colors ${
                input.trim() && !sending
                  ? 'bg-[var(--aether-violet)]/25 border border-[var(--aether-violet)]/40 text-[var(--parchment)] hover:bg-[var(--aether-violet)]/45'
                  : 'bg-[var(--ruin-grey)]/15 border border-[var(--ruin-grey)]/20 text-[var(--ruin-grey)] cursor-not-allowed'
              }`}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
