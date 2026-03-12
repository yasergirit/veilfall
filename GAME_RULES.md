# VEILFALL: Echoes of the Sky Rupture — Game Rules & Mechanics

> Complete reference document for all game systems, formulas, and constants.
> **Version 2.0 — Production Balance Pass**

---

## Table of Contents

1. [Factions](#1-factions)
2. [Resources](#2-resources)
3. [Buildings](#3-buildings)
4. [Units](#4-units)
5. [Research](#5-research)
6. [Heroes](#6-heroes)
7. [Combat](#7-combat)
8. [World Boss](#8-world-boss)
9. [Marches](#9-marches)
10. [Map & Terrain](#10-map--terrain)
11. [Alliances](#11-alliances)
12. [Seasonal Events](#12-seasonal-events)
13. [Quests](#13-quests)
14. [Hero Quests](#14-hero-quests)
15. [Spy System](#15-spy-system)
16. [Marketplace & Trade](#16-marketplace--trade)
17. [Daily Rewards](#17-daily-rewards)
18. [Leaderboard & Power Score](#18-leaderboard--power-score)
19. [New Player Protection & Anti-Snowball](#19-new-player-protection--anti-snowball)
20. [Game Loop Tick Rates](#20-game-loop-tick-rates)
21. [Balance Change Summary](#balance-change-summary)
22. [Production Balancing Notes](#production-balancing-notes)

---

## 1. Factions

Four playable factions, chosen at character creation. Each has unique bonuses, a starter hero, and a faction-exclusive building.

### The Ironveil Compact (`ironveil`)

- **Theme**: Engineers and pragmatists. Heavy defense, siege mastery, fast builders.
- **Color**: #4A6670 / Accent: #B8622A
- **Starter Hero**: Thorne (Warlord)
- **Unique Building**: Ironveil Foundry

| Bonus | Multiplier |
|---|---|
| Defense | 1.20x |
| Offense | 0.92x |
| March Speed | 0.90x |
| Build Speed | 1.15x |
| Aether Yield | 1.0x |
| Resource Gather | 1.0x |

### The Aetheri Dominion (`aetheri`)

- **Theme**: Scholars and mystics. Aether mastery, powerful offense, glass cannon.
- **Color**: #9B6ED4 / Accent: #C0E0FF
- **Starter Hero**: Lyris (Sage)
- **Unique Building**: Aetheri Resonance Spire

| Bonus | Multiplier |
|---|---|
| Defense | 0.88x |
| Offense | 1.20x |
| March Speed | 1.0x |
| Build Speed | 1.0x |
| Aether Yield | 1.25x |
| Resource Gather | 0.92x |
| Ruin Exploration | 1.10x |
| Lore Decrypt | 1.10x |

### The Thornwatch Clans (`thornwatch`)

- **Theme**: Survivalists and rangers. Speed, raiding, trade superiority.
- **Color**: #3A6B35 / Accent: #8B1A1A
- **Starter Hero**: Ashka (Shadowblade)
- **Unique Building**: Thornwatch Rootway

| Bonus | Multiplier |
|---|---|
| Defense | 1.0x |
| Offense | 1.0x |
| March Speed | 1.15x |
| Resource Gather | 1.12x |
| Trade Speed | 1.25x |
| Ruin Exploration | 1.15x |

### The Ashen Covenant (`ashen`)

- **Theme**: Conquerors and historians. Relic mastery, ruin exploitation, lore power.
- **Color**: #2C2C2C / Accent: #E87D20
- **Starter Hero**: Kael (Warlord)
- **Unique Building**: Ashen Reliquary

| Bonus | Multiplier |
|---|---|
| Offense | 1.08x |
| Build Speed | 0.96x |
| Ruin Exploration | 1.25x |
| Lore Decrypt | 1.40x |

> **Balance note (v2):** Faction multipliers tightened from ±25-30% to ±8-20%. The old spreads let Aetheri snowball offensively and Ironveil become near-unkillable. Narrower bands keep factions distinctive without hard-gating strategies.

---

## 2. Resources

Five resource types drive the economy:

| Resource | Icon | Starting Amount |
|---|---|---|
| Food | :ear_of_rice: | 800 |
| Wood | :wood: | 800 |
| Stone | :rock: | 400 |
| Iron | :gear: | 200 |
| Aether Stone | :gem: | 50 |

> **v2:** Starting Food/Wood raised from 500→800, Stone from 300→400. Smooths the first 10 minutes so players can build without stalling.

### Production Rates

Each resource building produces per hour at level 1. Higher levels scale with **soft diminishing returns** to prevent late-game resource inflation:

| Building | Resource | Base Rate/hr (L1) |
|---|---|---|
| Gathering Post | Food | 30 |
| Woodcutter Lodge | Wood | 25 |
| Stone Quarry | Stone | 20 |
| Iron Mine | Iron | 15 |
| Aether Extractor | Aether Stone | 5 |

**Production Formula** (per tick):
```
effectiveLevel = level ^ 0.85
produced = (baseRate * effectiveLevel * gatherMultiplier * aetherMultiplier * harvestMoonMultiplier) / 360
```

> **v2:** Changed from linear (`level`) to sub-linear (`level^0.85`). A level 10 building now produces ~7.1x its L1 rate instead of 10x. A level 20 building produces ~12.3x instead of 20x. This slows late-game resource flooding without hurting early levels (L1-5 barely change).

### Aether Harvest Cycle

A server-wide cycle affecting Aether Stone production:

| Phase | Duration | Aether Multiplier |
|---|---|---|
| Dormant | 8 minutes | 1.0x |
| Rising | 2 minutes | 1.5x |
| Surge | 3 minutes | 2.5x |
| Fading | 2 minutes | 1.5x |

> **v2:** Old cycle was binary (5 min dormant / 2 min at 3.0x), creating feast-or-famine. New 4-phase cycle is 15 minutes total with a gentler curve. Peak reduced from 3.0x to 2.5x. Players have a 5-minute window of elevated yield (Rising+Surge+Fading) instead of a 2-minute spike.

All players are notified when the phase transitions.

---

## 3. Buildings

- **Max Building Level**: 20
- **Max Build Queue Slots**: 2

### Building Costs (Level 1)

| Building | Food | Wood | Stone | Iron | Aether | Time (s) | Requires |
|---|---|---|---|---|---|---|---|
| Gathering Post | 50 | 80 | - | - | - | 30 | - |
| Woodcutter Lodge | 50 | 40 | 30 | - | - | 30 | - |
| Stone Quarry | 40 | 60 | - | 20 | - | 45 | TC 2 |
| Iron Mine | 60 | 80 | 40 | - | - | 60 | TC 2 |
| Aether Extractor | - | 100 | 80 | 60 | - | 90 | TC 3 |
| Militia Barracks | 80 | 120 | 60 | - | - | 60 | TC 2 |
| Palisade Wall | - | 150 | 50 | - | - | 45 | - |
| Scout Tower | - | 80 | 60 | - | - | 40 | TC 2 |
| Hero Hall | 100 | 150 | 100 | - | - | 90 | TC 3 |
| Warehouse | - | 100 | 80 | - | - | 40 | TC 2 |
| Marketplace | - | 120 | 80 | 40 | - | 60 | TC 3 |
| Spy Guild | - | 100 | 100 | 80 | - | 90 | TC 3 |

### Faction-Unique Buildings (TC 3 Required)

| Building | Faction | Food | Wood | Stone | Iron | Aether | Time (s) |
|---|---|---|---|---|---|---|---|
| Ironveil Foundry | Ironveil | - | 100 | 150 | 200 | - | 120 |
| Aetheri Resonance | Aetheri | - | - | 80 | 100 | 150 | 120 |
| Thornwatch Rootway | Thornwatch | 150 | 200 | 80 | - | - | 120 |
| Ashen Reliquary | Ashen | - | - | 200 | 100 | 50 | 120 |

### Upgrade Formulas

**Cost scaling** — exponential with a gentle curve:
```
upgradeCost[resource] = FLOOR(baseCost[resource] * (1.18 ^ (nextLevel - 1)))
```

> **v2:** Old formula was `baseCost * nextLevel` (linear). A level 10 upgrade cost 10x base. Now it costs ~4.4x base at L10 but ~27x base at L20. Early levels are actually cheaper, while L15+ becomes a meaningful commitment. The 1.18 base was chosen so L5 ≈ 2.3x, L10 ≈ 5.2x, L15 ≈ 12x, L20 ≈ 27x.

| Level | Cost Multiplier (approx) |
|---|---|
| 2 | 1.18x |
| 5 | 2.3x |
| 8 | 3.8x |
| 10 | 5.2x |
| 12 | 7.3x |
| 15 | 12x |
| 18 | 19x |
| 20 | 27x |

**Time scaling** — logarithmic acceleration:
```
upgradeTime = FLOOR(baseTime * (1 + (nextLevel - 1) * 0.6 + (nextLevel - 1)^1.4 * 0.08))
```

> **v2:** Old formula was `baseTime * nextLevel * 0.8` which was essentially linear and made L15+ upgrades feel tedious without being meaningful. New formula front-loads accessibility: L2-L8 builds are quick (30s–3min for most buildings), but L15+ upgrades take 15–45 minutes — enough to create session breaks without multi-hour waits.

| Level | Time Multiplier (approx) |
|---|---|
| 2 | 1.7x |
| 5 | 3.8x |
| 8 | 7.5x |
| 10 | 10.5x |
| 12 | 14x |
| 15 | 22x |
| 18 | 33x |
| 20 | 42x |

### Town Center Upgrade Costs

| Level | Food | Wood | Stone | Iron | Aether | Time (s) |
|---|---|---|---|---|---|---|
| 2 | 200 | 300 | 200 | - | - | 120 |
| 3 | 500 | 600 | 400 | 200 | - | 360 |
| 4 | 1,200 | 1,400 | 900 | 500 | 100 | 900 |
| 5 | 3,000 | 3,500 | 2,200 | 1,200 | 400 | 2,400 |

> **v2:** TC4 and TC5 costs increased. TC5 now takes 40 minutes instead of 20. TC is the progression gate — it should feel like a milestone, not a speed bump.

### Town Center Level Requirements

| TC Level | Unlocks |
|---|---|
| 1 | Gathering Post, Woodcutter Lodge, Palisade Wall |
| 2 | Stone Quarry, Iron Mine, Militia Barracks, Scout Tower, Warehouse |
| 3 | Aether Extractor, Hero Hall, Marketplace, Spy Guild, Faction buildings |

### Founding Additional Settlements

- **Requires**: TC level 3+ in existing settlement
- **Cost**: Food 1,500 / Wood 1,500 / Stone 800 / Iron 500
- **Max Settlements**: 3 per player
- New settlement starts with half starting resources
- **Cooldown**: 24 hours between founding settlements

> **v2:** Settlement cost increased (+50%) and added 24hr cooldown. Prevents rapid multi-settlement expansion which was the strongest snowball vector.

---

## 4. Units

### Unit Stats & Training

| Unit | ATK | DEF | HP | Speed | Carry | Train (s) | Food | Wood | Iron | Stone | Requires |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Militia | 10 | 15 | 40 | 8 | 20 | 15 | 30 | 20 | - | - | Militia Barracks |
| Archer | 18 | 8 | 30 | 9 | 15 | 20 | 40 | 30 | 10 | - | Militia Barracks |
| Shieldbearer | 8 | 25 | 55 | 6 | 10 | 25 | 50 | 20 | 30 | - | Militia Barracks |
| Scout | 3 | 3 | 15 | 18 | 5 | 10 | 20 | 10 | - | - | Scout Tower |
| Siege Ram | 40 | 5 | 60 | 3 | 0 | 60 | - | 100 | 60 | 40 | Militia Barracks |

> **v2:** Added HP stat for richer combat resolution (see Section 7). This replaces the old binary alive/dead model.

### Unit Type Tags & Counter System

Each unit has **type tags** that define its role and counter relationships:

| Unit | Tags | Strong vs | Weak vs |
|---|---|---|---|
| Militia | Infantry, Melee | Siege | Archer |
| Archer | Ranged, Light | Infantry | Cavalry*, Shieldbearer |
| Shieldbearer | Infantry, Heavy | Ranged, Siege | — |
| Scout | Light, Fast | — | Everything (not a combat unit) |
| Siege Ram | Siege, Slow | Walls, Buildings | Infantry, Ranged |

*Cavalry is reserved for future unit expansion.

**Counter bonus**: When a unit attacks a type it is strong against, it deals **+30% damage**. When attacking a type it is weak against, it deals **-20% damage**.

```
counterMultiplier:
  if attacker.strongVs includes defender.tag → 1.30
  if attacker.weakVs includes defender.tag → 0.80
  else → 1.00
```

> **v2:** The old system had no unit interactions — whoever had the most Militia or Archers won. The counter system makes army composition matter. Even a smaller force with good counters can punch above its weight.

- **Training Time**: `timePerUnit * count`
- **Max Train Queue Slots**: 2
- **Army Size Cap**: 200 units per march (prevents deathball meta)

> **v2:** Army cap of 200 per march prevents a single massive army from dominating. Players must split forces or specialize marches.

---

## 5. Research

- **Research Queue**: 1 slot per settlement
- **Cost Scaling**: `FLOOR(baseCost[resource] * (1.22 ^ (nextLevel - 1)))`
- **Time Scaling**: `FLOOR(baseTime * (1 + (nextLevel - 1) * 0.7 + (nextLevel - 1)^1.3 * 0.1))`

> **v2:** Research cost/time now uses exponential scaling similar to buildings but slightly steeper (1.22 base vs 1.18). Research is a permanent advantage — it should cost more per level than temporary building capacity.

### Research Tree

| Tech | Name | Max Lvl | Base Cost | Base Time | Requires | Effect |
|---|---|---|---|---|---|---|
| agriculture | Agriculture | 10 | Food 100, Wood 50 | 60s | - | +8% food/hr per level |
| forestry | Forestry | 10 | Food 50, Wood 100 | 60s | - | +8% wood/hr per level |
| masonry | Masonry | 10 | Wood 100, Stone 80 | 75s | - | +8% stone/hr per level |
| metallurgy | Metallurgy | 10 | Wood 80, Iron 100 | 90s | - | +8% iron/hr per level |
| aether_studies | Aether Studies | 10 | Aether 30, Iron 50 | 120s | - | +8% aether/hr per level |
| fortification | Fortification | 10 | Stone 150, Iron 80 | 90s | - | +5% defense per level |
| tactics | Tactics | 10 | Food 100, Iron 60 | 90s | Militia Barracks | +5% attack per level |
| logistics | Logistics | 10 | Food 80, Wood 80 | 75s | - | +5% march speed, +8% carry per level |
| cartography | Cartography | 5 | Wood 60, Aether 20 | 90s | Scout Tower | +2 tile vision per level |
| aether_mastery | Aether Mastery | 5 | Aether 80, Iron 60 | 180s | Aether Extractor | Unlock aether abilities |

> **v2:** Resource research effects reduced from +10%/level to +8%/level. At max level (10), this is +80% instead of +100%. Combined with sub-linear building production, this prevents late-game players from generating absurd resource volumes. Carry reduced from +10% to +8% per level.

**Example**: Researching Agriculture to level 3 costs FLOOR(100 * 1.22^2) = 149 Food, FLOOR(50 * 1.22^2) = 74 Wood, and takes ~150 seconds.

---

## 6. Heroes

- **Max Level**: 30
- **Max Heroes**: 6 per player
- **Starting Loyalty**: 80 (range 0-100)
- **Desertion Threshold**: Loyalty < 19

### Hero Classes

| Class | Icon | Description |
|---|---|---|
| Warlord | :crossed_swords: | Military commander. Leads armies from the front. |
| Sage | :crystal_ball: | Aether scholar. Accelerates lore and research. |
| Shadowblade | :dagger: | Scout and saboteur. Unseen, unmatched. |
| Steward | :scroll: | Economic leader. Builds empires from rubble. |
| Herald | :trumpet: | Diplomat and unifier. The voice of alliances. |
| Driftwalker | :milky_way: | Explorer of the unknown. Walks where others fear. |

### Starting Stats by Class

| Class | Strength | Intellect | Agility | Endurance |
|---|---|---|---|---|
| Warlord | 8 | 3 | 4 | 7 |
| Sage | 3 | 8 | 4 | 5 |
| Shadowblade | 5 | 4 | 8 | 3 |
| Steward | 4 | 6 | 4 | 6 |

### Leveling

- **XP per level**: `FLOOR(currentLevel * 100 * (1 + currentLevel * 0.05))` — gentle curve so L20+ heroes require real investment
- **On level-up**: +1 to a random stat
- **XP from combat**: 50 XP (win), 20 XP (loss)
- **XP from map event claim**: 25 XP
- **XP from world boss**: proportional to damage contribution, 30-150 XP

> **v2:** XP formula changed from flat `level * 100` to `level * 100 * (1 + level * 0.05)`. At L1 it's 105 XP (nearly unchanged). At L10 it's 1,500 XP (was 1,000). At L20 it's 4,000 XP (was 2,000). High-level heroes are genuine investments.

### Abilities

| Ability | Class | Level Req | Effect |
|---|---|---|---|
| Rally Cry | Warlord | 1 | +10% attack for 1 battle |
| Shield Wall | Warlord | 3 | +15% defense for 1 battle |
| Aether Bolt | Sage | 1 | Deals 50 damage to target |
| Mana Shield | Sage | 3 | Absorbs 80 damage |
| Shadow Strike | Shadowblade | 1 | +25% first attack damage |
| Vanish | Shadowblade | 3 | Avoid 1 combat round |
| Inspire | Steward | 1 | -10% build time |
| Trade Mastery | Steward | 3 | +15% trade value |

> **v2:** Shield Wall 20%→15%, Mana Shield 100→80, Shadow Strike 30%→25%, Trade Mastery 20%→15%. Abilities were too strong as flat buffs — combined with hero stat bonuses they created too much variance.

### Equipment

**Slots**: Weapon, Armor, Accessory, Relic

| Item | Slot | Rarity | Stats |
|---|---|---|---|
| Rusty Sword | Weapon | Common | STR +2 |
| Iron Blade | Weapon | Rare | STR +5 |
| Aether Staff | Weapon | Rare | INT +5 |
| Leather Armor | Armor | Common | END +3 |
| Chainmail | Armor | Rare | END +6 |
| Scout Cloak | Accessory | Common | AGI +3 |
| Aether Pendant | Accessory | Rare | INT +3, END +2 |
| Elder's Idol | Relic | Legendary | STR +3, INT +3, AGI +3, END +3 |

All new heroes start with **Rusty Sword** and **Leather Armor** equipped.

### Hero Combat Bonus

```
attackBonus  = 1.0 + (hero.level * 0.015) + FLOOR(strength / 3) * 0.01
defenseBonus = 1.0 + (hero.level * 0.015) + FLOOR(endurance / 3) * 0.01
```

> **v2:** Hero level scaling reduced from 0.02 to 0.015 per level. Stat divisor changed from 2 to 3. A max-level hero (L30) now gives +45% + stat bonus instead of +60% + stat bonus. This keeps heroes impactful but not fight-deciding on their own.

Additional ability bonuses: Rally Cry +0.10 ATK, Shield Wall +0.08 DEF, Shadow Strike +0.06 ATK, Aether Bolt +0.10 ATK.

---

## 7. Combat

### Combat Resolution

Combat now uses a **round-based system** with unit HP for deeper tactical outcomes.

**Round count**: 3 rounds (attackers always initiate Round 1).

**Per round:**

**Step 1 — Calculate Effective Attack Power (per unit type):**
```
unitDamage = unitATK * counterMultiplier * heroAttackBonus * factionOffenseMultiplier
totalAttack = SUM(unitCount[type] * unitDamage[type])
```

**Step 2 — Calculate Effective Defense Power:**
```
unitToughness = unitDEF * heroDefenseBonus * factionDefenseMultiplier
totalDefense = SUM(unitCount[type] * unitToughness[type])
```

**Step 3 — Wall Bonus (defender only, Round 1):**
```
if defender is in own settlement:
  wallBonus = 1 + (palisadeWallLevel * 0.05) + (fortificationResearchLevel * 0.03)
  totalDefense *= wallBonus
```

> **v2:** Walls now provide 5% per level (up to 100% at L20) + fortification research stacks. Walls were irrelevant before. Now a L10 wall + L5 fortification = +65% defense at home, making defense viable.

**Step 4 — Damage Dealt:**
```
attackerDamageDealt = totalAttack * (totalAttack / (totalAttack + totalDefense))
defenderDamageDealt = totalDefense * (totalDefense / (totalAttack + totalDefense)) * 0.60
```

> The defender's retaliatory damage is scaled by 0.60 because defenders are reacting, not initiating. This gives attackers a reason to attack while still making defense valuable.

**Step 5 — Distribute Damage to Units:**

Damage is distributed proportionally across unit types, weighted by inverse speed (slower units absorb more):
```
absorptionWeight[type] = unitCount[type] * (20 - unitSpeed[type])
shareOfDamage[type] = absorptionWeight[type] / SUM(absorptionWeight)
damageToType = totalDamage * shareOfDamage[type]
unitsKilled[type] = FLOOR(damageToType / unitHP[type])
```

> **v2:** Replaces the old flat loss percentages. Slow tanky units (Shieldbearers) absorb more damage, protecting fragile Archers and Scouts behind them. Army composition now matters — a pure Militia stack takes damage evenly, but a mixed army with Shieldbearers in front loses fewer Archers.

**Step 6 — After 3 Rounds, Determine Winner:**
```
attackerSurvivors = SUM(remaining unitCount for attacker)
defenderSurvivors = SUM(remaining unitCount for defender)

if attackerSurvivors > 0 AND defenderSurvivors == 0 → Attacker wins (decisive)
if defenderSurvivors > 0 AND attackerSurvivors == 0 → Defender wins (decisive)
if both > 0 → Compare total remaining HP:
  if attackerHP > defenderHP * 1.2 → Attacker wins (partial)
  if defenderHP > attackerHP * 1.2 → Defender wins (partial)
  else → Draw (both sides retreat)
```

> **v2:** The 1.2x threshold for partial victories prevents razor-thin wins from granting full loot. Close fights end as draws — both sides lick their wounds.

**Step 7 — Loot (attacker wins only):**

Loot scales with the defender's **stored resources** rather than being a flat random range:
```
lootPerResource = FLOOR(defenderStored[resource] * lootPercent)

Decisive victory: lootPercent = 0.10 (10% of stored resources)
Partial victory:  lootPercent = 0.05 (5% of stored resources)
```

Loot is capped by the surviving army's total carry capacity:
```
totalCarry = SUM(survivingCount[type] * unitCarry[type])
```

> **v2:** Old system gave flat 50-200 Food / 30-150 Wood / 20-100 Stone regardless of target wealth. New system is proportional — attacking a rich target is rewarding, but the 10% cap prevents crippling raids. The carry cap also means you need enough surviving troops to haul loot, discouraging suicide rushes. See also: Anti-Snowball loot protections in Section 19.

### Warehouse Protection

The Warehouse building protects a portion of resources from being looted:
```
protectedPercent = MIN(warehouseLevel * 5, 60)
lootableResources[resource] = storedResources[resource] * (1 - protectedPercent / 100)
```

> A L10 Warehouse protects 50% of resources. Max protection is 60% at L12+. The loot formula in Step 7 applies to the *lootable* portion only.

### NPC Garrisons

Unoccupied tiles have NPC defenders: 3-5 Militia + 1-2 Archers. NPC units have 0.8x stats.

---

## 8. World Boss

- One active boss at a time
- Checked every **120 seconds**, spawns after a **10-minute cooldown** from last boss death/despawn
- Despawns after **20 minutes** if not defeated
- Random position: q, r in range [-12, 12]

> **v2:** Boss check interval 60s→120s (halves server load). Added 10-minute cooldown between bosses instead of instant respawn. Despawn extended 15→20 minutes. Players no longer need to watch the boss timer constantly.

### Boss Types

| Boss | Title | HP | ATK | DEF | Rewards |
|---|---|---|---|---|---|
| Veil Titan | Guardian of the Rift | 8,000 | 180 | 120 | Food 4K, Wood 4K, Stone 2.5K, Iron 1.5K, Aether 800 |
| Aether Wyrm | Devourer of Leylines | 5,000 | 300 | 80 | Aether 2.5K, Food 1.5K, Wood 1.5K |
| Shadow Colossus | The Unbound | 3,500 | 400 | 180 | Iron 4K, Stone 4K, Aether 400 |

> **v2:** Boss HP increased significantly (Veil Titan 5K→8K, Aether Wyrm 3K→5K, Shadow Colossus 2K→3.5K). Rewards slightly reduced. Bosses should require multiple players to defeat, encouraging cooperation. A solo player can contribute but shouldn't be able to solo any boss until very late game.

### Damage Formula

```
playerAttackPower = SUM(unitCount * unitATK)
bossDefenseFactor = boss.DEF / (boss.DEF + playerAttackPower)
damageDealt = FLOOR(playerAttackPower * (1 - bossDefenseFactor))
```

### Boss Retaliation (Unit Losses)

```
playerDefensePower = SUM(unitCount * unitDEF)
bossAttackRatio = boss.ATK / (boss.ATK + playerDefensePower)
damageToArmy = FLOOR(boss.ATK * bossAttackRatio * 0.35)
```

Damage distributed to units by inverse speed (same as PvP combat Step 5):
```
unitsLost[type] = FLOOR(damageToArmy * shareOfDamage[type] / unitHP[type])
```

> **v2:** Boss retaliation now uses the HP-based damage distribution instead of flat percentage. Bringing Shieldbearers to tank boss hits is now a real strategy.

Surviving units return to settlement after the attack.

### Reward Distribution

Proportional to damage dealt by each attacker:
```
playerReward[resource] = FLOOR(totalReward[resource] * (playerDamage / totalDamage))
```

**Minimum participation reward**: Any player dealing at least 5% of total damage receives a guaranteed minimum of 10% of the total reward pool (in addition to their proportional share, capped at their proportional share + 10%).

> **v2:** Minimum participation reward prevents top players from getting 95% of boss loot. Encourages mid-game players to participate even if they can't compete with endgame armies.

---

## 9. Marches

### March Types

| Type | Description |
|---|---|
| Attack | Engage in combat at destination. Survivors return. |
| Scout | Travel to destination and immediately return. No combat. |
| Reinforce | Travel to destination and stay. |
| Raid | Fast strike — reduced carry capacity (50%), faster travel (1.3x speed), cannot capture tiles. |

> **v2:** Added Raid march type. Gives aggressive players a fast-strike option with tradeoffs. You can harass, but you can't carry much loot or hold territory.

### Travel Time

```
baseTimePerHex = 30 seconds
marchSpeedMultiplier = factionSpeedMultiplier * (1 + logisticsLevel * 0.05) * heroSpeedBonus
travelTime = CEIL(hexDistance * baseTimePerHex / marchSpeedMultiplier)
```

**Minimum travel time**: 15 seconds (prevents instant-teleport exploits with high speed stacking).

> **v2:** Made the formula explicit with all multipliers. Added minimum travel time floor.

**Hex Distance** (cube coordinates):
```
distance = MAX(|q1-q2|, |r1-r2|, |s1-s2|)
```

### March Limits

- **Max concurrent marches**: 2 per settlement (3 with Logistics research level 8+)
- **March recall**: A marching army can be recalled at any time. It returns in 50% of original travel time.

---

## 10. Map & Terrain

- **Grid**: 800 x 800 hexagonal, cube coordinates (q + r + s = 0)
- **New players spawn**: q, r in range [-10, 10]

### Terrain Types

Generated deterministically by coordinates:

| Terrain | Probability |
|---|---|
| Plains | 50% |
| Forest | 20% |
| Mountain | 10% |
| Ruins | 10% |
| Desert | 10% |

Ruin tiles contain Aether Stone deposits (richness 1-5).

### Terrain Combat Modifiers

| Terrain | Attacker Modifier | Defender Modifier |
|---|---|---|
| Plains | 1.0x | 1.0x |
| Forest | 0.95x | 1.10x |
| Mountain | 0.85x | 1.20x |
| Ruins | 1.0x | 1.0x |
| Desert | 1.05x | 0.95x |

> **v2:** Terrain now affects combat. Attacking into mountains is punishing. Forest gives defenders a modest edge. Desert slightly favors the attacker. This adds positional strategy to the map.

### Map Zones (by distance from center)

| Zone | Distance Range | Description |
|---|---|---|
| Sovereign Ring | 0-15% | Center of the map, highest danger |
| Wound Zones | 15-35% | Corrupted territory |
| Fractured Provinces | 35-60% | Mid-tier contested areas |
| Contested Reaches | 60-80% | Active PvP zones |
| Hearthlands | 80-100% | Outer edges, safest |

### Map Vision

```
visionRadius = 3 (base) + scoutTowerLevel * 2 + cartographyLevel * 1
```

Marching armies provide +1 hex vision around their current position.

### Map Events

- **Max active events**: 15
- **Spawn rate**: 1 event per 2-3 minutes (randomized)
- **Lifetime**: 45 minutes

> **v2:** Max events reduced from 20 to 15, spawn rate slowed from "1-3 per minute" to "1 per 2-3 minutes", lifetime extended from 30 to 45 minutes. The old rate created constant event spam that pressured players to check the map every minute. New cadence means fewer but longer-lasting events — you can come back in 15 minutes and still find opportunities.

| Event Type | Probability | Guardians | Rewards |
|---|---|---|---|
| Ruin | 40% | 3-5 Militia | Food 100-400, Wood 100-250, Stone 50-150 |
| Resource Node | 30% | None | 1 random resource: 150-600 |
| NPC Camp | 20% | 5-8 Militia, 2-4 Archers | Food 150-500, Wood 100-350, Iron 50-150 |
| Aether Surge | 10% | None (auto-claim) | Aether Stone 30-150 |

> **v2:** Reward ranges reduced ~20%. The old ranges were set before the economy was balanced — events were giving away more than 30 minutes of production, which devalued building upgrades.

---

## 11. Alliances

- **Max Members**: 50
- **Name Length**: 3-30 characters
- **Tag Length**: 2-5 characters

### Roles

| Role | Permissions |
|---|---|
| Leader | All permissions, transfer leadership, disband |
| Officer | Invite, kick members, manage diplomacy |
| Member | Basic participation |

### Diplomacy Types

| Type | Description |
|---|---|
| Alliance | Full military cooperation |
| NAP (Non-Aggression Pact) | No attacks between members |
| War | Active hostilities |

**Diplomacy flow**: Pending -> Active / Rejected

### Alliance Power

```
power = SUM(memberPowerScores)
```

### Alliance Contribution & Benefits

Members earn **Alliance Points (AP)** through:
- Donating resources: 1 AP per 100 resources donated
- Participating in world boss kills: 10 AP per boss kill
- Winning PvP battles: 5 AP per victory

**Alliance benefits** (unlocked by total alliance AP):
| AP Threshold | Benefit |
|---|---|
| 500 | +2% resource production for all members |
| 2,000 | +1 max march slot for all members |
| 5,000 | Alliance-wide trade fee reduction (no marketplace requirement between members) |
| 10,000 | +3% attack and defense for all members |

> **v2:** New system. Alliances were just labels before — now they have progression. Benefits are modest enough that solo play remains viable, but cooperation is rewarded.

---

## 12. Seasonal Events

Three events rotate on a **staggered cadence**. Each event lasts **30 minutes**, followed by a **15-minute rest period** before the next event begins.

> **v2:** Old cycle was 10 minutes per event with zero gap. That's an event every 10 minutes, 6 per hour — exhausting. New cadence: 30 min active + 15 min rest = 45 min cycle, ~1.3 events per hour. Players can realistically engage with 1-2 events per play session.

### Harvest Moon Festival

- **Bonus**: +30% resource production (1.3x multiplier)
- **Objective**: Gather 3,000 total resources
- **Reward**: Aether Stone 350

### Aether Storm

- **Bonus**: Research time reduced by 30% (0.7x multiplier)
- **Objective**: Build or upgrade 3 buildings
- **Reward**: Food 800 / Wood 800 / Stone 400

### Ironclad Tournament

- **Bonus**: Training costs -20% (0.8x multiplier)
- **Objective**: Train 25 military units
- **Reward**: Aether Stone 200 + 120 XP to first hero

> **v2:** Event bonuses tightened: Harvest Moon 50%→30%, Aether Storm 50%→30%, Ironclad 25%→20%. Rewards reduced ~30%. Objectives slightly adjusted. Events should be a nice boost, not a mandatory grind-or-fall-behind mechanic.

---

## 13. Quests

### Story Quests (15 sequential)

| # | Title | Phase | Objective | Key Rewards |
|---|---|---|---|---|
| 1 | A Full Stomach | 1 | Build Gathering Post | Food 100, Wood 50 |
| 2 | Walls of Hope | 1 | Build Palisade Wall | Wood 100, Stone 80 |
| 3 | Timber and Stone | 1 | Build Woodcutter Lodge | Food 80, Wood 120 |
| 4 | Strengthen the Core | 2 | Town Center level 2 | Food 200, Wood 200, Stone 150 |
| 5 | Deep Foundations | 2 | Build Stone Quarry | Stone 150, Iron 50 |
| 6 | Iron Will | 2 | Build Iron Mine | Iron 150, Food 100 |
| 7 | Idle Hands | 2 | Build Militia Barracks | Food 150, Wood 100, Iron 80 |
| 8 | First Swords | 2 | Train 5 Militia | Food 200, Iron 100 |
| 9 | Eyes on the Horizon | 3 | Build Scout Tower | Wood 150, Stone 100 |
| 10 | The Blue Glow | 3 | Build Aether Extractor | Aether 50, Iron 100 |
| 11 | The Stranger's Oath | 3 | Build Hero Hall | Food 200, Wood 200, Stone 150, +100 XP |
| 12 | Knowledge is Power | 3 | Research Agriculture | Food 300, Wood 150 |
| 13 | The Heart of Command | 4 | Town Center level 3 | Food 500, Wood 500, Stone 300, Iron 200, Aether 50 |
| 14 | A Standing Army | 4 | Have 20 total units | Food 400, Iron 200, +150 XP |
| 15 | The Elder's Secret | 4 | Town Center level 4 | Food 1K, Wood 1K, Stone 500, Iron 300, Aether 100, +300 XP |

### Milestone Quests (Achievements)

| Title | Objective | Key Rewards |
|---|---|---|
| Fledgling Town | 5 different buildings | Food 200, Wood 200 |
| Growing Settlement | 10 different buildings | Food 500, Wood 500, Stone 300 |
| Small Warband | 10 garrisoned units | Food 200, Iron 100 |
| Standing Army | 50 garrisoned units | Food 500, Iron 300, Aether 30 |
| Military Power | 100 garrisoned units | Food 1K, Iron 500, Aether 80, +200 XP |
| Resourceful | 5,000 total resources | Food 300, Wood 300 |
| Prosperous | 25,000 total resources | Food 800, Wood 800, Stone 500, Iron 300 |
| Overflowing Coffers | 100,000 total resources | Food 2K, Wood 2K, Stone 1K, Iron 500, Aether 200, +500 XP |
| Established Power | TC level 3 | Aether 50, Iron 200 |
| Capital City | TC level 5 | Food 3K, Wood 3K, Stone 2K, Iron 1K, Aether 500, +1000 XP |
| First March | Send first army | Food 150, Iron 80, +50 XP |
| Explorer | Send first scout | Wood 150, Stone 100 |
| Scholar | Complete 3 researches | Aether 30, Iron 150, +100 XP |

### Daily Quests

- 3 quests per day, regenerated at UTC midnight
- Scale with Town Center level: `scaleFactor = 1 + (tcLevel - 1) * 0.3`
- Types: Gather resources, Train units, Upgrade buildings, Research
- TC level 3+: Bonus XP reward

> **v2:** Daily quest scale factor reduced from 0.4 to 0.3 per TC level. At TC5 this means 2.2x difficulty instead of 2.6x — high-TC players were penalized too heavily.

---

## 14. Hero Quests

Heroes can be sent on solo quests while idle.

| Quest Type | Duration | Difficulty | XP Range | Rewards | Special |
|---|---|---|---|---|---|
| Exploration | 90s | 1 | 30-80 XP | Food 20-80, Wood 10-50 | - |
| Training | 120s | 2 | 60-120 XP | Iron 10-40 | - |
| Relic Hunt | 180s | 3 | 100-200 XP | Stone 30-80, Iron 20-60 | 20% equipment drop |
| Veil Expedition | 300s | 3 | 150-300 XP | Aether 20-80 | 30% lore fragment |

> **v2:** All durations increased ~50% (Exploration 60→90s, Training 90→120s, Relic Hunt 120→180s, Veil Expedition 180→300s). The old timings required checking every 1-2 minutes. New timings let players send heroes on quests and come back in 3-5 minutes.

### Success Chance

```
successChance = CLAMP(0.55 + hero.level * 0.025 + hero.agility * 0.01 - difficulty * 0.10, 0.20, 0.95)
```

> **v2:** Base reduced from 0.60 to 0.55, per-level from 0.03 to 0.025. Added floor of 0.20 (was implicitly possible to go negative). Low-level heroes now feel riskier on hard quests — failure is part of the hero progression story.

On failure, the hero returns idle with no rewards.

### Lore Fragments (from Veil Expeditions)

8 collectible fragments revealing the world's backstory:

1. *"...and the world shattered into six, each shard a kingdom unto itself..."*
2. *"The Veil is not a barrier. It is a wound."*
3. *"Those who drink deeply of the aether shall see beyond the veil, but never return whole."*
4. *"Day 47. The towers still hum. I hear voices in the stones."*
5. *"When the six factions unite, the Veil shall mend - or consume all."*
6. *"The Aether Wyrm sleeps beneath the convergence. Do not wake it."*
7. *"Before the Veilfall, there was one world. One people. One song."*
8. *"The shadow colossus rises when hope fades. Feed it despair and it grows."*

---

## 15. Spy System

**Requires**: Spy Guild building

### Mission Types

| Type | Base Success | Per Attacker Spy Lvl | Cap | Per Defender Spy Lvl | Cost |
|---|---|---|---|---|---|
| Intel | 65% | +4% | 90% | -8% | Food 100, Iron 50 |
| Sabotage | 45% | +4% | 75% | -8% | Food 150, Iron 80 |

> **v2:** Intel base 70→65%, cap 95→90%. Sabotage base 50→45%, cap 80→75%. Per-level reduced from 5%→4% (attacker) and 10%→8% (defender). Sabotage cost increased. Espionage was too reliable — a L5 spy guild guaranteed Intel success. Now it requires real investment to reach high reliability. Sabotage cap of 75% means it always carries risk, as it should for such a powerful ability.

**Travel Time**: `hexDistance * 15 seconds`

### Intel Success

Returns full snapshot: target's resources, buildings (type + level), and units.

### Sabotage Success

Reduces a random building's level by 1 (minimum level 1). **Cannot target Town Center.** Cooldown: **4 hours** against the same target.

> **v2:** Added TC protection (losing a TC level is devastating and un-fun) and 4-hour cooldown to prevent sabotage spam against one player.

### Caught

Mission fails. Defender receives notification: *"An enemy spy was caught."* Includes the attacker's player name (but not alliance).

---

## 16. Marketplace & Trade

**Requires**: Marketplace building in both seller and buyer settlements.

### Mechanics

1. **List Offer**: Specify resource to sell, amount, resource requested, amount requested. Sold resources are escrowed immediately.
2. **Accept Offer**: Buyer pays requested resources, receives offered resources. Seller gets buyer's payment.
3. **Cancel Offer**: Escrowed resources returned to seller.
4. Cannot trade a resource for itself.
5. **Max active offers per player**: 5
6. **Offer expiry**: 24 hours (escrowed resources returned automatically)

> **v2:** Added offer limit (5) and 24hr expiry. Prevents marketplace spam and stale offers clogging the system.

### Trade Rate Guardrails

To prevent exploitative trades (e.g., 1 Food for 10,000 Aether):
```
maxRatio = 10:1 (no offer can request more than 10x what it gives, by base-value equivalent)
```

Base resource values for ratio calculation: Food=1, Wood=1, Stone=1.5, Iron=2, Aether=6.

---

## 17. Daily Rewards

7-day reward cycle. Missing a day resets the streak to Day 1.

| Day | Rewards |
|---|---|
| 1 | Food 200, Wood 200 |
| 2 | Stone 250, Iron 150 |
| 3 | Food 400, Wood 400, Stone 200 |
| 4 | Aether Stone 80 |
| 5 | Food 600, Wood 600, Stone 400, Iron 200 |
| 6 | Aether Stone 150 |
| 7 | Food 800, Wood 800, Stone 500, Iron 350, Aether 250 |

> **v2:** Rewards reduced ~15-20% across the board. Day 7 was giving more than an hour of mid-game production for free — still generous but no longer inflationary. The streak mechanic remains the primary retention hook.

After Day 7, the cycle resets to Day 1. Rewards are deposited to the player's first settlement.

---

## 18. Leaderboard & Power Score

### Individual Power

```
power = (totalBuildingLevels * 80)
      + (totalUnits * 12)
      + (totalResearchLevels * 60)
      + FLOOR(totalResources / 150)
      + (heroLevelsSum * 20)
```

> **v2:** Reworked power formula. Old formula double-counted settlements and ignored research/heroes. New formula weights permanent progress (buildings, research, heroes) more heavily than transient assets (resources, disposable units). This means raiding someone doesn't tank their power score as badly, reducing grief incentive.

### Ranking Categories

- **Power** (overall score)
- **Settlements** (count)
- **Military** (unit count)
- **Buildings** (total levels)
- **Research** (total levels)

### Alliance Power

Sum of all member power scores.

---

## 19. New Player Protection & Anti-Snowball

### Beginner Shield

- **Shield Duration**: 72 hours after account creation
- During shield: Cannot be attacked by other players
- **Shield breaks early** if the player initiates a PvP attack

> **v2:** Added shield-break on aggression. A shielded player shouldn't be able to attack others risk-free.

### Post-Shield Graduated Protection

After the beginner shield expires, players receive **graduated protection** based on their settlement age:

| Settlement Age | Protection Level |
|---|---|
| 72h - 120h (Day 3-5) | Max 3 attacks received per day from any single player |
| 120h - 240h (Day 5-10) | Max 5 attacks received per day from any single player |
| 240h+ (Day 10+) | No per-player attack limit |

> **v2:** Entirely new system. The old 72h shield was a cliff — you went from full protection to zero. Graduated protection gives new players breathing room to recover from their first losses.

### Power Bracket Raid Penalties

When attacking a significantly weaker player, loot is reduced:
```
powerRatio = attackerPower / defenderPower

if powerRatio > 5.0:  loot reduced to 20% (barely worth the march time)
if powerRatio > 3.0:  loot reduced to 50%
if powerRatio > 2.0:  loot reduced to 75%
if powerRatio <= 2.0: full loot (100%)
```

> **v2:** New system. Prevents top players from farming inactive or weak players for easy resources. If you're 5x stronger than your target, you get almost nothing — go fight someone your size.

### Diminishing Raid Returns

Repeated raids against the same target yield diminishing rewards:
```
raidCount = number of times you've attacked this target in the last 24 hours

multiplier:
  1st attack: 100%
  2nd attack: 60%
  3rd attack: 30%
  4th+ attack: 10%
```

Resets at UTC midnight.

> **v2:** New system. Prevents repeatedly hitting the same player. After 2-3 raids, it's no longer worth the army losses.

### Revenge Cooldown

After being raided, the defender can launch **one revenge attack** within 6 hours that ignores the diminishing returns system (always 100% loot). Only one revenge slot is available at a time.

### Settlement Rebuild Aid

If a player's **total power drops below 50% of their peak power** (checked once per hour), they receive a temporary **Rebuild Shield** lasting 4 hours. This can trigger at most once per 48 hours.

> **v2:** Safety net for players who get catastrophically raided. Prevents permanent death spirals where a raided player can never recover because they keep getting hit.

---

## 20. Game Loop Tick Rates

| System | Interval | Notes |
|---|---|---|
| Economy (resource production) | 15 seconds | |
| Building queue | 5 seconds | |
| Training queue | 5 seconds | |
| Research queue | 5 seconds | |
| March movement | 10 seconds | Position updated |
| March combat resolution | On arrival | Not polled — triggered when march reaches destination |
| Spy missions | 10 seconds | |
| Aether cycle | 15 seconds | Phase transitions only |
| Map event spawner | 120 seconds | |
| World boss check | 120 seconds | |
| Seasonal event rotation | 30 seconds | Check only, not a full rotation |
| Hero quest check | 10 seconds | |
| Anti-snowball checks | 3600 seconds | Power-drop rebuild shield |
| Supabase sync | 30 seconds | Existing — unchanged |

> **v2:** Major tick rate overhaul for server sustainability:
> - Economy: 10s→15s (reduces DB writes by 33% with negligible player impact)
> - Build/Train/Research queues: 2s→5s (the old 2s was needlessly aggressive — a 5s check means at most 5s delay on completion, imperceptible for builds that take minutes)
> - March: 5s→10s for position updates. **Combat is now event-driven** (triggers on arrival) instead of polled — eliminates wasted combat checks for non-arrived marches
> - Spy: 5s→10s
> - Map events: 60s→120s (matches reduced spawn rate)
> - World boss: 60s→120s
> - Seasonal: 15s→30s (events last 30 min, checking every 30s is more than sufficient)
> - Hero quests: 5s→10s
>
> **Total tick reduction**: From 11 systems × fast intervals to wider spacing. Rough estimate: ~40% reduction in per-second server operations. For 1,000 concurrent players, this is the difference between needing 2 servers and 1.

---

## Balance Change Summary

### Safe to Keep
- **Faction identity and lore**: Factions, heroes, classes, abilities, lore fragments — all preserved
- **Core game loop**: Build → Train → March → Research → Upgrade cycle unchanged
- **Quest structure**: All 15 story quests and 13 milestone quests kept as-is
- **Map layout**: 800x800 hex grid, zones, terrain types, vision formula — all preserved
- **Alliance structure**: Roles, diplomacy types, 50-member cap — unchanged
- **Marketplace mechanics**: Core buy/sell/cancel flow preserved

### Lightly Adjusted
- **Faction multipliers**: Tightened from ±25-30% to ±8-20%. *Why*: Prevents hard faction tiering where one faction dominates a strategy. *Improves*: Faction pick diversity and matchup fairness.
- **Starting resources**: Food/Wood 500→800, Stone 300→400. *Why*: First 10 minutes were resource-starved, causing new-player churn. *Improves*: Onboarding smoothness.
- **Resource production**: Linear→sub-linear (`level^0.85`). *Why*: L20 buildings produced 20x base, flooding late-game economies. *Improves*: Long-term resource scarcity remains meaningful.
- **Research effects**: +10%→+8% per level for resource techs. *Why*: Compounded with building production, maxed research gave absurd yields. *Improves*: Late-game resource balance.
- **Hero XP curve**: Flat→gentle exponential. *Why*: L30 heroes were reachable too quickly; hero leveling lost meaning by mid-game. *Improves*: Heroes feel like long-term investments.
- **Hero combat bonus**: 0.02/level→0.015/level, stat divisor 2→3. *Why*: Max heroes were adding +60%+ to armies, overshadowing army composition. *Improves*: Armies matter more than hero level alone.
- **Ability values**: Shield Wall, Mana Shield, Shadow Strike, Trade Mastery all reduced 15-25%. *Why*: Stacked with hero bonuses, these were too swingy. *Improves*: More predictable combat outcomes.
- **Spy system**: Success rates reduced, sabotage capped at 75%, added TC protection and cooldown. *Why*: Sabotage spam was griefing; intel was nearly guaranteed. *Improves*: Espionage is strategic, not routine.
- **Event rewards**: Reduced ~20-30% across map events, seasonal events, daily rewards. *Why*: Free resources exceeded production value, devaluing buildings. *Improves*: Building investment feels worthwhile.
- **Event cadence**: 10-min events→30-min with 15-min rest; map events spawn slower, last longer. *Why*: Event fatigue — constant timers punished casual play. *Improves*: Session rhythm without FOMO pressure.
- **Hero quest durations**: All increased ~50%. *Why*: 60-second quests required constant micro-management. *Improves*: Reduced timer anxiety.
- **Daily quest scaling**: 0.4→0.3 per TC level. *Why*: High-TC players were penalized with unreasonable daily objectives. *Improves*: Daily engagement across all levels.

### Heavily Reworked
- **Building cost scaling**: `baseCost * level` → `baseCost * 1.18^(level-1)`. *Why*: Linear scaling made L10 feel identical to L5 in pacing. Exponential creates distinct early/mid/late phases. *Improves*: Progression pacing — early game is faster, late game is meaningfully slower.
- **Building time scaling**: `baseTime * level * 0.8` → `baseTime * (1 + (level-1)*0.6 + (level-1)^1.4 * 0.08)`. *Why*: Old formula was essentially linear and boring. New formula creates natural session breaks at L12+ without L20 taking absurdly long. *Improves*: Session rhythm and upgrade anticipation.
- **Combat system**: Single-pass ratio → 3-round HP-based with counter system. *Why*: Old combat was "bigger number wins, always." No composition decisions, no tactical depth. *Improves*: Army composition matters, mixed armies beat mono-stacks, Shieldbearers have a real role, terrain matters.
- **Loot system**: Flat random range → percentage of defender's stored resources with Warehouse protection. *Why*: Old loot was disconnected from target value and had no protection mechanics. *Improves*: Raiding is proportional and predictable; warehouses are worth upgrading.
- **Anti-snowball protections**: 72h shield only → full suite (graduated protection, power bracket penalties, diminishing raid returns, revenge cooldown, rebuild shield). *Why*: A single shield was grossly insufficient. Strong players could permanently suppress weaker ones. *Improves*: Player retention, comeback viability, PvP fairness.
- **World boss**: Instant respawn → 10-min cooldown, higher HP, participation rewards. *Why*: Permanent boss presence was server-taxing and rewarded always-online play. Higher HP forces cooperation. *Improves*: Boss events feel like events, not background noise.
- **Tick rates**: Aggressive 2-5s polling → 5-15s with event-driven combat. *Why*: Server sustainability. 2s queue checks for builds that take minutes is wasted computation. *Improves*: ~40% reduction in server operations with zero player-perceptible difference.
- **Power score formula**: Reworked to weight permanent progress over transient resources. *Why*: Old formula let raiders tank victims' scores by stealing resources, creating grief spirals. *Improves*: Power reflects true strength, not current bank balance.
- **Alliance benefits**: Added AP-based progression system. *Why*: Alliances were cosmetic-only with no mechanical incentive. *Improves*: Cooperation is rewarded; alliances have goals.
- **Trade guardrails**: Added 10:1 ratio cap, 5 offer limit, 24h expiry. *Why*: Unregulated marketplace enables RMT, scams, and market manipulation. *Improves*: Fair trading ecosystem.
- **Aether cycle**: Binary on/off → 4-phase curve. *Why*: 2-minute spike every 7 minutes forced players to time-camp for optimal Aether. *Improves*: Wider window of elevated yield, less timing pressure.
- **Unit HP + army cap**: Units now have HP; max 200 units per march. *Why*: HP enables the round-based combat system. Army cap prevents deathball meta where one massive army is unbeatable. *Improves*: Strategic force distribution, multi-front warfare.

---

## Production Balancing Notes

### Expected Early-Game Session Rhythm (First 3 Days)

| Timeframe | Player Activity | Session Length |
|---|---|---|
| 0-30 min | Tutorial quests (Phase 1-2), build first 4-5 buildings, train first units | 15-25 min |
| 30 min - 4h | TC2 upgrade, unlock mid-tier buildings, first scout march | 5-10 min check-ins |
| 4h - 24h | TC3 push, Hero Hall, first hero quests, marketplace opens | 10-15 min sessions, 3-4x/day |
| 24h - 72h | First PvP scouting (still shielded), alliance joining, world boss attempts | 2-3 sessions, 15 min each |

**Target**: Player reaches TC3 within 24 hours of active play (not 24h clock time). TC4 by end of first week. TC5 requires 2+ weeks of active play.

### Expected Mid-Game Pressure Points (Week 1-3)

- **Shield expiry (72h)**: First vulnerability moment. Graduated protection softens this. Players who haven't built walls will learn quickly.
- **TC4 push**: Resource demands jump significantly. Players must choose: upgrade buildings, train army, or research. Can't do all three simultaneously.
- **Second settlement (TC3+ required)**: Major commitment that splits attention. Players who expand too early get stretched thin.
- **Alliance politics**: By week 2, alliances are forming and breaking. Diplomacy becomes a real factor.

### Anti-Snowball Protection Summary

| Protection | Trigger | Effect |
|---|---|---|
| Beginner Shield | Account creation | 72h immunity (breaks on attack) |
| Graduated Protection | Post-shield, Day 3-10 | Per-player attack limits |
| Power Bracket Penalties | Attacker >2x defender power | Loot reduced 25-80% |
| Diminishing Raid Returns | Repeat attacks on same target | Loot drops to 10% after 3rd hit |
| Warehouse Protection | Warehouse building | 5% per level, up to 60% resource protection |
| Revenge Cooldown | After being raided | One full-loot counterattack within 6h |
| Rebuild Shield | Power drops below 50% of peak | 4h shield, max once per 48h |
| Army Cap | Always active | 200 units per march prevents deathball |
| Wall Bonus | Defending at home | Up to +100% defense from walls |

### Parts That Still Require Playtesting

1. **Cost curve inflection point (L12-L15)**: The 1.18 exponential base is a best guess. If L15 feels too gated, lower to 1.15. If players rush to L20 too quickly, raise to 1.20. Monitor median time-to-L15 across the first 2 weeks.
2. **Counter system balance**: The +30%/-20% counter values may need tuning. If Shieldbearers become auto-include (likely), reduce their counter bonus to +20%. If Siege Rams remain unused in PvP, increase their wall bonus.
3. **World boss HP values**: Tuned for ~5-10 players attacking cooperatively. If median participation is lower, reduce HP. If bosses die in under 5 minutes, increase.
4. **Power bracket thresholds**: The 2x/3x/5x power ratios are theoretical. Real-world power distributions may cluster differently — adjust thresholds based on actual population data.
5. **Seasonal event 30-minute duration**: May be too long for aggressive players or too short for casual ones. Monitor completion rates — if <30% of active players complete objectives, shorten duration or ease objectives.
6. **Aether cycle 4-phase timing**: New 15-minute cycle untested. Monitor whether players still camp Aether or if the wider window achieves its goal.
7. **Trade ratio guardrails (10:1)**: May be too strict or too loose depending on actual resource valuations. Track marketplace rejection rates.
8. **Alliance AP thresholds**: Purely theoretical. The +1 march slot at 2,000 AP is very powerful — monitor how quickly alliances reach it and whether it creates alliance-size pressure.

### Telemetry/Events to Track After Launch

**Economy health:**
- `resource_production_rate` — per player, per resource, per hour (detect inflation)
- `resource_stockpile_distribution` — histogram of resource holdings (detect hoarding or scarcity)
- `building_upgrade_completion` — distribution of building levels over time (verify pacing curve)
- `marketplace_trade_volume` — daily trade volume by resource (detect dead or hyperactive markets)

**Combat health:**
- `combat_outcome_distribution` — win/loss/draw rates by power bracket (verify fairness)
- `army_composition` — what unit mixes players use (detect mono-stack meta)
- `raid_loot_per_attack` — average loot per raid (detect over/under-reward)
- `casualties_per_combat` — average loss rates (detect if combat is too lethal or too safe)

**Retention health:**
- `session_length_distribution` — track if sessions are healthy 10-20 min or anxiety-driven 60+ min
- `shield_expiry_churn` — % of players who quit within 48h of shield expiry (critical metric)
- `daily_reward_streak` — average streak length (target: 4+ days)
- `event_participation_rate` — % of online players engaging with seasonal events
- `comeback_rate` — % of players who recover from >30% power loss within 7 days

**Server health:**
- `tick_processing_time` — per-tick execution duration (detect performance degradation)
- `concurrent_player_count` — peak and average (capacity planning)
- `supabase_sync_latency` — flush duration (detect DB bottlenecks)
- `march_count_active` — concurrent marches (memory/CPU scaling)

---

*VEILFALL: Echoes of the Sky Rupture - The Veil is not a barrier. It is a wound.*
