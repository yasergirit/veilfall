/** Cube coordinates for hex grid */
export interface HexCoord {
  q: number;
  r: number;
  s: number;
}

export const TERRAIN_TYPES = [
  'plains',
  'forest',
  'mountain',
  'desert',
  'swamp',
  'ruins',
  'wound_zone',
  'sovereign_ring',
  'water',
] as const;

export type TerrainType = (typeof TERRAIN_TYPES)[number];

export const MAP_ZONES = [
  'hearthlands',
  'contested_reaches',
  'fractured_provinces',
  'wound_zones',
  'sovereign_ring',
] as const;

export type MapZone = (typeof MAP_ZONES)[number];

export interface MapTile {
  q: number;
  r: number;
  s: number;
  terrain: TerrainType;
  zone: MapZone;
  ownerId: string | null;
  allianceId: string | null;
  structureType: string | null;
  resourceDeposit: {
    type: string;
    richness: number;
  } | null;
  ruinId: string | null;
  fogOfWar: boolean;
}
