import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { mockDb } from '../db/mock-db.js';

// ─── 7-Day Reward Cycle ───

interface DayReward {
  day: number;
  resources: Record<string, number>;
}

const REWARD_CYCLE: DayReward[] = [
  { day: 1, resources: { food: 200, wood: 200 } },
  { day: 2, resources: { stone: 300, iron: 200 } },
  { day: 3, resources: { food: 500, wood: 500, stone: 300 } },
  { day: 4, resources: { aether_stone: 100 } },
  { day: 5, resources: { food: 800, wood: 800, stone: 500, iron: 300 } },
  { day: 6, resources: { aether_stone: 200 } },
  { day: 7, resources: { food: 1000, wood: 1000, stone: 800, iron: 500, aether_stone: 300 } },
];

// ─── Helpers ───

function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Returns the number of calendar days between two YYYY-MM-DD strings.
 * A positive result means `b` is that many days after `a`.
 */
function daysBetween(a: string, b: string): number {
  const msA = Date.UTC(
    Number(a.slice(0, 4)),
    Number(a.slice(5, 7)) - 1,
    Number(a.slice(8, 10)),
  );
  const msB = Date.UTC(
    Number(b.slice(0, 4)),
    Number(b.slice(5, 7)) - 1,
    Number(b.slice(8, 10)),
  );
  return Math.round((msB - msA) / (1000 * 60 * 60 * 24));
}

// ─── Routes ───

export async function dailyRewardRoutes(app: FastifyInstance) {
  // GET /status - return current streak info and full reward schedule
  app.get('/status', { preHandler: [requireAuth] }, async (request, reply) => {
    const player = request.user;
    const today = getTodayUTC();
    const tracking = mockDb.dailyRewards.get(player.id);

    let currentDay = 1;
    let streak = 0;
    let claimed = false;
    let lastClaimDate: string | null = null;

    if (tracking) {
      lastClaimDate = tracking.lastClaimDate;
      const gap = daysBetween(tracking.lastClaimDate, today);

      if (gap === 0) {
        // Already claimed today
        currentDay = tracking.currentDay;
        streak = tracking.streak;
        claimed = true;
      } else if (gap === 1) {
        // Consecutive day - advance to next day in cycle
        currentDay = (tracking.currentDay % 7) + 1;
        streak = tracking.streak + 1;
        claimed = false;
      } else {
        // Missed a day - streak resets
        currentDay = 1;
        streak = 0;
        claimed = false;
      }
    }

    const rewardSchedule = REWARD_CYCLE.map((r) => ({
      day: r.day,
      resources: r.resources,
      isCurrent: r.day === currentDay,
    }));

    return reply.send({
      currentDay,
      streak,
      claimed,
      lastClaimDate,
      rewards: rewardSchedule,
    });
  });

  // POST /claim - claim today's reward
  app.post('/claim', { preHandler: [requireAuth] }, async (request, reply) => {
    const player = request.user;
    const today = getTodayUTC();
    const tracking = mockDb.dailyRewards.get(player.id);

    // ── Determine current day and whether claim is allowed ──

    let currentDay = 1;
    let streak = 0;

    if (tracking) {
      const gap = daysBetween(tracking.lastClaimDate, today);

      if (gap === 0) {
        return reply.status(400).send({
          error: 'Already claimed',
          code: 'DAILY_REWARD_ALREADY_CLAIMED',
          message: 'You have already claimed your daily reward today.',
        });
      }

      if (gap === 1) {
        // Consecutive login - continue streak
        currentDay = (tracking.currentDay % 7) + 1;
        streak = tracking.streak + 1;
      } else {
        // Gap > 1 day - reset streak
        currentDay = 1;
        streak = 1;
      }
    } else {
      // First ever claim
      streak = 1;
      currentDay = 1;
    }

    // ── Find the player's first settlement to deposit resources ──

    const settlements = mockDb.getSettlementsByPlayer(player.id);
    if (!settlements.length) {
      return reply.status(400).send({
        error: 'No settlement',
        code: 'NO_SETTLEMENT',
        message: 'You must have a settlement to claim daily rewards.',
      });
    }

    const settlement = settlements[0];
    const reward = REWARD_CYCLE[currentDay - 1];

    // ── Add resources to settlement ──

    const updatedResources = { ...settlement.resources };
    for (const [resource, amount] of Object.entries(reward.resources)) {
      updatedResources[resource] = (updatedResources[resource] ?? 0) + amount;
    }

    mockDb.updateSettlement(settlement.id, { resources: updatedResources });

    // ── Update tracking ──

    const totalClaimed = (tracking?.totalClaimed ?? 0) + 1;

    mockDb.dailyRewards.set(player.id, {
      playerId: player.id,
      currentDay,
      streak,
      lastClaimDate: today,
      totalClaimed,
    });

    return reply.send({
      success: true,
      currentDay,
      streak,
      totalClaimed,
      rewards: reward.resources,
      settlementId: settlement.id,
    });
  });
}
