import { mockDb } from '../db/mock-db.js';
import { resolveCombat, applyCombatLosses, getHeroCombatBonus } from './combat.js';
import { pushNotification } from '../routes/notifications.js';
import { tickEventRotation, getActiveEvent, incrementProgress, getHarvestMoonMultiplier } from '../routes/events.js';
import { FACTION_CONFIGS, AETHER_CYCLES, AETHER_PHASE_ORDER } from '@veilfall/shared';
import type { Faction, AetherPhase } from '@veilfall/shared';
import { WORLD_BOSS_TEMPLATES } from '../routes/world-boss.js';
import { QUEST_DEFINITIONS } from '../routes/hero-quests.js';
import { EQUIPMENT_ITEMS } from '../routes/heroes.js';
import { incrementQuestProgress } from '../routes/quests.js';
import { getIO } from '../websocket/index.js';

// ── Aether Harvest Cycle State ──
let aetherPhaseIndex = 0;
let aetherCyclePhase: AetherPhase = 'dormant';
let aetherCycleChangedAt = Date.now();

function getAetherMultiplier(): number {
  return AETHER_CYCLES[aetherCyclePhase].yieldMultiplier;
}

export function getAetherCycle() {
  const duration = AETHER_CYCLES[aetherCyclePhase].durationMs;
  return {
    phase: aetherCyclePhase,
    changedAt: aetherCycleChangedAt,
    nextChangeAt: aetherCycleChangedAt + duration,
    surgeMultiplier: AETHER_CYCLES.surge.yieldMultiplier,
  };
}

const RESOURCE_RATES: Record<string, Record<string, number>> = {
  gathering_post:   { food: 30 },
  woodcutter_lodge: { wood: 25 },
  stone_quarry:     { stone: 20 },
  iron_mine:        { iron: 15 },
  aether_extractor: { aether_stone: 5 },
};

const HERO_CLASS_ABILITIES: Record<string, string[]> = {
  warlord:     ['rally_cry', 'shield_wall'],
  sage:        ['aether_bolt', 'mana_shield'],
  shadowblade: ['shadow_strike', 'vanish'],
  steward:     ['inspire', 'trade_mastery'],
};

const MAP_EVENT_NAMES: Record<string, string[]> = {
  ruin:          ['Forgotten Temple', 'Collapsed Bastion', 'Ancient Library', 'Sunken Vault'],
  resource_node: ['Rich Vein', 'Fertile Grove', 'Crystal Deposit', 'Iron Outcrop'],
  npc_camp:      ['Bandit Hideout', 'Goblin Camp', 'Raider Outpost', 'Marauder Den'],
  aether_surge:  ['Aether Rift', 'Mana Wellspring', 'Leyline Convergence', 'Arcane Fissure'],
};

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function processHeroXp(playerId: string, marchId: string, xpGained: number): { id: string; name: string; xpGained: number } | undefined {
  // Find an idle hero belonging to this player (first available)
  const heroes = mockDb.getHeroesByPlayer(playerId);
  const hero = heroes.find((h) => h.status === 'idle' || h.status === 'marching');
  if (!hero) return undefined;

  const oldLevel = hero.level;
  hero.xp += xpGained;

  // Level threshold: level * 100 * (1 + level * 0.05) XP per level
  const xpForLevel = (lvl: number) => Math.floor(lvl * 100 * (1 + lvl * 0.05));
  let leveledUp = false;
  while (hero.xp >= xpForLevel(hero.level)) {
    hero.xp -= xpForLevel(hero.level);
    hero.level += 1;
    leveledUp = true;

    // +1 to a random stat
    const statKeys: Array<keyof typeof hero.stats> = ['strength', 'intellect', 'agility', 'endurance'];
    const randomStat = statKeys[Math.floor(Math.random() * statKeys.length)];
    hero.stats[randomStat] += 1;
  }

  // Auto-unlock class abilities at levels 1 and 3
  const classAbilities = HERO_CLASS_ABILITIES[hero.heroClass] ?? [];
  if (hero.level >= 1 && classAbilities[0] && !hero.abilities.includes(classAbilities[0])) {
    hero.abilities.push(classAbilities[0]);
  }
  if (hero.level >= 3 && classAbilities[1] && !hero.abilities.includes(classAbilities[1])) {
    hero.abilities.push(classAbilities[1]);
  }

  mockDb.updateHero(hero.id, {
    xp: hero.xp,
    level: hero.level,
    stats: hero.stats,
    abilities: hero.abilities,
  });

  if (leveledUp) {
    console.log(`[GameLoop] Hero ${hero.name} leveled up to ${hero.level} (was ${oldLevel})`);
  }

  return { id: hero.id, name: hero.name, xpGained };
}

