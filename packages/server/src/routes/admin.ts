import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { mockDb } from '../db/mock-db.js';

export async function adminRoutes(app: FastifyInstance) {
  // POST /reset — Reset all game data (admin only)
  app.post('/reset', { preHandler: requireAuth }, async (request, reply) => {
    const player = request.user;

    // Only allow LucidReis to reset the game
    if (player.username !== 'LucidReis') {
      return reply.status(403).send({ error: 'Permission denied. Only LucidReis can reset the game.' });
    }

    try {
      // Clear all game data - players, settlements, heroes, etc.
      mockDb.players.clear();
      mockDb.playersByEmail.clear();
      mockDb.playersByUsername.clear();
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
      // Don't clear passwordResetTokens as they're transient tokens

      return { message: 'Game reset complete. All player data has been cleared.' };
    } catch (error) {
      console.error('[Admin] Reset failed:', error);
      return reply.status(500).send({ error: 'Reset failed' });
    }
  });
}
