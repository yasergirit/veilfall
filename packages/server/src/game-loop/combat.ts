/**
 * Combat resolution engine v2 for VEILFALL.
 *
 * 3-round HP-based combat with counter system, wall bonuses,
 * inverse-speed damage distribution, and percentage-based looting.
 */

// ---------------------------------------------------------------------------
// Unit stats & counter definitions
// ---------------------------------------------------------------------------

export interface UnitStatBlock {
  attack: number;
  defense: number;
  hp: number;
  speed: number;
  tags: string[];
  strongVs: string[];
  weakVs: string[];
  carry: number;
}

export const UNIT_STATS: Record<string, UnitStatBlock> = {
  militia: {
    attack: 10,
    defense: 15,
    hp: 40,
    speed: 8,
    tags: ['infantry'],
    strongVs: ['siege'],
    weakVs: ['ranged'],
    carry: 30,
  },
  archer: {
    attack: 18,
    defense: 8,
    hp: 30,
    speed: 9,
    tags: ['ranged'],
    strongVs: ['infantry'],
    weakVs: ['heavy'],
    carry: 15,
  },
  shieldbearer: {
    attack: 8,
    defense: 25,
    hp: 55,
    speed: 6,
    tags: ['heavy', 'infantry'],
    strongVs: ['ranged', 'siege'],
    weakVs: [],
    carry: 20,
  },
  scout: {
    attack: 3,
    defense: 3,
    hp: 15,
    speed: 18,
    tags: ['recon'],
    strongVs: [],
    weakVs: [],
    carry: 10,
  },
  siege_ram: {
    attack: 40,
    defense: 5,
    hp: 60,
    speed: 3,
    tags: ['siege'],
    strongVs: ['wall'],
    weakVs: ['infantry', 'ranged'],
    carry: 50,
  },
};

// ---------------------------------------------------------------------------
// Counter multiplier constants
// ---------------------------------------------------------------------------

const COUNTER_STRONG_BONUS = 1.30; // +30 % vs strong targets
const COUNTER_WEAK_PENALTY = 0.80; // -20 % vs weak targets

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface CombatResult {
  attackerLosses: Record<string, number>;
  defenderLosses: Record<string, number>;
  winner: 'attacker' | 'defender' | 'draw';
  victoryType: 'decisive' | 'partial' | 'draw';
  loot: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check whether *any* tag of the target matches the attacker's strongVs / weakVs list. */
function getCounterMultiplier(
  attackerStats: UnitStatBlock,
  defenderUnits: Record<string, number>,
): number {
  let dominated = 0;   // weight that is strong-vs
  let countered = 0;    // weight that is weak-vs
  let total = 0;

  for (const [unitType, count] of Object.entries(defenderUnits)) {
    if (count <= 0) continue;
    const targetStats = UNIT_STATS[unitType];
    if (!targetStats) continue;

    const weight = count;
    total += weight;

    const targetTags = targetStats.tags;
    if (attackerStats.strongVs.some((t) => targetTags.includes(t))) {
      dominated += weight;
    }
    if (attackerStats.weakVs.some((t) => targetTags.includes(t))) {
      countered += weight;
    }
  }

  if (total === 0) return 1;

  // Weighted blend of bonuses / penalties
  const strongRatio = dominated / total;
  const weakRatio = countered / total;

  return 1 + strongRatio * (COUNTER_STRONG_BONUS - 1) - weakRatio * (1 - COUNTER_WEAK_PENALTY);
}

function computePower(
  units: Record<string, number>,
  opponentUnits: Record<string, number>,
  baseBonus: number,
  mode: 'attack' | 'defense',
): number {
  let power = 0;
  for (const [unitType, count] of Object.entries(units)) {
    if (count <= 0) continue;
    const stats = UNIT_STATS[unitType];
    if (!stats) continue;

    const base = mode === 'attack' ? stats.attack : stats.defense;
    const counter = getCounterMultiplier(stats, opponentUnits);
    power += count * base * baseBonus * counter;
  }
  return power;
}

/**
 * Distribute `totalDamage` across unit types by inverse speed (slower units
 * absorb more damage). Returns how many of each type are killed.
 */
function distributeDamage(
  units: Record<string, number>,
  totalDamage: number,
): Record<string, number> {
  const killed: Record<string, number> = {};
  if (totalDamage <= 0) return killed;

  // Calculate absorption weights: count * (20 - speed)
  let totalWeight = 0;
  const weights: Record<string, number> = {};

  for (const [unitType, count] of Object.entries(units)) {
    if (count <= 0) continue;
    const stats = UNIT_STATS[unitType];
    if (!stats) continue;
    const w = count * (20 - stats.speed);
    weights[unitType] = w;
    totalWeight += w;
  }

  if (totalWeight === 0) return killed;

  for (const [unitType, weight] of Object.entries(weights)) {
    const stats = UNIT_STATS[unitType]!;
    const damageToType = totalDamage * (weight / totalWeight);
    const unitsKilled = Math.min(
      Math.floor(damageToType / stats.hp),
      units[unitType] ?? 0,
    );
    if (unitsKilled > 0) {
      killed[unitType] = unitsKilled;
    }
  }

  return killed;
}

function totalRemainingHP(units: Record<string, number>): number {
  let hp = 0;
  for (const [unitType, count] of Object.entries(units)) {
    if (count <= 0) continue;
    const stats = UNIT_STATS[unitType];
    if (stats) hp += count * stats.hp;
  }
  return hp;
}

function subtractLosses(
  units: Record<string, number>,
  losses: Record<string, number>,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [unitType, count] of Object.entries(units)) {
    const remaining = count - (losses[unitType] ?? 0);
    if (remaining > 0) {
      result[unitType] = remaining;
    }
  }
  return result;
}

