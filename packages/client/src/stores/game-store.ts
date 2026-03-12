import { create } from 'zustand';
import type { ResourceMap, MapTile } from '@veilfall/shared';

interface Settlement {
  id: string;
  name: string;
  level: number;
  coordinates: { q: number; r: number; s: number };
  resources: ResourceMap;
  buildings: Array<{ type: string; level: number; position: number }>;
  buildQueue: Array<{ type: string; targetLevel: number; startedAt: number; endsAt: number }>;
  units: Record<string, number>;
  trainQueue: Array<{ unitType: string; count: number; startedAt: number; endsAt: number }>;
}

/** Normalize server settlement shape (flat q,r,s) to client shape (coordinates object) */
function normalizeSettlement(raw: any): Settlement {
  return {
    ...raw,
    coordinates: raw.coordinates ?? { q: raw.q ?? 0, r: raw.r ?? 0, s: raw.s ?? 0 },
  };
}

interface GameState {
  // Settlements
  settlements: Settlement[];
  activeSettlementId: string | null;
  setActiveSettlement: (id: string) => void;
  setSettlements: (settlements: any[]) => void;
  updateResources: (settlementId: string, resources: ResourceMap) => void;

  // Map
  visibleTiles: Map<string, MapTile>;
  mapCenter: { q: number; r: number };
  setMapCenter: (q: number, r: number) => void;
  setVisibleTiles: (tiles: MapTile[]) => void;

  // UI
  activePanel: 'settlement' | 'map' | 'heroes' | 'alliance' | 'chronicle' | 'research' | 'marketplace' | 'leaderboard' | 'profile' | 'events' | 'spy' | 'worldboss' | 'mail' | 'heroQuests' | null;
  setActivePanel: (panel: GameState['activePanel']) => void;
}

export const useGameStore = create<GameState>((set) => ({
  settlements: [],
  activeSettlementId: null,
  setActiveSettlement: (id) => set({ activeSettlementId: id }),
  setSettlements: (rawSettlements) => {
    const settlements = rawSettlements.map(normalizeSettlement);
    set({ settlements, activeSettlementId: settlements[0]?.id ?? null });
  },
  updateResources: (settlementId, resources) =>
    set((state) => ({
      settlements: state.settlements.map((s) =>
        s.id === settlementId ? { ...s, resources } : s,
      ),
    })),

  visibleTiles: new Map(),
  mapCenter: { q: 0, r: 0 },
  setMapCenter: (q, r) => set({ mapCenter: { q, r } }),
  setVisibleTiles: (tiles) => {
    const map = new Map<string, MapTile>();
    tiles.forEach((t) => map.set(`${t.q},${t.r}`, t));
    set({ visibleTiles: map });
  },

  activePanel: 'settlement',
  setActivePanel: (panel) => set({ activePanel: panel }),
}));
