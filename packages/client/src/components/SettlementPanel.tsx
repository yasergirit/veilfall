import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../stores/game-store.js';
import { useAuthStore } from '../stores/auth-store.js';
import { api } from '../lib/api.js';
import { useToastStore } from '../stores/toast-store.js';
import UnitPanel from './UnitPanel.js';

const MAX_BUILDING_LEVEL = 20;
const MAX_TC_LEVEL = 5;

// Town Center upgrade costs (mirrors server TC_UPGRADE_COSTS)
const TC_UPGRADE_COSTS: Record<number, { cost: Record<string, number>; time: number }> = {
  2: { cost: { food: 200, wood: 300, stone: 200 }, time: 120 },
  3: { cost: { food: 500, wood: 600, stone: 400, iron: 200 }, time: 300 },
  4: { cost: { food: 1000, wood: 1200, stone: 800, iron: 400, aether_stone: 100 }, time: 600 },
  5: { cost: { food: 2000, wood: 2400, stone: 1600, iron: 800, aether_stone: 300 }, time: 1200 },
};

// Town Center level required for each building
const TC_REQUIREMENTS: Record<string, number> = {
  gathering_post: 1, woodcutter_lodge: 1, palisade_wall: 1,
  stone_quarry: 2, iron_mine: 2, militia_barracks: 2,
  scout_tower: 2, warehouse: 2,
  aether_extractor: 3, hero_hall: 3, marketplace: 3, spy_guild: 3,
  ironveil_foundry: 3, aetheri_resonance: 3, thornwatch_rootway: 3, ashen_reliquary: 3,
};

interface BuildingSlot {
  type: string;
  name: string;
  icon: string;
  description: string;
  buildable: boolean;
  cost?: Record<string, number>;
  time?: number;
  tcRequired?: number;
  factionOnly?: string;
}

const BUILDING_SLOTS: BuildingSlot[] = [
  { type: 'town_center', name: 'Town Center', icon: '\u{1F3DB}', description: 'The heart of your settlement. Upgrade to unlock new buildings.', buildable: false },
  { type: 'gathering_post', name: 'Gathering Post', icon: '\u{1F33E}', description: 'Produces food for your settlement. +30/hr per level.', buildable: true, cost: { food: 50, wood: 80 }, time: 30, tcRequired: 1 },
  { type: 'woodcutter_lodge', name: "Woodcutter's Lodge", icon: '\u{1FAB5}', description: 'Harvests wood from nearby forests. +25/hr per level.', buildable: true, cost: { food: 50, wood: 40, stone: 30 }, time: 30, tcRequired: 1 },
  { type: 'stone_quarry', name: 'Stone Quarry', icon: '\u{1FAA8}', description: 'Mines stone from quarry deposits. +20/hr per level.', buildable: true, cost: { food: 40, wood: 60, iron: 20 }, time: 45, tcRequired: 2 },
  { type: 'iron_mine', name: 'Iron Mine', icon: '\u{2699}', description: 'Extracts iron ore from underground veins. +15/hr per level.', buildable: true, cost: { food: 60, wood: 80, stone: 40 }, time: 60, tcRequired: 2 },
  { type: 'aether_extractor', name: 'Aether Extractor', icon: '\u{1F48E}', description: 'Harvests Aether Stone from nearby deposits. +5/hr per level.', buildable: true, cost: { wood: 100, stone: 80, iron: 60 }, time: 90, tcRequired: 3 },
  { type: 'militia_barracks', name: 'Militia Barracks', icon: '\u{2694}', description: 'Train basic military units.', buildable: true, cost: { food: 80, wood: 120, stone: 60 }, time: 60, tcRequired: 2 },
  { type: 'palisade_wall', name: 'Palisade Wall', icon: '\u{1F6E1}', description: 'Basic defensive wall around your settlement.', buildable: true, cost: { wood: 150, stone: 50 }, time: 45, tcRequired: 1 },
  { type: 'scout_tower', name: 'Scout Tower', icon: '\u{1F441}', description: 'Reveals nearby map tiles. +2 hex vision per level.', buildable: true, cost: { wood: 80, stone: 60 }, time: 40, tcRequired: 2 },
  { type: 'hero_hall', name: 'Hero Hall', icon: '\u{1F451}', description: 'Recruit and manage heroes.', buildable: true, cost: { food: 100, wood: 150, stone: 100 }, time: 90, tcRequired: 3 },
  { type: 'warehouse', name: 'Warehouse', icon: '\u{1F4E6}', description: 'Increases resource storage capacity.', buildable: true, cost: { wood: 100, stone: 80 }, time: 40, tcRequired: 2 },
  { type: 'marketplace', name: 'Marketplace', icon: '\u{1F3EA}', description: 'Enable trade with other settlements.', buildable: true, cost: { wood: 120, stone: 80, iron: 40 }, time: 60, tcRequired: 3 },
  { type: 'spy_guild', name: 'Spy Guild', icon: '\u{1F5E1}', description: 'Enables espionage missions. Higher levels improve success rate.', buildable: true, cost: { wood: 100, stone: 100, iron: 80 }, time: 90, tcRequired: 3 },
  // Faction-specific buildings
  { type: 'ironveil_foundry', name: 'Ironveil Foundry', icon: '\u{2692}', description: 'Unique Ironveil forge. Boosts iron production and unit armor.', buildable: true, cost: { iron: 200, stone: 150, wood: 100 }, time: 120, tcRequired: 3, factionOnly: 'ironveil' },
  { type: 'aetheri_resonance', name: 'Aetheri Resonance Spire', icon: '\u{1F52E}', description: 'Unique Aetheri tower. Amplifies aether extraction and research speed.', buildable: true, cost: { aether_stone: 150, iron: 100, stone: 80 }, time: 120, tcRequired: 3, factionOnly: 'aetheri' },
  { type: 'thornwatch_rootway', name: 'Thornwatch Rootway', icon: '\u{1F33F}', description: 'Unique Thornwatch network. Boosts food/wood production and march speed.', buildable: true, cost: { wood: 200, food: 150, stone: 80 }, time: 120, tcRequired: 3, factionOnly: 'thornwatch' },
  { type: 'ashen_reliquary', name: 'Ashen Reliquary', icon: '\u{1F480}', description: 'Unique Ashen vault. Boosts stone production and defensive power.', buildable: true, cost: { stone: 200, iron: 100, aether_stone: 50 }, time: 120, tcRequired: 3, factionOnly: 'ashen' },
];