function isArmyDead(units: Record<string, number>): boolean {
  return Object.values(units).every((c) => c <= 0);
}

function mergeKills(
  target: Record<string, number>,
  addition: Record<string, number>,
): void {
  for (const [k, v] of Object.entries(addition)) {
    target[k] = (target[k] ?? 0) + v;
  }
}

function computeCarryCapacity(units: Record<string, number>): number {
  let cap = 0;
  for (const [unitType, count] of Object.entries(units)) {
    if (count <= 0) continue;
    const stats = UNIT_STATS[unitType];
    if (stats) cap += count * stats.carry;
  }
  return cap;
}

// ---------------------------------------------------------------------------
// Main combat resolver
// ---------------------------------------------------------------------------

export function resolveCombat(
  attackerUnits: Record<string, number>,
  defenderUnits: Record<string, number>,
  attackerBonus: number,
  defenderBonus: number,
  options?: {
    wallLevel?: number;
    fortificationLevel?: number;
    defenderResources?: Record<string, number>;
    warehouseLevel?: number;
  },
): CombatResult {
  const wallLevel = options?.wallLevel ?? 0;
  const fortificationLevel = options?.fortificationLevel ?? 0;

  // Mutable copies for tracking survivors across rounds
  let atkAlive = { ...attackerUnits };
  let defAlive = { ...defenderUnits };

  const totalAtkLosses: Record<string, number> = {};
  const totalDefLosses: Record<string, number> = {};

  // Edge case: both sides empty
  if (isArmyDead(atkAlive) && isArmyDead(defAlive)) {
    return {
      attackerLosses: {},
      defenderLosses: {},
      winner: 'draw',
      victoryType: 'draw',
      loot: {},
    };
  }

  // ---- 3-round combat loop ----
  const ROUNDS = 3;
  for (let round = 1; round <= ROUNDS; round++) {
    if (isArmyDead(atkAlive) || isArmyDead(defAlive)) break;

    // Total attack & defense with counter multipliers
    const totalAttack = computePower(atkAlive, defAlive, attackerBonus, 'attack');
    let totalDefense = computePower(defAlive, atkAlive, defenderBonus, 'defense');

    // Wall bonus on Round 1 only
    if (round === 1 && (wallLevel > 0 || fortificationLevel > 0)) {
      const wallBonus = 1 + wallLevel * 0.05 + fortificationLevel * 0.03;
      totalDefense *= wallBonus;
    }

    const denom = totalAttack + totalDefense;
    if (denom === 0) break;

    // Attacker deals damage to defender
    const attackerDamage = totalAttack * (totalAttack / denom);
    // Defender retaliates at 60 % efficiency
    const defenderRetaliation = totalDefense * (totalDefense / denom) * 0.60;

    // Distribute damage
    const defKillsThisRound = distributeDamage(defAlive, attackerDamage);
    const atkKillsThisRound = distributeDamage(atkAlive, defenderRetaliation);

    // Apply losses
    mergeKills(totalDefLosses, defKillsThisRound);
    mergeKills(totalAtkLosses, atkKillsThisRound);

    defAlive = subtractLosses(defAlive, defKillsThisRound);
    atkAlive = subtractLosses(atkAlive, atkKillsThisRound);
  }

  // ---- Determine winner ----
  const defDead = isArmyDead(defAlive);
  const atkDead = isArmyDead(atkAlive);

  let winner: 'attacker' | 'defender' | 'draw';
  let victoryType: 'decisive' | 'partial' | 'draw';

  if (defDead && atkDead) {
    winner = 'draw';
    victoryType = 'draw';
  } else if (defDead) {
    winner = 'attacker';
    victoryType = 'decisive';
  } else if (atkDead) {
    winner = 'defender';
    victoryType = 'decisive';
  } else {
    // Both alive -> compare remaining HP
    const atkHP = totalRemainingHP(atkAlive);
    const defHP = totalRemainingHP(defAlive);

    if (atkHP > defHP * 1.2) {
      winner = 'attacker';
      victoryType = 'partial';
    } else if (defHP > atkHP * 1.2) {
      winner = 'defender';
      victoryType = 'partial';
    } else {
      winner = 'draw';
      victoryType = 'draw';
    }
  }

  // ---- Loot calculation ----
  const loot: Record<string, number> = {};

  if (winner === 'attacker' && options?.defenderResources) {
    const defResources = options.defenderResources;
    const whLevel = options?.warehouseLevel ?? 0;
    const protectedPct = Math.min(whLevel * 5, 60) / 100;
    const lootPct = victoryType === 'decisive' ? 0.10 : 0.05;
    const carryCapacity = computeCarryCapacity(atkAlive);

    let totalLooted = 0;
    for (const [resource, amount] of Object.entries(defResources)) {
      if (amount <= 0) continue;
      const lootable = amount * (1 - protectedPct);
      const taken = Math.floor(lootable * lootPct);
      if (taken > 0) {
        loot[resource] = taken;
        totalLooted += taken;
      }
    }

    // Cap by carry capacity - scale down proportionally if over
    if (totalLooted > carryCapacity && totalLooted > 0) {
      const scale = carryCapacity / totalLooted;
      for (const resource of Object.keys(loot)) {
        loot[resource] = Math.floor(loot[resource] * scale);
        if (loot[resource] <= 0) delete loot[resource];
      }
    }
  }

  return {
    attackerLosses: totalAtkLosses,
    defenderLosses: totalDefLosses,
    winner,
    victoryType,
    loot,
  };
}

