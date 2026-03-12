import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { mockDb } from '../db/mock-db.js';
import type { MockHeroQuest } from '../db/mock-db.js';
import { z } from 'zod';

// ── Quest Type Definitions ──

export const QUEST_DEFINITIONS: Record<
  MockHeroQuest['questType'],
  {
    name: string;
    description: string;
    duration: number;      // seconds
    difficulty: 1 | 2 | 3;
    rewards: { xpMin: number; xpMax: number; resources?: Record<string, [number, number]>; equipmentChance?: number; loreChance?: number };
  }
> = {
  exploration: {
    name: 'Exploration',
    description: 'Send your hero to explore the surrounding lands. A quick, low-risk venture that yields modest XP and resources.',
    duration: 60,
    difficulty: 1,
    rewards: {
      xpMin: 30,
      xpMax: 80,
      resources: {
        food: [20, 80],
        wood: [10, 50],
      },
    },
  },
  training: {
    name: 'Training',
    description: 'Your hero undergoes rigorous combat training. Medium risk with solid XP gains and a chance to improve stats.',
    duration: 90,
    difficulty: 2,
    rewards: {
      xpMin: 60,
      xpMax: 120,
      resources: {
        iron: [10, 40],
      },
    },
  },
  relic_hunt: {
    name: 'Relic Hunt',
    description: 'Venture into ancient ruins seeking powerful relics. Dangerous, but successful heroes may return with legendary equipment.',
    duration: 120,
    difficulty: 3,
    rewards: {
      xpMin: 100,
      xpMax: 200,
      resources: {
        stone: [30, 80],
        iron: [20, 60],
      },
      equipmentChance: 0.2,
    },
  },
  veil_expedition: {
    name: 'Veil Expedition',
    description: 'Plunge deep into the Veil itself. The most perilous journey, but those who return carry aether stones and fragments of forgotten lore.',
    duration: 180,
    difficulty: 3,
    rewards: {
      xpMin: 150,
      xpMax: 300,
      resources: {
        aether_stone: [20, 80],
      },
      loreChance: 0.3,
    },
  },
};

const LORE_FRAGMENTS = [
  'Fragment of the First Veil — "...and the world shattered into six, each shard a kingdom unto itself..."',
  'Aether Codex Excerpt — "The Veil is not a barrier. It is a wound."',
  'Ruined Tablet — "Those who drink deeply of the aether shall see beyond the veil, but never return whole."',
  'Torn Journal Page — "Day 47. The towers still hum. I hear voices in the stones."',
  'Ancient Glyph Translation — "When the six factions unite, the Veil shall mend — or consume all."',
  'Faded Scroll — "The Aether Wyrm sleeps beneath the convergence. Do not wake it."',
  'Crystal Memory — "Before the Veilfall, there was one world. One people. One song."',
  'Prophecy Shard — "The shadow colossus rises when hope fades. Feed it despair and it grows."',
];

const startQuestSchema = z.object({
  heroId: z.string().min(1),
  questType: z.enum(['exploration', 'training', 'relic_hunt', 'veil_expedition']),
});

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── Routes ──

export async function heroQuestRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('onRequest', async (request) => {
    await request.jwtVerify();
  });

  // GET /available — List available quest types with requirements
  app.get('/available', { preHandler: requireAuth }, async () => {
    const quests = Object.entries(QUEST_DEFINITIONS).map(([type, def]) => ({
      type,
      name: def.name,
      description: def.description,
      duration: def.duration,
      difficulty: def.difficulty,
      rewards: {
        xpRange: [def.rewards.xpMin, def.rewards.xpMax],
        resources: def.rewards.resources
          ? Object.fromEntries(
              Object.entries(def.rewards.resources).map(([res, [min, max]]) => [res, { min, max }]),
            )
          : undefined,
        equipmentChance: def.rewards.equipmentChance,
        loreChance: def.rewards.loreChance,
      },
    }));

    return { quests };
  });

  // POST /start — Start a hero quest
  app.post('/start', { preHandler: requireAuth }, async (request, reply) => {
    const player = request.user;
    const { heroId, questType } = startQuestSchema.parse(request.body);

    // Validate hero exists and belongs to player
    const hero = mockDb.getHero(heroId);
    if (!hero || hero.playerId !== player.id) {
      return reply.status(404).send({ error: 'Hero not found' });
    }

    // Hero must be idle — not marching, questing, or otherwise engaged
    if (hero.status !== 'idle') {
      return reply.status(400).send({
        error: `Hero is currently ${hero.status}. Hero must be idle to start a quest.`,
      });
    }

    // Check hero is not already on an active quest
    const existingQuest = mockDb.getActiveHeroQuestByHero(heroId);
    if (existingQuest) {
      return reply.status(400).send({ error: 'Hero is already on an active quest' });
    }

    const definition = QUEST_DEFINITIONS[questType];
    if (!definition) {
      return reply.status(400).send({ error: 'Invalid quest type' });
    }

    const now = Date.now();
    const quest: MockHeroQuest = {
      id: crypto.randomUUID(),
      playerId: player.id,
      heroId,
      questType,
      status: 'active',
      startedAt: now,
      endsAt: now + definition.duration * 1000,
      difficulty: definition.difficulty,
    };

    mockDb.createHeroQuest(quest);
    mockDb.updateHero(heroId, { status: 'questing' });

    return {
      quest,
      message: `${hero.name} has embarked on a ${definition.name} quest. Returns in ${definition.duration} seconds.`,
    };
  });

  // GET /active — Get player's active quests
  app.get('/active', { preHandler: requireAuth }, async (request) => {
    const player = request.user;
    const quests = mockDb.getActiveHeroQuestsByPlayer(player.id);
    return { quests };
  });

  // GET /history — Past quests (last 20)
  app.get('/history', { preHandler: requireAuth }, async (request) => {
    const player = request.user;
    const quests = mockDb.getHeroQuestsByPlayer(player.id, 20);
    return { quests };
  });
}
