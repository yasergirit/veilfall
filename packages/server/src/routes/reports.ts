import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { mockDb } from '../db/mock-db.js';
import { z } from 'zod';

const listReportsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function reportRoutes(app: FastifyInstance) {
  // GET / — list player's battle reports
  app.get('/', { preHandler: requireAuth }, async (request) => {
    const player = request.user;
    const { limit, offset } = listReportsSchema.parse(request.query);
    const reports = mockDb.getReportsByPlayer(player.id, limit, offset);
    return { reports, limit, offset };
  });

  // GET /:reportId — single report detail
  app.get('/:reportId', { preHandler: requireAuth }, async (request, reply) => {
    const player = request.user;
    const { reportId } = request.params as { reportId: string };
    const report = mockDb.getBattleReport(reportId);

    if (!report) {
      return reply.status(404).send({ error: 'Report not found' });
    }

    // Only allow access to reports the player participated in
    if (report.attackerId !== player.id && report.defenderId !== player.id) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    return { report };
  });
}
