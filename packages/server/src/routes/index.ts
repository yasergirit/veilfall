import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.js';
import { settlementRoutes } from './settlement.js';
import { mapRoutes } from './map.js';
import { heroRoutes } from './heroes.js';
import { unitRoutes } from './units.js';
import { marchRoutes } from './marches.js';
import { allianceRoutes } from './alliance.js';
import { chatRoutes } from './chat.js';
import { chronicleRoutes } from './chronicle.js';
import { researchRoutes } from './research.js';
import { reportRoutes } from './reports.js';
import { marketplaceRoutes } from './marketplace.js';
import { leaderboardRoutes } from './leaderboard.js';
import { notificationRoutes } from './notifications.js';
import { eventRoutes } from './events.js';
import { spyRoutes } from './spy.js';
import { worldBossRoutes } from './world-boss.js';
import { mailRoutes } from './mail.js';
import { heroQuestRoutes } from './hero-quests.js';

export async function registerRoutes(app: FastifyInstance) {
  app.get('/api/health', async () => ({
    status: 'ok',
    game: 'VEILFALL',
    version: '0.1.0',
    mode: 'mock-db',
    timestamp: new Date().toISOString(),
  }));

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(settlementRoutes, { prefix: '/api/settlements' });
  await app.register(mapRoutes, { prefix: '/api/map' });
  await app.register(heroRoutes, { prefix: '/api/heroes' });
  await app.register(unitRoutes, { prefix: '/api/units' });
  await app.register(marchRoutes, { prefix: '/api/marches' });
  await app.register(allianceRoutes, { prefix: '/api/alliance' });
  await app.register(chatRoutes, { prefix: '/api/chat' });
  await app.register(chronicleRoutes, { prefix: '/api/chronicle' });
  await app.register(researchRoutes, { prefix: '/api/research' });
  await app.register(reportRoutes, { prefix: '/api/reports' });
  await app.register(marketplaceRoutes, { prefix: '/api/marketplace' });
  await app.register(leaderboardRoutes, { prefix: '/api/leaderboard' });
  await app.register(notificationRoutes, { prefix: '/api/notifications' });
  await app.register(eventRoutes, { prefix: '/api/events' });
  await app.register(spyRoutes, { prefix: '/api/spy' });
  await app.register(worldBossRoutes, { prefix: '/api/world-boss' });
  await app.register(mailRoutes, { prefix: '/api/mail' });
  await app.register(heroQuestRoutes, { prefix: '/api/hero-quests' });
}
