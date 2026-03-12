import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { mockDb } from '../db/mock-db.js';
import { STARTING_RESOURCES } from '@veilfall/shared';
import { syncPlayer, syncSettlement } from '../db/supabase-sync.js';

const STARTER_HEROES: Record<string, { name: string; heroClass: string }> = {
  ironveil: { name: 'Thorne', heroClass: 'warlord' },
  aetheri: { name: 'Lyris', heroClass: 'sage' },
  thornwatch: { name: 'Ashka', heroClass: 'shadowblade' },
  ashen: { name: 'Kael', heroClass: 'warlord' },
};

const HERO_CLASS_STATS: Record<string, { strength: number; intellect: number; agility: number; endurance: number }> = {
  warlord:     { strength: 8, intellect: 3, agility: 4, endurance: 7 },
  sage:        { strength: 3, intellect: 8, agility: 4, endurance: 5 },
  shadowblade: { strength: 5, intellect: 4, agility: 8, endurance: 3 },
  steward:     { strength: 4, intellect: 6, agility: 4, endurance: 6 },
};

const HERO_CLASS_LEVEL1_ABILITY: Record<string, string> = {
  warlord:     'rally_cry',
  sage:        'aether_bolt',
  shadowblade: 'shadow_strike',
  steward:     'inspire',
};

const registerSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  faction: z.enum(['ironveil', 'aetheri', 'thornwatch', 'ashen']),
  settlementName: z.string().min(2).max(30),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);

    if (mockDb.getPlayerByEmail(body.email)) {
      return reply.status(409).send({ error: 'Email already registered' });
    }
    if (mockDb.getPlayerByUsername(body.username)) {
      return reply.status(409).send({ error: 'Username already taken' });
    }

    const hashedPassword = await bcrypt.hash(body.password, 12);
    const playerId = crypto.randomUUID();

    const player = mockDb.createPlayer({
      id: playerId,
      username: body.username,
      email: body.email,
      passwordHash: hashedPassword,
      faction: body.faction,
      createdAt: new Date(),
    });
    syncPlayer(player);

    const q = Math.floor(Math.random() * 20) - 10;
    const r = Math.floor(Math.random() * 20) - 10;

    const settlement = mockDb.createSettlement({
      id: crypto.randomUUID(),
      playerId,
      name: body.settlementName,
      level: 1,
      q, r, s: -q - r,
      resources: { ...STARTING_RESOURCES },
      buildings: [{ type: 'town_center', level: 1, position: 0 }],
      buildQueue: [],
      units: {},
      trainQueue: [],
      researched: {},
      researchQueue: null,
    });
    syncSettlement(settlement);

    const starterHero = STARTER_HEROES[body.faction];
    const heroClass = starterHero.heroClass;
    const baseStats = HERO_CLASS_STATS[heroClass] ?? { strength: 5, intellect: 5, agility: 5, endurance: 5 };
    // Starter equipment: rusty_sword + leather_armor for everyone
    const starterEquipment: Record<string, string | null> = { weapon: 'rusty_sword', armor: 'leather_armor', accessory: null, relic: null };
    // Apply equipment stat bonuses: rusty_sword +2 strength, leather_armor +3 endurance
    const statsWithEquip = {
      ...baseStats,
      strength: baseStats.strength + 2,
      endurance: baseStats.endurance + 3,
    };
    // Auto-unlock level 1 ability
    const level1Ability = HERO_CLASS_LEVEL1_ABILITY[heroClass];
    const startingAbilities = level1Ability ? [level1Ability] : [];

    mockDb.createHero({
      id: crypto.randomUUID(),
      playerId,
      name: starterHero.name,
      heroClass,
      level: 1, xp: 0, loyalty: 80, status: 'idle',
      abilities: startingAbilities,
      equipment: starterEquipment,
      stats: statsWithEquip,
    });

    const token = app.jwt.sign({ id: playerId, username: body.username, faction: body.faction });
    const refreshToken = app.jwt.sign({ id: playerId, type: 'refresh' }, { expiresIn: '7d' });

    reply.status(201).send({
      player: { id: playerId, username: body.username, faction: body.faction, settlementName: body.settlementName },
      token,
      refreshToken,
    });
  });

  app.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const player = mockDb.getPlayerByEmail(body.email);
    if (!player) return reply.status(401).send({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(body.password, player.passwordHash);
    if (!valid) return reply.status(401).send({ error: 'Invalid email or password' });

    const token = app.jwt.sign({ id: player.id, username: player.username, faction: player.faction });
    const refreshToken = app.jwt.sign({ id: player.id, type: 'refresh' }, { expiresIn: '7d' });
    const settlements = mockDb.getSettlementsByPlayer(player.id);

    reply.send({
      player: { id: player.id, username: player.username, faction: player.faction, settlementName: settlements[0]?.name ?? 'Unknown' },
      token,
      refreshToken,
    });
  });
}
