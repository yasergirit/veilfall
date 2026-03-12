/**
 * Combat resolution engine for VEILFALL.
 * Calculates battle outcomes based on unit stats, bonuses, and battle ratios.
 */

const UNIT_STATS: Record<string, { attack: number; defense: number }> = {
  militia:      { attack: 10, defense: 15 },
  archer:       { attack: 18, defense: 8 },
  shieldbearer: { attack: 8,  defense: 25 },
  scout:        { attack: 3,  defense: 3 },
  siege_ram:    { attack: 40, defense: 5 },
};

export interface CombatResult {
  attackerLosses: Record<string, number>;
  defenderLosses: Record<string, number>;
  winner: 'attacker' | 'defender' | 'draw';
  loot: Record<string, number>;
}

export function resolveCombat(
  attackerUnits: Record<string, number>,
  defenderUnits: Record<string, number>,
  attackerBonus: number,
  defenderBonus: number,
): CombatResult {
  // 1. Calculate total attack power
  let totalAttack = 0;
  for (const [unitType, count] of Object.entries(attackerUnits)) {
    const stats = UNIT_STATS[unitType];
    if (stats) {
      totalAttack += count * stats.attack * attackerBonus;
    }
  }

  // 2. Calculate total defense power
  let totalDefense = 0;
  for (const [unitType, count] of Object.entries(defenderUnits)) {
    const stats = UNIT_STATS[unitType];
    if (stats) {
      totalDefense += count * stats.defense * defenderBonus;
    }
  }

  // Edge case: both sides have zero power
  if (totalAttack === 0 && totalDefense === 0) {
    return {
      attackerLosses: {},
      defenderLosses: {},
      winner: 'draw',
      loot: {},
    };
  }

  // 3. Battle ratio
  const ratio = totalAttack / (totalAttack + totalDefense);

  // 4. Determine winner
  let winner: 'attacker' | 'defender' | 'draw';
  if (ratio > 0.5) {
    winner = 'attacker';
  } else if (ratio < 0.5) {
    winner = 'defender';
  } else {
    winner = 'draw';
  }

  // 5. Calculate losses
  const attackerLosses: Record<string, number> = {};
  const defenderLosses: Record<string, number> = {};

  if (winner === 'attacker') {
    // Attacker (winner) loses ratio * 30% of units
    for (const [unitType, count] of Object.entries(attackerUnits)) {
      attackerLosses[unitType] = Math.round(count * ratio * 0.3);
    }
    // Defender (loser) loses (1 - ratio) * 70% of units
    for (const [unitType, count] of Object.entries(defenderUnits)) {
      defenderLosses[unitType] = Math.round(count * (1 - ratio) * 0.7);
    }
  } else if (winner === 'defender') {
    // Attacker (loser) loses (1 - ratio) * 70% of units
    for (const [unitType, count] of Object.entries(attackerUnits)) {
      attackerLosses[unitType] = Math.round(count * (1 - ratio) * 0.7);
    }
    // Defender (winner) loses ratio * 30% of units
    for (const [unitType, count] of Object.entries(defenderUnits)) {
      defenderLosses[unitType] = Math.round(count * ratio * 0.3);
    }
  } else {
    // Draw: both lose 50% * 50% = 25%
    for (const [unitType, count] of Object.entries(attackerUnits)) {
      attackerLosses[unitType] = Math.round(count * 0.25);
    }
    for (const [unitType, count] of Object.entries(defenderUnits)) {
      defenderLosses[unitType] = Math.round(count * 0.25);
    }
  }

  // 6. Loot: if attacker wins, generate random resources
  const loot: Record<string, number> = {};
  if (winner === 'attacker') {
    loot.food = Math.floor(Math.random() * 151) + 50;   // 50-200
    loot.wood = Math.floor(Math.random() * 121) + 30;   // 30-150
    loot.stone = Math.floor(Math.random() * 81) + 20;   // 20-100
  }

  return { attackerLosses, defenderLosses, winner, loot };
}

export function getHeroCombatBonus(hero: { level: number; stats: { strength: number; intellect: number; agility: number; endurance: number }; abilities: string[] }): { attackBonus: number; defenseBonus: number } {
  let attackBonus = 1.0;
  let defenseBonus = 1.0;

  // +2% per hero level
  attackBonus += hero.level * 0.02;
  defenseBonus += hero.level * 0.02;

  // Stat bonuses: +1% per 2 strength (attack), +1% per 2 endurance (defense)
  attackBonus += Math.floor(hero.stats.strength / 2) * 0.01;
  defenseBonus += Math.floor(hero.stats.endurance / 2) * 0.01;

  // Ability bonuses
  if (hero.abilities.includes('rally_cry')) attackBonus += 0.10;
  if (hero.abilities.includes('shield_wall')) defenseBonus += 0.10;
  if (hero.abilities.includes('shadow_strike')) attackBonus += 0.08;
  if (hero.abilities.includes('aether_bolt')) attackBonus += 0.12;

  return { attackBonus, defenseBonus };
}

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
