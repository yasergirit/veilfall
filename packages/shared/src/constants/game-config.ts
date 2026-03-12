import type { Faction, FactionConfig, ResourceMap } from '../types/index.js';

// --- Tick Rates ---
export const COMBAT_TICK_MS = 1000;       // 1 second (unused — combat is event-driven on march arrival)
export const ECONOMY_TICK_MS = 60_000;    // 1 minute
export const MAP_EVENT_TICK_MS = 300_000; // 5 minutes

// --- Map ---
export const MAP_WIDTH = 800;
export const MAP_HEIGHT = 800;
export const MAX_PLAYERS_PER_SERVER = 5000;

// --- New Player ---
export const NEW_PLAYER_SHIELD_HOURS = 72;
export const STARTING_RESOURCES: ResourceMap = {
  food: 800,
  wood: 800,
  stone: 400,
  iron: 200,
  aether_stone: 50,
};

// --- Settlement ---
export const MAX_SETTLEMENTS_BASE = 3;
export const MAX_SETTLEMENT_LEVEL = 25;
export const MAX_BUILDING_LEVEL = 20;
export const MAX_BUILDING_QUEUE = 2;
export const SETTLEMENT_FOUNDING_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

// --- Heroes ---
export const MAX_HERO_LEVEL = 30;
export const MAX_HEROES_PER_PLAYER = 6;
export const LOYALTY_MAX = 100;
export const LOYALTY_DESERTION_THRESHOLD = 19;
export const MAX_SCARS_BEFORE_DEATH_RISK = 3;

// --- Alliance ---
export const MAX_ALLIANCE_MEMBERS = 50;
export const MAX_ALLIANCE_TAG_LENGTH = 5;
export const MIN_ALLIANCE_NAME_LENGTH = 3;
export const MAX_ALLIANCE_NAME_LENGTH = 30;
export const TRIBUTE_RATE_MAX = 0.20;

// --- Aether Harvest Cycles (4-phase: dormant → rising → surge → fading, 15min total) ---
export const AETHER_CYCLES = {
  dormant: { durationMs: 480_000, yieldMultiplier: 1.0 },  // 8 minutes
  rising:  { durationMs: 120_000, yieldMultiplier: 1.5 },  // 2 minutes
  surge:   { durationMs: 180_000, yieldMultiplier: 2.5 },  // 3 minutes
  fading:  { durationMs: 120_000, yieldMultiplier: 1.5 },  // 2 minutes
} as const;

export type AetherPhase = keyof typeof AETHER_CYCLES;
export const AETHER_PHASE_ORDER: AetherPhase[] = ['dormant', 'rising', 'surge', 'fading'];

// --- Army ---
export const MAX_ARMY_SIZE_PER_MARCH = 200;

// --- Anti-Snowball ---
export const POWER_BRACKET_THRESHOLDS = [
  { ratio: 5.0, lootMultiplier: 0.20 },
  { ratio: 3.0, lootMultiplier: 0.50 },
  { ratio: 2.0, lootMultiplier: 0.75 },
];
export const DIMINISHING_RAID_MULTIPLIERS = [1.0, 0.60, 0.30, 0.10]; // 1st, 2nd, 3rd, 4th+ attack

// --- Marketplace ---
export const MAX_TRADE_OFFERS_PER_PLAYER = 5;
export const TRADE_OFFER_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
export const MAX_TRADE_RATIO = 10; // max 10:1 resource ratio
export const RESOURCE_BASE_VALUES: Record<string, number> = {
  food: 1, wood: 1, stone: 1.5, iron: 2, aether_stone: 6,
};

// --- Faction Configs (v2: tightened multiplier spreads ±8-20%) ---
export const FACTION_CONFIGS: Record<Faction, FactionConfig> = {
  ironveil: {
    id: 'ironveil',
    name: 'The Ironveil Compact',
    description: 'Engineers and pragmatists. Heavy defense, siege mastery, fast builders.',
    color: '#4A6670',
    accentColor: '#B8622A',
    bonuses: {
      defenseMultiplier: 1.20,
      offenseMultiplier: 0.92,
      speedMultiplier: 0.90,
      buildSpeedMultiplier: 1.15,
      aetherYieldMultiplier: 1.0,
      resourceGatherMultiplier: 1.0,
      tradeSpeedMultiplier: 1.0,
      ruinExplorationMultiplier: 0.9,
      loreDecryptMultiplier: 0.9,
    },
  },
  aetheri: {
    id: 'aetheri',
    name: 'The Aetheri Dominion',
    description: 'Scholars and mystics. Aether mastery, powerful offense, glass cannon.',
    color: '#9B6ED4',
    accentColor: '#C0E0FF',
    bonuses: {
      defenseMultiplier: 0.88,
      offenseMultiplier: 1.20,
      speedMultiplier: 1.0,
      buildSpeedMultiplier: 1.0,
      aetherYieldMultiplier: 1.25,
      resourceGatherMultiplier: 0.92,
      tradeSpeedMultiplier: 1.0,
      ruinExplorationMultiplier: 1.10,
      loreDecryptMultiplier: 1.10,
    },
  },
  thornwatch: {
    id: 'thornwatch',
    name: 'The Thornwatch Clans',
    description: 'Survivalists and rangers. Speed, raiding, trade superiority.',
    color: '#3A6B35',
    accentColor: '#8B1A1A',
    bonuses: {
      defenseMultiplier: 1.0,
      offenseMultiplier: 1.0,
      speedMultiplier: 1.15,
      buildSpeedMultiplier: 1.0,
      aetherYieldMultiplier: 1.0,
      resourceGatherMultiplier: 1.12,
      tradeSpeedMultiplier: 1.25,
      ruinExplorationMultiplier: 1.15,
      loreDecryptMultiplier: 0.9,
    },
  },
  ashen: {
    id: 'ashen',
    name: 'The Ashen Covenant',
    description: 'Conquerors and historians. Relic mastery, ruin exploitation, lore power.',
    color: '#2C2C2C',
    accentColor: '#E87D20',
    bonuses: {
      defenseMultiplier: 1.0,
      offenseMultiplier: 1.08,
      speedMultiplier: 1.0,
      buildSpeedMultiplier: 0.96,
      aetherYieldMultiplier: 1.0,
      resourceGatherMultiplier: 1.0,
      tradeSpeedMultiplier: 1.0,
      ruinExplorationMultiplier: 1.25,
      loreDecryptMultiplier: 1.40,
    },
  },
};
