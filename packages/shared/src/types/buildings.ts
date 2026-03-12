import type { ResourceMap } from './resources.js';

export const BUILDING_TYPES = [
  'town_center',
  'gathering_post',
  'woodcutter_lodge',
  'stone_quarry',
  'iron_mine',
  'aether_extractor',
  'warehouse',
  'palisade_wall',
  'stone_wall',
  'fortified_wall',
  'militia_barracks',
  'war_barracks',
  'siege_workshop',
  'scout_tower',
  'marketplace',
  'embassy',
  'academy',
  'hero_hall',
  'archive',
  'aether_refinery',
  'foundry',
  'resonance_spire',
  'rootway',
] as const;

export type BuildingType = (typeof BUILDING_TYPES)[number];

export interface BuildingConfig {
  type: BuildingType;
  name: string;
  description: string;
  maxLevel: number;
  category: 'resource' | 'military' | 'defense' | 'utility' | 'unique';
  factionRequired?: string;
  prerequisite?: { building: BuildingType; level: number }[];
  perLevel: BuildingLevelConfig[];
}

export interface BuildingLevelConfig {
  level: number;
  cost: ResourceMap;
  buildTimeSeconds: number;
  productionPerHour?: Partial<ResourceMap>;
  storageBonus?: Partial<ResourceMap>;
  defenseBonus?: number;
  populationCost: number;
  unlocks?: string[];
}
