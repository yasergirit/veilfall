import type { FastifyInstance } from 'fastify';
import { mockDb } from '../db/mock-db.js';
import type { MockSeasonalEvent } from '../db/mock-db.js';
import { pushNotification } from './notifications.js';

// ---------------------------------------------------------------------------
// Event Definitions
// ---------------------------------------------------------------------------

const EVENT_DURATION = 10 * 60 * 1000; // 10 minutes

interface SeasonalEventTemplate {
  type: MockSeasonalEvent['type'];
  name: string;
  description: string;
  objectives: { description: string; target: number };
  rewards: Record<string, number>;
  bonusDescription: string;
}

const EVENT_TEMPLATES: SeasonalEventTemplate[] = [
  {
    type: 'harvest_moon',
    name: 'Harvest Moon Festival',
    description:
      'The Harvest Moon rises over the realm! Gather resources under its golden glow. All resource production is boosted by 50% during this festival.',
    objectives: { description: 'Gather 2000 total resources (food + wood + stone + iron)', target: 2000 },
    rewards: { aether_stone: 500 },
    bonusDescription: '+50% resource production during event',
  },
  {
    type: 'aether_storm',
    name: 'Aether Storm',
    description:
      'A violent Aether Storm sweeps the land! Harness its chaotic energy to accelerate your construction efforts. Research time is halved.',
    objectives: { description: 'Build or upgrade 3 buildings', target: 3 },
    rewards: { food: 1000, wood: 1000, stone: 500 },
    bonusDescription: 'Research time -50%',
  },
  {
    type: 'ironclad_tournament',
    name: 'Ironclad Tournament',
    description:
      'The Ironclad Tournament has begun! Prove your military might by training soldiers for the arena. Training costs are reduced by 25%.',
    objectives: { description: 'Train 30 military units', target: 30 },
    rewards: { aether_stone: 300 },
    bonusDescription: 'Training cost -25%',
  },
];

// ---------------------------------------------------------------------------
// Module State — tracks which event template is next in the rotation
// ---------------------------------------------------------------------------

let rotationIndex = 0;

// ---------------------------------------------------------------------------
// Exported Helpers — called by game-loop/index.ts
// ---------------------------------------------------------------------------

/**
 * Returns the currently active seasonal event, or undefined if none is running.
 */
export function getActiveEvent(): MockSeasonalEvent | undefined {
  return mockDb.getActiveSeasonalEvent();
}

/**
 * Increment a player's progress toward the active event objective.
 * Automatically marks the objective as completed when the target is reached.
 */
export function incrementProgress(playerId: string, amount: number): void {
  const active = mockDb.getActiveSeasonalEvent();
  if (!active) return;

  let progress = mockDb.getEventProgressByPlayerAndEvent(playerId, active.id);
  if (!progress) {
    progress = mockDb.createEventProgress({
      id: crypto.randomUUID(),
      playerId,
      eventId: active.id,
      progress: 0,
      completed: false,
      claimedReward: false,
    });
  }

  if (progress.completed) return;

  const newProgress = progress.progress + amount;
  const completed = newProgress >= active.objectives.target;

  mockDb.updateEventProgress(progress.id, {
    progress: newProgress,
    completed,
  });

  if (completed) {
    pushNotification(playerId, {
      type: 'system',
      title: 'Event Objective Complete!',
      message: `You completed the ${active.name} objective! Claim your reward.`,
    });
    console.log(`[Events] Player ${playerId} completed ${active.name} objective`);
  }
}

/**
 * Check whether the active event has expired and rotate to the next one.
 * Called periodically from the game loop.
 */
