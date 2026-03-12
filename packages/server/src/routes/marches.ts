import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { mockDb } from '../db/mock-db.js';
import { z } from 'zod';
import { UNIT_CONFIGS } from './units.js';
import { MAX_ARMY_SIZE_PER_MARCH } from '@veilfall/shared';

const sendMarchSchema = z.object({
  units: z.record(z.string(), z.number().int().min(1)),
  toQ: z.number().int(),
  toR: z.number().int(),
  type: z.enum(['attack', 'scout', 'reinforce', 'raid']),
  heroId: z.string().optional(),
});

function hexDistance(q1: number, r1: number, q2: number, r2: number): number {
  const s1 = -q1 - r1;
  const s2 = -q2 - r2;
  return Math.max(Math.abs(q1 - q2), Math.abs(r1 - r2), Math.abs(s1 - s2));
}

export async function marchRoutes(app: FastifyInstance) {
  app.get('/:settlementId', { preHandler: requireAuth }, async (request, reply) => {
    const player = request.user;
    const { settlementId } = request.params as { settlementId: string };

    const settlement = mockDb.getSettlement(settlementId);
    if (!settlement || settlement.playerId !== player.id) {
      return reply.status(404).send({ error: 'Settlement not found' });
    }

    const marches = mockDb.getMarchesBySettlement(settlementId);
    return { marches };
  });

  app.post('/:settlementId/send', { preHandler: requireAuth }, async (request, reply) => {
    const player = request.user;
    const { settlementId } = request.params as { settlementId: string };
    const { units, toQ, toR, type, heroId } = sendMarchSchema.parse(request.body);

    const settlement = mockDb.getSettlement(settlementId);
    if (!settlement || settlement.playerId !== player.id) {
      return reply.status(404).send({ error: 'Settlement not found' });
    }

    // Validate units are available
    for (const [unitType, count] of Object.entries(units)) {
      const config = UNIT_CONFIGS[unitType];
      if (!config) return reply.status(400).send({ error: `Unknown unit type: ${unitType}` });
      if ((settlement.units[unitType] ?? 0) < count) {
        return reply.status(400).send({ error: `Not enough ${unitType} (have ${settlement.units[unitType] ?? 0}, need ${count})` });
      }
    }

    // Validate army size cap
    const totalUnits = Object.values(units).reduce((sum, n) => sum + n, 0);
    if (totalUnits > MAX_ARMY_SIZE_PER_MARCH) {
      return reply.status(400).send({ error: `Army size exceeds maximum of ${MAX_ARMY_SIZE_PER_MARCH} units per march` });
    }

    // Validate hero attachment
    if (heroId) {
      const hero = mockDb.getHero(heroId);
      if (!hero) {
        return reply.status(404).send({ error: 'Hero not found' });
      }
      if (hero.playerId !== player.id) {
        return reply.status(403).send({ error: 'Hero does not belong to you' });
      }
      if (hero.status !== 'idle') {
        return reply.status(400).send({ error: `Hero is currently ${hero.status}, must be idle` });
      }
      mockDb.updateHero(heroId, { status: 'marching' });
    }

    // Remove units from settlement
    for (const [unitType, count] of Object.entries(units)) {
      settlement.units[unitType] -= count;
      if (settlement.units[unitType] === 0) delete settlement.units[unitType];
    }

    // Calculate travel time based on slowest unit
    const distance = hexDistance(settlement.q, settlement.r, toQ, toR);
    let slowestSpeed = Infinity;
    for (const unitType of Object.keys(units)) {
      const config = UNIT_CONFIGS[unitType];
      if (config.speed < slowestSpeed) slowestSpeed = config.speed;
    }
    // 30 seconds per tile, adjusted inversely by speed (slower units = more time is default)
    const travelTimeMs = distance * 30 * 1000;
    // Enforce minimum travel time of 15 seconds
    let finalTravelTimeMs = Math.max(travelTimeMs, 15_000);
    // Raids move 1.3x faster
    if (type === 'raid') {
      finalTravelTimeMs = Math.round(finalTravelTimeMs / 1.3);
    }

    const now = Date.now();
    const march = mockDb.createMarch({
      id: crypto.randomUUID(),
      playerId: player.id,
      settlementId,
      units: { ...units },
      fromQ: settlement.q,
      fromR: settlement.r,
      toQ,
      toR,
      type,
      startedAt: now,
      arrivedAt: now + finalTravelTimeMs,
      status: 'marching',
      heroId,
    });

    mockDb.updateSettlement(settlementId, { units: settlement.units });

    return { message: `March sent (${type})`, march };
  });
}
