import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';

/* --- Types --- */

interface DailyRewardModalProps {
  onClose: () => void;
  onClaim: (rewards: Record<string, number>) => void;
}

interface DailyRewardStatus {
  currentDay: number;
  claimedToday: boolean;
  streak: number;
  claimedDays: number[];
}

interface DayReward {
  day: number;
  rewards: Record<string, number>;
}

/* --- Constants --- */

const DAILY_REWARDS: DayReward[] = [
  { day: 1, rewards: { food: 200, wood: 200 } },
  { day: 2, rewards: { stone: 300, iron: 200 } },
  { day: 3, rewards: { food: 500, wood: 500, stone: 300 } },
  { day: 4, rewards: { aether_stone: 100 } },
  { day: 5, rewards: { food: 800, wood: 800, stone: 500, iron: 300 } },
  { day: 6, rewards: { aether_stone: 200 } },
  { day: 7, rewards: { food: 1000, wood: 1000, stone: 800, iron: 500, aether_stone: 300 } },
];

const RESOURCE_ICONS: Record<string, string> = {
  food: '\u{1F33E}',
  wood: '\u{1FAB5}',
  stone: '\u{1FAA8}',
  iron: '\u{2699}',
  aether_stone: '\u{1F48E}',
};

const RESOURCE_LABELS: Record<string, string> = {
  food: 'Food',
  wood: 'Wood',
  stone: 'Stone',
  iron: 'Iron',
  aether_stone: 'Aether',
};

/* --- CSS Keyframes (injected once) --- */

const STYLE_ID = 'daily-reward-modal-keyframes';

