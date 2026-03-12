import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { mockDb } from '../db/mock-db.js';
import { z } from 'zod';

export const HERO_ABILITIES: Record<string, { name: string; description: string; heroClass: string; levelRequired: number; effect: string }> = {
  rally_cry:       { name: 'Rally Cry',       description: 'Boosts nearby unit morale',       heroClass: 'warlord',     levelRequired: 1,  effect: '+10% attack for 1 battle' },
  shield_wall:     { name: 'Shield Wall',     description: 'Forms defensive formation',       heroClass: 'warlord',     levelRequired: 3,  effect: '+20% defense for 1 battle' },
  aether_bolt:     { name: 'Aether Bolt',     description: 'Fires concentrated aether blast', heroClass: 'sage',        levelRequired: 1,  effect: 'Deals 50 damage to target' },
  mana_shield:     { name: 'Mana Shield',     description: 'Creates protective barrier',      heroClass: 'sage',        levelRequired: 3,  effect: 'Absorbs 100 damage' },
  shadow_strike:   { name: 'Shadow Strike',   description: 'Strikes from the shadows',        heroClass: 'shadowblade', levelRequired: 1,  effect: '+30% first attack damage' },
  vanish:          { name: 'Vanish',          description: 'Become invisible temporarily',    heroClass: 'shadowblade', levelRequired: 3,  effect: 'Avoid 1 combat round' },
  inspire:         { name: 'Inspire',         description: 'Inspire workers to build faster', heroClass: 'steward',     levelRequired: 1,  effect: '-10% build time' },
  trade_mastery:   { name: 'Trade Mastery',   description: 'Better trade deals',              heroClass: 'steward',     levelRequired: 3,  effect: '+20% trade value' },
};

export const EQUIPMENT_ITEMS: Record<string, { name: string; slot: 'weapon' | 'armor' | 'accessory' | 'relic'; rarity: 'common' | 'rare' | 'epic' | 'legendary'; stats: Record<string, number> }> = {
  rusty_sword:      { name: 'Rusty Sword',      slot: 'weapon',    rarity: 'common',    stats: { strength: 2 } },
  iron_blade:       { name: 'Iron Blade',        slot: 'weapon',    rarity: 'rare',      stats: { strength: 5 } },
  aether_staff:     { name: 'Aether Staff',      slot: 'weapon',    rarity: 'rare',      stats: { intellect: 5 } },
  leather_armor:    { name: 'Leather Armor',     slot: 'armor',     rarity: 'common',    stats: { endurance: 3 } },
  chainmail:        { name: 'Chainmail',         slot: 'armor',     rarity: 'rare',      stats: { endurance: 6 } },
  scout_cloak:      { name: 'Scout Cloak',       slot: 'accessory', rarity: 'common',    stats: { agility: 3 } },
  aether_pendant:   { name: 'Aether Pendant',    slot: 'accessory', rarity: 'rare',      stats: { intellect: 3, endurance: 2 } },
  elder_idol:       { name: 'Elder\'s Idol',     slot: 'relic',     rarity: 'legendary',  stats: { strength: 3, intellect: 3, agility: 3, endurance: 3 } },
};

const equipSchema = z.object({
  slot: z.enum(['weapon', 'armor', 'accessory', 'relic']),
  itemId: z.string(),
});

const unequipSchema = z.object({
  slot: z.enum(['weapon', 'armor', 'accessory', 'relic']),
});

export async function heroRoutes(app: FastifyInstance) {
  // GET / — list player's heroes
  app.get('/', { preHandler: requireAuth }, async (request) => {
    const player = request.user;
    const heroes = mockDb.getHeroesByPlayer(player.id);
    return { heroes };
  });

  // GET /abilities — available abilities for player's heroes
  app.get('/abilities', { preHandler: requireAuth }, async (request) => {
    const player = request.user;
    const heroes = mockDb.getHeroesByPlayer(player.id);

    const abilitiesByHero = heroes.map((hero) => {
      const available = Object.entries(HERO_ABILITIES)
        .filter(([, ability]) => ability.heroClass === hero.heroClass)
        .map(([id, ability]) => ({
          id,
          ...ability,
          unlocked: hero.abilities.includes(id),
          canUnlock: hero.level >= ability.levelRequired && !hero.abilities.includes(id),
        }));
      return { heroId: hero.id, heroName: hero.name, heroClass: hero.heroClass, abilities: available };
    });

    return { abilitiesByHero };
  });

  // GET /items — all equipment item configs
  app.get('/items', async () => {
    return { items: EQUIPMENT_ITEMS };
  });

  // POST /:heroId/equip — equip an item
  app.post('/:heroId/equip', { preHandler: requireAuth }, async (request, reply) => {
    const player = request.user;
    const { heroId } = request.params as { heroId: string };
    const { slot, itemId } = equipSchema.parse(request.body);

    const hero = mockDb.getHero(heroId);
    if (!hero || hero.playerId !== player.id) {
      return reply.status(404).send({ error: 'Hero not found' });
    }

    const item = EQUIPMENT_ITEMS[itemId];
    if (!item) {
      return reply.status(400).send({ error: 'Unknown item' });
    }

    if (item.slot !== slot) {
      return reply.status(400).send({ error: `Item ${itemId} is a ${item.slot}, cannot equip in ${slot} slot` });
    }

    // Unequip current item in slot (remove stats)
    const currentItemId = hero.equipment[slot];
    if (currentItemId) {
      const currentItem = EQUIPMENT_ITEMS[currentItemId];
      if (currentItem) {
        for (const [stat, value] of Object.entries(currentItem.stats)) {
          (hero.stats as Record<string, number>)[stat] = ((hero.stats as Record<string, number>)[stat] ?? 0) - value;
        }
      }
    }

    // Equip new item (apply stats)
    hero.equipment[slot] = itemId;
    for (const [stat, value] of Object.entries(item.stats)) {
      (hero.stats as Record<string, number>)[stat] = ((hero.stats as Record<string, number>)[stat] ?? 0) + value;
    }

    mockDb.updateHero(heroId, { equipment: hero.equipment, stats: hero.stats });

    return { message: `Equipped ${item.name} on ${hero.name}`, hero };
  });

  // POST /:heroId/unequip — remove equipment from slot
  app.post('/:heroId/unequip', { preHandler: requireAuth }, async (request, reply) => {
    const player = request.user;
    const { heroId } = request.params as { heroId: string };
    const { slot } = unequipSchema.parse(request.body);

    const hero = mockDb.getHero(heroId);
    if (!hero || hero.playerId !== player.id) {
      return reply.status(404).send({ error: 'Hero not found' });
    }

    const currentItemId = hero.equipment[slot];
    if (!currentItemId) {
      return reply.status(400).send({ error: `No item equipped in ${slot} slot` });
    }

    // Remove stats
    const currentItem = EQUIPMENT_ITEMS[currentItemId];
    if (currentItem) {
      for (const [stat, value] of Object.entries(currentItem.stats)) {
        (hero.stats as Record<string, number>)[stat] = ((hero.stats as Record<string, number>)[stat] ?? 0) - value;
      }
    }

    hero.equipment[slot] = null;
    mockDb.updateHero(heroId, { equipment: hero.equipment, stats: hero.stats });

    return { message: `Unequipped ${slot} from ${hero.name}`, hero };
  });
}
