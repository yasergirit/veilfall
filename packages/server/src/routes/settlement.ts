import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { mockDb } from '../db/mock-db.js';
import { z } from 'zod';
import { STARTING_RESOURCES, MAX_SETTLEMENTS_BASE } from '@veilfall/shared';

const BUILDING_COSTS: Record<string, { cost: Record<string, number>; timeSeconds: number }> = {
  gathering_post:   { cost: { food: 50, wood: 80 },               timeSeconds: 30 },
  woodcutter_lodge: { cost: { food: 50, wood: 40, stone: 30 },    timeSeconds: 30 },
  stone_quarry:     { cost: { food: 40, wood: 60, iron: 20 },     timeSeconds: 45 },
  iron_mine:        { cost: { food: 60, wood: 80, stone: 40 },    timeSeconds: 60 },
  aether_extractor: { cost: { wood: 100, stone: 80, iron: 60 },   timeSeconds: 90 },
  militia_barracks: { cost: { food: 80, wood: 120, stone: 60 },   timeSeconds: 60 },
  palisade_wall:    { cost: { wood: 150, stone: 50 },             timeSeconds: 45 },
  scout_tower:      { cost: { wood: 80, stone: 60 },              timeSeconds: 40 },
  hero_hall:        { cost: { food: 100, wood: 150, stone: 100 }, timeSeconds: 90 },
  warehouse:        { cost: { wood: 100, stone: 80 },             timeSeconds: 40 },
  marketplace:      { cost: { wood: 120, stone: 80, iron: 40 },   timeSeconds: 60 },
  spy_guild:        { cost: { wood: 100, stone: 100, iron: 80 },  timeSeconds: 90 },
  // Faction-unique buildings
  ironveil_foundry:    { cost: { iron: 200, stone: 150, wood: 100 },        timeSeconds: 120 },
  aetheri_resonance:   { cost: { aether_stone: 150, iron: 100, stone: 80 }, timeSeconds: 120 },
  thornwatch_rootway:  { cost: { wood: 200, food: 150, stone: 80 },         timeSeconds: 120 },
  ashen_reliquary:     { cost: { stone: 200, iron: 100, aether_stone: 50 }, timeSeconds: 120 },
};

const TC_REQUIREMENTS: Record<string, number> = {
  gathering_post: 1, woodcutter_lodge: 1, palisade_wall: 1,
  stone_quarry: 2, iron_mine: 2, militia_barracks: 2,
  scout_tower: 2, aether_extractor: 3, hero_hall: 3,
  warehouse: 2, marketplace: 3, spy_guild: 3,
  ironveil_foundry: 3, aetheri_resonance: 3, thornwatch_rootway: 3, ashen_reliquary: 3,
};

const FACTION_BUILDINGS: Record<string, string> = {
  ironveil_foundry: 'ironveil',
  aetheri_resonance: 'aetheri',
  thornwatch_rootway: 'thornwatch',
  ashen_reliquary: 'ashen',
};

const TC_UPGRADE_COSTS: Record<number, { cost: Record<string, number>; timeSeconds: number }> = {
  2: { cost: { food: 200, wood: 300, stone: 200 }, timeSeconds: 120 },
  3: { cost: { food: 500, wood: 600, stone: 400, iron: 200 }, timeSeconds: 360 },
  4: { cost: { food: 1200, wood: 1400, stone: 900, iron: 500, aether_stone: 100 }, timeSeconds: 900 },
  5: { cost: { food: 3000, wood: 3500, stone: 2200, iron: 1200, aether_stone: 400 }, timeSeconds: 2400 },
};

const buildSchema = z.object({ buildingType: z.string() });
const upgradeSchema = z.object({ buildingType: z.string() });
const foundSchema = z.object({
  name: z.string().min(2).max(30),
  q: z.number().int(),
  r: z.number().int(),
});

const FOUNDING_COST: Record<string, number> = { food: 1500, wood: 1500, stone: 800, iron: 500 };

const MAX_BUILDING_LEVEL = 20;

