import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { mockDb } from '../db/mock-db.js';
import { z } from 'zod';
import { hexesInRange, hex, hexDistance, getZoneForDistance } from '@veilfall/shared';
import { getAetherCycle } from '../game-loop/index.js';

const MAP_RADIUS = 400;

const viewportSchema = z.object({
  centerQ: z.coerce.number().int(),
  centerR: z.coerce.number().int(),
  radius: z.coerce.number().int().min(1).max(20).default(10),
});

const eventsQuerySchema = z.object({
  centerQ: z.coerce.number().int(),
  centerR: z.coerce.number().int(),
  radius: z.coerce.number().int().min(1).max(30).default(10),
});

function generateTerrain(q: number, r: number): string {
  const seed = Math.abs(q * 7 + r * 13) % 10;
  if (seed < 2) return 'forest';
  if (seed < 3) return 'mountain';
  if (seed < 4) return 'ruins';
  if (seed < 5) return 'desert';
  return 'plains';
}

export async function mapRoutes(app: FastifyInstance) {
  app.get('/tiles', { preHandler: requireAuth }, async (request) => {
    const { centerQ, centerR, radius } = viewportSchema.parse(request.query);
    const center = hex(centerQ, centerR);
    const hexes = hexesInRange(center, radius);

    const tiles = hexes.map((h) => {
      const dist = hexDistance(hex(0, 0), h);
      const zone = getZoneForDistance(dist, MAP_RADIUS);
      const terrain = zone === 'wound_zones' ? 'wound_zone'
        : zone === 'sovereign_ring' ? 'sovereign_ring'
        : generateTerrain(h.q, h.r);

      return {
        q: h.q, r: h.r, s: h.s, terrain, zone,
        ownerId: null, allianceId: null, structureType: null,
        resourceDeposit: terrain === 'ruins' ? { type: 'aether_stone', richness: Math.floor(Math.random() * 5 + 1) } : null,
      };
    });

    return { tiles, center: { q: centerQ, r: centerR }, radius };
  });

  // GET /events — active map events within radius
  app.get('/events', { preHandler: requireAuth }, async (request) => {
    const { centerQ, centerR, radius } = eventsQuerySchema.parse(request.query);
    const activeEvents = mockDb.getActiveMapEvents();

    // Filter events within hex distance
    const nearby = activeEvents.filter((event) => {
      const dist = hexDistance(hex(centerQ, centerR), hex(event.q, event.r));
      return dist <= radius;
    });

    return { events: nearby, center: { q: centerQ, r: centerR }, radius };
  });

  // GET /cycle — current Aether Harvest Cycle state
  app.get('/cycle', { preHandler: requireAuth }, async () => {
    return getAetherCycle();
  });

  // GET /visibility — returns set of hex coordinates visible to the player
  app.get('/visibility', { preHandler: requireAuth }, async (request) => {
    const playerId = request.user.id;
    const settlements = mockDb.getSettlementsByPlayer(playerId);

    // Collect all visible hex coordinates using a Set for deduplication
    const visibleSet = new Set<string>();

    function addHexesInRadius(centerQ: number, centerR: number, radius: number) {
      for (let q = -radius; q <= radius; q++) {
        for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
          visibleSet.add(`${centerQ + q},${centerR + r}`);
        }
      }
    }

    // Settlement vision: base 3 + scout_tower bonus + cartography bonus
    for (const settlement of settlements) {
      const baseVision = 3;
      const scoutTower = settlement.buildings.find((b) => b.type === 'scout_tower');
      const scoutTowerBonus = scoutTower ? scoutTower.level * 2 : 0;
      const cartographyLevel = settlement.researched?.cartography ?? 0;
      const cartographyBonus = cartographyLevel * 1;
      const totalRadius = baseVision + scoutTowerBonus + cartographyBonus;

      addHexesInRadius(settlement.q, settlement.r, totalRadius);
    }

    // Active marches: 1 hex radius around interpolated current position
    const allMarches = [...mockDb.marches.values()].filter(
      (m) => m.playerId === playerId && m.status === 'marching',
    );

    const now = Date.now();
    for (const march of allMarches) {
      const totalDuration = march.arrivedAt - march.startedAt;
      const elapsed = now - march.startedAt;
      const progress = totalDuration > 0 ? Math.min(1, Math.max(0, elapsed / totalDuration)) : 1;

      // Interpolate current position in axial coordinates
      const currentQ = Math.round(march.fromQ + (march.toQ - march.fromQ) * progress);
      const currentR = Math.round(march.fromR + (march.toR - march.fromR) * progress);

      addHexesInRadius(currentQ, currentR, 1);
    }

    // Convert Set to array of coordinate objects
    const visibleTiles = [...visibleSet].map((key) => {
      const [q, r] = key.split(',').map(Number);
      return { q, r };
    });

    return { visibleTiles };
  });

  app.get('/overview', { preHandler: requireAuth }, async () => ({
    zones: ['hearthlands', 'contested_reaches', 'fractured_provinces', 'wound_zones', 'sovereign_ring'],
    landmarks: [],
    worldBosses: [
      { name: 'The Hollow King', zone: 'sovereign_ring', status: 'dormant' },
      { name: 'Aethermaw', zone: 'wound_zones', status: 'roaming' },
    ],
  }));
}
