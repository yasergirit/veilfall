import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api.js';

/* --- Types --- */

interface ActiveEvent {
  id: string;
  name: string;
  type: 'harvest_moon' | 'aether_storm' | 'ironclad_tournament';
  description: string;
  bonusDescription: string;
  objective: string;
  targetValue: number;
  reward: Record<string, number>;
}

interface EventData {
  event: ActiveEvent | null;
  progress: number;
  timeRemaining: number;
  rewardClaimed: boolean;
}

interface HistoryEntry {
  id: string;
  name: string;
  type: string;
  completed: boolean;
  rewardClaimed: boolean;
  endedAt: string;
}

/* --- Theme Config --- */

const EVENT_THEMES: Record<string, { color: string; icon: string; label: string; glowColor: string }> = {
  harvest_moon: {
    color: '#48BB78',
    icon: '\u{1F33E}',
    label: 'Harvest Moon',
    glowColor: 'rgba(72, 187, 120, 0.3)',
  },
  aether_storm: {
    color: '#63B3ED',
    icon: '\u{26A1}',
    label: 'Aether Storm',
    glowColor: 'rgba(99, 179, 237, 0.3)',
  },
  ironclad_tournament: {
    color: '#F56565',
    icon: '\u{2694}\u{FE0F}',
    label: 'Ironclad Tournament',
    glowColor: 'rgba(245, 101, 101, 0.3)',
  },
};

const RESOURCE_ICONS: Record<string, string> = {
  food: '\u{1F33E}',
  wood: '\u{1FAB5}',
  stone: '\u{1FAA8}',
  iron: '\u{2699}',
  aether_stone: '\u{1F48E}',
  gold: '\u{1FA99}',
};

function getTheme(type: string) {
  return EVENT_THEMES[type] ?? EVENT_THEMES.harvest_moon;
}

/* --- Helpers --- */