export function tickEventRotation(): void {
  const now = Date.now();
  const active = mockDb.getActiveSeasonalEvent();

  if (active) {
    // Check for expiry
    if (now >= active.endsAt) {
      mockDb.updateSeasonalEvent(active.id, { status: 'expired' });
      console.log(`[Events] Seasonal event expired: ${active.name}`);

      // Notify all players
      for (const player of mockDb.players.values()) {
        pushNotification(player.id, {
          type: 'system',
          title: 'Event Ended',
          message: `The ${active.name} has ended. A new event will begin shortly.`,
        });
      }

      // Start the next event immediately after expiry
      startNextEvent();
    }
    return;
  }

  // No active event — start one if there are players
  if (mockDb.players.size > 0) {
    startNextEvent();
  }
}

function startNextEvent(): void {
  const template = EVENT_TEMPLATES[rotationIndex % EVENT_TEMPLATES.length];
  rotationIndex++;

  const now = Date.now();
  const event: MockSeasonalEvent = {
    id: crypto.randomUUID(),
    type: template.type,
    name: template.name,
    description: template.description,
    startedAt: now,
    endsAt: now + EVENT_DURATION,
    status: 'active',
    objectives: { ...template.objectives },
    rewards: { ...template.rewards },
    bonusDescription: template.bonusDescription,
  };

  mockDb.createSeasonalEvent(event);

  // Notify every connected player
  for (const player of mockDb.players.values()) {
    pushNotification(player.id, {
      type: 'system',
      title: `${event.name} has begun!`,
      message: `${event.description} Objective: ${event.objectives.description}`,
    });
  }

  console.log(`[Events] Seasonal event started: ${event.name} (ends at ${new Date(event.endsAt).toISOString()})`);
}

/**
 * Returns the bonus multiplier for resource production if the Harvest Moon
 * event is currently active. Returns 1.0 otherwise.
 */
export function getHarvestMoonMultiplier(): number {
  const active = mockDb.getActiveSeasonalEvent();
  return active && active.type === 'harvest_moon' ? 1.5 : 1.0;
}

/**
 * Returns the research time multiplier if the Aether Storm event is active.
 * Returns 1.0 otherwise (0.5 = half time).
 */
export function getAetherStormResearchMultiplier(): number {
  const active = mockDb.getActiveSeasonalEvent();
  return active && active.type === 'aether_storm' ? 0.5 : 1.0;
}

/**
 * Returns the training cost multiplier if the Ironclad Tournament event is
 * active. Returns 1.0 otherwise (0.75 = 25% cheaper).
 */
