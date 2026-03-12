import type { Faction, FactionConfig, ResourceMap } from '../types/index.js';

// --- Tick Rates ---
export const COMBAT_TICK_MS = 1000;       // 1 second
export const ECONOMY_TICK_MS = 60_000;    // 1 minute
export const MAP_EVENT_TICK_MS = 300_000; // 5 minutes

// --- Map ---
export const MAP_WIDTH = 800;
export const MAP_HEIGHT = 800;
export const MAX_PLAYERS_PER_SERVER = 5000;

// --- New Player ---
export const NEW_PLAYER_SHIELD_HOURS = 72;
export const STARTING_RESOURCES: ResourceMap = {
  food: 500,
  wood: 500,
  stone: 300,
  iron: 200,
  aether_stone: 50,
};

// --- Settlement ---
export const MAX_SETTLEMENTS_BASE = 3;
export const MAX_SETTLEMENT_LEVEL = 25;
export const MAX_BUILDING_LEVEL = 20;
export const MAX_BUILDING_QUEUE = 2;

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

// --- Aether Harvest Cycles ---
export const AETHER_CYCLES = {
  short:  { hours: 4,  yieldMultiplier: 0.8 },
  medium: { hours: 8,  yieldMultiplier: 1.0 },
  long:   { hours: 12, yieldMultiplier: 1.3 },
} as const;

// --- Faction Configs ---
export const FACTION_CONFIGS: Record<Faction, FactionConfig> = {
  ironveil: {
    id: 'ironveil',
    name: 'The Ironveil Compact',
    description: 'Engineers and pragmatists. Heavy defense, siege mastery, fast builders.',
    color: '#4A6670',
    accentColor: '#B8622A',
    bonuses: {
      defenseMultiplier: 1.25,
      offenseMultiplier: 0.9,
      speedMultiplier: 0.85,
      buildSpeedMultiplier: 1.20,
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
      defenseMultiplier: 0.85,
      offenseMultiplier: 1.25,
      speedMultiplier: 1.0,
      buildSpeedMultiplier: 1.0,
      aetherYieldMultiplier: 1.30,
      resourceGatherMultiplier: 0.9,
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
      speedMultiplier: 1.20,
      buildSpeedMultiplier: 1.0,
      aetherYieldMultiplier: 1.0,
      resourceGatherMultiplier: 1.15,
      tradeSpeedMultiplier: 1.30,
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
      offenseMultiplier: 1.10,
      speedMultiplier: 1.0,
      buildSpeedMultiplier: 0.95,
      aetherYieldMultiplier: 1.0,
      resourceGatherMultiplier: 1.0,
      tradeSpeedMultiplier: 1.0,
      ruinExplorationMultiplier: 1.25,
      loreDecryptMultiplier: 1.50,
    },
  },
};
