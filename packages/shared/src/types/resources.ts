export const RESOURCE_TYPES = ['food', 'wood', 'stone', 'iron', 'aether_stone'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export type ResourceMap = Record<ResourceType, number>;

export const EMPTY_RESOURCES: Readonly<ResourceMap> = {
  food: 0,
  wood: 0,
  stone: 0,
  iron: 0,
  aether_stone: 0,
};
