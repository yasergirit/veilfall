import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { mockDb } from '../db/mock-db.js';
import { z } from 'zod';

const eventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  type: z.string().default('all'),
});

const LORE_FRAGMENTS = [
  { id: 1, title: "Elder Maren's First Letter", content: 'The settlement was not built by chance...', unlockedBy: 'town_center' },
  { id: 2, title: 'The Gathering', content: 'Food was scarce in the early days. The first Gathering Post marked the beginning of hope.', unlockedBy: 'gathering_post' },
  { id: 3, title: 'Walls Against the Dark', content: 'The palisade was crude, but it kept the scavengers at bay through the first winter.', unlockedBy: 'palisade_wall' },
  { id: 4, title: 'The Blue Glow', content: 'Aether Stone — some called it skyblood. It hummed when touched, warm and alive.', unlockedBy: 'aether_extractor' },
  { id: 5, title: 'First Blades', content: "The militia barracks stood as a grim reminder: peace was a luxury we couldn't afford.", unlockedBy: 'militia_barracks' },
  { id: 6, title: 'The Stranger', content: 'A wanderer arrived, scarred and silent. They spoke of Bloodline Seats and old oaths.', unlockedBy: 'hero_hall' },
  { id: 7, title: 'Eyes Open', content: 'From the Scout Tower, we saw the true scale of the ruins. Miles of broken cities stretched to the horizon.', unlockedBy: 'scout_tower' },
  { id: 8, title: 'The Buried Idol', content: 'Beneath the town center, wrapped in roots and stone, we found it — an idol pulsing with aether light. The inscription read: "When the last thread breaks, the Weavers return."', unlockedBy: 'town_center_3' },
];

export async function chronicleRoutes(app: FastifyInstance) {
  app.get('/events', { preHandler: requireAuth }, async (request) => {
    const player = request.user;
    const { limit, offset, type } = eventsQuerySchema.parse(request.query);
    const events = mockDb.getEvents(player.id, limit, offset, type);
    return { events, limit, offset };
  });

  app.get('/lore', { preHandler: requireAuth }, async (request) => {
    const player = request.user;
    const settlements = mockDb.getSettlementsByPlayer(player.id);

    // Collect all buildings (type + level) across all settlements
    const builtTypes = new Set<string>();
    for (const settlement of settlements) {
      for (const building of settlement.buildings) {
        builtTypes.add(building.type);
        // Also add type_level keys for level-gated lore (e.g. town_center_3)
        builtTypes.add(`${building.type}_${building.level}`);
      }
    }

    const unlocked = LORE_FRAGMENTS.filter((f) => builtTypes.has(f.unlockedBy));
    const locked = LORE_FRAGMENTS.filter((f) => !builtTypes.has(f.unlockedBy)).map((f) => ({
      id: f.id,
      title: '???',
      content: null,
      unlockedBy: f.unlockedBy,
      locked: true,
    }));

    return { unlocked, locked };
  });
}
