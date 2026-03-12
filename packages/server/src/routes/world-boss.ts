import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { mockDb } from '../db/mock-db.js';
import { pushNotification } from './notifications.js';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Unit stats (mirrored from combat.ts for damage calculation)
// ---------------------------------------------------------------------------

const UNIT_STATS: Record<string, { attack: number; defense: number }> = {
  militia:      { attack: 10, defense: 15 },
  archer:       { attack: 18, defense: 8 },
  shieldbearer: { attack: 8,  defense: 25 },
  scout:        { attack: 3,  defense: 3 },
  siege_ram:    { attack: 40, defense: 5 },
};

// ---------------------------------------------------------------------------
// Boss type definitions
// ---------------------------------------------------------------------------

export const WORLD_BOSS_TEMPLATES: Record<string, {
  name: string;
  title: string;
  type: 'veil_titan' | 'aether_wyrm' | 'shadow_colossus';
  health: number;
  attack: number;
  defense: number;
  rewards: Record<string, number>;
}> = {
  veil_titan: {
    name: 'Veil Titan',
    title: 'Guardian of the Rift',
    type: 'veil_titan',
    health: 5000,
    attack: 200,
    defense: 100,
    rewards: { food: 5000, wood: 5000, stone: 3000, iron: 2000, aether_stone: 1000 },
  },
  aether_wyrm: {
    name: 'Aether Wyrm',
    title: 'Devourer of Leylines',
    type: 'aether_wyrm',
    health: 3000,
    attack: 350,
    defense: 80,
    rewards: { aether_stone: 3000, food: 2000, wood: 2000 },
  },
  shadow_colossus: {
    name: 'Shadow Colossus',
    title: 'The Unbound',
    type: 'shadow_colossus',
    health: 2000,
    attack: 500,
    defense: 200,
    rewards: { iron: 5000, stone: 5000, aether_stone: 500 },
  },
};

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const attackBossSchema = z.object({
  settlementId: z.string().uuid(),
  units: z.record(z.string(), z.number().int().positive()),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function worldBossRoutes(app: FastifyInstance) {
  // -----------------------------------------------------------------------
  // GET / — List all active world bosses
  // -----------------------------------------------------------------------
  app.get('/', { preHandler: requireAuth }, async () => {
    const allBosses = [...mockDb.worldBosses.values()];
    const bosses = allBosses.map((boss) => ({
      id: boss.id,
      name: boss.name,
      title: boss.title,
      type: boss.type,
      hp: boss.health,
      maxHp: boss.maxHealth,
      despawnAt: boss.expiresAt,
      defeated: boss.status === 'defeated',
      rewards: Object.entries(boss.rewards).map(([type, amount]) => ({ type, amount })),
      leaderboard: boss.attackers
        .sort((a, b) => b.damage - a.damage)
        .map((a, i) => ({ playerName: a.username, damage: a.damage, rank: i + 1 })),
    }));
    return { bosses };
  });

  // -----------------------------------------------------------------------
  // GET /:id — Get specific world boss with attacker leaderboard
  // -----------------------------------------------------------------------
  app.get('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const boss = mockDb.getWorldBoss(id);

    if (!boss) {
      return reply.status(404).send({ error: 'World boss not found' });
    }

    const leaderboard = [...boss.attackers]
      .sort((a, b) => b.damage - a.damage)
      .map((a, i) => ({ playerName: a.username, damage: a.damage, rank: i + 1 }));

    return {
      boss: {
        id: boss.id,
        name: boss.name,
        title: boss.title,
        type: boss.type,
        hp: boss.health,
        maxHp: boss.maxHealth,
        despawnAt: boss.expiresAt,
        defeated: boss.status === 'defeated',
        rewards: Object.entries(boss.rewards).map(([type, amount]) => ({ type, amount })),
        leaderboard,
      },
      attackers: leaderboard,
    };
  });

  // -----------------------------------------------------------------------
  // POST /:id/attack — Attack a world boss
  // -----------------------------------------------------------------------
  app.post('/:id/attack', { preHandler: requireAuth }, async (request, reply) => {
    const player = request.user;
    const { id } = request.params as { id: string };
    const body = attackBossSchema.parse(request.body);

    // Validate boss exists and is active
    const boss = mockDb.getWorldBoss(id);
    if (!boss || boss.status !== 'active') {
      return reply.status(404).send({ error: 'World boss not found or already defeated' });
    }

    // Validate settlement ownership
    const settlement = mockDb.getSettlement(body.settlementId);
    if (!settlement || settlement.playerId !== player.id) {
      return reply.status(404).send({ error: 'Settlement not found' });
    }

    // Validate player has enough units
    for (const [unitType, count] of Object.entries(body.units)) {
      const available = settlement.units[unitType] ?? 0;
      if (available < count) {
        return reply.status(400).send({
          error: `Not enough ${unitType}: have ${available}, need ${count}`,
        });
      }
      if (!UNIT_STATS[unitType]) {
        return reply.status(400).send({ error: `Unknown unit type: ${unitType}` });
      }
    }

    // Deduct units from settlement
    for (const [unitType, count] of Object.entries(body.units)) {
      settlement.units[unitType] = (settlement.units[unitType] ?? 0) - count;
      if (settlement.units[unitType] <= 0) {
        delete settlement.units[unitType];
      }
    }

    // ── Player attacks boss ──
    let playerAttackPower = 0;
    for (const [unitType, count] of Object.entries(body.units)) {
      const stats = UNIT_STATS[unitType];
      if (stats) {
        playerAttackPower += count * stats.attack;
      }
    }

    const bossDefenseFactor = boss.defense / (boss.defense + playerAttackPower);
    const damageDealt = Math.floor(playerAttackPower * (1 - bossDefenseFactor));

    // ── Boss retaliates ──
    let playerDefensePower = 0;
    for (const [unitType, count] of Object.entries(body.units)) {
      const stats = UNIT_STATS[unitType];
      if (stats) {
        playerDefensePower += count * stats.defense;
      }
    }

    const bossAttackRatio = boss.attack / (boss.attack + playerDefensePower);
    const unitsLost: Record<string, number> = {};
    const survivingUnits: Record<string, number> = {};

    for (const [unitType, count] of Object.entries(body.units)) {
      const lost = Math.floor(bossAttackRatio * 0.4 * count);
      unitsLost[unitType] = lost;
      const surviving = count - lost;
      if (surviving > 0) {
        survivingUnits[unitType] = surviving;
      }
    }

    // Return surviving units to settlement
    for (const [unitType, count] of Object.entries(survivingUnits)) {
      settlement.units[unitType] = (settlement.units[unitType] ?? 0) + count;
    }
    mockDb.updateSettlement(settlement.id, { units: settlement.units });

    // Apply damage to boss
    boss.health = Math.max(0, boss.health - damageDealt);

    // Track attacker damage
    const existingAttacker = boss.attackers.find((a) => a.playerId === player.id);
    if (existingAttacker) {
      existingAttacker.damage += damageDealt;
      // Accumulate unit losses
      for (const [unitType, lost] of Object.entries(unitsLost)) {
        existingAttacker.unitsLost[unitType] = (existingAttacker.unitsLost[unitType] ?? 0) + lost;
      }
    } else {
      const playerRecord = mockDb.players.get(player.id);
      boss.attackers.push({
        playerId: player.id,
        username: playerRecord?.username ?? player.username ?? 'Unknown',
        damage: damageDealt,
        unitsLost: { ...unitsLost },
      });
    }

    const response: {
      damage: number;
      unitsLost: Record<string, number>;
      bossHealth: number;
      bossMaxHealth: number;
      bossDefeated: boolean;
      rewards?: Record<string, number>;
    } = {
      damage: damageDealt,
      unitsLost,
      bossHealth: boss.health,
      bossMaxHealth: boss.maxHealth,
      bossDefeated: boss.health <= 0,
    };

    // Check if boss is defeated
    if (boss.health <= 0) {
      boss.status = 'defeated';

      // Calculate total damage dealt by all attackers
      const totalDamage = boss.attackers.reduce((sum, a) => sum + a.damage, 0);

      // Distribute rewards proportionally
      for (const attacker of boss.attackers) {
        const proportion = totalDamage > 0 ? attacker.damage / totalDamage : 0;
        const attackerRewards: Record<string, number> = {};

        for (const [resource, amount] of Object.entries(boss.rewards)) {
          attackerRewards[resource] = Math.floor(amount * proportion);
        }

        // Credit rewards to the attacker's first settlement
        const attackerSettlements = mockDb.getSettlementsByPlayer(attacker.playerId);
        if (attackerSettlements.length > 0) {
          const targetSettlement = attackerSettlements[0];
          for (const [resource, amount] of Object.entries(attackerRewards)) {
            targetSettlement.resources[resource] = (targetSettlement.resources[resource] ?? 0) + amount;
          }
          mockDb.updateSettlement(targetSettlement.id, { resources: targetSettlement.resources });
        }

        // Notify each attacker
        pushNotification(attacker.playerId, {
          type: 'system',
          title: `${boss.name} Defeated!`,
          message: `The ${boss.name} has been slain! You dealt ${attacker.damage} damage and earned rewards: ${Object.entries(attackerRewards).map(([r, a]) => `${a} ${r}`).join(', ')}`,
          data: { bossId: boss.id, rewards: attackerRewards },
        });

        // Set rewards on the response for the current player
        if (attacker.playerId === player.id) {
          response.rewards = attackerRewards;
        }
      }

      console.log(`[WorldBoss] ${boss.name} defeated! ${boss.attackers.length} attackers participated. Total damage: ${totalDamage}`);
    }

    mockDb.updateWorldBoss(boss.id, {
      health: boss.health,
      status: boss.status,
      attackers: boss.attackers,
    });

    return response;
  });
}
