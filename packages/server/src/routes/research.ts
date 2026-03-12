import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { mockDb } from '../db/mock-db.js';
import { z } from 'zod';

const RESEARCH_TREE: Record<string, { name: string; description: string; maxLevel: number; cost: Record<string, number>; timeSeconds: number; requires?: string; effects: string }> = {
  agriculture:     { name: 'Agriculture',      description: 'Improve food production',         maxLevel: 10, cost: { food: 100, wood: 50 },             timeSeconds: 60,  effects: '+10% food/hr per level' },
  forestry:        { name: 'Forestry',          description: 'Improve wood production',         maxLevel: 10, cost: { food: 50, wood: 100 },             timeSeconds: 60,  effects: '+10% wood/hr per level' },
  masonry:         { name: 'Masonry',           description: 'Improve stone production',        maxLevel: 10, cost: { wood: 100, stone: 80 },            timeSeconds: 75,  effects: '+10% stone/hr per level' },
  metallurgy:      { name: 'Metallurgy',        description: 'Improve iron production',         maxLevel: 10, cost: { wood: 80, iron: 100 },             timeSeconds: 90,  effects: '+10% iron/hr per level' },
  aether_studies:  { name: 'Aether Studies',    description: 'Improve aether harvesting',       maxLevel: 10, cost: { aether_stone: 30, iron: 50 },      timeSeconds: 120, effects: '+10% aether/hr per level' },
  fortification:   { name: 'Fortification',     description: 'Strengthen defenses',             maxLevel: 10, cost: { stone: 150, iron: 80 },            timeSeconds: 90,  effects: '+5% defense per level' },
  tactics:         { name: 'Tactics',           description: 'Improve military effectiveness',  maxLevel: 10, cost: { food: 100, iron: 60 },             timeSeconds: 90,  requires: 'militia_barracks', effects: '+5% attack per level' },
  logistics:       { name: 'Logistics',         description: 'Faster marches and more carry',   maxLevel: 10, cost: { food: 80, wood: 80 },              timeSeconds: 75,  effects: '+5% speed, +10% carry per level' },
  cartography:     { name: 'Cartography',       description: 'Reveal more of the map',          maxLevel: 5,  cost: { wood: 60, aether_stone: 20 },     timeSeconds: 90,  requires: 'scout_tower', effects: '+2 tile vision per level' },
  aether_mastery:  { name: 'Aether Mastery',    description: 'Unlock advanced aether abilities', maxLevel: 5,  cost: { aether_stone: 80, iron: 60 },     timeSeconds: 180, requires: 'aether_extractor', effects: 'Unlock aether abilities' },
};

const startResearchSchema = z.object({
  type: z.string(),
});

export async function researchRoutes(app: FastifyInstance) {
  app.get('/tree', async () => {
    // Return as array with type key included, matching client expectations
    const tree = Object.entries(RESEARCH_TREE).map(([type, node]) => ({
      type,
      name: node.name,
      description: node.description,
      maxLevel: node.maxLevel,
      cost: node.cost,
      time: node.timeSeconds,
      requiredBuilding: node.requires,
      effects: node.effects,
    }));
    return { tree };
  });

  app.get('/:settlementId', { preHandler: requireAuth }, async (request, reply) => {
    const player = request.user;
    const { settlementId } = request.params as { settlementId: string };

    const settlement = mockDb.getSettlement(settlementId);
    if (!settlement || settlement.playerId !== player.id) {
      return reply.status(404).send({ error: 'Settlement not found' });
    }

    return {
      completed: settlement.researched,
      active: settlement.researchQueue
        ? { type: settlement.researchQueue.type, level: settlement.researchQueue.level, endsAt: settlement.researchQueue.endsAt }
        : null,
    };
  });

  app.post('/:settlementId/start', { preHandler: requireAuth }, async (request, reply) => {
    const player = request.user;
    const { settlementId } = request.params as { settlementId: string };
    const { type } = startResearchSchema.parse(request.body);

    const settlement = mockDb.getSettlement(settlementId);
    if (!settlement || settlement.playerId !== player.id) {
      return reply.status(404).send({ error: 'Settlement not found' });
    }

    const config = RESEARCH_TREE[type];
    if (!config) {
      return reply.status(400).send({ error: 'Unknown research type' });
    }

    // Check if already researching
    if (settlement.researchQueue) {
      return reply.status(400).send({ error: 'Already researching. Only one research at a time.' });
    }

    // Check current level vs max
    const currentLevel = settlement.researched[type] ?? 0;
    const nextLevel = currentLevel + 1;
    if (currentLevel >= config.maxLevel) {
      return reply.status(400).send({ error: `${config.name} already at max level (${config.maxLevel})` });
    }

    // Check required building
    if (config.requires) {
      const hasBuilding = settlement.buildings.some((b) => b.type === config.requires);
      if (!hasBuilding) {
        return reply.status(400).send({ error: `Requires ${config.requires} to research ${config.name}` });
      }
    }

    // Calculate cost (base cost * nextLevel)
    const totalCost: Record<string, number> = {};
    for (const [res, amount] of Object.entries(config.cost)) {
      totalCost[res] = amount * nextLevel;
    }

    // Validate resources
    for (const [res, amount] of Object.entries(totalCost)) {
      if ((settlement.resources[res] ?? 0) < amount) {
        return reply.status(400).send({ error: `Not enough ${res} (need ${amount}, have ${Math.floor(settlement.resources[res] ?? 0)})` });
      }
    }

    // Deduct resources
    for (const [res, amount] of Object.entries(totalCost)) {
      settlement.resources[res] -= amount;
    }

    const researchTime = config.timeSeconds * nextLevel;
    const now = Date.now();
    settlement.researchQueue = {
      type,
      level: nextLevel,
      startedAt: now,
      endsAt: now + researchTime * 1000,
    };

    mockDb.updateSettlement(settlementId, {
      resources: settlement.resources,
      researchQueue: settlement.researchQueue,
    });

    return {
      message: `Researching ${config.name} level ${nextLevel}`,
      endsAt: now + researchTime * 1000,
      resources: settlement.resources,
      researchQueue: settlement.researchQueue,
    };
  });
}