function formatTime(totalSeconds: number): string {
  if (totalSeconds <= 0) return '00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

/* --- CSS Keyframes (injected once) --- */

const STYLE_ID = 'events-panel-keyframes';

function ensureKeyframes() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes ep-pulse-gold {
      0%, 100% { box-shadow: 0 0 8px rgba(212, 175, 55, 0.4); }
      50% { box-shadow: 0 0 20px rgba(212, 175, 55, 0.8), 0 0 40px rgba(212, 175, 55, 0.3); }
    }
    @keyframes ep-shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    @keyframes ep-float {
      0%, 100% { transform: translateY(0); opacity: 0.6; }
      50% { transform: translateY(-6px); opacity: 1; }
    }
    @keyframes ep-glow-text {
      0%, 100% { text-shadow: 0 0 8px currentColor; }
      50% { text-shadow: 0 0 16px currentColor, 0 0 32px currentColor; }
    }
    @keyframes ep-progress-fill {
      0% { background-position: 0% 50%; }
      100% { background-position: 200% 50%; }
    }
  `;
  document.head.appendChild(style);
}

/* --- Main Component --- */

export default function EventsPanel() {
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const fetchedTimeRef = useRef(Date.now());

  useEffect(() => {
    ensureKeyframes();
  }, []);

  /* Fetch active event */
  const fetchEvent = useCallback(async () => {
    try {
      const data = await api.getActiveEvent();
      setEventData(data);
      if (data.timeRemaining != null) {
        setCountdown(data.timeRemaining);
        fetchedTimeRef.current = Date.now();
      }
    } catch {
      setEventData(null);
    }
  }, []);

  /* Initial load */
  useEffect(() => {
    setLoading(true);
    fetchEvent().finally(() => setLoading(false));
  }, [fetchEvent]);

  /* Poll every 10 seconds */
  useEffect(() => {
    const interval = setInterval(fetchEvent, 10_000);
    return () => clearInterval(interval);
  }, [fetchEvent]);

  /* Countdown timer - ticks every second using local calculation */
  useEffect(() => {
    if (!eventData?.event) return;
    const interval = setInterval(() => {
      const elapsed = (Date.now() - fetchedTimeRef.current) / 1000;
      const remaining = Math.max(0, (eventData.timeRemaining ?? 0) - elapsed);
      setCountdown(remaining);
    }, 1000);
    return () => clearInterval(interval);
  }, [eventData]);

  /* Fetch history when section is opened */
  useEffect(() => {
    if (!historyOpen) return;
    api.getEventHistory()
      .then((data) => setHistory(data.events ?? data.history ?? []))
      .catch(() => setHistory([]));
  }, [historyOpen]);

  /* Claim reward */
  const handleClaim = async () => {
    setClaiming(true);
    try {
      await api.claimEventReward();
      await fetchEvent();
    } catch {
      // Silently fail - next poll will update
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl mb-1" style={{ fontFamily: 'Cinzel, serif' }}>
            Seasonal Events
          </h2>
          <div className="flex items-center justify-center py-16 text-[var(--ruin-grey)]">
            Loading events...
          </div>
        </div>
      </div>
    );
  }

  const event = eventData?.event ?? null;
  const theme = event ? getTheme(event.type) : null;
  const progress = eventData?.progress ?? 0;
  const targetValue = event?.targetValue ?? 1;
  const progressPercent = Math.min(100, (progress / targetValue) * 100);
  const isComplete = progress >= targetValue;
  const rewardClaimed = eventData?.rewardClaimed ?? false;
  const canClaim = isComplete && !rewardClaimed;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <h2
          className="text-2xl mb-1"
          style={{ fontFamily: 'Cinzel, serif', color: theme?.color ?? 'var(--parchment)' }}
        >
          Seasonal Events
        </h2>
        <p className="text-sm text-[var(--parchment-dim)] mb-6">
          Limited-time challenges with powerful rewards
        </p>

        {/* Active Event or Empty State */}
        {event && theme ? (
          <ActiveEventCard
            event={event}
            theme={theme}
            progress={progress}
            progressPercent={progressPercent}
            countdown={countdown}
            isComplete={isComplete}
            rewardClaimed={rewardClaimed}
            canClaim={canClaim}
            claiming={claiming}
            onClaim={handleClaim}
          />
        ) : (
          <NoEventState />
        )}

        {/* Event History - Collapsible */}
        <div className="mt-8">
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            className="flex items-center gap-2 w-full text-left text-sm text-[var(--parchment-dim)] hover:text-[var(--parchment)] transition-colors"
          >
            <span
              className="text-xs transition-transform"
              style={{ transform: historyOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
            >
              {'\u25B6'}
            </span>
            <span style={{ fontFamily: 'Cinzel, serif' }}>Past Events</span>
          </button>

          {historyOpen && (
            <div className="mt-4 space-y-3">
              {history.length === 0 ? (
                <p className="text-xs text-[var(--ruin-grey)] italic pl-5">
                  No past events recorded.
                </p>
              ) : (
                history.map((entry) => {
                  const entryTheme = getTheme(entry.type);
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                      style={{
                        background: 'rgba(26, 39, 68, 0.6)',
                        borderColor: 'rgba(107, 110, 115, 0.2)',
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{entryTheme.icon}</span>
                        <div>
                          <p className="text-sm text-[var(--parchment)]">{entry.name}</p>
                          <p className="text-xs text-[var(--ruin-grey)]">
                            {entry.completed ? 'Completed' : 'Incomplete'}
                            {entry.rewardClaimed && ' \u2022 Reward claimed'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {entry.completed ? (
                          <span className="text-xs px-2 py-0.5 rounded bg-green-900/30 border border-green-700/50 text-green-300">
                            {'\u2713'}
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded bg-red-900/30 border border-red-700/50 text-red-300">
                            {'\u2717'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* --- Active Event Card --- */

interface ActiveEventCardProps {
  event: ActiveEvent;
  theme: { color: string; icon: string; label: string; glowColor: string };
  progress: number;
  progressPercent: number;
  countdown: number;
  isComplete: boolean;
  rewardClaimed: boolean;
  canClaim: boolean;
  claiming: boolean;
  onClaim: () => void;
}

function ActiveEventCard({
  event,
  theme,
  progress,
  progressPercent,
  countdown,
  isComplete,
  rewardClaimed,
  canClaim,
  claiming,
  onClaim,
}: ActiveEventCardProps) {
  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        background: 'rgba(26, 39, 68, 0.95)',
        borderColor: `${theme.color}33`,
        boxShadow: `0 0 30px ${theme.glowColor}, inset 0 1px 0 ${theme.color}15`,
      }}
    >
      {/* Top accent bar */}
      <div
        className="h-1"
        style={{
          background: `linear-gradient(90deg, transparent, ${theme.color}, transparent)`,
        }}
      />

      <div className="p-6">
        {/* Event Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl" style={{ animation: 'ep-float 3s ease-in-out infinite' }}>
              {theme.icon}
            </span>
            <div>
              <h3
                className="text-xl"
                style={{
                  fontFamily: 'Cinzel, serif',
                  color: theme.color,
                }}
              >
                {event.name}
              </h3>
              <span
                className="inline-block text-xs px-2 py-0.5 rounded-full mt-1"
                style={{
                  background: `${theme.color}20`,
                  border: `1px solid ${theme.color}40`,
                  color: theme.color,
                }}
              >
                {theme.label}
              </span>
            </div>
          </div>

          {/* Countdown Timer */}
          <div className="text-right">
            <p className="text-xs text-[var(--ruin-grey)] mb-1">Time Remaining</p>
            <p
              className="text-2xl font-bold"
              style={{
                fontFamily: 'monospace',
                fontVariantNumeric: 'tabular-nums',
                color: countdown < 300 ? '#F56565' : theme.color,
                animation: countdown < 60 ? 'ep-glow-text 1s ease-in-out infinite' : 'none',
              }}
            >
              {formatTime(countdown)}
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-[var(--parchment-dim)] leading-relaxed mb-4">
          {event.description}
        </p>

        {/* Bonus Description with shimmer */}
        <div
          className="flex items-center gap-2 p-3 rounded-lg mb-5"
          style={{
            background: `linear-gradient(135deg, ${theme.color}10, ${theme.color}05)`,
            border: `1px solid ${theme.color}25`,
          }}
        >
          <span
            className="text-lg shrink-0"
            style={{ animation: 'ep-glow-text 2s ease-in-out infinite', color: theme.color }}
          >
            {'\u2728'}
          </span>
          <p className="text-sm" style={{ color: theme.color }}>
            {event.bonusDescription}
          </p>
        </div>

        {/* Progress Section */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-[var(--parchment-dim)]">{event.objective}</p>
            <p className="text-sm font-medium" style={{ fontVariantNumeric: 'tabular-nums', color: theme.color }}>
              {progress.toLocaleString()} / {event.targetValue.toLocaleString()}
            </p>
          </div>

          {/* Progress Bar */}
          <div
            className="h-3 rounded-full overflow-hidden relative"
            style={{ background: 'rgba(0, 0, 0, 0.4)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-700 ease-out relative"
              style={{
                width: `${progressPercent}%`,
                background: isComplete
                  ? `linear-gradient(90deg, ${theme.color}, ${theme.color}dd)`
                  : `linear-gradient(90deg, ${theme.color}cc, ${theme.color})`,
                boxShadow: `0 0 10px ${theme.glowColor}`,
              }}
            >
              {/* Animated shimmer overlay on progress bar */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)`,
                  backgroundSize: '200% 100%',
                  animation: 'ep-shimmer 2s linear infinite',
                }}
              />
            </div>

            {/* Percentage markers */}
            {[25, 50, 75].map((mark) => (
              <div
                key={mark}
                className="absolute top-0 bottom-0 w-px"
                style={{ left: `${mark}%`, background: 'rgba(255,255,255,0.08)' }}
              />
            ))}
          </div>

          {/* Completed badge */}
          {isComplete && (
            <p
              className="text-xs mt-2 font-medium"
              style={{ color: theme.color }}
            >
              {'\u2713'} Objective complete!
            </p>
          )}
        </div>

        {/* Reward Section */}
        <div
          className="p-4 rounded-lg mb-4"
          style={{
            background: 'rgba(0, 0, 0, 0.2)',
            border: '1px solid rgba(107, 110, 115, 0.15)',
          }}
        >
          <p className="text-xs text-[var(--ruin-grey)] mb-2 uppercase tracking-wider">Rewards</p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(event.reward).map(([resource, amount]) => (
              <div
                key={resource}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                style={{
                  background: 'rgba(26, 39, 68, 0.8)',
                  border: '1px solid rgba(107, 110, 115, 0.2)',
                }}
              >
                <span className="text-sm">{RESOURCE_ICONS[resource] ?? '\u{1F381}'}</span>
                <span className="text-sm text-[var(--parchment)]">
                  {amount.toLocaleString()} {resource.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Claim Button */}
        {canClaim && (
          <button
            onClick={onClaim}
            disabled={claiming}
            className="w-full py-3 rounded-lg text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-50"
            style={{
              fontFamily: 'Cinzel, serif',
              background: 'linear-gradient(135deg, var(--ember-gold), #b8860b)',
              color: '#1a1a2e',
              animation: claiming ? 'none' : 'ep-pulse-gold 2s ease-in-out infinite',
              border: '1px solid var(--ember-gold)',
            }}
          >
            {claiming ? 'Claiming...' : 'Claim Reward'}
          </button>
        )}

        {/* Already claimed */}
        {rewardClaimed && (
          <div
            className="w-full py-3 rounded-lg text-center text-sm"
            style={{
              background: 'rgba(72, 187, 120, 0.1)',
              border: '1px solid rgba(72, 187, 120, 0.3)',
              color: '#48BB78',
            }}
          >
            {'\u2713'} Reward Claimed
          </div>
        )}
      </div>
    </div>
  );
}

/* --- No Event State --- */

function NoEventState() {
  return (
    <div
      className="rounded-xl border p-12 text-center"
      style={{
        background: 'rgba(26, 39, 68, 0.95)',
        borderColor: 'rgba(107, 110, 115, 0.2)',
      }}
    >
      <span
        className="text-5xl block mb-4"
        style={{ animation: 'ep-float 4s ease-in-out infinite', opacity: 0.4 }}
      >
        {'\u{1F319}'}
      </span>
      <p
        className="text-lg mb-2"
        style={{ fontFamily: 'Cinzel, serif', color: 'var(--ruin-grey)' }}
      >
        The realm rests...
      </p>
      <p className="text-sm text-[var(--ruin-grey)] italic">
        Next event coming soon
      </p>
    </div>
  );
}
