import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { mockDb } from '../db/mock-db.js';
import { z } from 'zod';

const sendSpySchema = z.object({
  settlementId: z.string(),
  targetQ: z.number().int(),
  targetR: z.number().int(),
  type: z.enum(['intel', 'sabotage']),
});

function hexDistance(q1: number, r1: number, q2: number, r2: number): number {
  const s1 = -q1 - r1;
  const s2 = -q2 - r2;
  return Math.max(Math.abs(q1 - q2), Math.abs(r1 - r2), Math.abs(s1 - s2));
}

/** Cost per spy mission, by mission type. */
const SPY_COSTS: Record<string, Record<string, number>> = {
  intel: { food: 100, iron: 50 },
  sabotage: { food: 150, iron: 80 },
};

/** Travel time per hex tile in milliseconds (dev speed). */
const TRAVEL_TIME_PER_HEX_MS = 15 * 1000;

export async function spyRoutes(app: FastifyInstance) {
  // -----------------------------------------------------------------------
  // POST /send — Send a spy mission
  // -----------------------------------------------------------------------
  app.post('/send', { preHandler: requireAuth }, async (request, reply) => {
    const player = request.user;
    const { settlementId, targetQ, targetR, type } = sendSpySchema.parse(request.body);

    // Validate source settlement ownership
    const settlement = mockDb.getSettlement(settlementId);
    if (!settlement || settlement.playerId !== player.id) {
      return reply.status(404).send({ error: 'Settlement not found' });
    }

    // Require spy_guild building in source settlement
    const spyGuild = settlement.buildings.find((b) => b.type === 'spy_guild');
    if (!spyGuild) {
      return reply.status(400).send({ error: 'You need a Spy Guild building to send spy missions' });
    }

    // Validate resources
    const spyCost = SPY_COSTS[type] ?? SPY_COSTS.intel;
    for (const [resource, amount] of Object.entries(spyCost)) {
      if ((settlement.resources[resource] ?? 0) < amount) {
        return reply.status(400).send({
          error: `Not enough ${resource} (have ${Math.floor(settlement.resources[resource] ?? 0)}, need ${amount})`,
        });
      }
    }

    // Find enemy settlement at target coordinates
    let targetSettlement;
    for (const s of mockDb.settlements.values()) {
      if (s.q === targetQ && s.r === targetR && s.playerId !== player.id) {
        targetSettlement = s;
        break;
      }
    }

    if (!targetSettlement) {
      return reply.status(400).send({ error: 'No enemy settlement found at those coordinates' });
    }

    // Deduct resources
    for (const [resource, amount] of Object.entries(spyCost)) {
      settlement.resources[resource] -= amount;
    }
    mockDb.updateSettlement(settlementId, { resources: settlement.resources });

    // Calculate travel time
    const distance = hexDistance(settlement.q, settlement.r, targetQ, targetR);
    const travelTimeMs = Math.max(distance, 1) * TRAVEL_TIME_PER_HEX_MS;

    const now = Date.now();
    const mission = mockDb.createSpyMission({
      id: crypto.randomUUID(),
      playerId: player.id,
      settlementId,
      targetSettlementId: targetSettlement.id,
      targetPlayerId: targetSettlement.playerId,
      type,
      status: 'infiltrating',
      startedAt: now,
      arrivedAt: now + travelTimeMs,
    });

    console.log(
      `[Spy] ${player.id} sent ${type} mission to (${targetQ},${targetR}) — arrives in ${Math.round(travelTimeMs / 1000)}s`,
    );

    return {
      mission,
      message: `Spy mission (${type}) dispatched. Arrives in ${Math.round(travelTimeMs / 1000)} seconds.`,
    };
  });

  // -----------------------------------------------------------------------
  // GET /missions — List player's spy missions
  // -----------------------------------------------------------------------
  app.get('/missions', { preHandler: requireAuth }, async (request) => {
    const player = request.user;
    const missions = mockDb.getSpyMissionsByPlayer(player.id);
    return { missions };
  });

  // -----------------------------------------------------------------------
  // GET /reports/:id — Detailed spy report
  // -----------------------------------------------------------------------
  app.get('/reports/:id', { preHandler: requireAuth }, async (request, reply) => {
    const player = request.user;
    const { id } = request.params as { id: string };

    const mission = mockDb.getSpyMission(id);
    if (!mission || mission.playerId !== player.id) {
      return reply.status(404).send({ error: 'Spy mission not found' });
    }

    return { mission };
  });
}