function ensureKeyframes() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes dr-pulse-gold {
      0%, 100% { box-shadow: 0 0 8px rgba(212, 175, 55, 0.4), inset 0 0 4px rgba(212, 175, 55, 0.1); }
      50% { box-shadow: 0 0 20px rgba(212, 175, 55, 0.8), 0 0 40px rgba(212, 175, 55, 0.3), inset 0 0 8px rgba(212, 175, 55, 0.2); }
    }
    @keyframes dr-pulse-border {
      0%, 100% { border-color: rgba(212, 175, 55, 0.6); }
      50% { border-color: rgba(212, 175, 55, 1); }
    }
    @keyframes dr-fade-in {
      from { opacity: 0; transform: scale(0.95) translateY(10px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes dr-backdrop-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes dr-celebrate {
      0% { transform: scale(1); }
      15% { transform: scale(1.15); }
      30% { transform: scale(0.95); }
      45% { transform: scale(1.05); }
      60% { transform: scale(1); }
      100% { transform: scale(1); }
    }
    @keyframes dr-sparkle {
      0%, 100% { opacity: 0; transform: scale(0) rotate(0deg); }
      50% { opacity: 1; transform: scale(1) rotate(180deg); }
    }
    @keyframes dr-checkmark-in {
      from { transform: scale(0); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    @keyframes dr-btn-shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `;
  document.head.appendChild(style);
}

/* --- Main Component --- */

export default function DailyRewardModal({ onClose, onClaim }: DailyRewardModalProps) {
  const [status, setStatus] = useState<DailyRewardStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [celebrated, setCelebrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureKeyframes();
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.getDailyRewardStatus();
      setStatus(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load daily rewards');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchStatus().finally(() => setLoading(false));
  }, [fetchStatus]);

  const handleClaim = async () => {
    if (!status || status.claimedToday || claiming) return;

    setClaiming(true);
    setError(null);
    try {
      const result = await api.claimDailyReward();
      const todayReward = DAILY_REWARDS[(status.currentDay - 1) % 7];
      const rewardData = result.rewards ?? todayReward.rewards;

      setCelebrated(true);
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              claimedToday: true,
              claimedDays: [...prev.claimedDays, prev.currentDay],
            }
          : prev,
      );

      onClaim(rewardData);

      setTimeout(() => {
        setCelebrated(false);
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to claim reward');
    } finally {
      setClaiming(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const currentDay = status?.currentDay ?? 1;
  const cycleDayIndex = ((currentDay - 1) % 7) + 1;
  const claimedToday = status?.claimedToday ?? false;
  const streak = status?.streak ?? 0;
  const claimedDays = status?.claimedDays ?? [];

  function getDayStatus(day: number): 'claimed' | 'today' | 'future' {
    if (day < cycleDayIndex) return 'claimed';
    if (day === cycleDayIndex) return 'today';
    return 'future';
  }

  function isDayClaimed(day: number): boolean {
    if (day < cycleDayIndex) return true;
    if (day === cycleDayIndex) return claimedToday;
    return false;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: 'dr-backdrop-in 0.3s ease-out',
      }}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Daily Rewards"
    >
      <div
        className="w-full max-w-md rounded-xl border overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(26, 39, 68, 0.98), rgba(15, 23, 42, 0.98))',
          borderColor: 'rgba(212, 175, 55, 0.25)',
          boxShadow: '0 0 60px rgba(0, 0, 0, 0.5), 0 0 30px rgba(212, 175, 55, 0.1)',
          animation: 'dr-fade-in 0.35s ease-out',
        }}
      >
        {/* Gold accent bar */}
        <div
          className="h-1"
          style={{
            background: 'linear-gradient(90deg, transparent, var(--ember-gold), transparent)',
          }}
        />

        {/* Header */}
        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
          <div>
            <h2
              className="text-xl"
              style={{
                fontFamily: 'Cinzel, serif',
                color: 'var(--ember-gold)',
              }}
            >
              Daily Rewards
            </h2>
            {!loading && status && (
              <p className="text-sm mt-1" style={{ color: 'var(--parchment-dim)' }}>
                {'\u{1F525}'} Day {streak} Streak
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{
              color: 'var(--ruin-grey)',
              background: 'rgba(107, 110, 115, 0.1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--parchment)';
              e.currentTarget.style.background = 'rgba(107, 110, 115, 0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--ruin-grey)';
              e.currentTarget.style.background = 'rgba(107, 110, 115, 0.1)';
            }}
            aria-label="Close daily rewards"
          >
            {'\u2715'}
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-[var(--ruin-grey)]">
              <span className="text-sm">Loading rewards...</span>
            </div>
          ) : error && !status ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  fetchStatus().finally(() => setLoading(false));
                }}
                className="text-xs px-4 py-1.5 rounded-lg transition-colors"
                style={{
                  color: 'var(--parchment-dim)',
                  border: '1px solid rgba(107, 110, 115, 0.3)',
                  background: 'rgba(107, 110, 115, 0.1)',
                }}
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* 7-Day Grid */}
              <div className="grid grid-cols-7 gap-1.5 mb-5">
                {DAILY_REWARDS.map((dayReward) => {
                  const dayStatus = getDayStatus(dayReward.day);
                  const claimed = isDayClaimed(dayReward.day);
                  const isToday = dayStatus === 'today';
                  const isFuture = dayStatus === 'future';
                  const isCelebrating = celebrated && isToday;

                  return (
                    <div
                      key={dayReward.day}
                      className="relative flex flex-col items-center rounded-lg border p-1.5"
                      style={{
                        background: isToday
                          ? 'rgba(212, 175, 55, 0.08)'
                          : claimed
                            ? 'rgba(72, 187, 120, 0.06)'
                            : 'rgba(26, 39, 68, 0.6)',
                        borderColor: isToday
                          ? 'rgba(212, 175, 55, 0.6)'
                          : claimed
                            ? 'rgba(72, 187, 120, 0.25)'
                            : 'rgba(107, 110, 115, 0.15)',
                        opacity: isFuture ? 0.5 : 1,
                        animation: isToday && !claimed
                          ? 'dr-pulse-border 2s ease-in-out infinite'
                          : isCelebrating
                            ? 'dr-celebrate 0.6s ease-out'
                            : 'none',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      {/* Day label */}
                      <span
                        className="text-[9px] font-bold uppercase tracking-wide mb-1"
                        style={{
                          color: isToday
                            ? 'var(--ember-gold)'
                            : claimed
                              ? 'rgba(72, 187, 120, 0.8)'
                              : 'var(--ruin-grey)',
                        }}
                      >
                        Day {dayReward.day}
                      </span>

                      {/* Resource icons + amounts */}
                      <div className="flex flex-col items-center gap-0.5 min-h-[36px] justify-center">
                        {Object.entries(dayReward.rewards).map(([resource, amount]) => (
                          <div
                            key={resource}
                            className="flex items-center gap-0.5"
                            title={`${amount} ${RESOURCE_LABELS[resource] ?? resource}`}
                          >
                            <span className="text-[10px] leading-none">
                              {RESOURCE_ICONS[resource] ?? '\u{1F381}'}
                            </span>
                            <span
                              className="text-[9px] leading-none"
                              style={{
                                color: isToday ? 'var(--parchment)' : 'var(--parchment-dim)',
                              }}
                            >
                              {amount >= 1000 ? `${(amount / 1000).toFixed(0)}k` : amount}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Claimed checkmark overlay */}
                      {claimed && (
                        <div
                          className="absolute inset-0 flex items-center justify-center rounded-lg"
                          style={{
                            background: 'rgba(0, 0, 0, 0.35)',
                            animation: 'dr-checkmark-in 0.3s ease-out',
                          }}
                        >
                          <span
                            className="text-lg font-bold"
                            style={{ color: '#48BB78' }}
                          >
                            {'\u2713'}
                          </span>
                        </div>
                      )}

                      {/* Today glow indicator */}
                      {isToday && !claimed && (
                        <div
                          className="absolute -top-px -left-px -right-px -bottom-px rounded-lg pointer-events-none"
                          style={{
                            animation: 'dr-pulse-gold 2s ease-in-out infinite',
                            borderRadius: 'inherit',
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Error message (inline, after attempted claim) */}
              {error && (
                <p className="text-xs text-red-400 text-center mb-3">{error}</p>
              )}

              {/* Celebration message */}
              {celebrated && (
                <div
                  className="text-center mb-3"
                  style={{ animation: 'dr-fade-in 0.3s ease-out' }}
                >
                  <p
                    className="text-sm font-medium"
                    style={{ color: 'var(--ember-gold)', fontFamily: 'Cinzel, serif' }}
                  >
                    {'\u2728'} Reward Claimed! {'\u2728'}
                  </p>
                </div>
              )}

              {/* Claim Button or Status Message */}
              {!claimedToday ? (
                <button
                  onClick={handleClaim}
                  disabled={claiming}
                  className="w-full py-3 rounded-lg text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-60 disabled:cursor-not-allowed relative overflow-hidden"
                  style={{
                    fontFamily: 'Cinzel, serif',
                    background: 'linear-gradient(135deg, var(--ember-gold), #b8860b)',
                    color: '#1a1a2e',
                    border: '1px solid var(--ember-gold)',
                    animation: claiming ? 'none' : 'dr-pulse-gold 2s ease-in-out infinite',
                  }}
                >
                  {/* Shimmer overlay */}
                  {!claiming && (
                    <span
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background:
                          'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)',
                        backgroundSize: '200% 100%',
                        animation: 'dr-btn-shimmer 3s linear infinite',
                      }}
                    />
                  )}
                  <span className="relative">
                    {claiming ? 'Claiming...' : `Claim Day ${cycleDayIndex} Reward`}
                  </span>
                </button>
              ) : !celebrated ? (
                <div
                  className="w-full py-3 rounded-lg text-center text-sm"
                  style={{
                    background: 'rgba(72, 187, 120, 0.08)',
                    border: '1px solid rgba(72, 187, 120, 0.25)',
                    color: '#48BB78',
                  }}
                >
                  {'\u2713'} Today's reward claimed! Come back tomorrow!
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
