export const HERO_CLASSES = [
  'warlord',
  'sage',
  'shadowblade',
  'steward',
  'herald',
  'driftwalker',
] as const;

export type HeroClass = (typeof HERO_CLASSES)[number];

export type HeroStatus = 'idle' | 'marching' | 'expedition' | 'injured' | 'recovering' | 'garrisoned';

export interface HeroStats {
  attack: number;
  defense: number;
  speed: number;
  wisdom: number;
  charisma: number;
  resilience: number;
}

export interface HeroScar {
  id: string;
  name: string;
  description: string;
  statModifiers: Partial<HeroStats>;
  acquiredAt: string;
  battleId?: string;
}

export type InjurySeverity = 'minor' | 'moderate' | 'severe' | 'critical';

export interface Hero {
  id: string;
  name: string;
  heroClass: HeroClass;
  level: number;
  xp: number;
  loyalty: number;
  status: HeroStatus;
  stats: HeroStats;
  scars: HeroScar[];
  equipmentSlots: {
    weapon: string | null;
    armor: string | null;
    trinket: string | null;
    relic1: string | null;
    relic2: string | null;
  };
  personalQuestStage: number;
  corruptionLevel: number;
}
