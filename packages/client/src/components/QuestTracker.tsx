import { useState, useEffect } from 'react';
import { useGameStore } from '../stores/game-store.js';

interface Quest {
  id: number;
  title: string;
  description: string;
  narrator: string;
  objective: string;
  checkFn: (state: any) => boolean;
  reward: string;
}

const QUEST_CHAIN: Quest[] = [
  {
    id: 1,
    title: 'A Full Stomach',
    description: '"We\'ve been living off scavenged food. Build a Gathering Post — an empire starts with a full stomach." — Sera',
    narrator: 'Sera',
    objective: 'Build a Gathering Post',
    checkFn: (s) => s.buildings.some((b: any) => b.type === 'gathering_post'),
    reward: 'Unlocks next quest',
  },
  {
    id: 2,
    title: 'Walls of Hope',
    description: '"Scavengers have been seen nearby. We need protection before they find our Aether Stone." — Sera',
    narrator: 'Sera',
    objective: 'Build a Palisade Wall',
    checkFn: (s) => s.buildings.some((b: any) => b.type === 'palisade_wall'),
    reward: 'Defense +10%',
  },
  {
    id: 3,
    title: 'The Blue Glow',
    description: '"See those crystals growing from the earth? That\'s Aether Stone. Everyone\'s fighting over it. We should harvest some." — Sera',
    narrator: 'Sera',
    objective: 'Build an Aether Extractor',
    checkFn: (s) => s.buildings.some((b: any) => b.type === 'aether_extractor'),
    reward: 'Aether Stone production begins',
  },
  {
    id: 4,
    title: 'Idle Hands',
    description: '"We need soldiers. Not many — just enough to make the scavengers think twice." — Sera',
    narrator: 'Sera',
    objective: 'Build a Militia Barracks',
    checkFn: (s) => s.buildings.some((b: any) => b.type === 'militia_barracks'),
    reward: 'Military units unlocked',
  },
  {
    id: 5,
    title: "The Stranger's Oath",
    description: '"A wanderer approaches your gates — tired, armed, scarred. They say they\'ve been looking for a Bloodline Seat. Are you the heir?" — ???',
    narrator: '???',
    objective: 'Build a Hero Hall',
    checkFn: (s) => s.buildings.some((b: any) => b.type === 'hero_hall'),
    reward: 'Hero recruitment unlocked',
  },
  {
    id: 6,
    title: 'Eyes on the Horizon',
    description: '"We\'re blind out there. Build a Scout Tower and we can see what\'s coming before it arrives." — Sera',
    narrator: 'Sera',
    objective: 'Build a Scout Tower',
    checkFn: (s) => s.buildings.some((b: any) => b.type === 'scout_tower'),
    reward: 'Map vision expanded',
  },
  {
    id: 7,
    title: 'Timber and Stone',
    description: '"The settlement grows, but we need more materials. Establish a proper wood supply." — Sera',
    narrator: 'Sera',
    objective: "Build a Woodcutter's Lodge",
    checkFn: (s) => s.buildings.some((b: any) => b.type === 'woodcutter_lodge'),
    reward: 'Wood production begins',
  },
  {
    id: 8,
    title: 'Deep Foundations',
    description: '"Stone. We need stone for proper walls, proper buildings. The quarry to the north has deposits." — Sera',
    narrator: 'Sera',
    objective: 'Build a Stone Quarry',
    checkFn: (s) => s.buildings.some((b: any) => b.type === 'stone_quarry'),
    reward: 'Stone production begins',
  },
  {
    id: 9,
    title: 'Iron Will',
    description: '"For weapons and armor, we need iron. There are veins beneath us — Elder Maren mentioned them in her letter." — Sera',
    narrator: 'Sera',
    objective: 'Build an Iron Mine',
    checkFn: (s) => s.buildings.some((b: any) => b.type === 'iron_mine'),
    reward: 'Iron production begins',
  },
  {
    id: 10,
    title: "The Elder's Secret",
    description: '"The walls are strong now. It\'s time to dig beneath the town center — Elder Maren said there was something hidden below. Something from the old world..." — Sera',
    narrator: 'Sera',
    objective: 'Upgrade Town Center to Level 3',
    checkFn: (s) => s.buildings.some((b: any) => b.type === 'town_center' && b.level >= 3),
    reward: 'LORE UNLOCKED: The Buried Idol',
  },
];

