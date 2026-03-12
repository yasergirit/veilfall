import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';
import { triggerRewardCelebration } from '../lib/reward-events.js';

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
  const [claimingAll, setClaimingAll] = useState(false);
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
      // Find the quest to show celebration
      const allQuests = [...quests.story, ...quests.daily, ...quests.milestones];
      const quest = allQuests.find((q) => q.id === questId);
      if (quest?.reward) {
        const rewards: Record<string, number> = { ...quest.reward.resources };
        if (quest.reward.xp) rewards.xp = quest.reward.xp;
        triggerRewardCelebration('Quest Complete!', rewards, quest.title);
      }
      fetchQuests();
    } catch (err) {
      console.error('[Quest] Claim failed:', questId, err);
    } finally {
      setClaiming(null);
    }
  };

  const handleClaimAll = async () => {
    const allQuests = [...quests.story, ...quests.daily, ...quests.milestones];
    const claimable = allQuests.filter((q) => q.completed && !q.claimed);
    if (claimable.length === 0) return;

    setClaimingAll(true);
    const aggregatedRewards: Record<string, number> = {};
    const claimedTitles: string[] = [];

    for (const quest of claimable) {
      setClaiming(quest.id);
      try {
        await api.claimQuestReward(quest.id);
        claimedTitles.push(quest.title);
        if (quest.reward?.resources) {
          for (const [res, amt] of Object.entries(quest.reward.resources)) {
            aggregatedRewards[res] = (aggregatedRewards[res] ?? 0) + amt;
          }
        }
        if (quest.reward?.xp) {
          aggregatedRewards.xp = (aggregatedRewards.xp ?? 0) + quest.reward.xp;
        }
      } catch (err) {
        console.error('[Quest] Claim failed:', quest.id, err);
      }
    }

    setClaiming(null);
    setClaimingAll(false);

    if (claimedTitles.length > 0) {
      const subtitle = claimedTitles.length === 1
        ? claimedTitles[0]
        : `${claimedTitles.length} quests completed`;
      triggerRewardCelebration('Quests Complete!', aggregatedRewards, subtitle);
    }

    fetchQuests();
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

          {/* Claim All */}
          {totalClaimable > 1 && (
            <div className="px-3 pt-2">
              <button
                onClick={handleClaimAll}
                disabled={claimingAll}
                className="w-full text-[10px] font-bold py-1.5 rounded bg-green-500/20 border border-green-500/50 text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {claimingAll ? 'Claiming...' : `Claim All (${totalClaimable})`}
              </button>
            </div>
          )}

          {/* Quest List */}
          <div className="p-3 max-h-64 overflow-y-auto space-y-2">
            {displayQuests.length === 0 ? (
              <EmptyQuestState tab={tab} />
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

function EmptyQuestState({ tab }: { tab: TabKey }) {
  const configs: Record<TabKey, { icon: React.ReactNode; title: string; subtitle: string }> = {
    story: {
      icon: (
        <svg viewBox="0 0 64 64" className="w-16 h-16 mx-auto mb-3" fill="none">
          {/* Book / scroll icon */}
          <rect x="14" y="10" width="36" height="44" rx="3" fill="var(--veil-blue-deep)" stroke="var(--ruin-grey)" strokeWidth="1.5" opacity="0.6" />
          <rect x="18" y="10" width="32" height="44" rx="2" fill="var(--veil-blue-deep)" stroke="var(--ember-gold)" strokeWidth="1" opacity="0.4" />
          <path d="M24 22h16M24 28h12M24 34h14" stroke="var(--ruin-grey)" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
          <circle cx="34" cy="42" r="6" fill="none" stroke="var(--aether-violet)" strokeWidth="1.2" opacity="0.5">
            <animate attributeName="r" values="5;7;5" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;0.7;0.3" dur="3s" repeatCount="indefinite" />
          </circle>
          <path d="M34 39v6M31 42h6" stroke="var(--aether-violet)" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
          {/* Sparkle */}
          <circle cx="46" cy="16" r="1.5" fill="var(--ember-gold)" opacity="0.6">
            <animate attributeName="opacity" values="0.2;0.8;0.2" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx="12" cy="30" r="1" fill="var(--aether-violet)" opacity="0.4">
            <animate attributeName="opacity" values="0.1;0.6;0.1" dur="2.5s" repeatCount="indefinite" />
          </circle>
        </svg>
      ),
      title: 'Your story awaits',
      subtitle: 'Quest chapters will unfold as your settlement grows...',
    },
    daily: {
      icon: (
        <svg viewBox="0 0 64 64" className="w-16 h-16 mx-auto mb-3" fill="none">
          {/* Sun / clock icon for daily */}
          <circle cx="32" cy="32" r="14" fill="none" stroke="var(--ember-gold)" strokeWidth="1.5" opacity="0.3" />
          <circle cx="32" cy="32" r="10" fill="var(--veil-blue-deep)" stroke="var(--ember-gold)" strokeWidth="1" opacity="0.5" />
          <path d="M32 24v8l5 3" stroke="var(--ember-gold)" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
          {/* Rays */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const x1 = 32 + Math.cos(rad) * 17;
            const y1 = 32 + Math.sin(rad) * 17;
            const x2 = 32 + Math.cos(rad) * 20;
            const y2 = 32 + Math.sin(rad) * 20;
            return (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ember-gold)" strokeWidth="1.5" strokeLinecap="round" opacity="0.3">
                <animate attributeName="opacity" values="0.15;0.5;0.15" dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
              </line>
            );
          })}
          {/* Hourglass sand particles */}
          <circle cx="22" cy="50" r="1" fill="var(--ember-gold)" opacity="0.3">
            <animate attributeName="cy" values="50;46;50" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.1;0.5;0.1" dur="3s" repeatCount="indefinite" />
          </circle>
          <circle cx="42" cy="48" r="0.8" fill="var(--ember-gold)" opacity="0.2">
            <animate attributeName="cy" values="48;44;48" dur="2.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.1;0.4;0.1" dur="2.5s" repeatCount="indefinite" />
          </circle>
        </svg>
      ),
      title: 'No daily tasks yet',
      subtitle: 'Build your settlement to unlock daily challenges',
    },
    milestone: {
      icon: (
        <svg viewBox="0 0 64 64" className="w-16 h-16 mx-auto mb-3" fill="none">
          {/* Trophy / achievement icon */}
          <path d="M22 18h20v8c0 8-4 14-10 16-6-2-10-8-10-16z" fill="var(--veil-blue-deep)" stroke="var(--aether-violet)" strokeWidth="1.2" opacity="0.5" />
          <path d="M22 22h-6c0 6 3 10 6 10" stroke="var(--aether-violet)" strokeWidth="1" opacity="0.3" />
          <path d="M42 22h6c0 6-3 10-6 10" stroke="var(--aether-violet)" strokeWidth="1" opacity="0.3" />
          <rect x="28" y="42" width="8" height="4" rx="1" fill="var(--aether-violet)" opacity="0.3" />
          <rect x="24" y="46" width="16" height="3" rx="1.5" fill="var(--aether-violet)" opacity="0.25" />
          {/* Star */}
          <path d="M32 24l2 4 4.5.7-3.2 3.2.8 4.5L32 34l-4.1 2.4.8-4.5-3.2-3.2L30 28z" fill="var(--aether-violet)" opacity="0.4">
            <animate attributeName="opacity" values="0.2;0.6;0.2" dur="3s" repeatCount="indefinite" />
          </path>
          {/* Floating particles */}
          <circle cx="16" cy="14" r="1.2" fill="var(--aether-violet)" opacity="0.3">
            <animate attributeName="opacity" values="0.1;0.5;0.1" dur="2.2s" repeatCount="indefinite" />
          </circle>
          <circle cx="50" cy="12" r="1" fill="var(--aether-violet)" opacity="0.2">
            <animate attributeName="opacity" values="0.1;0.6;0.1" dur="2.8s" repeatCount="indefinite" />
          </circle>
          <circle cx="48" cy="50" r="0.8" fill="var(--ember-gold)" opacity="0.2">
            <animate attributeName="opacity" values="0.1;0.4;0.1" dur="3.2s" repeatCount="indefinite" />
          </circle>
        </svg>
      ),
      title: 'No milestones yet',
      subtitle: 'Great achievements await those who persevere',
    },
  };

  const config = configs[tab];

  return (
    <div className="flex flex-col items-center justify-center py-6 px-4">
      {config.icon}
      <p className="text-xs font-semibold text-[var(--parchment-dim)] mb-1" style={{ fontFamily: 'Cinzel, serif' }}>
        {config.title}
      </p>
      <p className="text-[10px] text-[var(--ruin-grey)] text-center leading-relaxed italic">
        {config.subtitle}
      </p>
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
