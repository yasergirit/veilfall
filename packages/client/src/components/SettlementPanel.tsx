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

// Production rates per level (resource, amount per hour)
const PRODUCTION_RATES: Record<string, { resource: string; perHour: number }> = {
  gathering_post: { resource: 'food', perHour: 30 },
  woodcutter_lodge: { resource: 'wood', perHour: 25 },
  stone_quarry: { resource: 'stone', perHour: 20 },
  iron_mine: { resource: 'iron', perHour: 15 },
  aether_extractor: { resource: 'aether_stone', perHour: 5 },
};

// What each building unlocks or provides at next levels
const BUILDING_UNLOCKS: Record<string, string[]> = {
  town_center: ['Lv2: Stone Quarry, Iron Mine, Barracks', 'Lv3: Aether Extractor, Hero Hall', 'Lv4: Advanced research', 'Lv5: Legendary structures'],
  gathering_post: ['Higher levels: +30 food/hr each'],
  woodcutter_lodge: ['Higher levels: +25 wood/hr each'],
  stone_quarry: ['Higher levels: +20 stone/hr each'],
  iron_mine: ['Higher levels: +15 iron/hr each'],
  aether_extractor: ['Higher levels: +5 aether/hr each'],
  militia_barracks: ['Lv1: Train Militia', 'Lv3: Train Archers', 'Lv5: Train Knights'],
  palisade_wall: ['Each level: +10% defense bonus'],
  scout_tower: ['Each level: +2 hex vision range'],
  hero_hall: ['Lv1: Recruit heroes', 'Lv3: Hero abilities'],
  warehouse: ['Each level: +500 storage capacity'],
  marketplace: ['Lv1: Resource trading', 'Lv3: Bulk trades'],
  spy_guild: ['Lv1: Basic espionage', 'Lv3: Advanced intel'],
  ironveil_foundry: ['+Iron production', '+Unit armor bonus'],
  aetheri_resonance: ['+Aether extraction', '+Research speed'],
  thornwatch_rootway: ['+Food/Wood production', '+March speed'],
  ashen_reliquary: ['+Stone production', '+Defensive power'],
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
  // Sort by TC requirement (unlock order), then by original BUILDING_SLOTS order within same TC level
  const visibleSlots = BUILDING_SLOTS
    .filter((slot) => {
      if (slot.factionOnly && slot.factionOnly !== player?.faction) return false;
      return true;
    })
    .map((slot, origIdx) => ({ slot, origIdx }))
    .sort((a, b) => {
      const tcA = a.slot.tcRequired ?? TC_REQUIREMENTS[a.slot.type] ?? 0;
      const tcB = b.slot.tcRequired ?? TC_REQUIREMENTS[b.slot.type] ?? 0;
      if (tcA !== tcB) return tcA - tcB;
      return a.origIdx - b.origIdx;
    })
    .map((item) => item.slot);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-7xl mx-auto pb-16">
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

        {/* Building Cards - Horizontal Scrollable Row */}
        <h3 className="text-lg mb-4" style={{ fontFamily: 'Cinzel, serif' }}>Buildings</h3>
        <div
          data-tutorial="building-grid"
          role="list"
          aria-label="Buildings"
          tabIndex={0}
          onKeyDown={(e) => {
            const container = e.currentTarget;
            if (e.key === 'ArrowRight') {
              container.scrollBy({ left: 436, behavior: 'smooth' });
              e.preventDefault();
            }
            if (e.key === 'ArrowLeft') {
              container.scrollBy({ left: -436, behavior: 'smooth' });
              e.preventDefault();
            }
          }}
          className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth focus-visible:outline-2 focus-visible:outline-[var(--aether-violet)] focus-visible:outline-offset-2 focus-visible:rounded-lg"
          style={{ scrollbarColor: 'var(--ruin-grey) transparent', scrollbarWidth: 'thin', scrollPaddingLeft: '0px' }}
        >
          {visibleSlots.map((slot) => {
            const existing = activeSettlement?.buildings.find((b) => b.type === slot.type);
            const inQueue = activeSettlement?.buildQueue.find((b) => b.type === slot.type);
            const isBuilt = !!existing;
            const isQueued = !!inQueue;
            const isTownCenter = slot.type === 'town_center';
            const currentLevel = existing?.level ?? 0;

            // Town Center level requirement
            const requiredTc = slot.tcRequired ?? TC_REQUIREMENTS[slot.type] ?? 1;
            const tcUnlocked = tcLevel >= requiredTc;

            // Build cost & affordability
            const affordable = slot.cost && tcUnlocked ? canAfford(slot.cost) : false;
            const canBuildThis = slot.buildable && !isBuilt && !isQueued && affordable && !queueFull && tcUnlocked;

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

            // For unbuilt buildings, show build cost as the "upgrade" cost
            const displayCost = isBuilt ? upgradeCost : (slot.cost ?? null);
            const displayTime = isBuilt ? upgradeTimeSeconds : (slot.time ?? null);

            const canAffordUpgrade = upgradeCost ? canAfford(upgradeCost) : false;
            const canUpgrade = isBuilt && canAffordUpgrade && !actionInProgress && !isQueued && !queueFull && !isMaxLevel;

            const production = PRODUCTION_RATES[slot.type];
            const unlocks = BUILDING_UNLOCKS[slot.type] ?? [];

            const handleCardClick = () => {
              if (canBuildThis && !actionInProgress) {
                handleBuild(slot.type);
              } else if (canUpgrade) {
                handleUpgrade(slot.type);
              }
            };

            const isClickable = canBuildThis || canUpgrade;

            // Card border/glow color logic
            const cardBorderColor = isBuilt && isMaxLevel
              ? 'var(--ember-gold)'
              : isBuilt
              ? '#22c55e'
              : isQueued
              ? 'var(--ember-gold)'
              : !tcUnlocked
              ? 'var(--ruin-grey)'
              : 'var(--ruin-grey)';

            const cardBorderOpacity = isBuilt && isMaxLevel
              ? '0.5'
              : isBuilt
              ? '0.4'
              : isQueued
              ? '0.4'
              : !tcUnlocked
              ? '0.15'
              : '0.3';

            return (
              <div
                key={slot.type}
                onClick={handleCardClick}
                role="listitem"
                aria-label={`${slot.name}, Level ${currentLevel}${isMaxLevel ? ', fully upgraded' : ''}`}
                tabIndex={isClickable ? 0 : undefined}
                onKeyDown={(e) => { if (e.key === 'Enter' && isClickable) handleCardClick(); }}
                className={`group relative select-none flex-shrink-0 snap-start transition-all duration-200 ${
                  isClickable ? 'cursor-pointer hover:-translate-y-1 hover:shadow-lg active:translate-y-0 active:scale-[0.98]' : ''
                } ${isQueued ? 'animate-[queue-pulse_2s_ease-in-out_infinite]' : ''}${!tcUnlocked ? ' opacity-40 grayscale' : ''}`}
                style={{
                  width: '420px',
                  minHeight: '200px',
                  borderRadius: '12px',
                  border: `1.5px solid color-mix(in srgb, ${cardBorderColor} ${parseFloat(cardBorderOpacity) * 100}%, transparent)`,
                  background: 'linear-gradient(135deg, rgba(15,12,20,0.95) 0%, rgba(25,20,35,0.9) 50%, rgba(15,12,20,0.95) 100%)',
                  boxShadow: isBuilt
                    ? `0 0 20px rgba(34,197,94,0.08), inset 0 1px 0 rgba(255,255,255,0.03)`
                    : isClickable
                    ? `0 0 20px rgba(139,92,246,0.1), inset 0 1px 0 rgba(255,255,255,0.03)`
                    : `inset 0 1px 0 rgba(255,255,255,0.02)`,
                }}
              >
                {/* Top decorative border accent */}
                <div
                  className="absolute top-0 left-4 right-4 h-[1px]"
                  style={{
                    background: isBuilt
                      ? 'linear-gradient(90deg, transparent, rgba(34,197,94,0.4), transparent)'
                      : 'linear-gradient(90deg, transparent, var(--ember-gold), transparent)',
                    opacity: 0.4,
                  }}
                />

                <div className="flex h-full">
                  {/* LEFT: Building Icon Section */}
                  <div
                    className="flex flex-col items-center justify-center px-5 py-4 relative"
                    style={{
                      width: '100px',
                      borderRight: '1px solid rgba(255,255,255,0.05)',
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)',
                    }}
                  >
                    <span className="text-4xl mb-2 drop-shadow-lg">{slot.icon}</span>
                    {/* Level Badge */}
                    {isBuilt && (
                      <span
                        className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
                        style={{
                          fontFamily: 'Cinzel, serif',
                          background: isMaxLevel
                            ? 'linear-gradient(135deg, rgba(218,165,32,0.3), rgba(218,165,32,0.15))'
                            : 'linear-gradient(135deg, rgba(34,197,94,0.3), rgba(34,197,94,0.15))',
                          color: isMaxLevel ? 'var(--ember-gold)' : '#86efac',
                          border: isMaxLevel
                            ? '1px solid rgba(218,165,32,0.3)'
                            : '1px solid rgba(34,197,94,0.3)',
                        }}
                      >
                        {isMaxLevel ? 'MAX' : `Lv ${currentLevel}`}
                      </span>
                    )}
                    {!isBuilt && !isQueued && tcUnlocked && (
                      <span className="text-[10px] text-[var(--ruin-grey)] italic mt-1">Not Built</span>
                    )}
                    {isQueued && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full animate-pulse mt-1"
                        style={{
                          background: 'rgba(218,165,32,0.2)',
                          color: 'var(--ember-gold)',
                          border: '1px solid rgba(218,165,32,0.3)',
                        }}
                      >
                        Building...
                      </span>
                    )}
                    {slot.factionOnly && (
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded mt-1.5 capitalize"
                        style={{
                          background: 'rgba(139,92,246,0.2)',
                          color: 'var(--aether-violet)',
                          border: '1px solid rgba(139,92,246,0.25)',
                        }}
                      >
                        {slot.factionOnly}
                      </span>
                    )}
                  </div>

                  {/* CENTER: Building Info */}
                  <div className="flex-1 py-3.5 px-4 flex flex-col min-w-0" style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                    {/* Name */}
                    <h4
                      className="text-sm font-semibold mb-1 text-[var(--parchment)] group-hover:text-[var(--ember-gold)] transition-colors truncate"
                      style={{ fontFamily: 'Cinzel, serif' }}
                    >
                      {slot.name}
                    </h4>

                    {/* Description */}
                    <p className="text-[11px] text-[var(--ruin-grey)] leading-relaxed mb-2 line-clamp-2">
                      {slot.description}
                    </p>

                    {/* TC requirement notice */}
                    {!isBuilt && !isQueued && !tcUnlocked && (
                      <div
                        className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded mb-2"
                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
                      >
                        <span>🔒</span>
                        <span>Requires Town Center Lv{requiredTc}</span>
                      </div>
                    )}

                    {/* Unlock Info */}
                    {unlocks.length > 0 && tcUnlocked && (
                      <div className="mb-2">
                        <span className="text-[10px] uppercase tracking-wider text-[var(--ember-gold)]/60 font-semibold">Unlocks</span>
                        <div className="mt-0.5 space-y-0.5">
                          {unlocks.slice(0, 2).map((u, i) => (
                            <p key={i} className="text-[10px] text-[var(--parchment-dim)] leading-snug">{u}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Spacer to push cost/button to bottom */}
                    <div className="flex-1" />

                    {/* Cost & Time Row */}
                    {displayCost && tcUnlocked && !isMaxLevel && !isQueued && (
                      <div className="mt-auto">
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-[10px] uppercase tracking-wider text-[var(--ruin-grey)]/80 font-semibold">
                            {isBuilt ? 'Upgrade Cost' : 'Build Cost'}
                          </span>
                          {displayTime != null && (
                            <span className="text-[10px] text-[var(--ruin-grey)] ml-auto flex items-center gap-0.5">
                              <span style={{ fontSize: '11px' }}>⏱</span> {formatTime(displayTime)}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-2.5 gap-y-0.5">
                          {Object.entries(displayCost).map(([res, amount]) => {
                            const have = (activeSettlement?.resources as Record<string, number>)?.[res] ?? 0;
                            const enough = have >= amount;
                            return (
                              <span
                                key={res}
                                className="text-[11px] flex items-center gap-0.5"
                                style={{ color: enough ? 'var(--parchment-dim)' : '#f87171' }}
                              >
                                <span>{RESOURCE_ICONS[res] || ''}</span>
                                <span>{amount}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* RIGHT: Production Stats + Action */}
                  <div className="flex flex-col items-center justify-between py-3.5 px-3" style={{ width: '115px' }}>
                    {/* Production Rate */}
                    {production && (
                      <div className="text-center mb-2">
                        <span className="text-[10px] uppercase tracking-wider text-[var(--ruin-grey)]/70 font-semibold block mb-1">
                          Production
                        </span>
                        {isBuilt ? (
                          <>
                            <div className="text-base font-bold text-green-400" style={{ fontFamily: 'Cinzel, serif' }}>
                              +{production.perHour * currentLevel}
                            </div>
                            <div className="text-[10px] text-[var(--ruin-grey)]">
                              {RESOURCE_ICONS[production.resource]} {RESOURCE_LABELS[production.resource]}/hr
                            </div>
                            {!isMaxLevel && (
                              <div className="text-[10px] text-green-500/70 mt-0.5">
                                Next: +{production.perHour * nextLevel}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="text-sm font-bold text-[var(--ruin-grey)]" style={{ fontFamily: 'Cinzel, serif' }}>
                              +{production.perHour}
                            </div>
                            <div className="text-[10px] text-[var(--ruin-grey)]">
                              {RESOURCE_ICONS[production.resource]} {RESOURCE_LABELS[production.resource]}/hr
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Non-production buildings: show a stat */}
                    {!production && isBuilt && !isMaxLevel && (
                      <div className="text-center mb-2">
                        <span className="text-[10px] uppercase tracking-wider text-[var(--ruin-grey)]/70 font-semibold block mb-1">
                          Level
                        </span>
                        <div className="text-2xl font-bold text-[var(--parchment)]" style={{ fontFamily: 'Cinzel, serif' }}>
                          {currentLevel}
                        </div>
                        <div className="text-[10px] text-[var(--ruin-grey)]/60">
                          Next: Lv{nextLevel}
                        </div>
                      </div>
                    )}

                    {!production && isBuilt && isMaxLevel && (
                      <div className="text-center mb-2">
                        <span className="text-[10px] uppercase tracking-wider text-[var(--ember-gold)]/70 font-semibold block mb-1">
                          Max Level
                        </span>
                        <div className="text-2xl font-bold text-[var(--ember-gold)]" style={{ fontFamily: 'Cinzel, serif' }}>
                          {currentLevel}
                        </div>
                      </div>
                    )}

                    {!production && !isBuilt && (
                      <div className="text-center mb-2">
                        <span className="text-[10px] uppercase tracking-wider text-[var(--ruin-grey)]/50 font-semibold block mb-1">
                          Status
                        </span>
                        <div className="text-[11px] text-[var(--ruin-grey)]/60 italic">
                          {tcUnlocked ? 'Available' : 'Locked'}
                        </div>
                      </div>
                    )}

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Action Button */}
                    {!isBuilt && !isQueued && tcUnlocked && slot.buildable && (
                      <button
                        disabled={!canBuildThis || actionInProgress}
                        onClick={(e) => { e.stopPropagation(); if (canBuildThis) handleBuild(slot.type); }}
                        className="w-full text-[11px] font-semibold py-2 px-2 rounded-lg transition-all"
                        style={{
                          fontFamily: 'Cinzel, serif',
                          background: canBuildThis
                            ? 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(139,92,246,0.15))'
                            : 'rgba(100,100,100,0.15)',
                          border: canBuildThis
                            ? '1px solid rgba(139,92,246,0.5)'
                            : '1px solid rgba(100,100,100,0.2)',
                          color: canBuildThis ? 'var(--parchment)' : 'var(--ruin-grey)',
                          cursor: canBuildThis ? 'pointer' : 'not-allowed',
                        }}
                      >
                        {queueFull ? 'Queue Full' : actionInProgress ? 'Working...' : 'Build'}
                      </button>
                    )}

                    {isBuilt && !isMaxLevel && !isQueued && (
                      <button
                        disabled={!canUpgrade}
                        onClick={(e) => { e.stopPropagation(); if (canUpgrade) handleUpgrade(slot.type); }}
                        className="w-full text-[11px] font-semibold py-2 px-2 rounded-lg transition-all"
                        style={{
                          fontFamily: 'Cinzel, serif',
                          background: canUpgrade
                            ? 'linear-gradient(135deg, rgba(218,165,32,0.3), rgba(218,165,32,0.15))'
                            : 'rgba(100,100,100,0.15)',
                          border: canUpgrade
                            ? '1px solid rgba(218,165,32,0.5)'
                            : '1px solid rgba(100,100,100,0.2)',
                          color: canUpgrade ? 'var(--ember-gold)' : 'var(--ruin-grey)',
                          cursor: canUpgrade ? 'pointer' : 'not-allowed',
                        }}
                      >
                        {queueFull ? 'Queue Full' : actionInProgress ? 'Working...' : `Lv ${nextLevel}`}
                      </button>
                    )}

                    {isBuilt && isMaxLevel && (
                      <div
                        className="w-full text-center text-[11px] py-2 px-2 rounded-lg italic"
                        style={{
                          fontFamily: 'Cinzel, serif',
                          background: 'rgba(218,165,32,0.08)',
                          border: '1px solid rgba(218,165,32,0.15)',
                          color: 'rgba(218,165,32,0.6)',
                        }}
                      >
                        Fully Upgraded
                      </div>
                    )}

                    {isQueued && (
                      <div
                        className="w-full text-center text-[11px] py-2 px-2 rounded-lg animate-pulse"
                        style={{
                          background: 'rgba(218,165,32,0.1)',
                          border: '1px solid rgba(218,165,32,0.2)',
                          color: 'var(--ember-gold)',
                        }}
                      >
                        In Queue
                      </div>
                    )}

                    {!tcUnlocked && (
                      <div
                        className="w-full text-center text-[10px] py-1.5 px-2 rounded-lg"
                        style={{
                          background: 'rgba(100,100,100,0.1)',
                          border: '1px solid rgba(100,100,100,0.15)',
                          color: 'var(--ruin-grey)',
                        }}
                      >
                        🔒 TC Lv{requiredTc}
                      </div>
                    )}
                  </div>
                </div>
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
