import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { mockDb } from '../db/mock-db.js';
import { STARTING_RESOURCES } from '@veilfall/shared';

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

export async function adminRoutes(app: FastifyInstance) {
  // POST /reset — Reset all game data, keep player accounts
  app.post('/reset', { preHandler: requireAuth }, async (request, reply) => {
    const player = request.user;

    const ADMIN_EMAILS = ['odgardian@gmail.com', 'yasergirit@gmail.com'];
    const TESTER_EMAILS = ['yasergirit@gmail.com'];

    // Check role from JWT, fallback to DB lookup by player ID for old tokens
    const dbPlayer = mockDb.players.get(player.id);
    const isAllowed = player.username === 'LucidReis' || player.role === 'tester' || player.role === 'admin'
      || ADMIN_EMAILS.includes(player.email) || TESTER_EMAILS.includes(player.email)
      || (dbPlayer && (dbPlayer.role === 'tester' || dbPlayer.role === 'admin' || ADMIN_EMAILS.includes(dbPlayer.email) || TESTER_EMAILS.includes(dbPlayer.email)));

    if (!isAllowed) {
      return reply.status(403).send({ error: 'Permission denied.' });
    }

    try {
      // Save all player accounts before clearing
      const players = [...mockDb.players.values()];

      // Clear all game data
      mockDb.settlements.clear();
      mockDb.settlementsByPlayer.clear();
      mockDb.heroes.clear();
      mockDb.marches.clear();
      mockDb.alliances.clear();
      mockDb.alliancesByTag.clear();
      mockDb.diplomacy.clear();
      mockDb.messages.clear();
      mockDb.messagesByChannel.clear();
      mockDb.events.length = 0;
      mockDb.battleReports.clear();
      mockDb.mapEvents.clear();
      mockDb.tradeOffers.clear();
      mockDb.spyMissions.clear();
      mockDb.seasonalEvents.clear();
      mockDb.eventProgress.clear();
      mockDb.mails.clear();
      mockDb.worldBosses.clear();
      mockDb.heroQuests.clear();
      mockDb.dailyRewards.clear();

      // Clear alliance references from players
      for (const p of players) {
        p.allianceId = undefined;
        mockDb.players.set(p.id, p);
      }

      // Recreate starting settlement and hero for each player
      for (const p of players) {
        const q = Math.floor(Math.random() * 20) - 10;
        const r = Math.floor(Math.random() * 20) - 10;

        mockDb.createSettlement({
          id: crypto.randomUUID(),
          playerId: p.id,
          name: `${p.username}'s Settlement`,
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

        const starterHero = STARTER_HEROES[p.faction] ?? STARTER_HEROES.ironveil;
        const heroClass = starterHero.heroClass;
        const baseStats = HERO_CLASS_STATS[heroClass] ?? { strength: 5, intellect: 5, agility: 5, endurance: 5 };
        const level1Ability = HERO_CLASS_LEVEL1_ABILITY[heroClass];

        mockDb.createHero({
          id: crypto.randomUUID(),
          playerId: p.id,
          name: starterHero.name,
          heroClass,
          level: 1, xp: 0, loyalty: 80, status: 'idle',
          abilities: level1Ability ? [level1Ability] : [],
          equipment: { weapon: 'rusty_sword', armor: 'leather_armor', accessory: null, relic: null },
          stats: { ...baseStats, strength: baseStats.strength + 2, endurance: baseStats.endurance + 3 },
        });
      }

      console.log(`[Admin] Game reset by ${player.username}. ${players.length} player(s) restored to initial state.`);
      return { message: `Game reset complete. ${players.length} player(s) restored to initial state.` };
    } catch (error) {
      console.error('[Admin] Reset failed:', error);
      return reply.status(500).send({ error: 'Reset failed' });
    }
  });
}