function spawnMapEvents() {
  const activeEvents = mockDb.getActiveMapEvents();
  if (activeEvents.length >= 15) return;

  const now = Date.now();
  const FORTY_FIVE_MINUTES = 45 * 60 * 1000;
  const count = 1; // v2: 1 event per spawn tick instead of 1-3

  for (let i = 0; i < count; i++) {
    if (activeEvents.length + i >= 15) break;

    const roll = Math.random();
    let type: 'ruin' | 'resource_node' | 'npc_camp' | 'aether_surge';
    if (roll < 0.4) type = 'ruin';
    else if (roll < 0.7) type = 'resource_node';
    else if (roll < 0.9) type = 'npc_camp';
    else type = 'aether_surge';

    const q = randomInt(-15, 15);
    const r = randomInt(-15, 15);

    // Skip if there's already an event at this location
    if (mockDb.getMapEventAt(q, r)) continue;

    const names = MAP_EVENT_NAMES[type];
    const name = names[Math.floor(Math.random() * names.length)];

    let rewards: Record<string, number> = {};
    let guardians: Record<string, number> | undefined;
    let description: string;

    switch (type) {
      case 'ruin':
        guardians = { militia: randomInt(3, 5) };
        rewards = {
          food: randomInt(100, 400),
          wood: randomInt(100, 250),
          stone: randomInt(50, 150),
        };
        description = `An ancient ruin guarded by ${guardians.militia} militia. Rich with forgotten treasures.`;
        break;
      case 'resource_node': {
        const resTypes = ['food', 'wood', 'stone', 'iron'];
        const resType = resTypes[Math.floor(Math.random() * resTypes.length)];
        rewards = { [resType]: randomInt(150, 600) };
        description = `A rich deposit of ${resType} waiting to be harvested.`;
        break;
      }
      case 'npc_camp':
        guardians = {
          militia: randomInt(5, 8),
          archer: randomInt(2, 4),
        };
        rewards = {
          food: randomInt(150, 500),
          wood: randomInt(100, 350),
          iron: randomInt(50, 150),
        };
        description = `A hostile camp with ${guardians.militia} militia and ${guardians.archer} archers. Defeat them for substantial rewards.`;
        break;
      case 'aether_surge':
        rewards = { aether_stone: randomInt(30, 150) };
        description = 'A surge of raw aether energy. Claim it before it dissipates.';
        break;
    }

    mockDb.addMapEvent({
      id: crypto.randomUUID(),
      type,
      q,
      r,
      name,
      description,
      rewards,
      guardians,
      status: 'active',
      expiresAt: now + FORTY_FIVE_MINUTES,
      createdAt: now,
    });

    console.log(`[GameLoop] Spawned map event: ${name} (${type}) at (${q},${r})`);
  }
}

function expireMapEvents() {
  const now = Date.now();
  for (const event of mockDb.getActiveMapEvents()) {
    if (event.expiresAt <= now) {
      mockDb.updateMapEvent(event.id, { status: 'expired' });
      console.log(`[GameLoop] Map event expired: ${event.name} at (${event.q},${event.r})`);
    }
  }
}

