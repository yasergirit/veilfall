export const FACTIONS = ['ironveil', 'aetheri', 'thornwatch', 'ashen'] as const;
export type Faction = (typeof FACTIONS)[number];

export interface FactionConfig {
  id: Faction;
  name: string;
  description: string;
  color: string;
  accentColor: string;
  bonuses: FactionBonuses;
}

export interface FactionBonuses {
  defenseMultiplier: number;
  offenseMultiplier: number;
  speedMultiplier: number;
  buildSpeedMultiplier: number;
  aetherYieldMultiplier: number;
  resourceGatherMultiplier: number;
  tradeSpeedMultiplier: number;
  ruinExplorationMultiplier: number;
  loreDecryptMultiplier: number;
}
