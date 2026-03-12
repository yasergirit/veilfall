import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api.js';
import { useToastStore } from '../stores/toast-store.js';

/* --- Types --- */

interface Hero {
  id: string;
  name: string;
  heroClass: string;
  level: number;
  status: string;
}

interface QuestType {
  type: string;
  name: string;
  description: string;
  duration: number; // seconds
  difficulty: number; // 1-5
  rewards: string[];
}

interface ActiveQuest {
  id: string;
  questType: string;
  heroId: string;
  heroName: string;
  startedAt: string;
  endsAt: number; // timestamp ms
  status: string;
}

interface QuestHistoryEntry {
  id: string;
  questType: string;
  heroName: string;
  result: 'success' | 'failure' | 'partial';
  rewards?: Record<string, number>;
  completedAt: string;
  xpGained?: number;
}

/* --- Quest Type Config --- */

const QUEST_STYLES: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  exploration: {
    color: '#55e080',
    bg: 'rgba(85, 224, 128, 0.08)',
    border: 'rgba(85, 224, 128, 0.30)',
    icon: '\u{1F30D}',
  },
  training: {
    color: '#55a0e0',
    bg: 'rgba(85, 160, 224, 0.08)',
    border: 'rgba(85, 160, 224, 0.30)',
    icon: '\u{2694}\u{FE0F}',
  },
  relic_hunt: {
    color: '#7B4FBF',
    bg: 'rgba(123, 79, 191, 0.08)',
    border: 'rgba(123, 79, 191, 0.30)',
    icon: '\u{1F52E}',
  },
  veil_expedition: {
    color: '#D4A843',
    bg: 'rgba(212, 168, 67, 0.08)',
    border: 'rgba(212, 168, 67, 0.30)',
    icon: '\u{1F30C}',
  },
};

function getQuestStyle(type: string) {
  return QUEST_STYLES[type] ?? QUEST_STYLES.exploration;
}

const RESULT_BADGES: Record<string, { bg: string; border: string; text: string; label: string }> = {
  success: { bg: 'bg-green-900/30', border: 'border-green-700/50', text: 'text-green-300', label: 'Success' },
  failure: { bg: 'bg-red-900/30', border: 'border-red-700/50', text: 'text-red-300', label: 'Failed' },
  partial: { bg: 'bg-yellow-900/30', border: 'border-yellow-700/50', text: 'text-yellow-300', label: 'Partial' },
};

/* --- Helpers --- */

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

