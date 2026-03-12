import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';

interface QuestData {
  id: string;
  questDefId: string;
  category: 'story' | 'daily' | 'milestone';
  title: string;
  description: string;
  narrator: string;
  objective: { type: string; target?: string; amount: number };
  reward: { resources?: Record<string, number>; xp?: number };
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
  order?: number;
}

type TabKey = 'story' | 'daily' | 'milestone';

const RESOURCE_LABELS: Record<string, string> = {
  food: 'Food', wood: 'Wood', stone: 'Stone', iron: 'Iron', aether_stone: 'Aether',
};

const TAB_CONFIG: { key: TabKey; label: string }[] = [
  { key: 'story', label: 'Story' },
  { key: 'daily', label: 'Daily' },
  { key: 'milestone', label: 'Goals' },
];

export default function QuestTracker() {
  const [expanded, setExpanded] = useState(true);
  const [tab, setTab] = useState<TabKey>('story');
  const [quests, setQuests] = useState<{ story: QuestData[]; daily: QuestData[]; milestones: QuestData[] }>({
    story: [], daily: [], milestones: [],
  });
  const [claiming, setClaiming] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchQuests = useCallback(async () => {
    try {
      const data = await api.getQuests();
      setQuests(data);
    } catch {
      // Silently fail -- quest system is optional
    }
  }, []);

  useEffect(() => {
    fetchQuests();
    const interval = setInterval(fetchQuests, 10_000);
    return () => clearInterval(interval);
  }, [fetchQuests, refreshKey]);

  const handleClaim = async (questId: string) => {
    setClaiming(questId);
    try {
      await api.claimQuestReward(questId);
      setRefreshKey(k => k + 1);
    } catch {
      // ignore
    } finally {
      setClaiming(null);
    }
  };

  const currentQuests = tab === 'story' ? quests.story
    : tab === 'daily' ? quests.daily
    : quests.milestones;

  // For story: find first uncompleted quest and show it + recent completed
  const storyView = tab === 'story' ? getStoryView(quests.story) : null;
  const displayQuests = storyView ?? currentQuests;

  // Count claimable across all tabs
  const totalClaimable = [...quests.story, ...quests.daily, ...quests.milestones]
    .filter(q => q.completed && !q.claimed).length;

  // Story progress
  const storyCompleted = quests.story.filter(q => q.completed).length;
  const storyTotal = quests.story.length;

  return (
    <div data-tutorial="quest-tracker" className="absolute bottom-4 right-4 w-80 pointer-events-auto">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 rounded-t-lg bg-[var(--veil-blue)]/95 border border-[var(--ruin-grey)]/30 border-b-0 text-xs"
      >
        <span className="font-semibold flex items-center gap-2" style={{ fontFamily: 'Cinzel, serif', color: 'var(--ember-gold)' }}>
          Quests
          {totalClaimable > 0 && (
            <span className="bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
              {totalClaimable}
            </span>
          )}
        </span>
        <span className="text-[var(--ruin-grey)]">
          {tab === 'story' ? `${storyCompleted}/${storyTotal}` : ''} {expanded ? '\u25BC' : '\u25B2'}
        </span>
      </button>

      {expanded && (
        <div className="rounded-b-lg bg-[var(--veil-blue)]/95 border border-[var(--ruin-grey)]/30 border-t-0 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-[var(--ruin-grey)]/20">
            {TAB_CONFIG.map(t => {
              const tabQuests = t.key === 'story' ? quests.story
                : t.key === 'daily' ? quests.daily
                : quests.milestones;
              const claimable = tabQuests.filter(q => q.completed && !q.claimed).length;

              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex-1 py-1.5 text-[10px] font-medium transition-colors relative ${
                    tab === t.key
                      ? 'text-[var(--ember-gold)] border-b-2 border-[var(--ember-gold)]'
                      : 'text-[var(--ruin-grey)] hover:text-[var(--parchment-dim)]'
                  }`}
                >
                  {t.label}
                  {claimable > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center bg-green-500 text-white text-[8px] w-3.5 h-3.5 rounded-full">
                      {claimable}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quest List */}
          <div className="p-3 max-h-64 overflow-y-auto space-y-2">
            {displayQuests.length === 0 ? (
              <p className="text-center text-xs text-[var(--ruin-grey)] py-4">No quests available</p>
            ) : (
              displayQuests.map(quest => (
                <QuestItem
                  key={quest.id}
                  quest={quest}
                  onClaim={handleClaim}
                  claiming={claiming === quest.id}
                />
              ))
            )}
          </div>

          {/* Story progress dots */}
          {tab === 'story' && storyTotal > 0 && (
            <div className="px-3 pb-2">
              <div className="flex gap-1 justify-center">
                {quests.story.map((q, i) => (
                  <div
                    key={q.id}
                    className="h-1 rounded-full transition-all duration-300"
                    style={{
                      width: i === storyCompleted ? '16px' : '6px',
                      background: q.claimed ? 'var(--aether-violet)'
                        : q.completed ? '#22c55e'
                        : i === storyCompleted ? 'var(--ember-gold)'
                        : 'rgba(100, 116, 139, 0.3)',
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QuestItem({ quest, onClaim, claiming }: { quest: QuestData; onClaim: (id: string) => void; claiming: boolean }) {
  const pct = quest.target > 0 ? Math.min(100, Math.round((quest.progress / quest.target) * 100)) : 0;
  const canClaim = quest.completed && !quest.claimed;

  return (
    <div className={`p-2.5 rounded-lg border transition-all ${
      quest.claimed
        ? 'border-[var(--ruin-grey)]/10 opacity-50'
        : canClaim
        ? 'border-green-500/40 bg-green-500/5'
        : 'border-[var(--ruin-grey)]/20 bg-[var(--veil-blue-deep)]/30'
    }`}>
      {/* Title row */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-[var(--parchment)] leading-tight">
          {quest.claimed && '\u2713 '}{quest.title}
        </span>
        {quest.narrator !== 'Achievement' && quest.narrator !== 'Daily' && (
          <span className="text-[9px] text-[var(--ember-gold)]/60 italic">-- {quest.narrator}</span>
        )}
      </div>

      {/* Description */}
      <p className="text-[10px] text-[var(--parchment-dim)] leading-relaxed mb-1.5 italic">
        {quest.description}
      </p>

      {/* Progress bar */}
      {!quest.claimed && (
        <div className="mb-1.5">
          <div className="flex justify-between text-[9px] text-[var(--ruin-grey)] mb-0.5">
            <span>{formatObjective(quest.objective)}</span>
            <span>{quest.progress >= quest.target ? quest.target : quest.progress}/{quest.target}</span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--veil-blue-deep)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: canClaim
                  ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                  : 'linear-gradient(90deg, var(--aether-violet), var(--aether-glow))',
              }}
            />
          </div>
        </div>
      )}

      {/* Rewards + Claim */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {quest.reward?.resources && Object.entries(quest.reward.resources).map(([res, amt]) => (
            <span key={res} className="text-[9px] text-[var(--aether-violet)] bg-[var(--aether-violet)]/10 px-1.5 py-0.5 rounded">
              +{amt} {RESOURCE_LABELS[res] ?? res}
            </span>
          ))}
          {quest.reward?.xp && (
            <span className="text-[9px] text-[var(--ember-gold)] bg-[var(--ember-gold)]/10 px-1.5 py-0.5 rounded">
              +{quest.reward.xp} XP
            </span>
          )}
        </div>

        {canClaim && (
          <button
            onClick={() => onClaim(quest.id)}
            disabled={claiming}
            className="text-[10px] font-bold px-2.5 py-1 rounded bg-green-500/20 border border-green-500/50 text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50"
          >
            {claiming ? '...' : 'Claim'}
          </button>
        )}
      </div>
    </div>
  );
}

function getStoryView(storyQuests: QuestData[]): QuestData[] {
  if (storyQuests.length === 0) return [];

  // Find first unclaimed quest
  const firstUnclaimedIdx = storyQuests.findIndex(q => !q.claimed);
  if (firstUnclaimedIdx === -1) {
    // All claimed -- show last 2
    return storyQuests.slice(-2);
  }

  const result: QuestData[] = [];

  // Previous completed quest (context)
  if (firstUnclaimedIdx > 0) {
    result.push(storyQuests[firstUnclaimedIdx - 1]);
  }

  // Current active/claimable quest
  result.push(storyQuests[firstUnclaimedIdx]);

  // Next quest (preview)
  if (firstUnclaimedIdx + 1 < storyQuests.length) {
    result.push(storyQuests[firstUnclaimedIdx + 1]);
  }

  return result;
}

function formatObjective(obj: { type: string; target?: string; amount: number }): string {
  const target = obj.target?.replace(/_/g, ' ') ?? '';
  switch (obj.type) {
    case 'build': return `Build ${target}`;
    case 'upgrade': return 'Upgrade a building';
    case 'tc_level': return `Town Center Lv${obj.amount}`;
    case 'train': return `Train ${target}`;
    case 'gather': return `Gather ${target || 'resources'}`;
    case 'research': return target === 'any' ? 'Complete research' : `Research ${target}`;
    case 'total_units': return `Have ${obj.amount} units`;
    case 'total_buildings': return `Have ${obj.amount} buildings`;
    case 'march': return 'Send march';
    case 'scout': return 'Send scout';
    default: return obj.type;
  }
}