export function startGameLoop() {
  // Economy tick — every 15 seconds
  setInterval(() => {
    const harvestMoonMultiplier = getHarvestMoonMultiplier();
    const activeEvent = getActiveEvent();

    for (const settlement of mockDb.settlements.values()) {
      // Look up player faction for resource gather multiplier
      const player = mockDb.players.get(settlement.playerId);
      const factionConfig = player ? FACTION_CONFIGS[player.faction as Faction] : undefined;
      const gatherMultiplier = factionConfig?.bonuses.resourceGatherMultiplier ?? 1.0;

      let resourcesGatheredThisTick = 0;

      for (const building of settlement.buildings) {
        const rates = RESOURCE_RATES[building.type];
        if (rates) {
          for (const [res, rate] of Object.entries(rates)) {
            // rate is per hour, tick is 15s -> /240, apply faction multiplier
            // Apply aether surge multiplier to aether_stone during surge phase
            const aetherMultiplier = (res === 'aether_stone') ? getAetherMultiplier() : 1;
            const effectiveLevel = Math.pow(building.level, 0.85);
            const produced = (rate * effectiveLevel * gatherMultiplier * aetherMultiplier * harvestMoonMultiplier) / 240;
            settlement.resources[res] = (settlement.resources[res] ?? 0) + produced;

            // Track resources gathered for harvest_moon event (food, wood, stone, iron only)
            if (activeEvent?.type === 'harvest_moon' && ['food', 'wood', 'stone', 'iron'].includes(res)) {
              resourcesGatheredThisTick += produced;
            }
          }
        }
      }

      // Increment harvest_moon event progress
      if (activeEvent?.type === 'harvest_moon' && resourcesGatheredThisTick > 0) {
        incrementProgress(settlement.playerId, resourcesGatheredThisTick);
      }

      // Broadcast resource update via WebSocket
      const io = getIO();
      if (io) {
        io.to(`player:${settlement.playerId}`).emit('resources:update', {
          settlementId: settlement.id,
          resources: { ...settlement.resources },
        });
      }
    }
  }, 15_000);

  // Building queue processor — every 5 seconds
  setInterval(() => {
    const now = Date.now();
    for (const settlement of mockDb.settlements.values()) {
      const completed: number[] = [];
      settlement.buildQueue.forEach((item, idx) => {
        if (item.endsAt <= now) {
          completed.push(idx);
          const existing = settlement.buildings.find((b) => b.type === item.type);
          const isUpgrade = !!existing;
          if (existing) {
            existing.level = item.targetLevel;
          } else {
            settlement.buildings.push({ type: item.type, level: item.targetLevel, position: settlement.buildings.length });
          }
          if (item.type === 'town_center') settlement.level = item.targetLevel;

          mockDb.addEvent({
            id: crypto.randomUUID(),
            playerId: settlement.playerId,
            type: isUpgrade ? 'building_upgrade' : 'building_complete',
            title: isUpgrade ? `${item.type} upgraded` : `${item.type} built`,
            description: isUpgrade
              ? `${item.type} upgraded to level ${item.targetLevel} in ${settlement.name}`
              : `${item.type} construction completed in ${settlement.name}`,
            timestamp: now,
            data: { buildingType: item.type, level: item.targetLevel, settlementId: settlement.id },
          });

          pushNotification(settlement.playerId, {
            type: 'building_complete',
            title: isUpgrade ? `${item.type} Upgraded` : `${item.type} Built`,
            message: isUpgrade
              ? `${item.type} upgraded to level ${item.targetLevel} in ${settlement.name}`
              : `${item.type} construction completed in ${settlement.name}`,
          });

          // Track aether_storm event progress (build or upgrade counts as 1)
          const currentEvent = getActiveEvent();
          if (currentEvent?.type === 'aether_storm') {
            incrementProgress(settlement.playerId, 1);
          }

          console.log(`[GameLoop] ${settlement.name}: ${item.type} -> Lv${item.targetLevel}`);
        }
      });
      for (const idx of completed.reverse()) {
        settlement.buildQueue.splice(idx, 1);
      }
    }
  }, 5_000);

  // Train queue processor — every 5 seconds
  setInterval(() => {
    const now = Date.now();
    for (const settlement of mockDb.settlements.values()) {
      const completed: number[] = [];
      settlement.trainQueue.forEach((item, idx) => {
        if (item.endsAt <= now) {
          completed.push(idx);
          settlement.units[item.unitType] = (settlement.units[item.unitType] ?? 0) + item.count;

          mockDb.addEvent({
            id: crypto.randomUUID(),
            playerId: settlement.playerId,
            type: 'unit_trained',
            title: `${item.count} ${item.unitType} trained`,
            description: `${item.count} ${item.unitType} finished training in ${settlement.name}`,
            timestamp: now,
            data: { unitType: item.unitType, count: item.count, settlementId: settlement.id },
          });

          pushNotification(settlement.playerId, {
            type: 'unit_trained',
            title: `${item.count} ${item.unitType} Trained`,
            message: `${item.count} ${item.unitType} finished training in ${settlement.name}`,
          });

          // Track ironclad_tournament event progress (count of units trained)
          const trainEvent = getActiveEvent();
          if (trainEvent?.type === 'ironclad_tournament') {
            incrementProgress(settlement.playerId, item.count);
          }

          // Track quest progress for unit training
          incrementQuestProgress(settlement.playerId, 'train', item.unitType, item.count);

          console.log(`[GameLoop] ${settlement.name}: trained ${item.count} ${item.unitType}`);
        }
      });
      for (const idx of completed.reverse()) {
        settlement.trainQueue.splice(idx, 1);
      }
    }
  }, 5_000);

  // March processor — every 10 seconds
  setInterval(() => {
    const now = Date.now();
    for (const march of mockDb.marches.values()) {
      if (march.status === 'marching' && march.arrivedAt <= now) {
        if (march.type === 'scout') {
          // Scout arrives — mark returning
          const returnTime = march.arrivedAt - march.startedAt;
          mockDb.updateMarch(march.id, {
            status: 'returning',
            arrivedAt: now + returnTime,
          });

          mockDb.addEvent({
            id: crypto.randomUUID(),
            playerId: march.playerId,
            type: 'march_sent',
            title: `Scout arrived`,
            description: `Scout march arrived at (${march.toQ},${march.toR}), returning home`,
            timestamp: now,
            data: { marchId: march.id, marchType: march.type, toQ: march.toQ, toR: march.toR },
          });

          // Track quest progress for scout missions
          incrementQuestProgress(march.playerId, 'scout', 'any', 1);

          console.log(`[GameLoop] Scout march ${march.id} arrived at (${march.toQ},${march.toR}), returning`);
        } else if (march.type === 'attack') {
          // ── Combat Resolution ──
          const returnTime = march.arrivedAt - march.startedAt;

          // Check for map event at target location
          const mapEvent = mockDb.getMapEventAt(march.toQ, march.toR);

          // Check for defender settlement at target coordinates
          let defenderSettlement: ReturnType<typeof mockDb.getSettlement> | undefined;
          for (const s of mockDb.settlements.values()) {
            if (s.q === march.toQ && s.r === march.toR && s.playerId !== march.playerId) {
              defenderSettlement = s;
              break;
            }
          }

          let defenderUnits: Record<string, number>;
          let defenderId: string | null = null;

          if (defenderSettlement) {
            // PvP combat against settlement
            defenderUnits = { ...defenderSettlement.units };
            defenderId = defenderSettlement.playerId;
          } else if (mapEvent && mapEvent.guardians && Object.keys(mapEvent.guardians).length > 0) {
            // Map event with guardians
            defenderUnits = { ...mapEvent.guardians };
          } else if (mapEvent && (!mapEvent.guardians || Object.keys(mapEvent.guardians).length === 0)) {
            // Map event with no guardians — auto-claim
            const settlement = mockDb.getSettlement(march.settlementId);
            if (settlement) {
              for (const [res, amount] of Object.entries(mapEvent.rewards)) {
                settlement.resources[res] = (settlement.resources[res] ?? 0) + amount;
              }
              mockDb.updateSettlement(settlement.id, { resources: settlement.resources });
            }
            mockDb.updateMapEvent(mapEvent.id, { status: 'claimed', discoveredBy: march.playerId });

            const heroResult = processHeroXp(march.playerId, march.id, 25);

            mockDb.addEvent({
              id: crypto.randomUUID(),
              playerId: march.playerId,
              type: 'lore_discovered',
              title: `Claimed ${mapEvent.name}`,
              description: `Your forces claimed ${mapEvent.name} at (${march.toQ},${march.toR}) and recovered resources.`,
              timestamp: now,
              data: { marchId: march.id, eventId: mapEvent.id, rewards: mapEvent.rewards },
            });

            mockDb.updateMarch(march.id, {
              status: 'returning',
              arrivedAt: now + returnTime,
            });

            console.log(`[GameLoop] March ${march.id} claimed map event ${mapEvent.name} at (${march.toQ},${march.toR})`);
            continue;
          } else {
            // Empty tile — NPC garrison
            defenderUnits = {
              militia: randomInt(3, 5),
              archer: randomInt(1, 2),
            };
          }

          // Resolve combat
          let attackerBonus = 1.0;
          let defenderBonus = 1.0;

          // Apply hero combat bonus if hero is attached
          if (march.heroId) {
            const hero = mockDb.getHero(march.heroId);
            if (hero) {
              const heroBonus = getHeroCombatBonus(hero);
              attackerBonus = heroBonus.attackBonus;
            }
          }
          const result = resolveCombat(
            { ...march.units },
            defenderUnits,
            attackerBonus,
            defenderBonus,
          );

          const survivingAttacker = applyCombatLosses(march.units, result.attackerLosses);
          const survivingDefender = applyCombatLosses(defenderUnits, result.defenderLosses);

          // XP for hero
          const xpGained = result.winner === 'attacker' ? 50 : 20;
          const heroResult = processHeroXp(march.playerId, march.id, xpGained);

          // Create battle report
          const report = mockDb.addBattleReport({
            id: crypto.randomUUID(),
            attackerId: march.playerId,
            defenderId,
            location: { q: march.toQ, r: march.toR },
            timestamp: now,
            attackerUnits: { ...march.units },
            defenderUnits,
            attackerLosses: result.attackerLosses,
            defenderLosses: result.defenderLosses,
            winner: result.winner,
            loot: result.loot,
            heroInvolved: heroResult,
          });

          // Apply results
          if (defenderSettlement) {
            // Update defender settlement units
            mockDb.updateSettlement(defenderSettlement.id, { units: survivingDefender });

            // Add loot to attacker settlement if won
            if (result.winner === 'attacker') {
              const attackerSettlement = mockDb.getSettlement(march.settlementId);
              if (attackerSettlement) {
                for (const [res, amount] of Object.entries(result.loot)) {
                  attackerSettlement.resources[res] = (attackerSettlement.resources[res] ?? 0) + amount;
                }
                mockDb.updateSettlement(attackerSettlement.id, { resources: attackerSettlement.resources });
              }
            }

            // Defender event
            mockDb.addEvent({
              id: crypto.randomUUID(),
              playerId: defenderSettlement.playerId,
              type: 'combat',
              title: `Settlement attacked!`,
              description: `Your settlement at (${march.toQ},${march.toR}) was attacked. Result: ${result.winner === 'attacker' ? 'defeat' : 'victory'}`,
              timestamp: now,
              data: { reportId: report.id, winner: result.winner },
            });
          }

          // Handle map event claim on victory
          if (mapEvent && result.winner === 'attacker') {
            const settlement = mockDb.getSettlement(march.settlementId);
            if (settlement) {
              for (const [res, amount] of Object.entries(mapEvent.rewards)) {
                settlement.resources[res] = (settlement.resources[res] ?? 0) + amount;
              }
              mockDb.updateSettlement(settlement.id, { resources: settlement.resources });
            }
            mockDb.updateMapEvent(mapEvent.id, { status: 'claimed', discoveredBy: march.playerId });
          }

          // Set march to returning with surviving attacker units
          mockDb.updateMarch(march.id, {
            status: 'returning',
            units: survivingAttacker,
            arrivedAt: now + returnTime,
          });

          // Attacker event
          mockDb.addEvent({
            id: crypto.randomUUID(),
            playerId: march.playerId,
            type: 'combat',
            title: result.winner === 'attacker' ? 'Attack successful' : 'Attack failed',
            description: `Attack at (${march.toQ},${march.toR}): ${result.winner}. Losses: ${JSON.stringify(result.attackerLosses)}`,
            timestamp: now,
            data: { marchId: march.id, reportId: report.id, winner: result.winner, loot: result.loot },
          });

          pushNotification(march.playerId, {
            type: 'combat_result',
            title: result.winner === 'attacker' ? 'Victory!' : 'Defeat',
            message: `Your attack at (${march.toQ},${march.toR}) ${result.winner === 'attacker' ? 'was successful' : 'failed'}`,
            data: { reportId: report.id },
          });

          // Track quest progress for march/attack
          incrementQuestProgress(march.playerId, 'march', 'any', 1);

          console.log(`[GameLoop] Combat at (${march.toQ},${march.toR}): ${result.winner} wins. Report: ${report.id}`);
        } else if (march.type === 'reinforce') {
          // Reinforce: just mark arrived
          mockDb.updateMarch(march.id, { status: 'arrived' });

          mockDb.addEvent({
            id: crypto.randomUUID(),
            playerId: march.playerId,
            type: 'march_sent',
            title: `Reinforcements arrived`,
            description: `Reinforcement march arrived at (${march.toQ},${march.toR})`,
            timestamp: now,
            data: { marchId: march.id, marchType: march.type, toQ: march.toQ, toR: march.toR },
          });

          console.log(`[GameLoop] Reinforce march ${march.id} arrived at (${march.toQ},${march.toR})`);
        }
      } else if (march.status === 'returning' && march.arrivedAt <= now) {
        // Return units to settlement
        const settlement = mockDb.getSettlement(march.settlementId);
        if (settlement) {
          for (const [unitType, count] of Object.entries(march.units)) {
            settlement.units[unitType] = (settlement.units[unitType] ?? 0) + count;
          }
          mockDb.updateSettlement(settlement.id, { units: settlement.units });

          mockDb.addEvent({
            id: crypto.randomUUID(),
            playerId: march.playerId,
            type: 'march_returned',
            title: `March returned`,
            description: `March returned to ${settlement.name}`,
            timestamp: now,
            data: { marchId: march.id, settlementId: settlement.id },
          });

          console.log(`[GameLoop] March ${march.id} returned to ${settlement.name}`);
        }
        mockDb.deleteMarch(march.id);
        if (march.heroId) {
          mockDb.updateHero(march.heroId, { status: 'idle' });
        }
      }
    }
  }, 10_000);

  // Spy mission processor — every 10 seconds
  setInterval(() => {
    const now = Date.now();
    for (const mission of mockDb.spyMissions.values()) {
      if (mission.status !== 'infiltrating' || mission.arrivedAt > now) continue;

      const targetSettlement = mockDb.getSettlement(mission.targetSettlementId);
      if (!targetSettlement) {
        mockDb.updateSpyMission(mission.id, { status: 'failed', completedAt: now });
        continue;
      }

      // Attacker spy guild level
      const sourceSettlement = mockDb.getSettlement(mission.settlementId);
      const attackerSpyGuild = sourceSettlement?.buildings.find((b) => b.type === 'spy_guild');
      const attackerSpyLevel = attackerSpyGuild?.level ?? 1;

      // Defender counter-intelligence (spy_guild in target)
      const defenderSpyGuild = targetSettlement.buildings.find((b) => b.type === 'spy_guild');
      const defenderSpyLevel = defenderSpyGuild?.level ?? 0;

      if (mission.type === 'intel') {
        // Intel: 65% base + 4% per spy_guild level, capped at 90%, minus 8% per defender spy_guild level
        const successChance = Math.min(0.65 + attackerSpyLevel * 0.04, 0.90) - defenderSpyLevel * 0.08;
        const roll = Math.random();

        if (roll < successChance) {
          // Success — gather intelligence
          const result = {
            resources: { ...targetSettlement.resources },
            buildings: targetSettlement.buildings.map((b) => ({ type: b.type, level: b.level })),
            units: { ...targetSettlement.units },
          };

          // Round resource values for readability
          for (const key of Object.keys(result.resources)) {
            result.resources[key] = Math.floor(result.resources[key]);
          }

          mockDb.updateSpyMission(mission.id, {
            status: 'completed',
            completedAt: now,
            result,
          });

          pushNotification(mission.playerId, {
            type: 'system',
            title: 'Spy Mission Successful',
            message: `Your intel spy mission at (${targetSettlement.q},${targetSettlement.r}) was successful. View the report for details.`,
            data: { missionId: mission.id },
          });

          console.log(`[GameLoop] Spy intel mission ${mission.id} succeeded at (${targetSettlement.q},${targetSettlement.r})`);
        } else {
          // Caught
          mockDb.updateSpyMission(mission.id, { status: 'caught', completedAt: now });

          pushNotification(mission.playerId, {
            type: 'system',
            title: 'Spy Mission Failed',
            message: `Your intel spy mission at (${targetSettlement.q},${targetSettlement.r}) failed — your spy was caught!`,
            data: { missionId: mission.id },
          });

          pushNotification(mission.targetPlayerId, {
            type: 'system',
            title: 'Enemy Spy Caught!',
            message: `An enemy spy was caught in ${targetSettlement.name}!`,
          });

          console.log(`[GameLoop] Spy intel mission ${mission.id} caught at (${targetSettlement.q},${targetSettlement.r})`);
        }
      } else if (mission.type === 'sabotage') {
        // Sabotage: 45% base + 4% per spy_guild level, capped at 75%, minus 8% per defender spy_guild level
        const successChance = Math.min(0.45 + attackerSpyLevel * 0.04, 0.75) - defenderSpyLevel * 0.08;
        const roll = Math.random();

        if (roll < successChance) {
          // Success — pick a random building and reduce its level by 1 (min 1)
          const eligibleBuildings = targetSettlement.buildings.filter((b) => b.level > 1 && b.type !== 'town_center');

          if (eligibleBuildings.length > 0) {
            const target = eligibleBuildings[Math.floor(Math.random() * eligibleBuildings.length)];
            const oldLevel = target.level;
            target.level = Math.max(target.level - 1, 1);
            mockDb.updateSettlement(targetSettlement.id, { buildings: targetSettlement.buildings });

            const result = {
              sabotaged: { buildingType: target.type, levelsLost: oldLevel - target.level },
            };

            mockDb.updateSpyMission(mission.id, {
              status: 'completed',
              completedAt: now,
              result,
            });

            pushNotification(mission.playerId, {
              type: 'system',
              title: 'Sabotage Successful',
              message: `Your sabotage mission at (${targetSettlement.q},${targetSettlement.r}) succeeded! ${target.type} reduced by 1 level.`,
              data: { missionId: mission.id },
            });

            pushNotification(mission.targetPlayerId, {
              type: 'system',
              title: 'Building Sabotaged!',
              message: `Your ${target.type} in ${targetSettlement.name} was sabotaged and lost a level!`,
            });

            console.log(`[GameLoop] Spy sabotage mission ${mission.id} succeeded — ${target.type} Lv${oldLevel} -> Lv${target.level}`);
          } else {
            // No building eligible (all level 1) — mission completes with no effect
            mockDb.updateSpyMission(mission.id, {
              status: 'completed',
              completedAt: now,
              result: { sabotaged: { buildingType: 'none', levelsLost: 0 } },
            });

            pushNotification(mission.playerId, {
              type: 'system',
              title: 'Sabotage — No Target',
              message: `Your sabotage mission at (${targetSettlement.q},${targetSettlement.r}) found no buildings worth sabotaging.`,
              data: { missionId: mission.id },
            });

            console.log(`[GameLoop] Spy sabotage mission ${mission.id} — no eligible buildings at (${targetSettlement.q},${targetSettlement.r})`);
          }
        } else {
          // Caught
          mockDb.updateSpyMission(mission.id, { status: 'caught', completedAt: now });

          pushNotification(mission.playerId, {
            type: 'system',
            title: 'Sabotage Failed',
            message: `Your sabotage mission at (${targetSettlement.q},${targetSettlement.r}) failed — your spy was caught!`,
            data: { missionId: mission.id },
          });

          pushNotification(mission.targetPlayerId, {
            type: 'system',
            title: 'Enemy Spy Caught!',
            message: `An enemy spy was caught in ${targetSettlement.name}!`,
          });

          console.log(`[GameLoop] Spy sabotage mission ${mission.id} caught at (${targetSettlement.q},${targetSettlement.r})`);
        }
      }
    }
  }, 10_000);

  // Research queue processor — every 5 seconds
  setInterval(() => {
    const now = Date.now();
    for (const settlement of mockDb.settlements.values()) {
      if (settlement.researchQueue && settlement.researchQueue.endsAt <= now) {
        const { type, level } = settlement.researchQueue;
        settlement.researched[type] = level;
        settlement.researchQueue = null;

        mockDb.addEvent({
          id: crypto.randomUUID(),
          playerId: settlement.playerId,
          type: 'quest_complete',
          title: `Research complete: ${type}`,
          description: `${type} research reached level ${level} in ${settlement.name}`,
          timestamp: now,
          data: { researchType: type, level, settlementId: settlement.id },
        });

        pushNotification(settlement.playerId, {
          type: 'research_complete',
          title: `Research Complete: ${type}`,
          message: `${type} research reached level ${level} in ${settlement.name}`,
        });

        console.log(`[GameLoop] ${settlement.name}: researched ${type} -> Lv${level}`);
      }
    }
  }, 5_000);

  // Map event spawner — every 120 seconds
  setInterval(() => {
    spawnMapEvents();
    expireMapEvents();
  }, 120_000);

  // Aether Harvest Cycle — check every 15 seconds (4-phase: dormant → rising → surge → fading)
  setInterval(() => {
    const now = Date.now();
    const duration = AETHER_CYCLES[aetherCyclePhase].durationMs;

    if (now >= aetherCycleChangedAt + duration) {
      aetherPhaseIndex = (aetherPhaseIndex + 1) % AETHER_PHASE_ORDER.length;
      aetherCyclePhase = AETHER_PHASE_ORDER[aetherPhaseIndex];
      aetherCycleChangedAt = now;

      const multiplier = AETHER_CYCLES[aetherCyclePhase].yieldMultiplier;
      console.log(`[GameLoop] Aether Harvest Cycle: ${aetherCyclePhase.toUpperCase()} phase — aether multiplier x${multiplier}`);

      for (const player of mockDb.players.values()) {
        pushNotification(player.id, {
          type: 'aether_cycle',
          title: `Aether Phase: ${aetherCyclePhase.charAt(0).toUpperCase() + aetherCyclePhase.slice(1)}`,
          message: `Aether production is now x${multiplier}.`,
        });
      }
    }
  }, 15_000);

  // Seasonal event rotation — every 30 seconds check for expiry/rotation
  setInterval(() => {
    tickEventRotation();
  }, 30_000);

  // World Boss spawner — every 120 seconds
  const WORLD_BOSS_EXPIRE_MS = 20 * 60 * 1000; // 20 minutes
  const WORLD_BOSS_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
  let lastBossDespawnedAt: number | null = null;
  const bossTypeKeys = Object.keys(WORLD_BOSS_TEMPLATES);

  function tickWorldBosses() {
    const now = Date.now();

    // Expire bosses that have exceeded their lifetime
    for (const boss of mockDb.getActiveWorldBosses()) {
      if (now >= boss.expiresAt) {
        mockDb.updateWorldBoss(boss.id, { status: 'despawned' });
        lastBossDespawnedAt = now;
        console.log(`[WorldBoss] ${boss.name} despawned — time expired at (${boss.q},${boss.r})`);

        for (const player of mockDb.players.values()) {
          pushNotification(player.id, {
            type: 'system',
            title: `${boss.name} Vanished`,
            message: `The ${boss.name} at (${boss.q},${boss.r}) has retreated into the veil.`,
          });
        }
      }
    }

    // Spawn a new boss if none are active
    const activeBosses = mockDb.getActiveWorldBosses();
    if (lastBossDespawnedAt && now - lastBossDespawnedAt < WORLD_BOSS_COOLDOWN_MS) return; // skip spawn during cooldown
    if (activeBosses.length === 0) {
      const typeKey = bossTypeKeys[Math.floor(Math.random() * bossTypeKeys.length)];
      const template = WORLD_BOSS_TEMPLATES[typeKey];

      const q = randomInt(-12, 12);
      const r = randomInt(-12, 12);

      const boss = mockDb.createWorldBoss({
        id: crypto.randomUUID(),
        name: template.name,
        title: template.title,
        type: template.type,
        q,
        r,
        health: template.health,
        maxHealth: template.health,
        attack: template.attack,
        defense: template.defense,
        rewards: { ...template.rewards },
        status: 'active',
        spawnedAt: now,
        expiresAt: now + WORLD_BOSS_EXPIRE_MS,
        attackers: [],
      });

      console.log(`[WorldBoss] ${boss.name} "${boss.title}" spawned at (${q},${r}) with ${boss.maxHealth} HP`);

      for (const player of mockDb.players.values()) {
        pushNotification(player.id, {
          type: 'system',
          title: `${boss.name} Has Appeared!`,
          message: `A ${boss.name} has appeared at (${q},${r})! Rally your forces to defeat it!`,
          data: { bossId: boss.id, q, r },
        });
      }
    }
  }

  // Spawn first boss immediately, then check every 120 seconds
  tickWorldBosses();
  setInterval(tickWorldBosses, 120_000);

  // Hero quest processor — every 5 seconds
  setInterval(() => {
    const now = Date.now();
    for (const quest of mockDb.heroQuests.values()) {
      if (quest.status !== 'active' || quest.endsAt > now) continue;

      const hero = mockDb.getHero(quest.heroId);
      if (!hero) {
        mockDb.updateHeroQuest(quest.id, { status: 'failed' });
        continue;
      }

      const definition = QUEST_DEFINITIONS[quest.questType];
      if (!definition) {
        mockDb.updateHeroQuest(quest.id, { status: 'failed' });
        mockDb.updateHero(hero.id, { status: 'idle' });
        continue;
      }

      // Success chance: 60% + (hero.level * 3%) + (hero.stats.agility * 1%) - (difficulty * 10%), cap 95%
      const successChance = Math.min(
        0.60 + hero.level * 0.03 + hero.stats.agility * 0.01 - quest.difficulty * 0.10,
        0.95,
      );
      const roll = Math.random();
      const success = roll < successChance;

      if (success) {
        // Generate rewards
        const xp = randomInt(definition.rewards.xpMin, definition.rewards.xpMax);
        const resources: Record<string, number> = {};

        if (definition.rewards.resources) {
          for (const [res, [min, max]] of Object.entries(definition.rewards.resources)) {
            resources[res] = randomInt(min, max);
          }
        }

        let equipment: string | undefined;
        let loreFragment: string | undefined;

        // Relic hunt: 20% chance for equipment
        if (quest.questType === 'relic_hunt' && definition.rewards.equipmentChance) {
          if (Math.random() < definition.rewards.equipmentChance) {
            const itemKeys = Object.keys(EQUIPMENT_ITEMS);
            equipment = itemKeys[Math.floor(Math.random() * itemKeys.length)];
          }
        }

        // Veil expedition: 30% chance for lore fragment
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

        if (quest.questType === 'veil_expedition' && definition.rewards.loreChance) {
          if (Math.random() < definition.rewards.loreChance) {
            loreFragment = LORE_FRAGMENTS[Math.floor(Math.random() * LORE_FRAGMENTS.length)];
          }
        }

        const rewards = { xp, resources, equipment, loreFragment };

        // Grant XP to hero
        const xpForLevel = (lvl: number) => Math.floor(lvl * 100 * (1 + lvl * 0.05));
        const oldLevel = hero.level;
        hero.xp += xp;
        let leveledUp = false;
        while (hero.xp >= xpForLevel(hero.level)) {
          hero.xp -= xpForLevel(hero.level);
          hero.level += 1;
          leveledUp = true;
          const statKeys: Array<keyof typeof hero.stats> = ['strength', 'intellect', 'agility', 'endurance'];
          const randomStat = statKeys[Math.floor(Math.random() * statKeys.length)];
          hero.stats[randomStat] += 1;
        }

        mockDb.updateHero(hero.id, {
          xp: hero.xp,
          level: hero.level,
          stats: hero.stats,
          status: 'idle',
        });

        if (leveledUp) {
          console.log(`[HeroQuest] Hero ${hero.name} leveled up to ${hero.level} (was ${oldLevel}) from quest`);
        }

        // Add resources to player's first settlement
        if (Object.keys(resources).length > 0) {
          const settlements = mockDb.getSettlementsByPlayer(quest.playerId);
          if (settlements.length > 0) {
            const settlement = settlements[0];
            for (const [res, amount] of Object.entries(resources)) {
              settlement.resources[res] = (settlement.resources[res] ?? 0) + amount;
            }
            mockDb.updateSettlement(settlement.id, { resources: settlement.resources });
          }
        }

        mockDb.updateHeroQuest(quest.id, { status: 'completed', rewards });

        // Push notification
        let notifMessage = `${hero.name} completed a ${definition.name} quest! Gained ${xp} XP.`;
        if (equipment) {
          const item = EQUIPMENT_ITEMS[equipment];
          notifMessage += ` Found ${item?.name ?? equipment}!`;
        }
        if (loreFragment) {
          notifMessage += ' Discovered a lore fragment!';
        }

        pushNotification(quest.playerId, {
          type: 'system',
          title: `Quest Complete: ${definition.name}`,
          message: notifMessage,
          data: { questId: quest.id, heroId: hero.id, rewards },
        });

        // Add chronicle event
        mockDb.addEvent({
          id: crypto.randomUUID(),
          playerId: quest.playerId,
          type: 'quest_complete',
          title: `${hero.name} completed ${definition.name}`,
          description: notifMessage,
          timestamp: now,
          data: { questId: quest.id, heroId: hero.id, questType: quest.questType, rewards },
        });

        console.log(`[HeroQuest] ${hero.name} completed ${quest.questType} quest — ${xp} XP${equipment ? `, equipment: ${equipment}` : ''}${loreFragment ? ', lore fragment' : ''}`);
      } else {
        // Failed — consolation XP (20% of normal range)
        const consolationXp = Math.floor(randomInt(definition.rewards.xpMin, definition.rewards.xpMax) * 0.2);

        const xpForLevel = (lvl: number) => Math.floor(lvl * 100 * (1 + lvl * 0.05));
        hero.xp += consolationXp;
        while (hero.xp >= xpForLevel(hero.level)) {
          hero.xp -= xpForLevel(hero.level);
          hero.level += 1;
          const statKeys: Array<keyof typeof hero.stats> = ['strength', 'intellect', 'agility', 'endurance'];
          const randomStat = statKeys[Math.floor(Math.random() * statKeys.length)];
          hero.stats[randomStat] += 1;
        }

        mockDb.updateHero(hero.id, {
          xp: hero.xp,
          level: hero.level,
          stats: hero.stats,
          status: 'idle',
        });

        mockDb.updateHeroQuest(quest.id, {
          status: 'failed',
          rewards: { xp: consolationXp },
        });

        pushNotification(quest.playerId, {
          type: 'system',
          title: `Quest Failed: ${definition.name}`,
          message: `${hero.name} failed the ${definition.name} quest but gained ${consolationXp} XP from the experience.`,
          data: { questId: quest.id, heroId: hero.id },
        });

        mockDb.addEvent({
          id: crypto.randomUUID(),
          playerId: quest.playerId,
          type: 'quest_complete',
          title: `${hero.name} failed ${definition.name}`,
          description: `${hero.name} failed the ${definition.name} quest but gained ${consolationXp} consolation XP.`,
          timestamp: now,
          data: { questId: quest.id, heroId: hero.id, questType: quest.questType, failed: true },
        });

        console.log(`[HeroQuest] ${hero.name} failed ${quest.questType} quest — ${consolationXp} consolation XP`);
      }
    }
  }, 10_000);

  // Spawn initial batch of events on startup
  spawnMapEvents();

  // Kick off the first seasonal event after a short delay (let players connect)
  setTimeout(() => {
    tickEventRotation();
  }, 5_000);

  console.log('[GameLoop] Economy: 15s | Build queue: 5s | Train queue: 5s | March: 10s | Spy missions: 10s | Research: 5s | Map events: 120s | Aether cycle: 15s | Seasonal events: 30s | World boss: 120s | Hero quests: 10s');
}