// ---------------------------------------------------------------------------
// Hero combat bonus
// ---------------------------------------------------------------------------

export function getHeroCombatBonus(hero: {
  level: number;
  stats: { strength: number; intellect: number; agility: number; endurance: number };
  abilities: string[];
}): { attackBonus: number; defenseBonus: number } {
  let attackBonus = 1.0;
  let defenseBonus = 1.0;

  // +1.5 % per hero level
  attackBonus += hero.level * 0.015;
  defenseBonus += hero.level * 0.015;

  // Stat bonuses: +1 % per 3 strength (attack), +1 % per 3 endurance (defense)
  attackBonus += Math.floor(hero.stats.strength / 3) * 0.01;
  defenseBonus += Math.floor(hero.stats.endurance / 3) * 0.01;

  // Ability bonuses
  if (hero.abilities.includes('rally_cry')) attackBonus += 0.10;
  if (hero.abilities.includes('shield_wall')) defenseBonus += 0.08;
  if (hero.abilities.includes('shadow_strike')) attackBonus += 0.06;
  if (hero.abilities.includes('aether_bolt')) attackBonus += 0.10;

  return { attackBonus, defenseBonus };
}

// ---------------------------------------------------------------------------
// Utility: apply losses to a unit record
// ---------------------------------------------------------------------------

/**
 * Apply losses to a unit record, returning surviving units.
 */
export function applyCombatLosses(
  units: Record<string, number>,
  losses: Record<string, number>,
): Record<string, number> {
  const surviving: Record<string, number> = {};
  for (const [unitType, count] of Object.entries(units)) {
    const lost = losses[unitType] ?? 0;
    const remaining = Math.max(0, count - lost);
    if (remaining > 0) {
      surviving[unitType] = remaining;
    }
  }
  return surviving;
}