export function getIroncladCostMultiplier(): number {
  const active = mockDb.getActiveSeasonalEvent();
  return active && active.type === 'ironclad_tournament' ? 0.75 : 1.0;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function eventRoutes(app: FastifyInstance) {
  // Auth hook — every route requires a valid JWT.
  app.addHook('onRequest', async (request) => {
    await request.jwtVerify();
  });

  // -------------------------------------------------------------------------
  // GET / — Get active event (if any) + player's progress
  // -------------------------------------------------------------------------
  app.get('/', async (request) => {
    const player = request.user;
    const active = mockDb.getActiveSeasonalEvent();

    if (!active) {
      return { event: null, progress: null };
    }

    const progress = mockDb.getEventProgressByPlayerAndEvent(player.id, active.id);

    return {
      event: {
        id: active.id,
        type: active.type,
        name: active.name,
        description: active.description,
        startedAt: active.startedAt,
        endsAt: active.endsAt,
        status: active.status,
        objectives: active.objectives,
        rewards: active.rewards,
        bonusDescription: active.bonusDescription,
        timeRemainingMs: Math.max(0, active.endsAt - Date.now()),
      },
      progress: progress
        ? {
            current: progress.progress,
            target: active.objectives.target,
            completed: progress.completed,
            claimedReward: progress.claimedReward,
          }
        : {
            current: 0,
            target: active.objectives.target,
            completed: false,
            claimedReward: false,
          },
    };
  });

  // -------------------------------------------------------------------------
  // POST /claim — Claim reward for completed event objective
  // -------------------------------------------------------------------------
  app.post('/claim', async (request, reply) => {
    const player = request.user;
    const body = request.body as { eventId?: string };
    const eventId = body?.eventId;

    if (!eventId) {
      return reply.status(400).send({ error: 'eventId is required' });
    }

    const event = mockDb.getSeasonalEvent(eventId);
    if (!event) {
      return reply.status(404).send({ error: 'Event not found' });
    }

    const progress = mockDb.getEventProgressByPlayerAndEvent(player.id, eventId);
    if (!progress) {
      return reply.status(400).send({ error: 'No progress recorded for this event' });
    }

    if (!progress.completed) {
      return reply.status(400).send({ error: 'Objective not yet completed' });
    }

    if (progress.claimedReward) {
      return reply.status(400).send({ error: 'Reward already claimed' });
    }

    // Grant rewards to the player's first settlement
    const settlements = mockDb.getSettlementsByPlayer(player.id);
    if (settlements.length === 0) {
      return reply.status(400).send({ error: 'No settlement to receive rewards' });
    }

    const settlement = settlements[0];
    for (const [resource, amount] of Object.entries(event.rewards)) {
      settlement.resources[resource] = (settlement.resources[resource] ?? 0) + amount;
    }
    mockDb.updateSettlement(settlement.id, { resources: settlement.resources });

    // If ironclad tournament, also grant hero XP boost
    if (event.type === 'ironclad_tournament') {
      const heroes = mockDb.getHeroesByPlayer(player.id);
      if (heroes.length > 0) {
        const hero = heroes[0];
        const xpBoost = 150;
        mockDb.updateHero(hero.id, { xp: hero.xp + xpBoost });
        console.log(`[Events] Hero ${hero.name} received ${xpBoost} XP from Ironclad Tournament`);
      }
    }

    mockDb.updateEventProgress(progress.id, { claimedReward: true });

    pushNotification(player.id, {
      type: 'system',
      title: 'Reward Claimed!',
      message: `You claimed your ${event.name} rewards: ${Object.entries(event.rewards).map(([r, a]) => `${a} ${r}`).join(', ')}`,
    });

    mockDb.addEvent({
      id: crypto.randomUUID(),
      playerId: player.id,
      type: 'quest_complete',
      title: `${event.name} Complete`,
      description: `Claimed rewards from ${event.name}: ${Object.entries(event.rewards).map(([r, a]) => `${a} ${r}`).join(', ')}`,
      timestamp: Date.now(),
      data: { eventId: event.id, rewards: event.rewards },
    });

    console.log(`[Events] Player ${player.id} claimed ${event.name} rewards`);

    return {
      success: true,
      rewards: event.rewards,
      settlement: {
        id: settlement.id,
        resources: settlement.resources,
      },
    };
  });

  // -------------------------------------------------------------------------
  // GET /history — Past events and their results
  // -------------------------------------------------------------------------
  app.get('/history', async (request) => {
    const player = request.user;
    const query = request.query as { limit?: string };
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 50);

    const pastEvents = mockDb.getSeasonalEventHistory(limit);

    const history = pastEvents.map((event) => {
      const progress = mockDb.getEventProgressByPlayerAndEvent(player.id, event.id);
      const totalParticipants = mockDb.getEventProgressByEvent(event.id).length;
      const totalCompleted = mockDb.getEventProgressByEvent(event.id).filter((p) => p.completed).length;

      return {
        id: event.id,
        type: event.type,
        name: event.name,
        startedAt: event.startedAt,
        endsAt: event.endsAt,
        status: event.status,
        objectives: event.objectives,
        rewards: event.rewards,
        playerProgress: progress
          ? {
              current: progress.progress,
              target: event.objectives.target,
              completed: progress.completed,
              claimedReward: progress.claimedReward,
            }
          : null,
        stats: {
          totalParticipants,
          totalCompleted,
        },
      };
    });

    return { events: history };
  });
}