export default function QuestTracker() {
  const settlements = useGameStore((s) => s.settlements);
  const activeSettlementId = useGameStore((s) => s.activeSettlementId);
  const activeSettlement = settlements.find((s) => s.id === activeSettlementId);
  const [expanded, setExpanded] = useState(true);

  // Determine current quest
  let currentQuestIdx = 0;
  if (activeSettlement) {
    for (let i = 0; i < QUEST_CHAIN.length; i++) {
      if (QUEST_CHAIN[i].checkFn(activeSettlement)) {
        currentQuestIdx = i + 1;
      } else {
        break;
      }
    }
  }

  const completedCount = currentQuestIdx;
  const currentQuest = QUEST_CHAIN[currentQuestIdx];
  const allDone = currentQuestIdx >= QUEST_CHAIN.length;

  return (
    <div data-tutorial="quest-tracker" className="absolute bottom-4 right-4 w-80 pointer-events-auto">
      {/* Toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 rounded-t-lg bg-[var(--veil-blue)]/95 border border-[var(--ruin-grey)]/30 border-b-0 text-xs"
      >
        <span className="font-semibold" style={{ fontFamily: 'Cinzel, serif', color: 'var(--ember-gold)' }}>
          The Elder's Promise
        </span>
        <span className="text-[var(--ruin-grey)]">
          {completedCount}/{QUEST_CHAIN.length} {expanded ? '\u25BC' : '\u25B2'}
        </span>
      </button>

      {expanded && (
        <div className="p-4 rounded-b-lg bg-[var(--veil-blue)]/95 border border-[var(--ruin-grey)]/30 border-t-0">
          {allDone ? (
            <div className="text-center">
              <p className="text-[var(--ember-gold)] text-sm font-semibold mb-2">Quest Chain Complete!</p>
              <p className="text-xs text-[var(--parchment)] italic">
                "The idol beneath the town center pulses with light. An inscription reads:
                'When the last thread breaks, the Weavers return.'
                Elder Maren knew. The path to something greater lies ahead..."
              </p>
            </div>
          ) : currentQuest ? (
            <>
              {/* Current Quest */}
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[var(--ember-gold)] text-xs font-mono">#{currentQuest.id}</span>
                  <span className="text-sm font-semibold text-[var(--parchment)]">{currentQuest.title}</span>
                </div>
                <p className="text-xs text-[var(--parchment-dim)] italic leading-relaxed">
                  {currentQuest.description}
                </p>
              </div>

              {/* Objective */}
              <div className="flex items-center gap-2 p-2 rounded bg-[var(--veil-blue-deep)]/50 border border-[var(--ruin-grey)]/15 mb-3">
                <span className="text-[var(--ruin-grey)]">\u25CB</span>
                <span className="text-xs text-[var(--parchment)]">{currentQuest.objective}</span>
              </div>

              {/* Reward */}
              <div className="text-xs text-[var(--aether-violet)]">
                Reward: {currentQuest.reward}
              </div>
            </>
          ) : null}

          {/* Progress dots */}
          <div className="flex gap-1 mt-3 justify-center">
            {QUEST_CHAIN.map((q, i) => (
              <div
                key={q.id}
                className={`w-2 h-2 rounded-full ${
                  i < completedCount
                    ? 'bg-green-400'
                    : i === completedCount
                    ? 'bg-[var(--ember-gold)]'
                    : 'bg-[var(--ruin-grey)]/30'
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
