import type { ResourceMap } from './resources.js';
import type { Faction } from './factions.js';

export const UNIT_TYPES = [
  // Ironveil
  'shieldwall_legionnaire',
  'ironcaster',
  'vaultbreaker',
  'cogwright_golem',
  // Aetheri
  'threadweaver',
  'shardlancer',
  'voidwalker',
  'aether_colossus',
  // Thornwatch
  'briarrunner',
  'thornguard',
  'rootbinder',
  'great_warden',
  // Ashen
  'reclaimant_soldier',
  'ashwalker',
  'chronicler',
  'sovereign_guard',
] as const;

export type UnitType = (typeof UNIT_TYPES)[number];

export interface UnitConfig {
  type: UnitType;
  name: string;
  faction: Faction;
  tier: 1 | 2 | 3 | 4;
  attack: number;
  defense: number;
  hp: number;
  speed: number;
  carryCapacity: number;
  trainTimeSeconds: number;
  cost: ResourceMap;
  upkeepPerHour: Partial<ResourceMap>;
  special?: string;
}