function formatCountdown(endsAt: number): string {
  const remaining = Math.max(0, endsAt - Date.now());
  const totalSeconds = Math.floor(remaining / 1000);
  if (totalSeconds <= 0) return 'Complete!';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

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

/* --- Difficulty Stars --- */

function DifficultyStars({ difficulty }: { difficulty: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`Difficulty: ${difficulty} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className="text-xs"
          style={{ color: i < difficulty ? '#D4A843' : 'var(--ruin-grey)', opacity: i < difficulty ? 1 : 0.3 }}
        >
          {'\u2605'}
        </span>
      ))}
    </span>
  );
}

/* --- Quest Card --- */

function QuestCard({
  quest,
  heroes,
  onStart,
  starting,
}: {
  quest: QuestType;
  heroes: Hero[];
  onStart: (heroId: string, questType: string) => void;
  starting: boolean;
}) {
  const [selectedHeroId, setSelectedHeroId] = useState('');
  const style = getQuestStyle(quest.type);
  const idleHeroes = heroes.filter((h) => h.status === 'idle');

  const handleStart = () => {
    if (!selectedHeroId) return;
    onStart(selectedHeroId, quest.type);
    setSelectedHeroId('');
  };

  return (
    <div
      className="p-4 rounded-lg border transition-all hover:shadow-lg hover:shadow-black/20"
      style={{ background: style.bg, borderColor: style.border }}
    >
      {/* Quest header */}
      <div className="flex items-start gap-3 mb-3">
        <span className="text-2xl shrink-0">{style.icon}</span>
        <div className="flex-1 min-w-0">
          <h4
            className="text-sm font-semibold"
            style={{ fontFamily: 'Cinzel, serif', color: style.color }}
          >
            {quest.name}
          </h4>
          <p className="text-xs text-[var(--parchment-dim)] mt-0.5 leading-relaxed">
            {quest.description}
          </p>
        </div>
      </div>

      {/* Quest info */}
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[var(--ruin-grey)]">Duration:</span>
          <span className="text-xs text-[var(--parchment)]">{formatDuration(quest.duration)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[var(--ruin-grey)]">Difficulty:</span>
          <DifficultyStars difficulty={quest.difficulty} />
        </div>
      </div>

      {/* Rewards */}
      {quest.rewards && quest.rewards.length > 0 && (
        <div className="mb-3">
          <span className="text-[10px] text-[var(--ruin-grey)] block mb-1">Potential Rewards:</span>
          <div className="flex flex-wrap gap-1.5">
            {quest.rewards.map((reward, i) => (
              <span
                key={i}
                className="text-[10px] px-2 py-0.5 rounded-full border"
                style={{ color: style.color, borderColor: style.border, background: `${style.color}08` }}
              >
                {reward}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Hero selector + Start */}
      {idleHeroes.length > 0 ? (
        <div className="flex items-center gap-2">
          <select
            value={selectedHeroId}
            onChange={(e) => setSelectedHeroId(e.target.value)}
            className="flex-1 px-2 py-1.5 rounded bg-[var(--veil-blue-deep)] border border-[var(--ruin-grey)]/30 text-xs text-[var(--parchment)] focus:border-[var(--aether-violet)]/50 focus:outline-none"
          >
            <option value="">Select a hero...</option>
            {idleHeroes.map((hero) => (
              <option key={hero.id} value={hero.id}>
                {hero.name} (Lv.{hero.level})
              </option>
            ))}
          </select>
          <button
            onClick={handleStart}
            disabled={!selectedHeroId || starting}
            className="px-3 py-1.5 rounded text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: selectedHeroId ? style.color : 'transparent',
              color: selectedHeroId ? '#0a0f1a' : 'var(--ruin-grey)',
              border: `1px solid ${selectedHeroId ? style.color : 'var(--ruin-grey)'}40`,
            }}
          >
            {starting ? 'Starting...' : 'Start Quest'}
          </button>
        </div>
      ) : (
        <div className="px-3 py-2 rounded bg-[var(--veil-blue-deep)]/50 border border-[var(--ruin-grey)]/15 text-center">
          <span className="text-xs text-[var(--ruin-grey)] italic">
            All heroes are busy
          </span>
        </div>
      )}
    </div>
  );
}

/* --- Active Quest Row --- */

function ActiveQuestRow({ quest }: { quest: ActiveQuest }) {
  const [countdown, setCountdown] = useState(formatCountdown(quest.endsAt));
  const style = getQuestStyle(quest.questType);
  const progress = Math.min(100, Math.max(0,
    ((Date.now() - new Date(quest.startedAt).getTime()) / (quest.endsAt - new Date(quest.startedAt).getTime())) * 100
  ));

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(formatCountdown(quest.endsAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [quest.endsAt]);

  return (
    <div
      className="p-3 rounded-lg border"
      style={{ background: style.bg, borderColor: style.border }}
    >
      <div className="flex items-center gap-3">
        <span className="text-lg shrink-0">{style.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium" style={{ color: style.color }}>
              {quest.questType.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </span>
            <span
              className="text-xs font-mono tabular-nums"
              style={{ color: style.color }}
            >
              {countdown}
            </span>
          </div>
          <div className="text-[10px] text-[var(--parchment-dim)] mt-0.5">
            Hero: {quest.heroName}
          </div>
          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-[var(--veil-blue-deep)] mt-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${style.color}80, ${style.color})`,
                animation: 'pulse 2s ease-in-out infinite',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* --- Main Component --- */

export default function HeroQuestPanel() {
  const [availableQuests, setAvailableQuests] = useState<QuestType[]>([]);
  const [activeQuests, setActiveQuests] = useState<ActiveQuest[]>([]);
  const [questHistory, setQuestHistory] = useState<QuestHistoryEntry[]>([]);
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const addToast = useToastStore((s) => s.addToast);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [questData, activeData, historyData, heroData] = await Promise.all([
        api.getAvailableQuests().catch(() => ({ quests: [] })),
        api.getActiveQuests().catch(() => ({ quests: [] })),
        api.getQuestHistory().catch(() => ({ quests: [] })),
        api.getHeroes().catch(() => ({ heroes: [] })),
      ]);
      setAvailableQuests(questData.quests ?? []);
      setActiveQuests(activeData.quests ?? []);
      setQuestHistory(historyData.quests ?? []);
      setHeroes(heroData.heroes ?? []);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  // Refresh active quests every 10 seconds
  useEffect(() => {
    refreshRef.current = setInterval(() => {
      api.getActiveQuests().catch(() => ({ quests: [] })).then((data) => {
        setActiveQuests(data.quests ?? []);
      });
    }, 10_000);
    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, []);

  const handleStartQuest = async (heroId: string, questType: string) => {
    setStarting(true);
    try {
      await api.startHeroQuest(heroId, questType);
      addToast({ message: 'Quest started!', type: 'success' });
      await fetchAll();
    } catch (err) {
      addToast({ message: err instanceof Error ? err.message : 'Failed to start quest', type: 'error' });
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--ruin-grey)]">
        Loading quests...
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <h2 className="text-2xl mb-1" style={{ fontFamily: 'Cinzel, serif' }}>
          Hero Quests
        </h2>
        <p className="text-sm text-[var(--parchment-dim)] mb-6">
          Send your heroes on perilous quests for glory and treasure
        </p>

        {/* Active Quests */}
        {activeQuests.length > 0 && (
          <div className="mb-8">
            <h3
              className="text-sm font-semibold text-[var(--parchment-dim)] mb-3"
              style={{ fontFamily: 'Cinzel, serif' }}
            >
              Active Quests ({activeQuests.length})
            </h3>
            <div className="space-y-2">
              {activeQuests.map((quest) => (
                <ActiveQuestRow key={quest.id} quest={quest} />
              ))}
            </div>
          </div>
        )}

        {/* Available Quest Cards */}
        <div className="mb-8">
          <h3
            className="text-sm font-semibold text-[var(--parchment-dim)] mb-3"
            style={{ fontFamily: 'Cinzel, serif' }}
          >
            Available Quests
          </h3>
          {availableQuests.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {availableQuests.map((quest) => (
                <QuestCard
                  key={quest.type}
                  quest={quest}
                  heroes={heroes}
                  onStart={handleStartQuest}
                  starting={starting}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center rounded-lg border border-[var(--ruin-grey)]/20 bg-[var(--veil-blue)]/20">
              <span className="text-3xl mb-3 opacity-30">{'\u{1F9ED}'}</span>
              <p className="text-xs text-[var(--ruin-grey)] italic">
                No quests available. Check back later.
              </p>
            </div>
          )}
        </div>

        {/* Quest History (collapsible) */}
        <div>
          <button
            onClick={() => setHistoryExpanded(!historyExpanded)}
            className="flex items-center gap-2 text-sm font-semibold text-[var(--parchment-dim)] mb-3 hover:text-[var(--parchment)] transition-colors"
            style={{ fontFamily: 'Cinzel, serif' }}
          >
            <span className="text-xs">{historyExpanded ? '\u25BC' : '\u25B6'}</span>
            Quest History ({questHistory.length})
          </button>

          {historyExpanded && (
            <div>
              {questHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-xs text-[var(--ruin-grey)] italic">
                    No completed quests yet. Send a hero to begin.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {questHistory.map((entry) => {
                    const style = getQuestStyle(entry.questType);
                    const badge = RESULT_BADGES[entry.result] ?? RESULT_BADGES.partial;
                    return (
                      <div
                        key={entry.id}
                        className="p-3 rounded-lg border border-[var(--ruin-grey)]/20 bg-[var(--veil-blue)]/30"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm shrink-0">{style.icon}</span>
                            <span className="text-xs font-medium" style={{ color: style.color }}>
                              {entry.questType.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${badge.bg} border ${badge.border} ${badge.text}`}>
                              {badge.label}
                            </span>
                          </div>
                          <span className="text-[10px] text-[var(--ruin-grey)] shrink-0">
                            {relativeTime(entry.completedAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[10px] text-[var(--parchment-dim)]">
                            Hero: {entry.heroName}
                          </span>
                          <div className="flex items-center gap-2">
                            {entry.xpGained != null && entry.xpGained > 0 && (
                              <span className="text-[10px] text-[var(--aether-violet)]">
                                +{entry.xpGained} XP
                              </span>
                            )}
                            {entry.rewards && Object.entries(entry.rewards).map(([res, amount]) => (
                              <span key={res} className="text-[10px] text-[var(--ember-gold)]">
                                +{amount} {res.replace('_', ' ')}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