const RESOURCE_LABELS: Record<string, string> = {
  food: 'Food', wood: 'Wood', stone: 'Stone', iron: 'Iron', aether_stone: 'Aether',
};

const RESOURCE_ICONS: Record<string, string> = {
  food: '\u{1F33E}', wood: '\u{1FAB5}', stone: '\u{1FAA8}', iron: '\u{2699}', aether_stone: '\u{1F48E}',
};

function formatTime(seconds: number): string {
  if (seconds <= 0) return 'Done!';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}h ${rm}m`;
  }
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function useCountdown(endsAt: number | undefined): number {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!endsAt) { setRemaining(0); return; }
    const update = () => setRemaining(Math.max(0, (endsAt - Date.now()) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  return remaining;
}

function getUpgradeCost(baseCost: Record<string, number>, nextLevel: number): Record<string, number> {
  return Object.fromEntries(
    Object.entries(baseCost).map(([res, amount]) => [res, amount * nextLevel]),
  );
}

function getUpgradeTime(baseTime: number, nextLevel: number): number {
  return Math.ceil(baseTime * nextLevel * 0.8);
}

export default function SettlementPanel() {
  const settlements = useGameStore((s) => s.settlements);
  const activeSettlementId = useGameStore((s) => s.activeSettlementId);
  const setSettlements = useGameStore((s) => s.setSettlements);
  const addToast = useToastStore((s) => s.addToast);
  const player = useAuthStore((s) => s.player);
  const activeSettlement = settlements.find((s) => s.id === activeSettlementId);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const tcLevel = activeSettlement?.buildings.find((b) => b.type === 'town_center')?.level ?? 1;

  // Auto-refresh: poll settlements when there's an active build queue
  const hasBuildQueue = (activeSettlement?.buildQueue?.length ?? 0) > 0;
  useEffect(() => {
    if (!hasBuildQueue) return;
    const interval = setInterval(() => {
      api.getSettlements().then((data) => setSettlements(data.settlements)).catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [hasBuildQueue, setSettlements]);

  const canAfford = useCallback((cost: Record<string, number>) => {
    if (!activeSettlement) return false;
    return Object.entries(cost).every(
      ([res, amount]) => ((activeSettlement.resources as Record<string, number>)[res] ?? 0) >= amount,
    );
  }, [activeSettlement]);

  const refreshSettlements = useCallback(async () => {
    const data = await api.getSettlements();
    setSettlements(data.settlements);
  }, [setSettlements]);

  const handleBuild = async (buildingType: string) => {
    if (!activeSettlement || actionInProgress) return;
    setActionInProgress(true);
    setMessage(null);
    try {
      const result = await api.buildBuilding(activeSettlement.id, buildingType);
      setMessage({ text: result.message, type: 'success' });
      addToast({ message: result.message, type: 'success' });
      await refreshSettlements();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Build failed';
      setMessage({ text: msg, type: 'error' });
      addToast({ message: msg, type: 'error' });
    } finally {
      setActionInProgress(false);
    }
  };

  const handleUpgrade = async (buildingType: string) => {
    if (!activeSettlement || actionInProgress) return;
    setActionInProgress(true);
    setMessage(null);
    try {
      const result = await api.upgradeBuilding(activeSettlement.id, buildingType);
      setMessage({ text: result.message, type: 'success' });
      addToast({ message: result.message, type: 'success' });
      await refreshSettlements();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upgrade failed';
      setMessage({ text: msg, type: 'error' });
      addToast({ message: msg, type: 'error' });
    } finally {
      setActionInProgress(false);
    }
  };

  const hasBarracks = activeSettlement?.buildings.some((b) => b.type === 'militia_barracks');
  const queueFull = (activeSettlement?.buildQueue?.length ?? 0) >= 2;

  // Filter building slots: only show faction buildings for the player's faction
  const visibleSlots = BUILDING_SLOTS.filter((slot) => {
    if (slot.factionOnly && slot.factionOnly !== player?.faction) return false;
    return true;
  });

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto pb-16">
        {/* Settlement Header */}
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl mb-1" style={{ fontFamily: 'Cinzel, serif' }}>
              {activeSettlement?.name ?? 'Your Settlement'}
            </h2>
            <p className="text-[var(--parchment-dim)] text-sm">
              Level {activeSettlement?.level ?? 1} Settlement
              {activeSettlement && (
                <span className="ml-3 text-[var(--ruin-grey)]">
                  ({activeSettlement.buildings.length} building{activeSettlement.buildings.length !== 1 ? 's' : ''})
                </span>
              )}
            </p>
          </div>
          {activeSettlement && (
            <div className="text-xs text-[var(--ruin-grey)]">
              [{activeSettlement.coordinates.q}, {activeSettlement.coordinates.r}]
            </div>
          )}
        </div>

        {/* Status Message */}
        {message && (
          <div className={`mb-4 p-3 rounded text-sm ${
            message.type === 'success'
              ? 'bg-green-900/30 border border-green-700/50 text-green-300'
              : 'bg-red-900/30 border border-red-700/50 text-red-300'
          }`}>
            {message.text}
          </div>
        )}

        {/* Build Queue */}
        {activeSettlement && activeSettlement.buildQueue.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[var(--ember-gold)] mb-2">
              Construction Queue ({activeSettlement.buildQueue.length}/2)
            </h3>
            <div className="space-y-2">
              {activeSettlement.buildQueue.map((item, idx) => (
                <BuildQueueItem key={`${item.type}-${idx}`} item={item} />
              ))}
            </div>
          </div>
        )}

        {/* Queue full warning */}
        {queueFull && (
          <div className="mb-4 p-2 rounded text-xs bg-[var(--ember-gold)]/10 border border-[var(--ember-gold)]/30 text-[var(--ember-gold)]">
            Construction queue is full (2/2). Wait for a building to finish.
          </div>
        )}

        {/* Narrative intro for new players */}
        {(!activeSettlement || activeSettlement.level <= 1) && (
          <div className="mb-6 p-4 rounded-lg border border-[var(--ember-gold)]/30 bg-[var(--ember-gold)]/5">
            <p className="text-sm text-[var(--parchment)] italic leading-relaxed">
              "To the last heir — if you are reading this, I have passed, and the settlement is yours.
              Our people are few. Our walls are thin. But beneath us lies something the old world left behind.
              Do not dig until the walls are strong. Trust the stone — it remembers what we have forgotten."
            </p>
            <p className="text-xs text-[var(--ember-gold)] mt-2">— Elder Maren's Letter</p>
          </div>
        )}

        {/* Building Grid */}
        <h3 className="text-lg mb-4" style={{ fontFamily: 'Cinzel, serif' }}>Buildings</h3>
        <div data-tutorial="building-grid" className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {visibleSlots.map((slot) => {
            const existing = activeSettlement?.buildings.find((b) => b.type === slot.type);
            const inQueue = activeSettlement?.buildQueue.find((b) => b.type === slot.type);
            const isBuilt = !!existing;
            const isQueued = !!inQueue;
            const isTownCenter = slot.type === 'town_center';

            // Town Center level requirement
            const requiredTc = slot.tcRequired ?? TC_REQUIREMENTS[slot.type] ?? 1;
            const tcUnlocked = tcLevel >= requiredTc;

            // Build cost & affordability
            const affordable = slot.cost && tcUnlocked ? canAfford(slot.cost) : false;
            const canBuild = slot.buildable && !isBuilt && !isQueued && affordable && !queueFull && tcUnlocked;

            // Upgrade logic
            let isMaxLevel = false;
            let nextLevel = 1;
            let upgradeCost: Record<string, number> | null = null;
            let upgradeTimeSeconds: number | null = null;

            if (isTownCenter && isBuilt) {
              nextLevel = existing.level + 1;
              isMaxLevel = existing.level >= MAX_TC_LEVEL;
              if (!isMaxLevel && TC_UPGRADE_COSTS[nextLevel]) {
                upgradeCost = TC_UPGRADE_COSTS[nextLevel].cost;
                upgradeTimeSeconds = TC_UPGRADE_COSTS[nextLevel].time;
              }
            } else if (isBuilt) {
              nextLevel = existing.level + 1;
              isMaxLevel = existing.level >= MAX_BUILDING_LEVEL;
              if (slot.cost && !isMaxLevel) {
                upgradeCost = getUpgradeCost(slot.cost, nextLevel);
                upgradeTimeSeconds = slot.time ? getUpgradeTime(slot.time, nextLevel) : null;
              }
            }

            const canAffordUpgrade = upgradeCost ? canAfford(upgradeCost) : false;
            const canUpgrade = canAffordUpgrade && !actionInProgress && !isQueued && !queueFull;

            const handleCardClick = () => {
              if (canBuild && !actionInProgress) {
                handleBuild(slot.type);
              } else if (canUpgrade) {
                handleUpgrade(slot.type);
              }
            };

            return (
              <div
                key={slot.type}
                onClick={handleCardClick}
                role={canBuild || canUpgrade ? 'button' : undefined}
                tabIndex={canBuild || canUpgrade ? 0 : undefined}
                onKeyDown={(e) => { if (e.key === 'Enter' && (canBuild || canUpgrade)) handleCardClick(); }}
                className={`p-4 rounded-lg border text-left transition-all group relative select-none ${
                  isBuilt
                    ? 'border-green-700/40 bg-green-900/10'
                    : isQueued
                    ? 'border-[var(--ember-gold)]/40 bg-[var(--ember-gold)]/5'
                    : !tcUnlocked
                    ? 'border-[var(--ruin-grey)]/10 bg-[var(--veil-blue)]/10 opacity-40'
                    : canBuild
                    ? 'border-[var(--ruin-grey)]/30 bg-[var(--veil-blue)]/50 hover:border-[var(--aether-violet)]/60 hover:bg-[var(--aether-violet)]/10 cursor-pointer active:scale-[0.98]'
                    : 'border-[var(--ruin-grey)]/20 bg-[var(--veil-blue)]/20 opacity-60'
                }`}
              >
                {/* Status badge */}
                {isBuilt && isMaxLevel && (
                  <span className="absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded bg-[var(--ember-gold)]/20 text-[var(--ember-gold)] font-semibold">
                    MAX
                  </span>
                )}
                {isBuilt && !isMaxLevel && (
                  <span className="absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded bg-green-800/50 text-green-300">
                    Lv{existing.level}
                  </span>
                )}
                {isQueued && (
                  <span className="absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded bg-[var(--ember-gold)]/20 text-[var(--ember-gold)] animate-pulse">
                    Building...
                  </span>
                )}

                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{slot.icon}</span>
                  <div>
                    <span className="text-sm font-medium text-[var(--parchment)] group-hover:text-[var(--ember-gold)] transition-colors">
                      {slot.name}
                    </span>
                    {slot.factionOnly && (
                      <span className="ml-2 text-[10px] px-1 py-0.5 rounded bg-[var(--aether-violet)]/20 text-[var(--aether-violet)] capitalize">
                        {slot.factionOnly}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-[var(--ruin-grey)] leading-relaxed mb-2">
                  {slot.description}
                </p>

                {/* TC requirement notice */}
                {!isBuilt && !isQueued && !tcUnlocked && (
                  <div className="text-xs text-red-400/80 mt-1">
                    Requires Town Center Lv{requiredTc}
                  </div>
                )}

                {/* Build section (for unbuilt buildings) */}
                {slot.buildable && slot.cost && !isBuilt && !isQueued && tcUnlocked && (
                  <div className="mt-1">
                    <CostDisplay cost={slot.cost} resources={activeSettlement?.resources} />
                    {slot.time && (
                      <span className="text-xs text-[var(--ruin-grey)] ml-1">
                        {formatTime(slot.time)}
                      </span>
                    )}
                    <button
                      disabled={!canBuild || actionInProgress}
                      onClick={(e) => { e.stopPropagation(); if (canBuild) handleBuild(slot.type); }}
                      className={`w-full mt-2 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                        canBuild && !actionInProgress
                          ? 'bg-[var(--aether-violet)]/30 border border-[var(--aether-violet)]/50 text-[var(--parchment)] hover:bg-[var(--aether-violet)]/50'
                          : 'bg-[var(--ruin-grey)]/20 border border-[var(--ruin-grey)]/20 text-[var(--ruin-grey)] cursor-not-allowed'
                      }`}
                    >
                      {queueFull ? 'Queue Full' : actionInProgress ? 'Building...' : 'Build'}
                    </button>
                  </div>
                )}

                {/* Upgrade section (for built buildings, not at max) */}
                {isBuilt && !isMaxLevel && upgradeCost && (
                  <div className="mt-2 pt-2 border-t border-[var(--ruin-grey)]/20">
                    <CostDisplay cost={upgradeCost} resources={activeSettlement?.resources} />
                    {upgradeTimeSeconds != null && (
                      <span className="text-xs text-[var(--ruin-grey)] ml-1">
                        {formatTime(upgradeTimeSeconds)}
                      </span>
                    )}
                    <button
                      disabled={!canUpgrade}
                      onClick={(e) => { e.stopPropagation(); if (canUpgrade) handleUpgrade(slot.type); }}
                      className={`w-full mt-2 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                        canUpgrade
                          ? 'bg-[var(--ember-gold)]/20 border border-[var(--ember-gold)]/40 text-[var(--ember-gold)] hover:bg-[var(--ember-gold)]/30'
                          : 'bg-[var(--ruin-grey)]/20 border border-[var(--ruin-grey)]/20 text-[var(--ruin-grey)] cursor-not-allowed'
                      }`}
                    >
                      {queueFull ? 'Queue Full' : isQueued ? 'In Queue' : actionInProgress ? 'Working...' : `Upgrade to Lv${nextLevel}`}
                    </button>
                  </div>
                )}

                {/* Max level message */}
                {isBuilt && isMaxLevel && (
                  <div className="mt-2 pt-2 border-t border-[var(--ruin-grey)]/10">
                    <p className="text-xs text-[var(--ember-gold)]/60 italic">Fully upgraded</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Military Section - UnitPanel */}
        {activeSettlement && hasBarracks && (
          <div className="mt-8">
            <h3 className="text-lg mb-4" style={{ fontFamily: 'Cinzel, serif' }}>Military</h3>
            <UnitPanel
              settlementId={activeSettlement.id}
              resources={activeSettlement.resources}
              buildings={activeSettlement.buildings}
              units={activeSettlement.units ?? {}}
              trainQueue={activeSettlement.trainQueue ?? []}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function CostDisplay({ cost, resources }: { cost: Record<string, number>; resources?: Record<string, number> }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {Object.entries(cost).map(([res, amount]) => {
        const have = (resources as Record<string, number>)?.[res] ?? 0;
        const enough = have >= amount;
        return (
          <span key={res} className={`text-xs ${enough ? 'text-[var(--parchment-dim)]' : 'text-red-400'}`}>
            {RESOURCE_ICONS[res] || ''} {RESOURCE_LABELS[res] || res}: {amount}
          </span>
        );
      })}
    </div>
  );
}

function BuildQueueItem({ item }: { item: { type: string; targetLevel: number; startedAt: number; endsAt: number } }) {
  const remaining = useCountdown(item.endsAt);
  const slot = BUILDING_SLOTS.find((s) => s.type === item.type);
  const totalDuration = (item.endsAt - item.startedAt) / 1000;
  const elapsed = totalDuration - remaining;
  const progress = totalDuration > 0 ? Math.max(0, Math.min(100, (elapsed / totalDuration) * 100)) : 100;

  return (
    <div className="flex items-center gap-3 p-3 rounded bg-[var(--veil-blue)]/60 border border-[var(--ember-gold)]/20">
      <span className="text-lg">{slot?.icon ?? '\u{1F3D7}'}</span>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-[var(--parchment)]">
            {slot?.name ?? item.type} Lv{item.targetLevel}
          </span>
          <span className="text-xs text-[var(--ember-gold)] font-mono">
            {remaining > 0 ? formatTime(remaining) : 'Complete!'}
          </span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-[var(--veil-blue-deep)]">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, var(--aether-violet), var(--aether-glow))',
            }}
          />
        </div>
      </div>
    </div>
  );
}