export async function settlementRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireAuth }, async (request) => {
    const player = request.user;
    return { settlements: mockDb.getSettlementsByPlayer(player.id) };
  });

  app.post('/:settlementId/build', { preHandler: requireAuth }, async (request, reply) => {
    const player = request.user;
    const { settlementId } = request.params as { settlementId: string };
    const { buildingType } = buildSchema.parse(request.body);

    const settlement = mockDb.getSettlement(settlementId);
    if (!settlement || settlement.playerId !== player.id) {
      return reply.status(404).send({ error: 'Settlement not found' });
    }

    const existing = settlement.buildings.find((b) => b.type === buildingType);
    if (existing) return reply.status(400).send({ error: 'Already built. Use upgrade.' });
    if (settlement.buildQueue.length >= 2) return reply.status(400).send({ error: 'Build queue full (max 2)' });

    // Town Center level gate
    const tcLevel = settlement.buildings.find((b) => b.type === 'town_center')?.level ?? 1;
    const requiredTc = TC_REQUIREMENTS[buildingType] ?? 1;
    if (tcLevel < requiredTc) {
      return reply.status(400).send({ error: `Requires Town Center level ${requiredTc}` });
    }

    // Faction-specific building check
    const requiredFaction = FACTION_BUILDINGS[buildingType];
    if (requiredFaction && player.faction !== requiredFaction) {
      return reply.status(400).send({ error: `${buildingType} is exclusive to the ${requiredFaction} faction` });
    }

    const config = BUILDING_COSTS[buildingType];
    if (!config) return reply.status(400).send({ error: 'Unknown building type' });

    for (const [res, amount] of Object.entries(config.cost)) {
      if ((settlement.resources[res] ?? 0) < amount) {
        return reply.status(400).send({ error: `Not enough ${res}` });
      }
    }

    for (const [res, amount] of Object.entries(config.cost)) {
      settlement.resources[res] -= amount;
    }

    const now = Date.now();
    settlement.buildQueue.push({ type: buildingType, targetLevel: 1, startedAt: now, endsAt: now + config.timeSeconds * 1000 });
    mockDb.updateSettlement(settlementId, { resources: settlement.resources, buildQueue: settlement.buildQueue });

    return { message: `Building ${buildingType}`, endsAt: now + config.timeSeconds * 1000, resources: settlement.resources, buildQueue: settlement.buildQueue };
  });

  app.post('/:settlementId/upgrade', { preHandler: requireAuth }, async (request, reply) => {
    const player = request.user;
    const { settlementId } = request.params as { settlementId: string };
    const { buildingType } = upgradeSchema.parse(request.body);

    const settlement = mockDb.getSettlement(settlementId);
    if (!settlement || settlement.playerId !== player.id) {
      return reply.status(404).send({ error: 'Settlement not found' });
    }

    const existing = settlement.buildings.find((b) => b.type === buildingType);
    if (!existing) return reply.status(400).send({ error: 'Building not found. Build it first.' });

    if (settlement.buildQueue.length >= 2) {
      return reply.status(400).send({ error: 'Build queue full (max 2)' });
    }

    const nextLevel = existing.level + 1;

    // Handle town_center upgrades with special costs
    if (buildingType === 'town_center') {
      const tcConfig = TC_UPGRADE_COSTS[nextLevel];
      if (!tcConfig) {
        return reply.status(400).send({ error: `Town Center cannot be upgraded beyond level ${Math.max(...Object.keys(TC_UPGRADE_COSTS).map(Number))}` });
      }

      for (const [res, amount] of Object.entries(tcConfig.cost)) {
        if ((settlement.resources[res] ?? 0) < amount) {
          return reply.status(400).send({ error: `Not enough ${res}` });
        }
      }

      for (const [res, amount] of Object.entries(tcConfig.cost)) {
        settlement.resources[res] -= amount;
      }

      const now = Date.now();
      settlement.buildQueue.push({ type: buildingType, targetLevel: nextLevel, startedAt: now, endsAt: now + tcConfig.timeSeconds * 1000 });
      mockDb.updateSettlement(settlementId, { resources: settlement.resources, buildQueue: settlement.buildQueue });

      return { message: `Upgrading Town Center to level ${nextLevel}`, endsAt: now + tcConfig.timeSeconds * 1000, resources: settlement.resources, buildQueue: settlement.buildQueue };
    }

    if (existing.level >= MAX_BUILDING_LEVEL) {
      return reply.status(400).send({ error: `Building already at max level (${MAX_BUILDING_LEVEL})` });
    }

    const config = BUILDING_COSTS[buildingType];
    if (!config) return reply.status(400).send({ error: 'Unknown building type' });

    const upgradeCost: Record<string, number> = {};
    for (const [res, amount] of Object.entries(config.cost)) {
      upgradeCost[res] = Math.floor(amount * Math.pow(1.18, nextLevel - 1));
    }

    for (const [res, amount] of Object.entries(upgradeCost)) {
      if ((settlement.resources[res] ?? 0) < amount) {
        return reply.status(400).send({ error: `Not enough ${res}` });
      }
    }

    for (const [res, amount] of Object.entries(upgradeCost)) {
      settlement.resources[res] -= amount;
    }

    const upgradeTime = Math.floor(config.timeSeconds * (1 + (nextLevel - 1) * 0.6 + Math.pow(nextLevel - 1, 1.4) * 0.08));
    const now = Date.now();
    settlement.buildQueue.push({ type: buildingType, targetLevel: nextLevel, startedAt: now, endsAt: now + upgradeTime * 1000 });
    mockDb.updateSettlement(settlementId, { resources: settlement.resources, buildQueue: settlement.buildQueue });

    return { message: `Upgrading ${buildingType} to level ${nextLevel}`, endsAt: now + upgradeTime * 1000, resources: settlement.resources, buildQueue: settlement.buildQueue };
  });

  // Found a new settlement
  app.post('/found', { preHandler: requireAuth }, async (request, reply) => {
    const player = request.user;
    const body = foundSchema.parse(request.body);

    const playerSettlements = mockDb.getSettlementsByPlayer(player.id);

    // Check settlement cap
    if (playerSettlements.length >= MAX_SETTLEMENTS_BASE) {
      return reply.status(400).send({ error: `Maximum ${MAX_SETTLEMENTS_BASE} settlements allowed` });
    }

    // First settlement must have town_center level 3+
    const firstSettlement = playerSettlements[0];
    if (!firstSettlement) {
      return reply.status(400).send({ error: 'No existing settlement found' });
    }

    const tcLevel = firstSettlement.buildings.find((b) => b.type === 'town_center')?.level ?? 1;
    if (tcLevel < 3) {
      return reply.status(400).send({ error: 'First settlement Town Center must be level 3 or higher' });
    }

    // Check target hex is not occupied
    for (const s of mockDb.settlements.values()) {
      if (s.q === body.q && s.r === body.r) {
        return reply.status(400).send({ error: 'Target hex is already occupied by another settlement' });
      }
    }

    // Check founding cost against first settlement resources
    for (const [res, amount] of Object.entries(FOUNDING_COST)) {
      if ((firstSettlement.resources[res] ?? 0) < amount) {
        return reply.status(400).send({ error: `Not enough ${res} in primary settlement` });
      }
    }

    // Deduct resources from first settlement
    for (const [res, amount] of Object.entries(FOUNDING_COST)) {
      firstSettlement.resources[res] -= amount;
    }
    mockDb.updateSettlement(firstSettlement.id, { resources: firstSettlement.resources });

    // Create new settlement with halved starting resources
    const halfResources: Record<string, number> = {};
    for (const [res, amount] of Object.entries(STARTING_RESOURCES)) {
      halfResources[res] = Math.floor(amount / 2);
    }

    const s = -body.q - body.r;
    const newSettlement = mockDb.createSettlement({
      id: crypto.randomUUID(),
      playerId: player.id,
      name: body.name,
      level: 1,
      q: body.q,
      r: body.r,
      s,
      resources: halfResources,
      buildings: [{ type: 'town_center', level: 1, position: 0 }],
      buildQueue: [],
      units: {},
      trainQueue: [],
      researched: {},
      researchQueue: null,
    });

    mockDb.addEvent({
      id: crypto.randomUUID(),
      playerId: player.id,
      type: 'building_complete',
      title: 'New settlement founded',
      description: `Founded new settlement "${body.name}" at (${body.q},${body.r})`,
      timestamp: Date.now(),
      data: { settlementId: newSettlement.id, q: body.q, r: body.r },
    });

    return {
      message: `Settlement "${body.name}" founded`,
      settlement: newSettlement,
      primaryResources: firstSettlement.resources,
    };
  });
}
