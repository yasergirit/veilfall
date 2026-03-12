import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../lib/api.js';
import { useAuthStore } from '../stores/auth-store.js';
import { useToastStore } from '../stores/toast-store.js';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket.js';

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
  channelType?: string;
  channelId?: string;
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
  const token = useAuthStore((s) => s.token);
  const [expanded, setExpanded] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([
    { type: 'global', id: 'global', label: 'World' },
  ]);
  const [activeChannel, setActiveChannel] = useState<Channel>({ type: 'global', id: 'global', label: 'World' });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const addToast = useToastStore((s) => s.addToast);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const activeChannelRef = useRef(activeChannel);
  activeChannelRef.current = activeChannel;

  // Connect WebSocket on mount
  useEffect(() => {
    if (!token) return;

    try {
      const sock = connectSocket();

      sock.on('connect', () => setConnected(true));
      sock.on('disconnect', () => setConnected(false));

      // Listen for real-time messages
      sock.on('chat:message', (msg: ChatMessage) => {
        const ch = activeChannelRef.current;
        // Only add if it matches the active channel
        if (msg.channelType === ch.type &&
            (msg.channelType === 'global' ? msg.channelId === 'global' : msg.channelId === ch.id)) {
          setMessages((prev) => {
            // Deduplicate by id
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }

        // Track unread when collapsed
        if (!expandedRef.current && msg.senderId !== player?.id) {
          setUnreadCount((prev) => prev + 1);
        }
      });

      sock.on('online:count', (count: number) => {
        setOnlineCount(count);
      });
    } catch {
      // Socket connection failed — will fall back to polling
    }

    return () => {
      disconnectSocket();
      setConnected(false);
    };
  }, [token, player?.id]);

  // Fetch available channels
  useEffect(() => {
    api.getChatChannels().then((data) => {
      if (data.channels && data.channels.length > 0) {
        const mapped = data.channels.map((ch: any) => ({
          type: ch.type,
          id: ch.id,
          label: ch.name || ch.id,
        }));
        setChannels(mapped);
      }
    }).catch(() => {});
  }, []);

  // Fetch message history when channel changes or panel expands
  const fetchMessages = useCallback(async () => {
    try {
      const data = await api.getChatMessages(activeChannel.type, activeChannel.id);
      const msgs: ChatMessage[] = (data.messages ?? []).map((m: any) => ({
        id: m.id,
        senderId: m.senderId,
        senderUsername: m.senderName || m.senderUsername,
        senderFaction: m.senderFaction || '',
        content: m.content,
        timestamp: typeof m.timestamp === 'number' ? new Date(m.timestamp).toISOString() : m.timestamp,
        channelType: m.channelType,
        channelId: m.channelId,
      }));
      setMessages(msgs);
      if (msgs.length > 0) {
        lastMessageIdRef.current = msgs[msgs.length - 1].id;
      }
    } catch {
      // Silently fail
    }
  }, [activeChannel]);

  // Load history on channel switch or expand
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages, expanded]);

  // Fallback polling only if WebSocket is disconnected
  useEffect(() => {
    if (connected || !expanded) return;

    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [connected, expanded, fetchMessages]);

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

    const sock = getSocket();
    if (sock?.connected) {
      // Send via WebSocket (real-time)
      sock.emit('chat:send', {
        channelType: activeChannel.type,
        channelId: activeChannel.id,
        content,
      }, (res: any) => {
        if (res?.error) {
          setInput(content);
          addToast({ message: res.error, type: 'error' });
        }
        setSending(false);
      });
    } else {
      // Fallback to REST
      try {
        await api.sendChatMessage(activeChannel.type, activeChannel.id, content);
        await fetchMessages();
      } catch {
        setInput(content);
        addToast({ message: 'Failed to send message', type: 'error' });
      } finally {
        setSending(false);
      }
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
        <span className="text-[var(--parchment-dim)] text-xs flex items-center gap-1.5" style={{ fontFamily: 'Cinzel, serif' }}>
          {expanded ? activeChannel.label + ' Chat' : 'World Chat'}
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: connected ? '#22c55e' : '#ef4444' }}
            title={connected ? 'Connected' : 'Reconnecting...'}
          />
        </span>
        <div className="flex items-center gap-2">
          {onlineCount > 0 && expanded && (
            <span className="text-[9px] text-[var(--ruin-grey)]">{onlineCount} online</span>
          )}
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
          className="rpg-chat-bg flex-1 flex flex-col border border-[var(--ruin-grey)]/30 rounded-b-lg overflow-hidden"
          style={{ background: 'url(/assets/gui/chat/chat_main_bg.png) center/cover, rgba(18, 28, 50, 0.97)' }}
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
