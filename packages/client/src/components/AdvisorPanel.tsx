import { useState, useEffect, useMemo, useCallback } from 'react';
import { useGameStore } from '../stores/game-store.js';
import { api } from '../lib/api.js';

interface QuestData {
  id: string;
  completed: boolean;
  claimed: boolean;
}

interface Suggestion {
  text: string;
  detail: string;
  targetPanel: NonNullable<ReturnType<typeof useGameStore.getState>['activePanel']>;
}

const STORAGE_KEY = 'veilfall-advisor-collapsed';

function getInitialCollapsed(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'true';
  } catch {
    return false;
  }
}

export default function AdvisorPanel() {
  const settlements = useGameStore((s) => s.settlements);
  const activeSettlementId = useGameStore((s) => s.activeSettlementId);
  const setActivePanel = useGameStore((s) => s.setActivePanel);

  const [collapsed, setCollapsed] = useState(getInitialCollapsed);
  const [quests, setQuests] = useState<{ story: QuestData[]; daily: QuestData[]; milestones: QuestData[] }>({
    story: [],
    daily: [],
    milestones: [],
  });

  const fetchQuests = useCallback(async () => {
    try {
      const data = await api.getQuests();
      setQuests(data);
    } catch {
      // Quest system may not be available
    }
  }, []);

  useEffect(() => {
    fetchQuests();
    const interval = setInterval(fetchQuests, 30_000);
    return () => clearInterval(interval);
  }, [fetchQuests]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      // localStorage unavailable
    }
  }, [collapsed]);

  const activeSettlement = useMemo(
    () => settlements.find((s) => s.id === activeSettlementId) ?? settlements[0],
    [settlements, activeSettlementId],
  );

  const suggestion = useMemo<Suggestion | null>(() => {
    if (!activeSettlement) return null;

    const { buildings, buildQueue, units, resources } = activeSettlement;
    const buildingTypes = new Set(buildings.map((b) => b.type));
    const hasResources = resources
      && (resources.food > 0 || resources.wood > 0 || resources.stone > 0 || resources.iron > 0);
    const totalUnits = Object.values(units ?? {}).reduce((sum, n) => sum + n, 0);

    // 1. Empty build queue + has resources -> recommend building
    if (buildQueue.length === 0 && hasResources) {
      // Pick a recommended building based on what's missing
      if (!buildingTypes.has('gathering_post')) {
        return {
          text: 'Build a Gathering Post',
          detail: 'Your people hunger, my lord. A Gathering Post will ensure a steady supply of Food to sustain your settlement.',
          targetPanel: 'settlement',
        };
      }
      if (!buildingTypes.has('woodcutter_lodge')) {
        return {
          text: 'Build a Woodcutter Lodge',
          detail: 'Wood is the backbone of expansion. Commission a Woodcutter Lodge so your builders never go wanting.',
          targetPanel: 'settlement',
        };
      }

      // 4. TC level 1 + can upgrade
      const townCenter = buildings.find((b) => b.type === 'town_center');
      if (townCenter && townCenter.level === 1) {
        return {
          text: 'Upgrade your Town Center',
          detail: 'Your Town Center holds the key to greater power. Upgrading it will unlock new buildings and possibilities.',
          targetPanel: 'settlement',
        };
      }

      // Generic: empty build queue with resources
      return {
        text: 'Construct a new building',
        detail: 'Your builders stand idle and resources gather dust. Put them to work -- there is always more to build.',
        targetPanel: 'settlement',
      };
    }

    // 2. No gathering_post (even if queue is busy)
    if (!buildingTypes.has('gathering_post')) {
      return {
        text: 'Build a Gathering Post',
        detail: 'Without a Gathering Post, famine looms. This should be your highest priority, my lord.',
        targetPanel: 'settlement',
      };
    }

    // 3. No woodcutter_lodge
    if (!buildingTypes.has('woodcutter_lodge')) {
      return {
        text: 'Build a Woodcutter Lodge',
        detail: 'The forests hold boundless timber. A Woodcutter Lodge will ensure a steady flow of Wood for your ambitions.',
        targetPanel: 'settlement',
      };
    }

    // 4. TC level 1 + can upgrade
    const townCenter = buildings.find((b) => b.type === 'town_center');
    if (townCenter && townCenter.level === 1 && buildQueue.length === 0) {
      return {
        text: 'Upgrade your Town Center',
        detail: 'Your Town Center holds the key to greater power. Upgrading it will unlock new buildings and possibilities.',
        targetPanel: 'settlement',
      };
    }

    // 5. No units + has barracks
    if (totalUnits === 0 && buildingTypes.has('barracks')) {
      return {
        text: 'Train your first soldiers',
        detail: 'A settlement without defenders is a lamb among wolves. Visit the barracks and train your first warriors.',
        targetPanel: 'settlement',
      };
    }

    // 6. Unclaimed quest rewards
    const allQuests = [...quests.story, ...quests.daily, ...quests.milestones];
    const unclaimedRewards = allQuests.filter((q) => q.completed && !q.claimed);
    if (unclaimedRewards.length > 0) {
      return {
        text: 'Claim your quest rewards!',
        detail: `You have ${unclaimedRewards.length} reward${unclaimedRewards.length > 1 ? 's' : ''} awaiting collection. The fruits of your labor should not go unclaimed.`,
        targetPanel: 'chronicle',
      };
    }

    // 7. No heroes + has hero_hall
    if (buildingTypes.has('hero_hall')) {
      return {
        text: 'Recruit your first Hero',
        detail: 'The Hero Hall stands ready. Great champions await your call -- summon one to lead your forces.',
        targetPanel: 'heroes',
      };
    }

    // 8. Build queue empty + suggest research
    if (buildQueue.length === 0) {
      return {
        text: 'Start a research project',
        detail: 'Knowledge is the truest power. Begin a research project to strengthen your settlement from within.',
        targetPanel: 'research',
      };
    }

    // 9. No alliance
    return {
      text: 'Join or create an Alliance',
      detail: 'No ruler thrives in isolation. Seek out allies or forge your own banner -- together you will be unstoppable.',
      targetPanel: 'alliance',
    };
  }, [activeSettlement, quests]);

  // Fallback suggestion
  const displaySuggestion = suggestion ?? {
    text: 'Explore the World Map',
    detail: 'The Veil recedes with each passing day. Venture forth and discover what lies beyond your borders.',
    targetPanel: 'map' as const,
  };

  const handleGo = () => {
    setActivePanel(displaySuggestion.targetPanel);
    setCollapsed(true);
  };

  // Collapsed state: floating advisor button
  if (collapsed) {
    return (
      <div className="fixed z-40 pointer-events-auto" style={{ bottom: '440px', right: '16px' }}>
        <button
          onClick={() => setCollapsed(false)}
          className="relative flex items-center justify-center w-12 h-12 rounded-full border transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[var(--ember-gold)]/50"
          style={{
            background: 'rgba(20, 30, 56, 0.92)',
            borderColor: 'rgba(var(--ember-gold-rgb, 212, 175, 55), 0.4)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
          }}
          aria-label="Open advisor panel"
        >
          <span className="text-xl" role="img" aria-hidden="true">
            {'\u{1F9D9}'}
          </span>
          {/* Pulse ring when there's a suggestion */}
          {suggestion && (
            <span
              className="absolute inset-0 rounded-full animate-ping"
              style={{
                border: '2px solid var(--ember-gold)',
                opacity: 0.3,
                animationDuration: '2.5s',
              }}
            />
          )}
        </button>
      </div>
    );
  }

  // Expanded state: advisor card
  return (
    <div
      className="fixed z-40 pointer-events-auto max-w-[260px] rounded-lg overflow-hidden"
      style={{
        bottom: '440px',
        right: '16px',
        background: 'rgba(20, 30, 56, 0.94)',
        border: '1px solid rgba(212, 175, 55, 0.25)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
      }}
      role="complementary"
      aria-label="Advisor panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--ruin-grey)]/20">
        <div className="flex items-center gap-2">
          {/* Avatar area */}
          <div
            className="flex items-center justify-center w-8 h-8 rounded-full shrink-0"
            style={{
              background: 'linear-gradient(135deg, var(--veil-blue-deep), var(--aether-violet))',
              border: '1.5px solid var(--ember-gold)',
            }}
          >
            <span className="text-sm" role="img" aria-hidden="true">
              {'\u{1F9D9}'}
            </span>
          </div>
          <h3
            className="text-xs font-semibold leading-tight"
            style={{ fontFamily: 'Cinzel, serif', color: 'var(--ember-gold)' }}
          >
            Elder Maren
          </h3>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="flex items-center justify-center w-6 h-6 rounded text-[var(--ruin-grey)] hover:text-[var(--parchment)] hover:bg-white/5 transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--ruin-grey)]/30"
          aria-label="Dismiss advisor"
        >
          {'\u2715'}
        </button>
      </div>

      {/* Advice body */}
      <div className="px-3 py-3 space-y-2.5">
        {/* Suggestion title */}
        <p
          className="text-[11px] font-semibold leading-snug"
          style={{ color: 'var(--parchment)' }}
        >
          {displaySuggestion.text}
        </p>

        {/* Flavor text */}
        <p
          className="text-[10px] leading-relaxed italic"
          style={{ color: 'var(--parchment-dim)' }}
        >
          {displaySuggestion.detail}
        </p>

        {/* Go button */}
        <button
          onClick={handleGo}
          className="w-full py-1.5 rounded text-[10px] font-bold tracking-wide uppercase transition-all duration-200 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[var(--ember-gold)]/40"
          style={{
            background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(212, 175, 55, 0.1))',
            border: '1px solid rgba(212, 175, 55, 0.35)',
            color: 'var(--ember-gold)',
          }}
        >
          Go
        </button>
      </div>
    </div>
  );
}
