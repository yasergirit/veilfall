import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { mockDb } from '../db/mock-db.js';
import { z } from 'zod';

const UNIT_CONFIGS: Record<string, { cost: Record<string, number>; timePerUnit: number; attack: number; defense: number; speed: number; carry: number; hp: number; requires: string }> = {
  militia:      { cost: { food: 30, wood: 20 }, timePerUnit: 15, attack: 10, defense: 15, speed: 8, carry: 20, hp: 40, requires: 'militia_barracks' },
  archer:       { cost: { food: 40, wood: 30, iron: 10 }, timePerUnit: 20, attack: 18, defense: 8, speed: 9, carry: 15, hp: 30, requires: 'militia_barracks' },
  shieldbearer: { cost: { food: 50, wood: 20, iron: 30 }, timePerUnit: 25, attack: 8, defense: 25, speed: 6, carry: 10, hp: 55, requires: 'militia_barracks' },
  scout:        { cost: { food: 20, wood: 10 }, timePerUnit: 10, attack: 3, defense: 3, speed: 18, carry: 5, hp: 15, requires: 'scout_tower' },
  siege_ram:    { cost: { wood: 100, iron: 60, stone: 40 }, timePerUnit: 60, attack: 40, defense: 5, speed: 3, carry: 0, hp: 60, requires: 'militia_barracks' },
};

const trainSchema = z.object({
  unitType: z.string(),
  count: z.number().int().min(1),
});

export { UNIT_CONFIGS };

export async function unitRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireAuth }, async (request, reply) => {
    const player = request.user;
    const { settlementId } = request.query as { settlementId: string };

    if (!settlementId) {
      return reply.status(400).send({ error: 'settlementId query param required' });
    }

    const settlement = mockDb.getSettlement(settlementId);
    if (!settlement || settlement.playerId !== player.id) {
      return reply.status(404).send({ error: 'Settlement not found' });
    }

    return { units: settlement.units, trainQueue: settlement.trainQueue };
  });

  app.get('/configs', async () => {
    return { configs: UNIT_CONFIGS };
  });

  app.post('/:settlementId/train', { preHandler: requireAuth }, async (request, reply) => {
    const player = request.user;
    const { settlementId } = request.params as { settlementId: string };
    const { unitType, count } = trainSchema.parse(request.body);

    const settlement = mockDb.getSettlement(settlementId);
    if (!settlement || settlement.playerId !== player.id) {
      return reply.status(404).send({ error: 'Settlement not found' });
    }

    const config = UNIT_CONFIGS[unitType];
    if (!config) return reply.status(400).send({ error: 'Unknown unit type' });

    const hasRequiredBuilding = settlement.buildings.some((b) => b.type === config.requires);
    if (!hasRequiredBuilding) {
      return reply.status(400).send({ error: `Requires ${config.requires} to train ${unitType}` });
    }

    if (settlement.trainQueue.length >= 2) {
      return reply.status(400).send({ error: 'Train queue full (max 2)' });
    }

    const totalCost: Record<string, number> = {};
    for (const [res, amount] of Object.entries(config.cost)) {
      totalCost[res] = amount * count;
    }

    for (const [res, amount] of Object.entries(totalCost)) {
      if ((settlement.resources[res] ?? 0) < amount) {
        return reply.status(400).send({ error: `Not enough ${res}` });
      }
    }

    for (const [res, amount] of Object.entries(totalCost)) {
      settlement.resources[res] -= amount;
    }

    const totalTime = config.timePerUnit * count;
    const now = Date.now();
    settlement.trainQueue.push({ unitType, count, startedAt: now, endsAt: now + totalTime * 1000 });
    mockDb.updateSettlement(settlementId, { resources: settlement.resources, trainQueue: settlement.trainQueue });

    return { message: `Training ${count} ${unitType}`, endsAt: now + totalTime * 1000, resources: settlement.resources, trainQueue: settlement.trainQueue };
  });
}
